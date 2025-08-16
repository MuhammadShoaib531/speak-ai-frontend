import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import api from '../../api/axiosInstance';
import {
  UserGroupIcon,
  UserPlusIcon,
  ChartBarIcon,
  PhoneIcon,
  CogIcon,
  PlusIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import {
  RefreshButton,
  PageHeader,
  KPISkeleton as KPISkeletonCommon,
  ListSkeleton as ListSkeletonCommon,
} from '../../lib/commonUtils';

const fmtRel = (iso) => {
  try {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    if (diff < 60) return rtf.format(-Math.round(diff), 'second');
    if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
    if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
    return rtf.format(-Math.round(diff / 86400), 'day');
  } catch {
    return '—';
  }
};

const formatPlanName = (plan) => {
  if (!plan) return '—';
  return plan
    .toString()
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const StatCard = ({ title, value, icon: Icon, variant = 'primary', format = 'number' }) => {
  const color =
    variant === 'primary' ? 'text-primary-600' :
    variant === 'success' ? 'text-green-600' :
    variant === 'warning' ? 'text-amber-600' :
    variant === 'secondary' ? 'text-purple-600' : 'text-gray-600';

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex items-center min-w-0 flex-1">
          <div className="flex-shrink-0 mr-4">
            <Icon className={`h-8 w-8 ${color}`} />
          </div>
          <div className="min-w-0 flex-1">
            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
            <dd className="text-xl font-bold text-gray-900">
              {format === 'currency'
                ? `$${Number(value || 0).toLocaleString()}`
                : Number(value || 0).toLocaleString()}
            </dd>
          </div>
        </div>
      </div>
    </div>
  );
};

const KPISkeleton = () => <KPISkeletonCommon />;
const ListSkeleton = ({ rows = 5 }) => <ListSkeletonCommon rows={rows} />;

const RightPaneSkeleton = () => (
  <div className="card animate-pulse">
    <div className="h-5 w-56 bg-gray-200 rounded mb-4" />
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-36 bg-gray-200 rounded" />
            <div className="h-3 w-24 bg-gray-200 rounded" />
          </div>
          <div className="space-y-2 text-right">
            <div className="h-4 w-12 bg-gray-200 rounded ml-auto" />
            <div className="h-3 w-20 bg-gray-200 rounded ml-auto" />
          </div>
        </div>
      ))}
    </div>
    <div className="h-4 w-40 bg-gray-200 rounded mt-6 mb-4" />
    {[...Array(3)].map((_, i) => (
      <div key={i} className="flex items-center justify-between mt-3">
        <div className="h-4 w-40 bg-gray-200 rounded" />
        <div className="h-4 w-12 bg-gray-200 rounded" />
      </div>
    ))}
  </div>
);

const SuperAdminDashboard = () => {
  const { user } = useAuthStore();
  const { fetchAgents, fetchAnalytics, fetchSubscriptions, analytics, loading: analyticsLoadingFlag } = useAppStore();

  const [refreshing, setRefreshing] = useState(false);

  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [usersTotal, setUsersTotal] = useState(0);
  const [users, setUsers] = useState([]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError('');
    try {
      const res = await api.get('/auth/admin/users');
      const { total_users, users: list } = res.data || {};
      setUsersTotal(Number(total_users ?? list?.length ?? 0));
      setUsers(Array.isArray(list) ? list : []);
    } catch (e) {
      setUsersError(e?.response?.data?.detail || e?.message || 'Failed to load users.');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);     
    setUsersError('');
    try {
      await Promise.allSettled([
        (async () => { try { await fetchAgents?.(); } catch {} })(),
        (async () => { try { await fetchAnalytics?.(); } catch {} })(),
        (async () => { try { await fetchSubscriptions?.(); } catch {} })(),
        (async () => { try { await loadUsers(); } catch {} })(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchAgents, fetchAnalytics, fetchSubscriptions, loadUsers]);

  useEffect(() => {
    (async () => {
      fetchAgents?.();
      fetchAnalytics?.();
      fetchSubscriptions?.();
      await loadUsers();
    })();
  }, [fetchAgents, fetchAnalytics, fetchSubscriptions, loadUsers]);

  const activeSubscriptions = useMemo(
    () => users.filter(u => String(u.subscription_status).toLowerCase() === 'active').length,
    [users]
  );

  const newUsers7d = useMemo(() => {
    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;
    return users.filter(u => {
      const d = new Date(u.created_at).getTime();
      return !Number.isNaN(d) && (now - d) <= week;
    }).length;
  }, [users]);

  const recentUsers = useMemo(() => {
    return [...users]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
      .map(u => ({
        id: u.id ?? u.user_id ?? u.uid,
        name: u.name || '—',
        company: u.company_name || '—',
        plan: formatPlanName(u.subscription_plan) || '—',
        joined: fmtRel(u.created_at),
      }));
  }, [users]);

  const totalCalls = analytics?.overview?.total_calls || 0;

  const topPerformingAgents = useMemo(() => {
    const perf = analytics?.agent_performance || [];
    const byType = {};
    perf.forEach(p => {
      const key = p.agent_type || p.name || 'Agent';
      if (!byType[key]) byType[key] = { name: key, totalCalls: 0, successRateAccum: 0, n: 0 };
      byType[key].totalCalls += Number(p.calls || 0);
      byType[key].successRateAccum += Number(p.success_rate || 0);
      byType[key].n += 1;
    });
    const rows = Object.values(byType).map(r => ({
      name: r.name,
      totalCalls: r.totalCalls,
      successRate: r.n ? Math.round((r.successRateAccum / r.n) * 100) / 100 : 0,
    }));
    return rows.sort((a, b) => b.totalCalls - a.totalCalls).slice(0, 3);
  }, [analytics]);

  const topRatedAgents = useMemo(() => {
    const perf = Array.isArray(analytics?.agent_performance) ? analytics.agent_performance : [];
    const MIN_CALLS = 1;
    const rows = perf
      .map(p => ({
        name: p.name || p.agent_name || 'Agent',
        calls: Number(p.calls || 0),
        successRate: Number(p.success_rate || 0),
      }))
      .filter(p => p.calls >= MIN_CALLS)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 3)
      .map(p => ({
        ...p,
        successRate: Math.max(0, Math.min(100, Number.isFinite(p.successRate) ? p.successRate : 0)),
      }));
    return rows;
  }, [analytics]);

  const isLoading = usersLoading || analyticsLoadingFlag || refreshing;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Overview"
        subtitle={`Welcome back, ${user?.name || 'Super Admin'}. Here's what's happening across the platform.`}
      >
        <div className="flex items-center space-x-3">
          <RefreshButton onClick={handleRefresh} isLoading={isLoading} />
          <Link to="/settings" className="btn btn-primary flex items-center py-3 px-5 rounded-xl">
            <CogIcon className="h-4 w-4 mr-2" />
            Platform Settings
          </Link>
        </div>
      </PageHeader>

      {isLoading ? (
        <KPISkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Users" value={usersTotal} icon={UserGroupIcon} variant="primary" />
          <StatCard title="Active Subscriptions" value={activeSubscriptions} icon={ChartBarIcon} variant="success" />
          <StatCard title="New Users (7d)" value={newUsers7d} icon={UserPlusIcon} variant="warning" />
          <StatCard title="Total Calls" value={totalCalls} icon={PhoneIcon} variant="secondary" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Recent Users</h2>
            <Link to="/user" className="text-sm text-primary-600 hover:text-primary-900">
              View All
            </Link>
          </div>

          {(usersLoading || refreshing) && <ListSkeleton rows={5} />}
          {usersError && !(usersLoading || refreshing) && <p className="text-sm text-red-600">{usersError}</p>}

          {!(usersLoading || refreshing) && !usersError && (
            <div className="divide-y divide-gray-200 rounded-lg border border-gray-200">
              {recentUsers.map((u, i) => {
                const hasId = Boolean(u.id);
                const Row = (
                  <div className="flex items-center justify-between p-3 hover:bg-gray-50 transition">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.name}</p>
                      <p className="text-sm text-gray-500">{u.company}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{u.plan}</p>
                      <p className="text-sm text-gray-500">{u.joined}</p>
                    </div>
                  </div>
                );
                return hasId ? (
                  <Link key={i} to={`/user/${u.id}`}>{Row}</Link>
                ) : (
                  <div key={i}>{Row}</div>
                );
              })}
              {recentUsers.length === 0 && <p className="text-sm text-gray-500 p-3">No users yet.</p>}
            </div>
          )}
        </div>

        {isLoading ? (
          <RightPaneSkeleton />
        ) : (
          <div className="card">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Top Performing Agent Types</h2>
            <div className="space-y-4">
              {topPerformingAgents.map((agent, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{agent.name}</p>
                    <p className="text-sm text-gray-500">{agent.totalCalls} total calls</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-green-600">
                      {Number.isFinite(agent.successRate) ? `${agent.successRate}%` : '0%'}
                    </p>
                    <p className="text-sm text-gray-500">Success Rate</p>
                  </div>
                </div>
              ))}
              {topPerformingAgents.length === 0 && (
                <p className="text-sm text-gray-500">No agent performance data yet.</p>
              )}
            </div>

            <div className="border-t mt-6 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Rated Agents</h3>
              <div className="space-y-3">
                {topRatedAgents.map((a, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{a.name}</p>
                      <p className="text-xs text-gray-500">{a.calls} calls</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-green-600">{a.successRate.toFixed(2)}%</span>
                    </div>
                  </div>
                ))}
                {topRatedAgents.length === 0 && (
                  <p className="text-sm text-gray-500">No agents with enough calls yet.</p>
                )}
              </div>
            </div>
          </div>
        )}
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

export default SuperAdminDashboard;