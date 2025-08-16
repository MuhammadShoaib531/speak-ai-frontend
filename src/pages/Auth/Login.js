import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/authStore';
import {
  EyeIcon,
  EyeSlashIcon,
  EnvelopeIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, resendOtp } = useAuthStore();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    const result = await login(data);

    if (result?.success) {
      toast.success('Welcome back!');
      navigate('/dashboard');
      return;
    }

    if (result?.code === 'ACCOUNT_NOT_VERIFIED') {
      const email = result.email || data.email;
      sessionStorage.setItem('pendingEmail', email);
      try { await resendOtp({ email }); } catch {}
      navigate('/verify-otp', { state: { email, autoSent: true } });
      return;
    }

    toast.error(result?.error || 'Login failed');
  };

  return (
    <div className="max-w-md mx-auto w-full">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-extrabold uppercase tracking-wide bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
          Login
        </h2>
        <p className="mt-1 text-gray-600">
          Sign in to your account to continue
        </p>
      </div>

      <form
        className="space-y-5"
        onSubmit={handleSubmit(onSubmit)}
        aria-busy={isLoading}
      >
        <fieldset disabled={isLoading} className="space-y-5">
          <div>
            <div className="relative">
              <input
                type="email"
                placeholder="Enter your email"
                className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition
                  ${errors.email
                    ? 'border-error-300 ring-error-100'
                    : 'border-primary-200 focus:border-primary-400 ring-primary-100'
                  }`}
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /^\S+@\S+$/i, message: 'Please enter a valid email address' },
                })}
              />
              <EnvelopeIcon
                className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary-800"
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-sm text-error-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                className={`w-full pl-12 pr-12 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition
                  ${errors.password
                    ? 'border-error-300 ring-error-100'
                    : 'border-primary-200 focus:border-primary-400 ring-primary-100'
                  }`}
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 6, message: 'Password must be at least 6 characters' },
                })}
              />
              <LockClosedIcon
                className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary-800"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-md hover:bg-primary-50"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5 text-primary-800" />
                ) : (
                  <EyeIcon className="h-5 w-5 text-primary-800" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-error-600">{errors.password.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-primary-800">
              <input type="checkbox" {...register('rememberMe')} />
              Remember Me
            </label>
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="
              w-full text-white font-semibold py-3 rounded-xl shadow-lg
              transition-transform disabled:opacity-60 disabled:cursor-not-allowed
              flex items-center justify-center gap-2
              bg-primary-700
              focus:outline-none focus:ring-4 focus:ring-primary-200
            "
          >
            {isLoading && <div className="spinner" />}
            <span>{isLoading ? 'Signing in…' : 'Sign In'}</span>
          </button>
        </fieldset>
      </form>

      <div className="text-center mt-8">
        <p className="text-sm text-gray-600">
          Don&apos;t have an account?{' '}
          <Link
            to="/register"
            className="font-semibold text-primary-600 hover:text-primary-700 hover:underline"
          >
            Sign up now
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
