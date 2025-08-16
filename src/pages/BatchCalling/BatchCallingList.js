import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowDownTrayIcon,
  PlusIcon,
  PhoneIcon,
  ClockIcon,
  UserIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import useAppStore from '../../store/appStore';
import {
  RefreshButton,
  PageHeader,
  SearchAndFilters,
  KPISkeleton,
  TableSkeleton,
} from '../../lib/commonUtils';

const getStatusBadge = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'completed':   return 'bg-green-100 text-green-800';
    case 'pending':     return 'bg-yellow-100 text-yellow-800';
    case 'in_progress': return 'bg-blue-100 text-blue-800';
    case 'cancelled':   return 'bg-red-100 text-red-800';
    default:            return 'bg-gray-100 text-gray-800';
  }
};

const formatStatus = (s = '') =>
  String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const getCreatedAt = (job) => {
  const iso = job?.local_record?.created_at;
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const unix = job?.elevenlabs_live_status?.created_at_unix;
  if (unix != null) {
    const n = Number(unix);
    const ms = n > 1e12 ? n : n * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
};

const BatchCallingList = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const isFromUser = queryParams.get('fromUser') === 'true';

  const {
    batchCalling,
    fetchBatchCallingStatus,
    cancelBatchCalling,
    retryBatchCalling,
  } = useAppStore((s) => ({
    batchCalling: s.batchCalling,
    fetchBatchCallingStatus: s.fetchBatchCallingStatus,
    cancelBatchCalling: s.cancelBatchCalling,
    retryBatchCalling: s.retryBatchCalling,
  }));

  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowLoading, setRowLoading] = useState({});
  const itemsPerPage = 100;

  const doRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetchBatchCallingStatus?.();
    } finally {
      setIsLoading(false);
    }
  }, [fetchBatchCallingStatus]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      try {
        await fetchBatchCallingStatus?.();
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [fetchBatchCallingStatus]);

  const jobs = batchCalling?.jobs || [];

  const agentOptions = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.agent_name))).sort(),
    [jobs]
  );

  const filteredJobs = useMemo(() => {
    const term = (searchTerm || '').trim().toLowerCase();
    return jobs.filter((job) => {
      const call = String(job?.call_name || '').toLowerCase();
      const agent = String(job?.agent_name || '').toLowerCase();
      const matchesSearch = !term || call.includes(term) || agent.includes(term);
      const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
      const matchesAgent = agentFilter === 'all' || job.agent_name === agentFilter;
      return matchesSearch && matchesStatus && matchesAgent;
    });
  }, [jobs, searchTerm, statusFilter, agentFilter]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentJobs = filteredJobs.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / itemsPerPage));

  const clearSearch = () => setSearchTerm('');
  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setAgentFilter('all');
    setCurrentPage(1);
  };

  const exportCsv = useCallback(() => {
    const header = ['Batch Job ID','Batch Name','Agent','Total Jobs','Status','Created At'];
    const rowsToUse = filteredJobs.length ? filteredJobs : jobs;
    const body = rowsToUse.map((j) => {
      const created = getCreatedAt(j);
      return [
        j.batch_job_id || '',
        j.call_name || '',
        j.agent_name || '',
        (j.total_numbers ?? j.local_record?.total_numbers ?? '') || '',
        j.status || '',
        created ? `${created.toLocaleDateString()} ${created.toLocaleTimeString()}` : '',
      ];
    });

    const csv = [header, ...body]
      .map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'batch-calling.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredJobs, jobs]);

  const onCancelRow = async (job) => {
    const id = job.batch_job_id;
    const callName = String(job?.call_name || '').replace(/\s+/g, ' ').trim();
    if (!callName) return;
    setRowLoading((s) => ({ ...s, [id]: 'cancel' }));
    try {
      const res = await cancelBatchCalling(callName);
      if (res?.success) toast.success(`Batch '${callName}' cancelled`);
      else toast.error(res?.error || 'Failed to cancel');
    } finally {
      setRowLoading((s) => ({ ...s, [id]: '' }));
    }
  };

  const onRetryRow = async (job) => {
    const id = job.batch_job_id;
    const callName = String(job?.call_name || '').replace(/\s+/g, ' ').trim();
    if (!callName) return;
    setRowLoading((s) => ({ ...s, [id]: 'retry' }));
    try {
      const res = await retryBatchCalling(callName);
      if (res?.success) toast.success(`Batch '${callName}' retried`);
      else toast.error(res?.error || 'Failed to retry');
    } finally {
      setRowLoading((s) => ({ ...s, [id]: '' }));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Batch Calling">
        <div className="flex items-center gap-2">
          <RefreshButton onClick={doRefresh} isLoading={isLoading} />
          <button onClick={exportCsv} className="btn btn-secondary">
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export CSV
          </button>
          {!isFromUser && (
            <Link
              to="/batchcalling/batchcallingform"
              className="inline-flex items-center px-5 py-3 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-primary-600 hover:bg-primary-700"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Start New Batch Calling
            </Link>
          )}
        </div>
      </PageHeader>

      <p className="text-sm text-gray-600">
        Manage and monitor batch calling jobs
        {batchCalling?.lastFetched && (
          <span className="ml-2 text-gray-400">
            (last update {new Date(batchCalling.lastFetched).toLocaleString()})
          </span>
        )}
      </p>

      {isLoading ? (
        <KPISkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={PhoneIcon} label="Total Batches" value={filteredJobs.length} iconClass="text-primary-600" />
          <StatCard icon={ClockIcon} label="Running" value={filteredJobs.filter((j) => j.status === 'in_progress').length} iconClass="text-success-600" />
          <StatCard icon={UserIcon} label="Pending" value={filteredJobs.filter((j) => j.status === 'pending').length} iconClass="text-warning-600" />
          <StatCard icon={PhoneIcon} label="Cancelled" value={filteredJobs.filter((j) => j.status === 'cancelled').length} iconClass="text-secondary-600" />
        </div>
      )}

      <SearchAndFilters
        searchTerm={searchTerm}
        onSearchChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
        searchPlaceholder="Search batches..."
        filters={[
          {
            value: statusFilter,
            onChange: (e) => { setStatusFilter(e.target.value); setCurrentPage(1); },
            options: [
              { value: 'all', label: 'All Status' },
              { value: 'pending', label: 'Pending' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
          {
            value: agentFilter,
            onChange: (e) => { setAgentFilter(e.target.value); setCurrentPage(1); },
            options: [
              { value: 'all', label: 'All Agents' },
              ...agentOptions.map((agent) => ({ value: agent, label: agent })),
            ],
          },
        ]}
      />

      {isLoading ? (
        <TableSkeleton />
      ) : filteredJobs.length === 0 ? (
        <div className="card">
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="rounded-full bg-primary-50 p-4 mb-4">
              <PhoneIcon className="h-8 w-8 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No batch history yet</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md">
              You don't have any batches yet. Try adjusting filters, or start a new batch to see results here.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button onClick={clearSearch} className="btn btn-secondary btn-sm">Clear Search</button>
              <button onClick={resetFilters} className="btn btn-secondary btn-sm">Reset Filters</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white border rounded overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3">Batch Name</th>
                  <th className="px-6 py-3">Agent</th>
                  <th className="px-6 py-3">Total Jobs</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white text-sm">
                {currentJobs.map((job) => {
                  const isCancelable = ['pending', 'in_progress'].includes(job.status);
                  const loadingMode = rowLoading[job.batch_job_id];

                  return (
                    <tr key={job.batch_job_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">{job.call_name}</td>
                      <td className="px-6 py-4">{job.agent_name}</td>
                      <td className="px-6 py-4">{job.total_numbers ?? job.local_record?.total_numbers ?? '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(job.status)}`}>
                          {formatStatus(job.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {isCancelable ? (
                          <button
                            onClick={() => onCancelRow(job)}
                            disabled={loadingMode === 'cancel'}
                            className="text-red-600 hover:underline inline-flex items-center disabled:opacity-50"
                          >
                            <XCircleIcon className="h-4 w-4 mr-1" />
                            {loadingMode === 'cancel' ? 'Cancelling...' : 'Cancel'}
                          </button>
                        ) : (
                          <button
                            onClick={() => onRetryRow(job)}
                            disabled={loadingMode === 'retry'}
                            className="text-amber-600 hover:underline inline-flex items-center disabled:opacity-50"
                          >
                            {loadingMode === 'retry' ? (
                              <>
                                <ArrowPathIcon className="h-4 w-4 mr-1 animate-spin" />
                                Retrying...
                              </>
                            ) : (
                              <>
                                <ArrowPathIcon className="h-4 w-4 mr-1" />
                                Retry
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-white border rounded px-6 py-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing <span className="font-medium">{filteredJobs.length ? indexOfFirstItem + 1 : 0}</span> to{' '}
              <span className="font-medium">{Math.min(indexOfLastItem, filteredJobs.length)}</span> of{' '}
              <span className="font-medium">{filteredJobs.length}</span> results
            </p>
            <div className="flex items-center space-x-2">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-gray-700">{currentPage}</span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, iconClass = 'text-gray-600' }) => (
  <div className="card">
    <div className="flex items-center">
      <Icon className={`h-8 w-8 ${iconClass}`} />
      <div className="ml-5">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="text-lg font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  </div>
);

export default BatchCallingList;