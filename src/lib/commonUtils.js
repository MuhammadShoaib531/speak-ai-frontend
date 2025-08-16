export const toTitle = (s) =>
  s ? s.toString().replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : '';

export const norm = (s) => (s == null ? '' : s.toString().trim().toLowerCase().replace(/\s+/g, '_'));

export const formatDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? String(d) : dt.toLocaleString();
};

export const formatRelativeTime = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInHours = (now - date) / (1000 * 60 * 60);

  if (diffInHours < 1) {
    const minutes = Math.floor((now - date) / (1000 * 60));
    return `${minutes} minutes ago`;
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)} hours ago`;
  } else if (diffInHours < 48) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString();
  }
};

export const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const clamp0to100 = (v) => Math.min(100, Math.max(0, Math.round(num(v))));

export const compact = (n) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n) || 0);

export const pad = (n) => String(n).padStart(2, '0');

export const toMMSS = (secs) => {
  const s = Math.max(0, num(secs));
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};

export const toHHMMSS = (secs) => {
  if (secs == null || Number.isNaN(Number(secs))) return '—';
  const s = Math.max(0, Math.floor(Number(secs)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};

export const parseDuration = (raw) => {
  if (typeof raw === 'number') return toMMSS(raw);
  if (typeof raw === 'string' && /^\d+:\d{2}$/.test(raw)) return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return toMMSS(Number(raw));
  return raw || '—';
};

export const getStatusColor = (status) => {
  switch (norm(status)) {
    case 'active':
    case 'completed':
    case 'succeeded':
    case 'success':
      return 'bg-green-100 text-green-800';
    case 'inactive':
    case 'missed':
    case 'failed':
    case 'error':
      return 'bg-red-100 text-red-800';
    case 'in_progress':
    case 'ongoing':
    case 'processing':
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'cancelled':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getStatusBadgeClass = (status) => {
  const s = norm(status);
  if (s === 'completed' || s === 'succeeded' || s === 'success') return 'bg-success-100 text-success-800';
  if (s === 'missed' || s === 'failed' || s === 'error') return 'bg-error-100 text-error-800';
  if (s === 'in_progress' || s === 'ongoing' || s === 'processing') return 'bg-warning-100 text-warning-800';
  return 'bg-gray-100 text-gray-800';
};

export const normalizeAgent = (raw) => {
  const id = raw?.agent_id ?? raw?.id ?? raw?._id ?? '';
  const name = raw?.agent_name ?? raw?.name ?? 'Untitled Agent';
  const typeRaw = raw?.agent_type ?? raw?.type ?? 'unknown';
  const type = norm(typeRaw) || 'unknown';
  const is_active = Boolean(raw?.is_active);
  const status = is_active ? 'active' : 'inactive';
  const total_calls = num(raw?.total_calls ?? raw?.stats?.calls ?? raw?.call_count);
  let sr = raw?.success_rate ?? raw?.stats?.successRate ?? 0;
  if (typeof sr === 'string') sr = sr.replace('%', '');
  sr = num(sr);
  sr = sr <= 1 ? sr * 100 : sr;
  const success_rate = clamp0to100(sr);
  let acd = raw?.average_call_duration ?? raw?.stats?.avgCallDuration ?? 0;
  const average_call_duration = typeof acd === 'string' && acd.includes(':') ? acd : toMMSS(acd);
  const created_at = formatDate(raw?.created_at ?? raw?.createdAt);
  return {
    id,
    name,
    type,
    is_active,
    status,
    total_calls,
    success_rate,
    average_call_duration,
    created_at,
  };
};

export const getTypeIcon = (type) => {
  switch (norm(type)) {
    case 'customer_support':
      return '🎧';
    case 'lead_generation':
      return '🎯';
    case 'appointment_scheduling':
      return '📅';
    default:
      return '🤖';
  }
};

export const getTypeLabel = (type) => toTitle(type || 'Unknown');

export const isSuperAdminRole = (role) => /super\s*admin/i.test((role ?? '').toString().replace(/_/g, ' ').trim());

export const normalizeAgentForEdit = (raw = {}, fallbackEmail = '') => ({
  id: raw.agent_id ?? String(raw.id ?? raw._id ?? ''),
  name: raw.agent_name ?? raw.name ?? 'Untitled Agent',
  phone: raw.twilio_number ?? raw.contact_phone_number ?? raw.phone ?? '',
  email: raw.user_email ?? raw.email ?? fallbackEmail,
  firstMessage: raw.first_message ?? raw.first_message_to_caller ?? '',
  companyName: raw.business_name ?? raw.company_name ?? '',
});

export const KPISkeleton = () => (
  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="card animate-pulse">
        <div className="flex items-center">
          <div className="h-8 w-8 rounded bg-gray-200" />
          <div className="ml-5 flex-1">
            <div className="h-3 w-24 bg-gray-200 rounded mb-2" />
            <div className="h-5 w-16 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const TableSkeleton = ({ rows = 6, compactPad = 'px-4 py-3' }) => (
  <div className="card overflow-hidden animate-pulse">
    <div className="overflow-x-auto">
      <div className="min-w-full">
        <div className="bg-gray-50">
          <div className={`grid grid-cols-5 ${compactPad}`}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-3 w-24 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
        {[...Array(rows)].map((_, i) => (
          <div key={i} className={`grid grid-cols-5 ${compactPad} border-b border-gray-100`}>
            {[...Array(5)].map((__, j) => (
              <div key={j} className="h-4 w-28 bg-gray-200 rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const ListSkeleton = ({ rows = 3 }) => (
  <div className="space-y-4">
    {[...Array(rows)].map((_, i) => (
      <div key={i} className="card animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center min-w-0 flex-1">
            <div className="h-6 w-6 rounded bg-gray-200 mr-3" />
            <div className="flex-1">
              <div className="h-4 w-40 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-28 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="h-5 w-20 rounded-full bg-gray-200" />
        </div>
      </div>
    ))}
  </div>
);

export const RefreshButton = ({ onClick, isLoading, className = "btn btn-secondary", children = "Refresh" }) => (
  <button
    onClick={onClick}
    className={className}
    disabled={isLoading}
    title="Refresh data"
  >
    <svg className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
    <span>{children}</span>
  </button>
);

export const PageHeader = ({ title, subtitle, children }) => (
  <div className="sm:flex sm:items-center sm:justify-between">
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-gray-600">{subtitle}</p>}
    </div>
    {children && <div className="mt-4 sm:mt-0">{children}</div>}
  </div>
);

export const SearchAndFilters = ({ 
  searchTerm, 
  onSearchChange, 
  searchPlaceholder = "Search...",
  filters = [],
  disabled = false 
}) => (
  <div className="card">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 sm:space-x-4">
      <div className="relative flex-1 max-w-md">
        <svg
          className="absolute left-3 top-1/2 transform -translate-y-[50%] h-4 w-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={onSearchChange}
          className="mt-1 w-full pl-9 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition border-purple-200 focus:border-purple-400 ring-purple-100"
          disabled={disabled}
        />
      </div>
      {filters.length > 0 && (
        <div className="flex space-x-4">
          {filters.map((filter, index) => (
            <select
              key={index}
              value={filter.value}
              onChange={filter.onChange}
              className="mt-1 w-[200px] pl-5 pr-5 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition border-purple-200 focus:border-purple-400 ring-purple-100"
              disabled={disabled}
            >
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}
    </div>
  </div>
);