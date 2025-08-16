import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import api from '../../api/axiosInstance';
import {
  PencilIcon,
  TrashIcon,
  PlayIcon as ResumeIcon,
  PauseIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import {
  norm,
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

const AgentList = () => {
  const [searchParams] = useSearchParams();
  const fromUser = searchParams.get('fromUser') === 'true';
  const urlEmail = (searchParams.get('email') || '').trim();

  const { user: currentUser } = useAuthStore();
  const currentEmail = (currentUser?.email || currentUser?.user_email || '').trim();
  const currentEmailLc = currentEmail.toLowerCase();
  const targetEmail = (fromUser && urlEmail) ? urlEmail : (urlEmail || currentEmail || '');

  const {
    agents: rawAgents,
    adminUserInfo,
    loading,
    agentsLoaded,
    setAgentsScope,
    loadAgentsForCurrentScope,
    deleteAgent,
    pauseAgent,
    resumeAgent,
  } = useAppStore();

  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');
  const [statsById, setStatsById] = useState(() => new Map());

  const fetchAgentStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError('');
    try {
      const res = await api.post('/analysis/training/agent-individual-analytics', {});
      const rows = Array.isArray(res?.data?.individual_results) ? res.data.individual_results : [];
      const map = new Map();
      rows.forEach((r) => {
        const key = String(r?.agent_id || r?.id || '').trim();
        if (key) map.set(key, r);
      });
      setStatsById(map);
    } catch (e) {
      setStatsError(e?.response?.data?.message || e?.message || 'Failed to load agent stats');
      setStatsById(new Map());
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!targetEmail) return;
    setStatsError('');
    setAgentsScope({ type: 'user', email: targetEmail });
    loadAgentsForCurrentScope().then((r) => {
      if (!r?.success && !r?.canceled) {
      }
    });
    fetchAgentStats();
  }, [targetEmail, setAgentsScope, loadAgentsForCurrentScope, fetchAgentStats]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [error, setError] = useState('');

  const rawByAnyId = useMemo(() => {
    const map = new Map();
    (rawAgents || []).forEach((a) => {
      if (a?.id != null) map.set(String(a.id), a);
      if (a?.agent_id) map.set(String(a.agent_id), a);
    });
    return map;
  }, [rawAgents]);

  const scopedRawAgents = useMemo(() => {
    if (fromUser && urlEmail) {
      const matchLc = urlEmail.toLowerCase();
      return (rawAgents || []).filter(a => String(a?.user_email || '').toLowerCase() === matchLc);
    }
    return rawAgents || [];
  }, [fromUser, urlEmail, rawAgents]);

  const agents = useMemo(() => (scopedRawAgents || []).map(normalizeAgent), [scopedRawAgents]);

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

  const doRefresh = useCallback(async () => {
    if (!targetEmail) return;
    setError('');
    const [r1] = await Promise.allSettled([
      loadAgentsForCurrentScope(),
      (async () => { try { await fetchAgentStats(); } catch {} })(),
    ]);
    if (r1.status === 'fulfilled') {
      const r = r1.value;
      if (!r?.success && !r?.canceled) setError(r?.error || 'Error fetching agents');
    } else {
      setError('Error fetching agents');
    }
  }, [loadAgentsForCurrentScope, targetEmail, fetchAgentStats]);

  const refetchScoped = async () => {
    if (!targetEmail) return;
    await Promise.allSettled([loadAgentsForCurrentScope(), fetchAgentStats()]);
  };

  const getOwnerEmailFromRaw = (agent) => {
    const key = String(agent?.id ?? agent?.agent_id ?? '');
    const raw = rawByAnyId.get(key);
    return String(raw?.user_email || raw?.owner_email || raw?.email || '').toLowerCase();
  };

  const canEdit = (agent) => {
    const ownerLc = getOwnerEmailFromRaw(agent);
    return ownerLc && ownerLc === currentEmailLc;
  };

  const handleDelete = async (agentId) => {
    if (!window.confirm('Are you sure you want to delete this agent?')) return;
    const r = await deleteAgent(agentId);
    if (!r.success) {
      setError(r.error || 'Error deleting agent');
      return;
    }
    await refetchScoped();
  };

  const handlePauseToggle = async (agent) => {
    const id = agent?.id ?? agent?.agent_id;
    if (!id) return;
    const r = agent.is_active ? await pauseAgent(id) : await resumeAgent(id);
    if (!r.success) setError(r.error || 'Error updating agent status');
    await refetchScoped();
  };

  const isListLoading = loading || !agentsLoaded;
  const isBusy = isListLoading || statsLoading; 

  const formatDuration = (seconds) => {
    const sec = Number(seconds) || 0;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Agents"
        subtitle={
          targetEmail && adminUserInfo
            ? `Viewing agents for ${adminUserInfo.user_name || '—'} (${adminUserInfo.user_email || targetEmail})`
            : 'Manage and monitor your AI agents'
        }
      >
        <div className="flex items-center space-x-3">
          <RefreshButton onClick={doRefresh} isLoading={isBusy} />
          {(!fromUser || (adminUserInfo?.user_email && adminUserInfo.user_email.toLowerCase() === currentEmailLc)) && (
            <Link
              to="/agents/create"
              className="inline-flex items-center px-5 py-3 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Agent
            </Link>
          )}
        </div>
      </PageHeader>

      <SearchAndFilters
        searchTerm={searchTerm}
        onSearchChange={(e) => setSearchTerm(e.target.value)}
        searchPlaceholder="Search agents..."
        disabled={isListLoading}
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

      {(error || statsError) && (
        <div className="card p-4 text-sm text-red-600">
          {error || statsError}
        </div>
      )}

      {isListLoading ? (
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
              <div className="flex justify-between">
                <div className="h-4 w-16 bg-gray-200 rounded" />
                <div className="h-8 w-24 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredAgents.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => {
            const id = agent?.id ?? agent?.agent_id;
            const name = agent.name;
            const type = agent.type;

            const stat = statsById.get(String(agent?.agent_id || agent?.id || '')) || {};
            const total_calls = (Number.isFinite(Number(stat.total_calls)) ? Number(stat.total_calls) : agent.total_calls) ?? 0;
            const success_rate_value = (Number.isFinite(Number(stat.success_rate_value)) ? Number(stat.success_rate_value) : clamp0to100(agent.success_rate)) ?? 0;
            const avg_secs =
              Number.isFinite(Number(stat.average_call_duration_seconds))
                ? Number(stat.average_call_duration_seconds)
                : 0;
            const average_call_duration =
              avg_secs > 0 ? formatDuration(avg_secs) : (agent.average_call_duration || '0:00');

            const created_at =
              agent.created_at ||
              stat.created_at ||
              null;

            const allowEdit = canEdit(agent);

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
                      {clamp0to100(success_rate_value)}%
                    </div>
                    <div className="text-xs text-gray-500">Success Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-medium text-gray-900">{average_call_duration}</div>
                    <div className="text-xs text-gray-500">Avg Call Time</div>
                  </div>
                </div>

                <div className="text-xs text-gray-500 mb-4">
                  <p>Created: {created_at ? formatDate(created_at) : '—'}</p>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex space-x-2">
                    <Link
                      to={allowEdit ? `/agents/${id}/edit` : '#'}
                      onClick={(e) => { if (!allowEdit) e.preventDefault(); }}
                      className={`${allowEdit ? 'text-gray-400 hover:text-gray-600' : 'text-gray-300 cursor-not-allowed'}`}
                      title={allowEdit ? 'Edit Agent' : 'Editing disabled for this agent'}
                    >
                      <PencilIcon className="h-4 w-4" />
                    </Link>

                    <button
                      onClick={() => handleDelete(id)}
                      className="text-gray-400 hover:text-red-600"
                      title="Delete Agent"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex space-x-2">
                    {agent.is_active ? (
                      <button
                        onClick={() => handlePauseToggle(agent)}
                        className="btn btn-secondary btn-sm inline-flex items-center py-2 px-4 rounded-xl"
                        title="Pause Agent"
                      >
                        <PauseIcon className="h-4 w-4 mr-1" />
                        <span>Pause</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePauseToggle(agent)}
                        className="btn btn-primary btn-sm inline-flex items-center py-2 px-4 rounded-xl"
                        title="Resume Agent"
                      >
                        <ResumeIcon className="h-4 w-4 mr-1" />
                        <span>Resume</span>
                      </button>
                    )}
                  </div>
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a9 9 0 00-9 9v2a9 9 0 009 9 9 9 0 009-9v-2a9 9 0 00-9-9z" />
            <circle cx="9" cy="10" r="1" fill="currentColor" />
            <circle cx="15" cy="10" r="1" fill="currentColor" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 15c1.333 1 2.667 1 4 0" />
          </svg>
          <h3 className="mt-2 text-lg font-semibold text-gray-900">No agents found</h3>
          {targetEmail ? (
            <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
              No agents for <span className="font-medium">{targetEmail}</span>.
            </p>
          ) : (
            <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
              You haven't created any AI agents yet. You can{' '}
              <Link to="/agents/create" className="text-primary-600 hover:text-primary-800 font-medium">
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

export default AgentList;