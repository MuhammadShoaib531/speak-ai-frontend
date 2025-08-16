import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../api/axiosInstance';

const pickErr = (e, fallback = 'Something went wrong') => {
  const d = e?.response?.data;
  if (Array.isArray(d?.detail) && d.detail.length) {
    const first = d.detail[0];
    if (typeof first === 'string') return first;
    if (first?.msg) return first.msg;
    if (first?.message) return first.message;
  }
  return d?.detail || d?.message || e?.message || fallback;
};

const appendToFormData = (fd, key, val) => {
  if (val == null) return;
  if (typeof File !== 'undefined' && val instanceof File) { fd.append(key, val); return; }
  if (typeof Blob !== 'undefined' && val instanceof Blob) { fd.append(key, val); return; }
  if (Array.isArray(val)) { val.forEach((v) => appendToFormData(fd, key, v)); return; }
  if (typeof val === 'boolean') { fd.append(key, val ? 'true' : 'false'); return; }
  if (typeof val === 'number' || typeof val === 'string') { fd.append(key, String(val)); return; }
  try { fd.append(key, JSON.stringify(val)); } catch { fd.append(key, String(val)); }
};

const normalizePhone = (s) => {
  const raw = String(s || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/[^\d+]/g, '');
  const hasPlus = digits.startsWith('+');
  const body = digits.replace(/^\+/, '');
  return hasPlus ? `+${body}` : (body ? `+${body}` : '');
};

const unixToISO = (u) => {
  if (u == null || Number.isNaN(Number(u))) return null;
  const ms = Number(u) * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const snake = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, '_');

const normalizePlan = (p) => ({
  name: String(p?.name ?? '').trim(),
  setup_fee: p?.setup_fee ?? null,
  monthly_price: p?.monthly_price ?? null,
  included_minutes: p?.included_minutes ?? null,
  extra_minute_rate: p?.extra_minute_rate ?? null,
  features: (p?.features && typeof p.features === 'object') ? p.features : {},
  id: p?.id ?? null,
  code: p?.code ?? null,
  is_popular: Boolean(p?.is_popular),
  recommended_for: p?.recommended_for ?? '',
  plan: p?.plan ?? null,
});

const preferStatus = (job) => {
  const live = job?.elevenlabs_live_status?.status || '';
  const local = job?.local_record?.updated_status || job?.local_record?.previous_local_status || '';
  return String(live || local || 'pending').toLowerCase();
};

const numbersFrom = (job) => {
  const local = job?.local_record?.total_numbers;
  const live = job?.elevenlabs_live_status?.total_calls_scheduled ?? job?.elevenlabs_live_status?.total_calls_dispatched;
  return local ?? live ?? 0;
};

const createdAtFrom = (job) => job?.local_record?.created_at || unixToISO(job?.elevenlabs_live_status?.created_at_unix) || null;

const withScopeGuard = async (get, set, work) => {
  const scopeId = get().agentsScopeId;
  const res = await work();
  if (get().agentsScopeId !== scopeId) return { success: false, canceled: true };
  return res;
};

const weeklySeriesFrom = (weekly) => {
  const source = Array.isArray(weekly) ? weekly : [];
  const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const toKey = (raw) => {
    const s = String(raw ?? '').trim().toLowerCase();
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      const idx = n >= 1 && n <= 7 ? n - 1 : (n >= 0 && n <= 6 ? n : 0);
      return order[idx];
    }
    if (s.startsWith('mon')) return 'Mon';
    if (s.startsWith('tue')) return 'Tue';
    if (s.startsWith('wed')) return 'Wed';
    if (s.startsWith('thu')) return 'Thu';
    if (s.startsWith('fri')) return 'Fri';
    if (s.startsWith('sat')) return 'Sat';
    if (s.startsWith('sun')) return 'Sun';
    return 'Mon';
  };
  const map = {};
  for (const x of source) {
    const key = toKey(x?.day);
    const calls = Number(x?.calls ?? 0);
    map[key] = (map[key] ?? 0) + (Number.isFinite(calls) ? calls : 0);
  }
  return order.map((d) => ({ day: d, calls: map[d] ?? 0 }));
};

const useAppStore = create(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      currentPage: 'dashboard',
      loading: false,

      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setCurrentPage: (page) => set({ currentPage: page }),
      setLoading: (loading) => set({ loading }),
      setSelectedAgent: (agent) => set({ selectedAgent: agent }),

      agents: [],
      selectedAgent: null,
      adminUserInfo: null,
      agentsLoaded: false,

      agentTypes: [
        { id: 'customer_support', name: 'Customer Support', icon: '🎧' },
        { id: 'appointment_scheduling', name: 'Appointment Scheduling', icon: '📅' },
        { id: 'lead_generation', name: 'Lead Generation', icon: '🎯' },
      ],

      subscriptions: [],
      currentSubscription: null,

      analytics: {
        user_info: null,
        overview: {
          total_calls: 0,
          success_rate: '0%',
          success_rate_value: 0,
          average_call_duration: '0:00',
          average_call_duration_seconds: 0,
          active_agent_count: 0,
        },
        call_patterns: [],
        weekly_performance: [],
        agent_performance: [],
        agent_types: {},
        data_period: null,
      },

      agentOverview: null,
      numbersAnalytics: null,
      agentAnalytics: {},

      usersAdmin: [],
      totalUsersAdmin: 0,
      adminUsersError: '',

      agentsScope: { type: 'self', email: null },
      agentsScopeId: 0,

      batchCalling: {
        jobs: [],
        loading: false,
        error: '',
        total_jobs: 0,
        successful_status_updates: 0,
        failed_status_updates: 0,
        lastFetched: null,
        creating: false,
        createError: '',
        lastCreateResponse: null,
      },

      createBatchCallingJob: async ({
        agent_name,
        call_name,
        csvOrExcelFile,
        phone_column = 'phone',
        scheduled_time = '',
      } = {}) => {
        if (!agent_name) return { success: false, error: 'agent_name is required' };
        if (!call_name) return { success: false, error: 'call_name is required' };
        if (!csvOrExcelFile) return { success: false, error: 'csv_file is required' };

        set((s) => ({
          batchCalling: { ...s.batchCalling, creating: true, createError: '', lastCreateResponse: null },
        }));

        try {
          const fd = new FormData();
          appendToFormData(fd, 'agent_name', agent_name);
          appendToFormData(fd, 'call_name', call_name);
          appendToFormData(fd, 'csv_file', csvOrExcelFile);
          appendToFormData(fd, 'phone_column', phone_column);
          if (String(scheduled_time || '').trim()) appendToFormData(fd, 'scheduled_time', String(scheduled_time).trim());

          const res = await api.post('/auth/agent/batch-calling', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          const payload = res?.data ?? null;

          set((s) => ({
            batchCalling: { ...s.batchCalling, creating: false, createError: '', lastCreateResponse: payload },
          }));

          try { await get().fetchBatchCallingStatus(); } catch { }

          return { success: true, data: payload };
        } catch (e) {
          const msg = pickErr(e, 'Failed to create batch calling job');
          set((s) => ({ batchCalling: { ...s.batchCalling, creating: false, createError: msg } }));
          return { success: false, error: msg };
        }
      },

      fetchBatchCallingStatus: async () => {
        set((s) => ({ batchCalling: { ...s.batchCalling, loading: true, error: '' } }));
        try {
          const res = await api.get('/auth/agent/batch-calling-status');
          const d = res?.data || {};

          const jobs = Array.isArray(d.jobs)
            ? d.jobs.map((raw) => ({
                batch_job_id: raw.batch_job_id,
                call_name: raw.call_name,
                agent_name: raw.agent_name,
                agent_id: raw.agent_id,
                total_numbers: numbersFrom(raw),
                status: preferStatus(raw),
                created_at: createdAtFrom(raw),
                _raw: raw,
              }))
            : [];

          set((s) => ({
            batchCalling: {
              ...s.batchCalling,
              jobs,
              loading: false,
              error: '',
              total_jobs: Number(d.total_jobs ?? jobs.length),
              successful_status_updates: Number(d.successful_status_updates ?? 0),
              failed_status_updates: Number(d.failed_status_updates ?? 0),
              lastFetched: new Date().toISOString(),
            },
          }));

          return { success: true, jobs };
        } catch (e) {
          const msg = pickErr(e, 'Failed to fetch batch calling status');
          set((s) => ({ batchCalling: { ...s.batchCalling, loading: false, error: msg } }));
          return { success: false, error: msg };
        }
      },

      cancelBatchCalling: async (input) => {
        const raw = typeof input === 'string' ? input : input?.call_name;
        const call_name = String(raw ?? '').replace(/\s+/g, ' ').trim();
        if (!call_name) return { success: false, error: 'call_name is required' };

        const postJSON = async () =>
          api.post(
            '/auth/agent/cancel-batch-calling',
            { call_name },
            {
              headers: { 'Content-Type': 'application/json' },
              transformRequest: [(data, headers) => {
                headers['Content-Type'] = 'application/json';
                return JSON.stringify(data);
              }],
            }
          );

        try {
          let res;
          try {
            res = await postJSON();
          } catch (e1) {
            const maybeFieldRequired = e1?.response?.status === 422;
            if (!maybeFieldRequired) throw e1;

            const params = new URLSearchParams();
            params.set('call_name', call_name);
            try {
              res = await api.post('/auth/agent/cancel-batch-calling', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              });
            } catch (e2) {
              const fd = new FormData();
              fd.append('call_name', call_name);
              res = await api.post('/auth/agent/cancel-batch-calling', fd); 
            }
          }

          try { await get().fetchBatchCallingStatus(); } catch {}
          return { success: true, data: res?.data };
        } catch (e) {
          return { success: false, error: pickErr(e, 'Failed to cancel batch calling') };
        }
      },

      retryBatchCalling: async (input) => {
        const raw = typeof input === 'string' ? input : input?.call_name;
        const call_name = String(raw ?? '').replace(/\s+/g, ' ').trim();
        if (!call_name) return { success: false, error: 'call_name is required' };

        const postJSON = async () =>
          api.post(
            '/auth/agent/retry-batch-calling',
            { call_name },
            {
              headers: { 'Content-Type': 'application/json' },
              transformRequest: [(data, headers) => {
                headers['Content-Type'] = 'application/json';
                return JSON.stringify(data);
              }],
            }
          );

        try {
          let res;
          try {
            res = await postJSON();
          } catch (e1) {
            const maybeFieldRequired = e1?.response?.status === 422;
            if (!maybeFieldRequired) throw e1;
            const params = new URLSearchParams();
            params.set('call_name', call_name);
            try {
              res = await api.post('/auth/agent/retry-batch-calling', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              });
            } catch (e2) {
              const fd = new FormData();
              fd.append('call_name', call_name);
              res = await api.post('/auth/agent/retry-batch-calling', fd);
            }
          }

          try { await get().fetchBatchCallingStatus(); } catch {}
          return { success: true, data: res?.data };
        } catch (e) {
          return { success: false, error: pickErr(e, 'Failed to retry batch calling') };
        }
      },
      
      updateSubscription: (sub) => set({ currentSubscription: sub }),

      setAgentsScope: (scope) =>
        set((s) => ({ agentsScope: scope, agentsScopeId: s.agentsScopeId + 1 })),
      initAgentsScope: ({ fromUser, urlEmail, isSuperAdmin }) => {
        const v = (fromUser && urlEmail)
          ? { type: 'user', email: urlEmail }
          : { type: 'self', email: null };
        set((s) => ({ agentsScope: v, agentsScopeId: s.agentsScopeId + 1 }));
        return v;
      },

      loadAgentsForCurrentScope: async () => withScopeGuard(get, set, async () => {
        const scope = get().agentsScope;
        set({ loading: true, agentsLoaded: false });

        try {
          if (scope.type === 'user' && scope.email) {
            const res = await api.get('/auth/admin/user-agents', { params: { email: scope.email } });
            const data = res?.data || {};
            const rows = Array.isArray(data.agents) ? data.agents : [];
            set({
              agents: rows,
              adminUserInfo: {
                user_email: data.user_email,
                user_name: data.user_name,
                user_id: data.user_id,
                total_agents: data.total_agents ?? rows.length,
              },
              loading: false,
              agentsLoaded: true,
            });
            return { success: true, data: rows };
          }

          const res = await api.post('/analysis/training/agent-individual-analytics', {});
          const rows = res?.data?.individual_results || [];
          set({ agents: rows, adminUserInfo: null, loading: false, agentsLoaded: true });
          return { success: true, data: rows };
        } catch (err) {
          set({ loading: false, agentsLoaded: true });
          return { success: false, error: err?.response?.data?.message || err.message };
        }
      }),

      fetchAdminUsers: async () => {
        const guard = Symbol('adminUsersFetch');
        set({ loading: true, adminUsersError: '', __adminGuard: guard });
        try {
          const res = await api.get('/auth/admin/users');
          if (get().__adminGuard !== guard) return { success: false, canceled: true };
          const { total_users, users } = res?.data || {};
          set({
            usersAdmin: Array.isArray(users) ? users : [],
            totalUsersAdmin: Number(total_users ?? (Array.isArray(users) ? users.length : 0)),
            loading: false,
          });
          return { success: true };
        } catch (e) {
          if (get().__adminGuard !== guard) return { success: false, canceled: true };
          const msg = pickErr(e, 'Failed to load users.');
          set({ loading: false, adminUsersError: msg });
          return { success: false, error: msg };
        } finally {
          set((s) => (s.__adminGuard === guard ? { __adminGuard: null } : {}));
        }
      },

      fetchAgents: async () => {
        if (get().agentsScope.type !== 'self') return { success: false, ignored: true };
        return withScopeGuard(get, set, async () => {
          set({ loading: true, agentsLoaded: false });
          try {
            const res = await api.post('/analysis/training/agent-individual-analytics', {});
            const rows = res?.data?.individual_results || [];
            set({ agents: rows, adminUserInfo: null, loading: false, agentsLoaded: true });
            return { success: true, data: rows };
          } catch (err) {
            set({ loading: false, agentsLoaded: true });
            return { success: false, error: err?.response?.data?.message || err.message };
          }
        });
      },

      fetchAgentsForUser: async (userEmail) => {
        if (!userEmail) return { success: false, error: 'Missing email' };
        const scope = get().agentsScope;
        if (!(scope.type === 'user' && scope.email === userEmail)) return { success: false, ignored: true };
        return withScopeGuard(get, set, async () => {
          set({ loading: true, agentsLoaded: false });
          try {
            const res = await api.get('/auth/admin/user-agents', { params: { email: userEmail } });
            const data = res?.data || {};
            const rows = Array.isArray(data.agents) ? data.agents : [];
            set({
              agents: rows,
              adminUserInfo: {
                user_email: data.user_email,
                user_name: data.user_name,
                user_id: data.user_id,
                total_agents: data.total_agents ?? rows.length,
              },
              loading: false,
              agentsLoaded: true,
            });
            return { success: true, data: rows };
          } catch (err) {
            set({ loading: false, agentsLoaded: true });
            return { success: false, error: err?.response?.data?.message || err.message };
          }
        });
      },

      createAgent: async (payload = {}) => {
        const agent_name = payload.agent_name ?? payload.name ?? payload.agentName;
        const first_message = payload.first_message ?? payload.firstMessage;
        const prompt = payload.prompt;
        const email = payload.email;
        const llm = payload.llm ?? payload.model;
        const file = payload.file ?? (Array.isArray(payload.knowledgeFiles) ? payload.knowledgeFiles[0] : payload.knowledgeFile);
        const voice_file = payload.voice_file ?? payload.voiceFile;

        const business_name = payload.business_name ?? payload.businessName ?? payload.companyName ?? '';
        const agent_type = payload.agent_type ?? payload.type ?? payload.agentType ?? '';
        const speaking_style = payload.speaking_style ?? payload.speakingStyle ?? '';
        const contact_phone_number = normalizePhone(
          payload.contact_phone_number ?? payload.phone ?? payload.contactPhoneNumber ?? ''
        );

        if (!agent_name) return { success: false, error: 'agent_name is required' };
        if (!first_message) return { success: false, error: 'first_message is required' };
        if (!prompt) return { success: false, error: 'prompt is required' };
        if (!email) return { success: false, error: 'email is required' };
        if (!llm) return { success: false, error: 'llm (model) is required' };

        try {
          const fd = new FormData();
          appendToFormData(fd, 'agent_name', agent_name);
          appendToFormData(fd, 'first_message', first_message);
          appendToFormData(fd, 'prompt', prompt);
          appendToFormData(fd, 'email', email);
          appendToFormData(fd, 'llm', llm);

          if (business_name) appendToFormData(fd, 'business_name', business_name);
          if (agent_type) appendToFormData(fd, 'agent_type', agent_type);
          if (speaking_style) appendToFormData(fd, 'speaking_style', speaking_style);
          if (contact_phone_number) appendToFormData(fd, 'contact_phone_number', contact_phone_number);

          if (file) appendToFormData(fd, 'file', file);
          if (voice_file) appendToFormData(fd, 'voice_file', voice_file);

          const res = await api.post('/auth/agent/create-agent', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          try { await get().loadAgentsForCurrentScope(); } catch {  }

          return { success: true, data: res?.data };
        } catch (e) {
          return { success: false, error: pickErr(e, 'Failed to create agent') };
        }
      },

      deleteAgent: async (agentId) => {
        if (!agentId) return { success: false, error: 'Missing agent id' };
        try {
          await api.delete(`/auth/agent/delete-agent/${agentId}`);
          set((s) => ({
            agents: (s.agents || []).filter((a) => a.id !== agentId && a.agent_id !== agentId),
          }));
          return { success: true };
        } catch (err) {
          return { success: false, error: err?.response?.data?.message || err.message };
        }
      },

      pauseAgent: async (agentId) => {
        if (!agentId) return { success: false, error: 'Missing agent id' };
        try {
          await api.patch(`/auth/agent/pause-twilio-number/${agentId}`);
          set((s) => ({
            agents: (s.agents || []).map((a) =>
              a.id === agentId || a.agent_id === agentId ? { ...a, is_active: false } : a
            ),
          }));
          return { success: true };
        } catch (err) {
          return { success: false, error: err?.response?.data?.message || err.message };
        }
      },

      resumeAgent: async (agentId) => {
        if (!agentId) return { success: false, error: 'Missing agent id' };
        try {
          await api.patch(`/auth/agent/resume-twilio-number/${agentId}`);
          set((s) => ({
            agents: (s.agents || []).map((a) =>
              a.id === agentId || a.agent_id === agentId ? { ...a, is_active: true } : a
            ),
          }));
          return { success: true };
        } catch (err) {
          return { success: false, error: err?.response?.data?.message || err.message };
        }
      },

      updateAgentExact: async ({
        email,
        agent_name,
        first_message,
        prompt,
        llm,
        file,
        voice_file,
        business_name,
        agent_type,
        speaking_style,
        contact_phone_number,
      } = {}) => {
        if (!email) return { success: false, error: 'email is required' };
        if (!agent_name) return { success: false, error: 'agent_name is required' };

        try {
          const fd = new FormData();
          appendToFormData(fd, 'email', email);
          appendToFormData(fd, 'agent_name', agent_name);

          if (first_message) appendToFormData(fd, 'first_message', first_message);
          if (prompt) appendToFormData(fd, 'prompt', prompt);
          if (llm) appendToFormData(fd, 'llm', llm);
          if (file) appendToFormData(fd, 'file', file);
          if (voice_file) appendToFormData(fd, 'voice_file', voice_file);
          if (business_name) appendToFormData(fd, 'business_name', business_name);
          if (agent_type) appendToFormData(fd, 'agent_type', agent_type);
          if (speaking_style) appendToFormData(fd, 'speaking_style', speaking_style);

          const phoneNorm = contact_phone_number ? normalizePhone(contact_phone_number) : '';
          if (phoneNorm) appendToFormData(fd, 'contact_phone_number', phoneNorm);

          const res = await api.put('/auth/agent/update-agent', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          try { await get().loadAgentsForCurrentScope(); } catch {}

          return { success: true, data: res?.data };
        } catch (e) {
          return { success: false, error: pickErr(e, 'Failed to update agent') };
        }
      },

      fetchAnalytics: async (params = {}) => {
        set({ loading: true });
        try {
          const body = { range: params?.range ?? 'all', ...(params?.agent_id ? { agent_id: params.agent_id } : {}) };
        const res = await api.post('/analysis/dashboard-analytics', body);
          set({ analytics: res?.data || {}, loading: false });
          return { success: true };
        } catch (err) {
          set({ loading: false });
          return { success: false, error: err?.response?.data?.message || err.message };
        }
      },

      fetchAgentOverview: async () => {
        set({ loading: true });
        try {
          const res = await api.post('/analysis/analytics/agent-overview-analytics', {});
          set({ agentOverview: res?.data || null, loading: false });
          return { success: true };
        } catch (err) {
          set({ loading: false });
          return { success: false, error: err?.response?.data?.message || err.message };
        }
      },

      fetchAgentAnalytics: async (agentId) => {
        if (!agentId) return;
        set({ loading: true });
        try {
          const res = await api.post('/analysis/agent-analytics', { agent_id: agentId });
          const data = res?.data || {};
          set((state) => ({
            agentAnalytics: { ...state.agentAnalytics, [agentId]: data },
            loading: false,
          }));
          return { success: true };
        } catch (err) {
          set({ loading: false });
          return { success: false, error: err?.response?.data?.message || err.message };
        }
      },

      fetchSubscriptions: async () => {
        set({ loading: true });
        try {
          const current = await api.get('/subscription/current');
          set({
            subscriptions: [current.data],
            currentSubscription: current.data,
            loading: false,
          });
          return { success: true };
        } catch (err) {
          set({ loading: false });
          return { success: false, error: err?.response?.data?.message || err.message };
        }
      },

      callHistory: [],
      callHistoryLoading: false,

      fetchCallHistory: async (limit = 50) => {
        try {
          set({ callHistoryLoading: true });
          const res = await api.get('/auth/agent/call-history', { params: { limit } });
          set({ callHistory: Array.isArray(res?.data) ? res.data : [] });
          return { success: true };
        } catch (err) {
          set({ callHistory: [] });
          return { success: false, error: err?.response?.data?.message || err?.message || 'Failed to load call history' };
        } finally {
          set({ callHistoryLoading: false });
        }
      },

      setActiveCall: (call) => set({ activeCall: call }),

      getAgentById: (id) => {
        const { agents } = get();
        return agents?.find?.((a) => a?.agent_id === id || a?.id === id) || null;
      },

      getCallPatterns: () => (get().analytics?.call_patterns ?? []),

      getWeeklySeries: () => weeklySeriesFrom(get().analytics?.weekly_performance ?? []),

      getAgentTypesSeries: () => {
        const t = get().analytics?.agent_types ?? {};
        return Object.entries(t).map(([label, value]) => ({ label, value }));
      },

      fetchDashboardData: async () => {
        set({ loading: true });
        try {
          await Promise.allSettled([
            get().fetchAgents(),
            get().fetchAnalytics(),
            get().fetchSubscriptions(),
          ]);
        } finally {
          set({ loading: false });
        }
        return { success: true };
      },

      billing: {
        plans: [],
        plansLoading: false,
        plansError: '',

        currentSub: null,
        currentLoading: false,
        currentError: '',

        usage: null,
        usageLoading: false,
        usageError: '',

        compareData: null,
        compareLoading: false,
        compareError: '',

        payments: [],
        paymentsLoading: false,
        paymentsLoadingMore: false,
        paymentsError: '',
        totalPayments: 0,
        hasMorePayments: false,

        redirectingPlan: '',
      },

      billingBootstrap: async () => {
        set((s) => ({
          billing: {
            ...s.billing,
            plansLoading: true, plansError: '',
            currentLoading: true, currentError: '',
            usageLoading: true,  usageError: '',
            compareLoading: true, compareError: '',
          },
        }));

        const [pRes, cRes, uRes, pcRes] = await Promise.all([
          api.get('/subscription/plans').catch((e) => ({ __err: e })),
          api.get('/subscription/current').catch((e) => ({ __err: e })),
          api.get('/subscription/usage').catch((e) => ({ __err: e })),
          api.get('/subscription/plan-comparison').catch((e) => ({ __err: e })),
        ]);

        set((s) => ({
          billing: {
            ...s.billing,
            plans: pRes?.__err ? [] : (Array.isArray(pRes?.data) ? pRes.data.map(normalizePlan) : []),
            plansLoading: false,
            plansError: pRes?.__err ? (pickErr(pRes.__err, 'Failed to load subscription plans')) : '',

            currentSub: cRes?.__err ? null : (cRes?.data || null),
            currentLoading: false,
            currentError: cRes?.__err ? pickErr(cRes.__err, 'Failed to load current subscription') : '',

            usage: uRes?.__err ? null : (uRes?.data || null),
            usageLoading: false,
            usageError: uRes?.__err ? pickErr(uRes.__err, 'Failed to load usage') : '',

            compareData: pcRes?.__err ? null : (pcRes?.data || null),
            compareLoading: false,
            compareError: pcRes?.__err ? pickErr(pcRes.__err, 'Failed to load plan comparison') : '',
          },
          currentSubscription: cRes?.data || null,
        }));

        return { success: true };
      },

      billingRefreshCore: async () => {
        const [cur, use] = await Promise.all([
          api.get('/subscription/current').catch((e) => ({ __err: e })),
          api.get('/subscription/usage').catch((e) => ({ __err: e })),
        ]);

        set((s) => ({
          billing: {
            ...s.billing,
            currentSub: cur?.__err ? s.billing.currentSub : (cur?.data || null),
            currentError: cur?.__err ? pickErr(cur.__err, 'Failed to load current subscription') : '',
            usage: use?.__err ? s.billing.usage : (use?.data || null),
            usageError: use?.__err ? pickErr(use.__err, 'Failed to load usage') : '',
          },
          currentSubscription: cur?.__err ? get().currentSubscription : (cur?.data || null),
        }));

        return { success: !cur?.__err && !use?.__err };
      },

      billingFetchPayments: async ({ startingAfter = '', limit = 50 } = {}, { append = false } = {}) => {
        set((s) => ({
          billing: {
            ...s.billing,
            paymentsLoading: append ? s.billing.paymentsLoading : true,
            paymentsLoadingMore: append,
            paymentsError: append ? s.billing.paymentsError : '',
            ...(append ? {} : { payments: [] }),
          },
        }));

        const doFetch = async (lim) => {
          const params = new URLSearchParams();
          if (lim) params.set('limit', String(lim));
          if (startingAfter) params.set('starting_after', startingAfter);
          return api.get(`/subscription/payment-history?${params.toString()}`);
        };

        try {
          let res;
          try {
            res = await doFetch(limit);
          } catch (e) {
            if (e?.response?.status === 500 && limit > 20) {
              res = await doFetch(20);
            } else {
              throw e;
            }
          }
          const d = res?.data || {};
          const list = Array.isArray(d.payments) ? d.payments : [];
          set((s) => ({
            billing: {
              ...s.billing,
              payments: append ? [...s.billing.payments, ...list] : list,
              paymentsLoading: false,
              paymentsLoadingMore: false,
              paymentsError: '',
              totalPayments: d.total_payments || 0,
              hasMorePayments: !!d.has_more,
            },
          }));
          return { success: true };
        } catch (e) {
          const msg = pickErr(e, 'Failed to load payment history');
          set((s) => ({
            billing: {
              ...s.billing,
              paymentsLoading: false,
              paymentsLoadingMore: false,
              paymentsError: msg,
              payments: append ? s.billing.payments : [],
            },
          }));
          return { success: false, error: msg };
        }
      },

      billingLoadMorePayments: async () => {
        const s = get().billing;
        if (!s.hasMorePayments || s.paymentsLoadingMore || !s.payments.length) return { success: false };
        const last = s.payments[s.payments.length - 1];
        const cursor = last?.cursor || last?.id || last?.invoice_id || '';
        if (!cursor) return { success: false };
        return get().billingFetchPayments({ limit: 50, startingAfter: cursor }, { append: true });
      },

      billingCreateCheckoutSession: async (plan) => {
        const planName = typeof plan === 'string' ? plan : plan?.name;
        const code = typeof plan === 'object'
          ? (String(plan?.code || '').trim().toLowerCase() || snake(plan?.name))
          : snake(planName);

        set((s) => ({ billing: { ...s.billing, redirectingPlan: planName } }));
        try {
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          const body = {
            plan: code,
            success_url: `${origin}/billing?tab=current&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/billing?tab=plans&checkout=cancelled`,
          };
          const res = await api.post('/subscription/create-checkout-session', body);
          const url = res?.data?.checkout_url || res?.data?.url;
          if (!url) throw new Error('No checkout_url returned');
          set((s) => ({ billing: { ...s.billing, redirectingPlan: '' } }));
          return { success: true, url };
        } catch (e) {
          set((s) => ({ billing: { ...s.billing, redirectingPlan: '' } }));
          return { success: false, error: pickErr(e, 'Failed to start checkout') };
        }
      },

      billingDowngradeToFree: async () => {
        try {
          await api.post('/subscription/downgrade-to-free');
          await get().billingRefreshCore();
          return { success: true };
        } catch (e) {
          const msg = pickErr(e, 'Failed to downgrade to Free');
          if (/already/i.test(msg) && /free/i.test(msg)) {
            await get().billingRefreshCore();
            return { success: true, already: true };
          }
          return { success: false, error: msg };
        }
      },
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        currentPage: state.currentPage,
        selectedAgent: state.selectedAgent,
        agentsScope: state.agentsScope,
      }),
    }
  )
);

export default useAppStore;
