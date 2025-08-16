import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ArrowDownTrayIcon,
  PhoneIcon,
  ClockIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import useAppStore from '../../store/appStore';
import {
  norm,
  toMMSS,
  toHHMMSS,
  parseDuration,
  getStatusBadgeClass,
  KPISkeleton,
  TableSkeleton,
  RefreshButton,
  PageHeader,
  SearchAndFilters,
} from '../../lib/commonUtils';

const compactPad = 'px-4 py-3';



const CallLogs = () => {
  const { callHistory, fetchCallHistory } = useAppStore();

  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterAgent, setFilterAgent] = useState('all');

  const doRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetchCallHistory?.(50);
    } finally {
      setIsLoading(false);
    }
  }, [fetchCallHistory]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      try {
        await fetchCallHistory?.(50);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [fetchCallHistory]);

  const rows = useMemo(() => {
    const list = Array.isArray(callHistory) ? callHistory : [];
    return list.map((r, idx) => ({
      id: r.id ?? r.call_id ?? r.sid ?? idx,
      timestamp: (() => {
        const v = r.timestamp ?? r.time ?? r.created_at ?? r.createdAt ?? r.start_time;
        const d = typeof v === 'number' ? new Date(v * (v < 2000000000 ? 1000 : 1)) : new Date(v);
        return Number.isNaN(d.getTime()) ? null : d;
      })(),
      customerName: r.customer_name ?? r.caller_name ?? r.customer ?? r.name ?? 'Unknown',
      customerPhone: r.customer_phone ?? r.caller ?? r.phone ?? r.number ?? '',
      agent: r.agent_name ?? r.agent ?? r.agent_id ?? '—',
      durationLabel: parseDuration(r.duration_label ?? r.duration ?? r.duration_seconds),
      durationSeconds: Number(r.duration_seconds ?? r.duration ?? 0),
      status: r.status ?? r.call_status ?? 'completed',
      type: r.type ?? r.direction ?? 'inbound',
    }));
  }, [callHistory]);

  const agentOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => { if (r.agent && r.agent !== '—') set.add(r.agent); });
    return Array.from(set);
  }, [rows]);

  const filteredRows = useMemo(() => {
    const needle = norm(searchTerm);
    return rows.filter((r) => {
      const matchesSearch =
        norm(r.customerName).includes(needle) ||
        norm(r.customerPhone).includes(needle) ||
        norm(r.agent).includes(needle);

      const matchesStatus = filterStatus === 'all' || norm(r.status) === norm(filterStatus);
      const matchesAgent = filterAgent === 'all' || r.agent === filterAgent;

      return matchesSearch && matchesStatus && matchesAgent;
    });
  }, [rows, searchTerm, filterStatus, filterAgent]);

  const totalCalls = filteredRows.length || rows.length;

  const avgDurationSecs = useMemo(() => {
    const secList = rows.map((r) => Number(r.durationSeconds)).filter((n) => Number.isFinite(n) && n > 0);
    if (!secList.length) return null;
    const sum = secList.reduce((a, b) => a + b, 0);
    return Math.round(sum / secList.length);
  }, [rows]);
  const avgDurationLabel = avgDurationSecs == null ? '—' : toMMSS(avgDurationSecs);

  const totalDurationSecs = useMemo(() => {
    const secList = rows.map((r) => Number(r.durationSeconds)).filter((n) => Number.isFinite(n) && n > 0);
    if (!secList.length) return null;
    return secList.reduce((a, b) => a + b, 0);
  }, [rows]);
  const totalDurationLabel = totalDurationSecs == null ? '—' : toHHMMSS(totalDurationSecs);

  const successRate = useMemo(() => {
    if (!rows.length) return 0;
    const ok = rows.filter((r) => ['completed', 'succeeded', 'success'].includes(norm(r.status))).length;
    return Math.round((ok / rows.length) * 100);
  }, [rows]);

  const exportCsv = useCallback(() => {
    const header = ['Timestamp','Customer Name','Customer Phone','Agent','Duration','Status','Type'];
    const body = (filteredRows.length ? filteredRows : rows).map((r) => [
      r.timestamp ? `${r.timestamp.toLocaleDateString()} ${r.timestamp.toLocaleTimeString()}` : '',
      r.customerName || '',
      r.customerPhone || '',
      r.agent || '',
      r.durationLabel || '',
      r.status || '',
      r.type || '',
    ]);
    const rowsCsv = [header, ...body]
      .map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([rowsCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'call-logs.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredRows, rows]);

  const clearSearch = () => setSearchTerm('');
  const resetFilters = () => {
    setSearchTerm('');
    setFilterStatus('all');
    setFilterAgent('all');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Call Logs"
        subtitle="View call recordings and transcripts"
      >
        <div className="flex items-center gap-2">
          <RefreshButton onClick={doRefresh} isLoading={isLoading} />
          <button onClick={exportCsv} className="btn btn-secondary">
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export Logs
          </button>
        </div>
      </PageHeader>

      {isLoading ? (
        <KPISkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card">
            <div className="flex items-center">
              <PhoneIcon className="h-8 w-8 text-primary-600" />
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-500">Total Calls</p>
                <p className="text-lg font-medium text-gray-900">{totalCalls}</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center">
              <ClockIcon className="h-8 w-8 text-success-600" />
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-500">Avg Duration</p>
                <p className="text-lg font-medium text-gray-900">{avgDurationLabel}</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center">
              <UserIcon className="h-8 w-8 text-warning-600" />
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-500">Success Rate</p>
                <p className="text-lg font-medium text-gray-900">{successRate}%</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center">
              <ClockIcon className="h-8 w-8 text-secondary-600" />
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-500">Total Duration</p>
                <p className="text-lg font-medium text-gray-900">{totalDurationLabel}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <SearchAndFilters
        searchTerm={searchTerm}
        onSearchChange={(e) => setSearchTerm(e.target.value)}
        searchPlaceholder="Search calls..."
        filters={[
          {
            value: filterStatus,
            onChange: (e) => setFilterStatus(e.target.value),
            options: [
              { value: 'all', label: 'All Status' },
              { value: 'completed', label: 'Completed' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'missed', label: 'Missed' },
            ],
          },
          {
            value: filterAgent,
            onChange: (e) => setFilterAgent(e.target.value),
            options: [
              { value: 'all', label: 'All Agents' },
              ...agentOptions.map((a) => ({ value: a, label: a })),
            ],
          },
        ]}
      />

      {isLoading ? (
        <TableSkeleton rows={6} compactPad={compactPad} />
      ) : filteredRows.length === 0 ? (
        <div className="card">
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="rounded-full bg-primary-50 p-4 mb-4">
              <PhoneIcon className="h-8 w-8 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No call history yet</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md">
              You don't have any calls yet. Try adjusting filters, or start making calls to see them here.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button onClick={clearSearch} className="btn btn-secondary btn-sm">Clear Search</button>
              <button onClick={resetFilters} className="btn btn-secondary btn-sm">Reset Filters</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-full">
              <div className="bg-gray-50">
                <div className={`grid grid-cols-5 ${compactPad}`}>
                  <div className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Call Info</div>
                  <div className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</div>
                  <div className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</div>
                  <div className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</div>
                  <div className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</div>
                </div>
              </div>

              {filteredRows.map((r) => (
                <div key={r.id} className={`grid grid-cols-5 ${compactPad} hover:bg-gray-50 border-b border-gray-100`}>
                  <div className="whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {r.timestamp ? r.timestamp.toLocaleDateString() : '—'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {r.timestamp ? r.timestamp.toLocaleTimeString() : '—'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {norm(r.type) === 'inbound' ? '📞 Inbound' : '📱 Outbound'}
                    </div>
                  </div>

                  <div className="whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{r.customerName}</div>
                    <div className="text-sm text-gray-500">{r.customerPhone}</div>
                  </div>

                  <div className="whitespace-nowrap">
                    <div className="text-sm text-gray-900">{r.agent}</div>
                  </div>

                  <div className="whitespace-nowrap">
                    <div className="text-sm text-gray-900">{r.durationLabel}</div>
                  </div>

                  <div className="whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(r.status)}`}>
                      {r.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{filteredRows.length ? 1 : 0}</span> to{' '}
              <span className="font-medium">{filteredRows.length}</span> of{' '}
              <span className="font-medium">{rows.length}</span> results
            </p>
            <div className="flex items-center space-x-2">
              <button className="btn btn-secondary btn-sm" disabled>Previous</button>
              <span className="px-3 py-1 text-sm text-gray-700">1</span>
              <button className="btn btn-secondary btn-sm" disabled>Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallLogs;
