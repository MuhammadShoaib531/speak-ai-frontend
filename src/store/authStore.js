import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../api/axiosInstance';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      token: null,
      _axiosInterceptorId: null,

      _attachInterceptor: () => {
        const { _axiosInterceptorId } = get();
        if (_axiosInterceptorId != null) return;

        const id = api.interceptors.response.use(
          (res) => res,
          (error) => {
            const status = error?.response?.status;
            const url = error?.config?.url || '';

            const authPaths = [
              '/auth/token',
              '/auth/signup',
              '/auth/verify-otp',
              '/auth/resend-otp',
              '/auth/forgot-password',
              '/auth/reset-password',
            ];
            const isAuthEndpoint = authPaths.some((p) => url.includes(p));

            if (status === 401 && get().isAuthenticated && !isAuthEndpoint) {
              get().logout({ redirect: true, reason: 'expired' });
            }

            return Promise.reject(error);
          }
        );

        set({ _axiosInterceptorId: id });
      },

      init: async () => {
        const token =
          get().token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);

        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          set({ token, isAuthenticated: true });
        }

        get()._attachInterceptor();

        if (token) {
          try {
            const res = await api.get('/auth/me');
            set({ user: res.data, isAuthenticated: true });
          } catch {
            get().logout({ redirect: false });
          }
        }
      },

      login: async ({ email, password }) => {
        set({ isLoading: true });
        try {
          const params = new URLSearchParams();
          params.append('username', email);
          params.append('password', password);

          const res = await api.post('/auth/token', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          });

          const token = res.data.access_token;
          if (typeof window !== 'undefined') localStorage.setItem('token', token);
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

          get()._attachInterceptor();

          const profileRes = await api.get('/auth/me');
          set({
            user: profileRes.data,
            token,
            isAuthenticated: true,
            isLoading: false,
          });

          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          const status = error?.response?.status;
          const msg =
            error?.response?.data?.message ||
            error?.response?.data?.detail ||
            error?.message ||
            'Invalid email or password';
          const codeFromApi = error?.response?.data?.code;

          const looksUnverified =
            codeFromApi === 'ACCOUNT_NOT_VERIFIED' ||
            /not\s*verified|verify\s*otp|account\s*not\s*verified/i.test(msg);

          if ((status === 400 || status === 401 || status === 403) && looksUnverified) {
            return {
              success: false,
              code: 'ACCOUNT_NOT_VERIFIED',
              error: 'Account not verified',
              email,
            };
          }

          return { success: false, code: 'GENERIC_ERROR', error: msg };
        }
      },

      register: async (userData) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/auth/signup', userData);

          const token = res.data?.token || res.data?.access_token;
          const user = res.data?.user;

          if (token) {
            if (typeof window !== 'undefined') localStorage.setItem('token', token);
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            get()._attachInterceptor();
            set({
              user,
              token,
              isAuthenticated: true,
              isLoading: false,
            });
            return { success: true, otpRequired: false };
          }

          set({ isLoading: false });
          return { success: true, otpRequired: true, email: userData.email };
        } catch (error) {
          set({ isLoading: false });
          const errMsg =
            error?.response?.data?.message ||
            error?.response?.data?.detail ||
            'Registration failed';
          return { success: false, error: errMsg };
        }
      },

      verifyOtp: async ({ email, otp_code }) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/auth/verify-otp', { email, otp_code });
          const token = res.data?.access_token || res.data?.token;

          if (token) {
            if (typeof window !== 'undefined') localStorage.setItem('token', token);
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          }

          get()._attachInterceptor();

          const user = res.data?.user || (await api.get('/auth/me')).data;
          set({
            user,
            token,
            isAuthenticated: !!token,
            isLoading: false,
          });

          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          return {
            success: false,
            error:
              error?.response?.data?.message ||
              error?.response?.data?.detail ||
              'OTP verification failed',
          };
        }
      },

      resendOtp: async ({ email }) => {
        try {
          await api.post('/auth/resend-otp', { email });
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error:
              error?.response?.data?.message ||
              error?.response?.data?.detail ||
              'Failed to resend OTP',
          };
        }
      },

      forgotPassword: async ({ email }) => {
        set({ isLoading: true });
        try {
          await api.post('/auth/forgot-password', { email });
          set({ isLoading: false });
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          return {
            success: false,
            error:
              error?.response?.data?.message ||
              error?.response?.data?.detail ||
              'Failed to send reset email',
          };
        }
      },

      resetPassword: async ({ email, otp_code, new_password, confirm_new_password }) => {
        set({ isLoading: true });
        try {
          await api.post('/auth/reset-password', {
            email,
            otp_code,
            new_password,
            confirm_new_password,
          });
        set({ isLoading: false });
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          return {
            success: false,
            error:
              error?.response?.data?.message ||
              error?.response?.data?.detail ||
              'Password reset failed',
          };
        }
      },

      updatePassword: async ({ current_password, new_password, confirm_password }) => {
        set({ isLoading: true });

        const body = { current_password, new_password, confirm_password };
        try {
          await api.request({ method: 'put', url: '/auth/update-password', data: body });
          set({ isLoading: false });
          return { success: true };
        } catch (err) {
          if (err?.response?.status === 405) {
            try {
              await api.request({ method: 'post', url: '/auth/update-password', data: body });
              set({ isLoading: false });
              return { success: true };
            } catch (e2) {
              set({ isLoading: false });
              return {
                success: false,
                error:
                  e2?.response?.data?.message ||
                  e2?.response?.data?.detail ||
                  'Password update failed',
              };
            }
          }
          set({ isLoading: false });
          return {
            success: false,
            error:
              err?.response?.data?.message ||
              err?.response?.data?.detail ||
              'Password update failed',
          };
        }
      },

      logout: ({ redirect = false, reason = '' } = {}) => {
        try {
          if (typeof window !== 'undefined') localStorage.removeItem('token');
        } catch {}
        delete api.defaults.headers.common['Authorization'];

        const id = get()._axiosInterceptorId;
        if (typeof id === 'number') {
          try {
            api.interceptors.response.eject(id);
          } catch {}
        }

        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          _axiosInterceptorId: null,
        });

        if (redirect) {
          let url = '/login';
          if (reason) url += `?reason=${reason}`;
          window.location.href = url;
        }
      },

      isSuperAdmin: () => get().user?.role === 'super_admin',
      isAdmin: () => get().user?.role === 'admin',
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;

if (typeof window !== 'undefined') {
  Promise.resolve().then(() => {
    useAuthStore.getState().init();
  });
}
