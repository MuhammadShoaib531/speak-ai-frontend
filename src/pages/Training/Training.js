import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import {
  UserGroupIcon,
  PlayIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import {
  norm,
  num,
  clamp0to100,
  formatDate,
  normalizeAgent,
  getStatusColor,
  getTypeIcon,
  getTypeLabel,
  RefreshButton,
  PageHeader,
  SearchAndFilters,
} from '../../lib/commonUtils';
import api from '../../api/axiosInstance';

const KPISkeleton = () => (
  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="card animate-pulse">
        <div className="flex items-center">
          <div className="h-8 w-8 rounded bg-gray-200" />
          <div className="ml-5 flex-1">
            <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
            <div className="h-5 w-16 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const Training = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const fromUser = searchParams.get('fromUser') === 'true';
  const urlEmail = (searchParams.get('email') || '').trim();
  const stateEmail =
    (location.state &&
      (location.state.email ||
        location.state.user_email ||
        location.state.userEmail)) ||
    '';

  const { user: currentUser } = useAuthStore();
  const currentEmail = (currentUser?.email || currentUser?.user_email || '').trim();
  const currentEmailLc = currentEmail.toLowerCase();

  const resolvedEmail = (stateEmail || urlEmail || currentEmail || '').trim();

  const {
    agents: rawAgents,
    adminUserInfo,
    loading,
    agentsLoaded,
    setAgentsScope,
    loadAgentsForCurrentScope,
  } = useAppStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [error, setError] = useState('');

  const [refreshing, setRefreshing] = useState(false);

  const [trainingSummary, setTrainingSummary] = useState(null);
  const [statsIndex, setStatsIndex] = useState(() => new Map());

  const fetchTrainingStats = useCallback(async () => {
    try {
      const res = await api.post('/analysis/training/agent-individual-analytics', {});
      const list = Array.isArray(res?.data?.individual_results)
        ? res.data.individual_results
        : [];
      const m = new Map();
      list.forEach((r) => {
        if (r?.agent_id) m.set(String(r.agent_id), r);
      });
      setStatsIndex(m);
      setTrainingSummary(res?.data?.summary || null);
    } catch (e) {
    }
  }, []);

  useEffect(() => {
    setError('');
    if (resolvedEmail) {
      setAgentsScope({ type: 'user', email: resolvedEmail });
    } else {
      setAgentsScope({ type: 'self', email: null });
    }

    loadAgentsForCurrentScope().then((r) => {
      if (!r?.success && !r?.canceled) setError(r?.error || 'Error fetching agents');
    });

    fetchTrainingStats();
  }, [resolvedEmail, setAgentsScope, loadAgentsForCurrentScope, fetchTrainingStats]);

  const doRefresh = useCallback(async () => {
    setError('');
    try {
      setRefreshing(true);
      const [agentsRes] = await Promise.allSettled([
        loadAgentsForCurrentScope(),
        fetchTrainingStats(),
      ]);
      const rr = agentsRes?.value;
      if (!rr?.success && !rr?.canceled) setError(rr?.error || 'Error fetching agents');
    } finally {
      setRefreshing(false);
    }
  }, [loadAgentsForCurrentScope, fetchTrainingStats]);

  const rawByAnyId = useMemo(() => {
    const map = new Map();
    (rawAgents || []).forEach((a) => {
      if (a?.id != null) map.set(String(a.id), a);
      if (a?.agent_id) map.set(String(a.agent_id), a);
    });
    return map;
  }, [rawAgents]);

  const scopedRawAgents = useMemo(() => {
    if (fromUser && resolvedEmail) {
      const matchLc = resolvedEmail.toLowerCase();
      return (rawAgents || []).filter(
        (a) => String(a?.user_email || '').toLowerCase() === matchLc
      );
    }
    return rawAgents || [];
  }, [fromUser, resolvedEmail, rawAgents]);

  const agents = useMemo(() => {
    return (scopedRawAgents || []).map((raw) => {
      const base = normalizeAgent(raw);
      const key =
        String(base.id ?? base.agent_id ?? raw?.agent_id ?? raw?.id ?? '');
      const s = statsIndex.get(key);
      if (!s) return base;

      const srVal =
        typeof s.success_rate_value === 'number'
          ? s.success_rate_value
          : Number(String(s.success_rate || '').replace('%', '')) ||
            base.success_rate ||
            0;

      return {
        ...base,
        total_calls:
          (typeof s.total_calls === 'number' ? s.total_calls : base.total_calls) ??
          0,
        success_rate: srVal,
        average_call_duration:
          s.average_call_duration ??
          base.average_call_duration ??
          '0:00',
        average_call_duration_seconds:
          (typeof s.average_call_duration_seconds === 'number'
            ? s.average_call_duration_seconds
            : base.average_call_duration_seconds) ?? 0,
        is_active:
          typeof s.is_active === 'boolean' ? s.is_active : base.is_active,
        created_at: s.created_at ? s.created_at.replace(' ', 'T') : base.created_at,
      };
    });
  }, [scopedRawAgents, statsIndex]);

  const filteredAgents = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return (agents || []).filter((a) => {
      const nameMatch = (a.name || '').toLowerCase().includes(lower);
      const typeMatch = filterType === 'all' || a.type === norm(filterType);
      const statusMatch =
        filterStatus === 'all'
          ? true
          : filterStatus === 'Active'
          ? a.is_active === true
          : filterStatus === 'Inactive'
          ? a.is_active === false
          : true;
      return nameMatch && typeMatch && statusMatch;
    });
  }, [agents, searchTerm, filterType, filterStatus]);

  const totalAgents =
    trainingSummary?.total_agents ?? filteredAgents.length;
  const activeAgents =
    trainingSummary?.active_agents ??
    filteredAgents.filter((a) => a.is_active).length;
  const avgSuccessRate =
    typeof trainingSummary?.success_rate_value === 'number'
      ? Math.round(trainingSummary.success_rate_value)
      : filteredAgents.length
      ? Math.round(
          filteredAgents.reduce((s, a) => s + num(a.success_rate), 0) /
            filteredAgents.length
        )
      : 0;
  const avgFallback = Math.max(0, 100 - clamp0to100(avgSuccessRate));

  const isInitialLoading = loading || !agentsLoaded;
  const showSummaryLoading = isInitialLoading || refreshing;
  const showCardsLoading = isInitialLoading || refreshing;
  const isBusy = isInitialLoading || refreshing;

  const getOwnerEmailFromRaw = (agent) => {
    const key = String(agent?.id ?? agent?.agent_id ?? '');
    const raw = rawByAnyId.get(key);
    return String(
      raw?.user_email || raw?.owner_email || raw?.email || ''
    ).toLowerCase();
  };

  const canRetrain = (agent) => {
    const ownerLc = getOwnerEmailFromRaw(agent);
    return ownerLc && ownerLc === currentEmailLc;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Training"
        subtitle={
          resolvedEmail && adminUserInfo
            ? `Retrain agents for ${
                adminUserInfo.user_name || '—'
              } (${adminUserInfo.user_email || resolvedEmail}) — Total: ${
                adminUserInfo.total_agents ?? agents.length
              }`
            : 'Retrain and monitor your AI agents'
        }
      >
        <RefreshButton onClick={doRefresh} isLoading={isBusy} />
      </PageHeader>

      {showSummaryLoading ? (
        <KPISkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card">
            <div className="flex items-center">
              <UserGroupIcon className="h-8 w-8 text-primary-600" />
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-500">Total Agents</p>
                <p className="text-lg font-medium text-gray-900">{totalAgents}</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center">
              <PlayIcon className="h-8 w-8 text-green-600" />
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-500">Active Agents</p>
                <p className="text-lg font-medium text-gray-900">{activeAgents}</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center">
              <ChartBarIcon className="h-8 w-8 text-yellow-600" />
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-500">Avg Success Rate</p>
                <p className="text-lg font-medium text-gray-900">
                  {clamp0to100(avgSuccessRate)}%
                </p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center">
              <ChartBarIcon className="h-8 w-8 text-indigo-600" />
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-500">Avg Fall Back Rate</p>
                <p className="text-lg font-medium text-gray-900">{avgFallback}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <SearchAndFilters
        searchTerm={searchTerm}
        onSearchChange={(e) => setSearchTerm(e.target.value)}
        searchPlaceholder="Search agents..."
        disabled={isInitialLoading}
        filters={[
          {
            value: filterType,
            onChange: (e) => setFilterType(e.target.value),
            options: [
              { value: 'all', label: 'All Types' },
              { value: 'customer_support', label: 'Customer Support' },
              { value: 'lead_generation', label: 'Lead Generation' },
              { value: 'appointment_scheduling', label: 'Appointment Scheduling' },
              { value: 'unknown', label: 'Unknown' },
            ],
          },
          {
            value: filterStatus,
            onChange: (e) => setFilterStatus(e.target.value),
            options: [
              { value: 'all', label: 'All Status' },
              { value: 'Active', label: 'Active' },
              { value: 'Inactive', label: 'Inactive' },
            ],
          },
        ]}
      />

      {error && <div className="card p-4 text-sm text-red-600">{error}</div>}

      {showCardsLoading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="h-6 w-6 rounded-full bg-gray-200" />
                  <div className="ml-3">
                    <div className="h-4 w-28 bg-gray-200 rounded" />
                    <div className="h-3 w-20 bg-gray-200 rounded mt-2" />
                  </div>
                </div>
                <div className="h-5 w-16 bg-gray-200 rounded-full" />
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="h-6 w-16 bg-gray-200 rounded mx-auto" />
                <div className="h-6 w-16 bg-gray-200 rounded mx-auto" />
                <div className="h-6 w-16 bg-gray-200 rounded mx-auto" />
              </div>
              <div className="h-3 w-32 bg-gray-200 rounded mb-4" />
              <div className="flex justify-end">
                <div className="h-8 w-24 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredAgents.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => {
            const id = agent.id ?? agent.agent_id;
            const name = agent.name;
            const type = agent.type;
            const total_calls = agent.total_calls;
            const success_rate = agent.success_rate;
            const average_call_duration = agent.average_call_duration;
            const created_at = agent.created_at;
            const retrainAllowed = canRetrain(agent);

            return (
              <div key={id} className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <span className="text-2xl">{getTypeIcon(type)}</span>
                    <div className="ml-3">
                      <h3 className="text-lg font-medium text-gray-900">{name}</h3>
                      <p className="text-sm text-gray-500">{getTypeLabel(type)}</p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                      agent.is_active ? 'active' : 'inactive'
                    )}`}
                  >
                    {agent.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-lg font-medium text-gray-900">{total_calls}</div>
                    <div className="text-xs text-gray-500">Total Calls</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-medium text-gray-900">
                      {clamp0to100(success_rate)}%
                    </div>
                    <div className="text-xs text-gray-500">Success Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-medium text-gray-900">
                      {average_call_duration || '0:00'}
                    </div>
                    <div className="text-xs text-gray-500">Avg Call Time</div>
                  </div>
                </div>

                <div className="text-xs text-gray-500 mb-4">
                  <p>Created: {created_at ? formatDate(created_at) : '—'}</p>
                </div>

                <div className="flex justify-end">
                  {retrainAllowed ? (
                    <Link
                      to={`/agents/${id}/retrain`}
                      className="btn btn-primary btn-sm py-2 px-4 rounded-xl"
                      title="Retrain Agent"
                    >
                      Retrain Agent
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="btn btn-primary btn-sm py-2 px-4 rounded-xl opacity-50 cursor-not-allowed"
                      title="Retraining disabled for this agent"
                    >
                      Retrain Agent
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 px-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto mb-6 h-14 w-14 text-gray-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 2a9 9 0 00-9 9v2a9 9 0 009 9 9 9 0 009-9v-2a9 9 0 00-9-9z"
            />
            <circle cx="9" cy="10" r="1" fill="currentColor" />
            <circle cx="15" cy="10" r="1" fill="currentColor" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 15c1.333 1 2.667 1 4 0"
            />
          </svg>
          <h3 className="mt-2 text-lg font-semibold text-gray-900">No agents found</h3>
          {resolvedEmail ? (
            <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
              No agents for <span className="font-medium">{resolvedEmail}</span>.
            </p>
          ) : (
            <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
              You haven't created any AI agents yet. You can{' '}
              <Link
                to="/agents/create"
                className="text-primary-600 hover:text-primary-800 font-medium"
              >
                create an agent
              </Link>{' '}
              to get started.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Training;
