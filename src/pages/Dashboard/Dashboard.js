import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import api from '../../api/axiosInstance';
import {
  PhoneIcon,
  UserGroupIcon,
  ChartBarIcon,
  PlusIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import {
  RefreshButton,
  PageHeader,
  KPISkeleton as KPISkeletonCommon,
  ListSkeleton as ListSkeletonCommon,
} from '../../lib/commonUtils';

const formatStatus = (status) =>
  (status
    ? status.toString().replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Active');

const normalizeRate = (v) => {
  if (v == null || v === '') return 0;
  const n = typeof v === 'string' ? parseFloat(v.replace('%', '').trim()) : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
};

const fmtRel = (dtLike) => {
  try {
    const d = new Date(dtLike);
    const diff = (Date.now() - d.getTime()) / 1000;
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    if (diff < 60) return rtf.format(-Math.round(diff), 'second');
    if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
    if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
    return rtf.format(-Math.round(diff / 86400), 'day');
  } catch { return ''; }
};

const KPISkeleton = () => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="card animate-pulse">
        <div className="flex items-center">
          <div className="h-8 w-8 rounded bg-gray-200 mr-4" />
          <div className="flex-1">
            <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
            <div className="h-6 w-16 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const ListSkeleton = ({ rows = 3 }) => <ListSkeletonCommon rows={rows} />;

const ActivitySkeleton = () => (
  <div className="space-y-2">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="flex items-center space-x-4 p-3 rounded-lg animate-pulse">
        <div className="h-5 w-5 rounded bg-gray-200" />
        <div className="flex-1">
          <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
          <div className="h-3 w-32 bg-gray-200 rounded" />
        </div>
        <div className="h-3 w-16 bg-gray-200 rounded" />
      </div>
    ))}
  </div>
);

const Dashboard = () => {
  const { user } = useAuthStore();
  const {
    fetchAnalytics,
    fetchSubscriptions,
    analytics,
    loading: storeLoading,
  } = useAppStore();

  const [uaAllAgents, setUaAllAgents] = useState([]);   
  const [uaAgents, setUaAgents] = useState([]);        
  const [uaLoading, setUaLoading] = useState(true);
  const [uaError, setUaError] = useState('');
  const [uaTotalAgentsFromAPI, setUaTotalAgentsFromAPI] = useState(0);

  const currentEmail = (user?.email || user?.user_email || '').trim();

  const fetchUserAgents = useCallback(async () => {
    if (!currentEmail) {
      setUaAllAgents([]); setUaAgents([]); setUaTotalAgentsFromAPI(0); setUaLoading(false);
      return;
    }
    setUaLoading(true);
    setUaError('');
    try {
      const res = await api.get('/auth/admin/user-agents', { params: { email: currentEmail } });
      const data = res?.data || {};
      const list = Array.isArray(data.agents) ? data.agents : [];

      const mapped = list.map((a) => ({
        id: a.id ?? a.agent_id ?? String(a.agent_name ?? 'unknown'),
        name: a.agent_name ?? a.name ?? 'Untitled Agent',
        type: (() => {
          const raw = String(a.agent_type || '').trim().toLowerCase();
          if (raw.startsWith('lead')) return 'lead_generation';
          if (raw.startsWith('appoint')) return 'appointment_scheduling';
          if (raw.startsWith('customer')) return 'customer_support';
          return 'customer_support';
        })(),
        status: (a.is_active ? 'Active' : 'Inactive'),
        stats: {
          calls: Number(a.total_calls ?? 0) || 0,
          successRate: Number.isFinite(a.success_rate_value)
            ? normalizeRate(a.success_rate_value)
            : normalizeRate(a.success_rate),
        },
        createdAt: a.created_at ?? null,
        updatedAt: a.updated_at ?? a.created_at ?? null,
        is_active: !!a.is_active,
        twilio_number: a.twilio_number || null,
        has_doc: !!a.file_url,
        _raw: a,
      }));

      mapped.sort((a, b) => {
        const da = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const db = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return db - da;
      });

      setUaAllAgents(mapped);
      setUaAgents(mapped.slice(0, 3));
      setUaTotalAgentsFromAPI(Number(data.total_agents ?? mapped.length) || mapped.length);
    } catch (e) {
      setUaError(e?.response?.data?.message || e?.message || 'Failed to load agents');
      setUaAllAgents([]); setUaAgents([]); setUaTotalAgentsFromAPI(0);
    } finally {
      setUaLoading(false);
    }
  }, [currentEmail]);

  const [refreshing, setRefreshing] = useState(false);
  const isBusy = refreshing || uaLoading || storeLoading;

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await Promise.allSettled([
        (async () => { try { await fetchAnalytics?.(); } catch {} })(),
        (async () => { try { await fetchSubscriptions?.(); } catch {} })(),
        fetchUserAgents(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchAnalytics, fetchSubscriptions, fetchUserAgents]);

  const MIN_SKELETON_MS = 600;
  const startedAtRef = useRef(Date.now());
  const [minTimePassed, setMinTimePassed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await Promise.allSettled([
          (async () => { try { await fetchAnalytics?.(); } catch {} })(),
          (async () => { try { await fetchSubscriptions?.(); } catch {} })(),
          fetchUserAgents(),
        ]);
      } catch {}
    })();
  }, [fetchAnalytics, fetchSubscriptions, fetchUserAgents]);

  useEffect(() => {
    const left = Math.max(0, MIN_SKELETON_MS - (Date.now() - startedAtRef.current));
    const t = setTimeout(() => setMinTimePassed(true), left);
    return () => clearTimeout(t);
  }, []);

  const showKPISkeleton = uaLoading || refreshing || !minTimePassed;

  const showListSkeleton = (!minTimePassed) || refreshing || uaLoading || storeLoading;

  const kpis = useMemo(() => {
    const total = uaTotalAgentsFromAPI || uaAllAgents.length || 0;

    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const newThisWeek = uaAllAgents.reduce((acc, a) => {
      const t = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      return acc + (t >= weekAgo ? 1 : 0);
    }, 0);

    const inactive = uaAllAgents.reduce((acc, a) => acc + (a.is_active ? 0 : 1), 0);

    const withPhones = uaAllAgents.reduce((acc, a) => acc + (!!a.twilio_number ? 1 : 0), 0);

    const withDocs = uaAllAgents.reduce((acc, a) => acc + (a.has_doc ? 1 : 0), 0);
    const docsCoverage = total ? Math.round((withDocs / total) * 100) : 0;

    return { total, newThisWeek, inactive, withPhones, docsCoverage };
  }, [uaAllAgents, uaTotalAgentsFromAPI]);

  const derivedActivity = useMemo(() => {
    const recentFromAnalytics = Array.isArray(analytics?.recentActivity)
      ? analytics.recentActivity
      : (Array.isArray(analytics?.activity) ? analytics.activity : []);
    if (recentFromAnalytics.length) return recentFromAnalytics;

    const newest = [...uaAgents];
    const rows = [];
    newest.forEach((a, idx) => {
      if (a.createdAt) {
        rows.push({ id: `created-${a.id}`, type: 'agent', agent: a.name, description: 'Agent created', timestamp: fmtRel(a.createdAt) });
      }
      rows.push({ id: `calls-${a.id}`, type: 'call', agent: a.name, description: `${a.stats.calls} call${a.stats.calls === 1 ? '' : 's'} so far`, timestamp: fmtRel(a.createdAt) || '' });
      if (idx === 0) rows.push({ id: `sr-${a.id}`, type: 'appointment', agent: a.name, description: `Success rate ${a.stats.successRate}%`, timestamp: fmtRel(a.createdAt) || '' });
    });
    return rows.slice(0, 5);
  }, [analytics?.recentActivity, analytics?.activity, uaAgents]);

  const iconColor = {
    primary: 'text-primary-600',
    success: 'text-green-600',
    warning: 'text-amber-600',
    secondary: 'text-purple-600',
  };

  const StatCard = ({ title, value, icon: Icon, color = 'primary', subtext }) => (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex items-center min-w-0 flex-1">
          <div className="flex-shrink-0 mr-4">
            <Icon className={`h-8 w-8 ${iconColor[color] || iconColor.primary} ${uaLoading || refreshing ? 'animate-pulse' : ''}`} />
          </div>
          <div className="min-w-0 flex-1">
            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
            <dd className="text-xl font-bold text-gray-900">{value}</dd>
            {subtext ? <p className="text-xs text-gray-500 mt-1">{subtext}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );

  const AgentCard = ({ agent }) => (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center min-w-0 flex-1">
          <div className="flex-shrink-0 mr-3 text-2xl">
            {agent.type === 'customer_support' && '🎧'}
            {agent.type === 'lead_generation' && '🎯'}
            {agent.type === 'appointment_scheduling' && '📅'}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-medium text-gray-900 truncate">{agent.name}</h3>
            <p className="text-sm text-gray-500">
              {agent.stats.calls} calls • {agent.stats.successRate}% success rate
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            agent.status === 'Active'
              ? 'bg-success-100 text-success-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {agent.status}
        </span>
      </div>
    </div>
  );

  const ActivityItem = ({ activity }) => (
    <div className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg">
      <div className="flex-shrink-0">
        {activity.type === 'call' && <PhoneIcon className="h-5 w-5 text-blue-600" />}
        {activity.type === 'lead' && <UserGroupIcon className="h-5 w-5 text-green-600" />}
        {activity.type === 'appointment' && <ChartBarIcon className="h-5 w-5 text-purple-600" />}
        {activity.type === 'agent' && <UserGroupIcon className="h-5 w-5 text-gray-600" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{activity.agent || 'N/A'}</p>
        <p className="text-sm text-gray-500">{activity.description}</p>
      </div>
      <div className="flex-shrink-0">
        <span className="text-xs text-gray-500">{activity.timestamp ?? activity.time ?? ''}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.name || 'User'}!`}
        subtitle="Here's what's happening with your agents today."
      >
        <RefreshButton onClick={handleRefresh} isLoading={isBusy} />
      </PageHeader>

      {showKPISkeleton ? (
        <KPISkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="New This Week"
            value={kpis.newThisWeek}
            icon={UserGroupIcon}
            color="primary"
            subtext={`${kpis.total} total agents`}
          />
          <StatCard
            title="Inactive Agents"
            value={kpis.inactive}
            icon={EyeIcon}
            color="secondary"
            subtext={`${kpis.total - kpis.inactive} active now`}
          />
          <StatCard
            title="With Phone Numbers"
            value={kpis.withPhones}
            icon={PhoneIcon}
            color="success"
            subtext="Twilio numbers configured"
          />
          <StatCard
            title="Docs Coverage"
            value={`${kpis.docsCoverage}%`}
            icon={ChartBarIcon}
            color="warning"
            subtext="Agents with knowledge docs"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Your AI Agents</h2>
            <Link to="/agents" className="text-sm text-primary-600 hover:text-primary-900">View All</Link>
          </div>
          {showListSkeleton ? (
            <ListSkeleton rows={3} />
          ) : uaError ? (
            <p className="text-sm text-red-600">{uaError}</p>
          ) : (
            <div className="space-y-4">
              {uaAgents.length === 0
                ? <p className="text-gray-500 text-sm">No agents found.</p>
                : uaAgents.map((agent) => <AgentCard key={agent.id} agent={agent} />)}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
          {showListSkeleton ? (
            <ActivitySkeleton />
          ) : (
            <div className="space-y-1">
              {derivedActivity.map((a) => (
                <ActivityItem key={a.id ?? `${a.type}-${a.timestamp}-${a.agent}`} activity={a} />
              ))}
              {derivedActivity.length === 0 && <p className="text-gray-500 text-sm">No recent activity available.</p>}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link to="/agents/create" className="flex items-center p-4 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors">
            <PlusIcon className="h-6 w-6 text-primary-600 mr-3" />
            <span className="text-sm font-medium text-primary-900">Create New Agent</span>
          </Link>
          <Link to="/call-logs" className="flex items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
            <PhoneIcon className="h-6 w-6 text-blue-600 mr-3" />
            <span className="text-sm font-medium text-blue-900">View Call Logs</span>
          </Link>
          <Link to="/training" className="flex items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
            <ChartBarIcon className="h-6 w-6 text-green-600 mr-3" />
            <span className="text-sm font-medium text-green-900">Agent Training</span>
          </Link>
          <Link to="/analytics" className="flex items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
            <EyeIcon className="h-6 w-6 text-purple-600 mr-3" />
            <span className="text-sm font-medium text-purple-900">View Analytics</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;