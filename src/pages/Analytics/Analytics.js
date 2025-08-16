import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ChartBarIcon,
  ArrowDownTrayIcon,
  PhoneIcon,
  UserGroupIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import {
  AreaChart,
  Area,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import useAppStore from '../../store/appStore';
import api from '../../api/axiosInstance';
import {
  RefreshButton,
  PageHeader,
  KPISkeleton,
  TableSkeleton,
  ListSkeleton,
  compact,
} from '../../lib/commonUtils';

const DEFAULT_RANGE = 'all';

const Analytics = () => {
  const {
    analytics,
    fetchAnalytics,
    agents,        
    fetchAgents,   
    loading,        
  } = useAppStore();

  const [perfAgents, setPerfAgents] = useState([]);
  const [perfLoading, setPerfLoading] = useState(true);

  useEffect(() => {
    fetchAgents?.();
  }, [fetchAgents]);

  useEffect(() => {
    fetchAnalytics?.({ range: DEFAULT_RANGE });
  }, [fetchAnalytics]);

  const fetchIndividualPerformance = useCallback(async () => {
    setPerfLoading(true);
    try {
      const res = await api.post('/analysis/training/agent-individual-analytics', {});
      const rows = Array.isArray(res?.data?.individual_results) ? res.data.individual_results : [];
      setPerfAgents(rows);
    } catch (e) {
      console.error('Failed to fetch individual performance', e);
      setPerfAgents([]);
    } finally {
      setPerfLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIndividualPerformance();
  }, [fetchIndividualPerformance]);

  const doRefresh = useCallback(() => {
    fetchAgents?.();
    fetchAnalytics?.({ range: DEFAULT_RANGE });
    fetchIndividualPerformance();
  }, [fetchAgents, fetchAnalytics, fetchIndividualPerformance]);

  const formatDuration = (seconds) => {
    const sec = Number(seconds) || 0;
    const minutes = Math.floor(sec / 60);
    const remainingSeconds = sec % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const safeNumber = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const rawHourly =
    analytics?.call_patterns ||
    analytics?.hourly_distribution ||
    analytics?.calls_by_hour ||
    [];

  const rawDaily =
    analytics?.daily_calls ||
    analytics?.calls_by_day ||
    analytics?.daily ||
    [];

  const rawWeekly =
    analytics?.weekly_performance ||
    analytics?.weekly ||
    [];

  const callPatternsData = useMemo(() => {
    return (rawHourly || []).map((p) => ({
      hour: p?.hour ?? p?.time ?? p?.label ?? '—',
      calls: safeNumber(p?.total_calls ?? p?.calls ?? p?.count),
      success: safeNumber(p?.successful_calls ?? p?.success ?? p?.successful),
    }));
  }, [rawHourly]);

  const callsByDayData = useMemo(() => {
    return (rawDaily || []).map((d) => ({
      date: d?.date ?? d?.day ?? d?.label ?? '—',
      calls: safeNumber(d?.calls ?? d?.total_calls ?? d?.count),
      successRate:
        typeof d?.success_rate_value === 'number'
          ? d.success_rate_value
          : (typeof d?.successRate === 'number' ? d.successRate : null),
    }));
  }, [rawDaily]);

  const weeklyPerformanceData = useMemo(() => {
    return (rawWeekly || []).map((w) => ({
      day: w?.day || w?.week || '—',
      calls: safeNumber(w?.calls ?? w?.total_calls),
      successRate:
        typeof w?.success_rate_value === 'number'
          ? w.success_rate_value
          : (typeof w?.successRate === 'number' ? w.successRate : null),
    }));
  }, [rawWeekly]);

  const hasWeeklySuccess = weeklyPerformanceData.some(
    (d) => typeof d.successRate === 'number'
  );

  const parseMMSS = (mmss) => {
    if (!mmss || typeof mmss !== 'string') return 0;
    const [m = 0, s = 0] = mmss.split(':').map((n) => parseInt(n || '0', 10));
    return (Number.isFinite(m) ? m : 0) * 60 + (Number.isFinite(s) ? s : 0);
  };

  const agentPerformanceData = useMemo(() => {
    return (perfAgents || []).map((a) => ({
      id: a?.agent_id || a?.id || null,
      name: a?.agent_name || a?.name || 'Agent',
      calls: safeNumber(a?.total_calls),
      successRate: safeNumber(
        a?.success_rate_value ?? a?.successRate ?? a?.success_rate
      ),
      avgDuration:
        safeNumber(
          a?.average_call_duration_seconds ?? a?.avg_call_time_seconds,
          0
        ) || parseMMSS(a?.average_call_duration ?? a?.avg_call_time),
    }));
  }, [perfAgents]);

  const baseOverview = analytics?.overview || {
    total_calls: 0,
    success_rate: '0%',
    success_rate_value: 0,
    average_call_duration: '0:00',
    average_call_duration_seconds: 0,
    active_agent_count: 0,
  };
  const kpi = baseOverview;

  const activeAgentsCount = useMemo(() => {
    if (typeof baseOverview.active_agent_count === 'number') {
      return baseOverview.active_agent_count;
    }
    return (agents || []).filter((a) =>
      (a?.is_active === undefined || a?.is_active === null) ? true : !!a.is_active
    ).length;
  }, [agents, baseOverview.active_agent_count]);

  const colorClass = {
    primary: 'text-primary-600',
    success: 'text-success-600',
    warning: 'text-amber-600',
    secondary: 'text-gray-600',
  };

  const StatCard = ({ title, value, icon: Icon, color = 'primary', format = 'number' }) => (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex items-center min-w-0 flex-1">
          <div className="flex-shrink-0 mr-4">
            <Icon className={`h-8 w-8 ${colorClass[color] || colorClass.secondary}`} />
          </div>
          <div className="min-w-0 flex-1">
            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
            <dd className="text-xl font-bold text-gray-900">
              {format === 'percentage'
                ? `${safeNumber(value)}%`
                : format === 'duration'
                ? formatDuration(value)
                : compact(value)}
            </dd>
          </div>
        </div>
      </div>
    </div>
  );

  const periodLabel =
    analytics?.data_period?.start_date && analytics?.data_period?.end_date
      ? ` · ${analytics.data_period.start_date} → ${analytics.data_period.end_date}`
      : '';

  const isBusy = loading || perfLoading;

  const exportReport = useCallback(() => {
    try {
      const rows = [];
      rows.push(['=== OVERVIEW ===']);
      rows.push(['Total Calls', kpi.total_calls ?? 0]);
      rows.push([
        'Success Rate',
        typeof kpi.success_rate_value === 'number' ? `${kpi.success_rate_value}%` : (kpi.success_rate ?? '0%'),
      ]);
      rows.push(['Avg Call Duration', kpi.average_call_duration ?? '0:00']);
      rows.push(['Active Agents', activeAgentsCount]);
      rows.push([]);

      rows.push(['=== WEEKLY PERFORMANCE ===']);
      rows.push(['Day/Week', 'Calls', 'Success Rate (%)']);
      (weeklyPerformanceData || []).forEach((r) =>
        rows.push([r.day, r.calls, r.successRate ?? ''])
      );
      rows.push([]);

      if ((callPatternsData?.length ?? 0) > 0) {
        rows.push(['=== CALLS BY HOUR ===']);
        rows.push(['Hour', 'Calls', 'Successful']);
        callPatternsData.forEach((r) => rows.push([r.hour, r.calls, r.success]));
      } else if ((callsByDayData?.length ?? 0) > 0) {
        rows.push(['=== CALLS BY DAY ===']);
        rows.push(['Date/Day', 'Calls', 'Success Rate (%)']);
        callsByDayData.forEach((r) =>
          rows.push([r.date, r.calls, r.successRate ?? ''])
        );
      }
      rows.push([]);

      rows.push(['=== AGENT PERFORMANCE ===']);
      rows.push(['Agent', 'Calls', 'Success Rate (%)', 'Avg Duration (sec)']);
      (agentPerformanceData || []).forEach((r) =>
        rows.push([r.name, r.calls, r.successRate, r.avgDuration])
      );

      const csv = rows
        .map((r) =>
          r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
        )
        .join('\n');

      const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const start = analytics?.data_period?.start_date || '';
      const end = analytics?.data_period?.end_date || '';
      a.href = url;
      a.download = `analytics_report_${start}_${end || 'today'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  }, [
    kpi,
    activeAgentsCount,
    weeklyPerformanceData,
    callPatternsData,
    callsByDayData,
    agentPerformanceData,
    analytics?.data_period?.start_date,
    analytics?.data_period?.end_date,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <div className="flex items-center">
            <ChartBarIcon className="h-6 w-6 mr-2" />
            Analytics
          </div>
        }
        subtitle={`Detailed insights into your AI agent performance${periodLabel}`}
      >
        <div className="flex space-x-3">
          <RefreshButton onClick={doRefresh} isLoading={isBusy} />
          <button className="btn btn-secondary" onClick={exportReport}>
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export Report
          </button>
        </div>
      </PageHeader>

      {loading ? (
        <KPISkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Calls"
            value={kpi.total_calls ?? 0}
            icon={PhoneIcon}
            color="primary"
          />
          <StatCard
            title="Success Rate"
            value={kpi.success_rate_value ?? 0}
            icon={CheckCircleIcon}
            color="success"
            format="percentage"
          />
          <StatCard
            title="Avg Call Duration"
            value={kpi.average_call_duration_seconds ?? 0}
            icon={ClockIcon}
            color="warning"
            format="duration"
          />
          <StatCard
            title="Active Agents"
            value={activeAgentsCount}
            icon={UserGroupIcon}
            color="secondary"
          />
        </div>
      )}

      <div className="card">
        <div className="mb-2">
          <h3 className="text-lg font-medium text-gray-900">
            {(callPatternsData?.length ?? 0) > 0 ? 'Calls by Hour' : 'Calls by Day'}
          </h3>
          <p className="text-sm text-gray-500">
            {(callPatternsData?.length ?? 0) > 0
              ? 'Distribution of calls across hours'
              : 'Daily call volume'}
          </p>
        </div>

        {loading ? (
          <TableSkeleton rows={8} />
        ) : (callPatternsData?.length ?? 0) > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={callPatternsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis allowDecimals={false} tickFormatter={(v) => compact(v)} />
              <Tooltip formatter={(v, n) => [v, n]} />
              <Legend />
              <Area type="monotone" dataKey="calls" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.1} name="Calls" />
              <Area type="monotone" dataKey="success" stroke="#10B981" fill="#10B981" fillOpacity={0.1} name="Successful" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (callsByDayData?.length ?? 0) > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={callsByDayData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} tickFormatter={(v) => compact(v)} />
              <Tooltip
                formatter={(val, name) =>
                  name.includes('Rate') ? [`${val}%`, name] : [val, name]
                }
              />
              <Legend />
              <Bar dataKey="calls" name="Calls" fill="#3B82F6" />
              {callsByDayData.some((d) => typeof d.successRate === 'number') && (
                <Line
                  type="monotone"
                  dataKey="successRate"
                  name="Success Rate (%)"
                  stroke="#10B981"
                  strokeWidth={3}
                  dot={false}
                  yAxisId="right"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-sm text-gray-500">
            No hourly or daily breakdown available for this selection.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card">
          <div className="mb-2">
            <h3 className="text-lg font-medium text-gray-900">Weekly Performance</h3>
            <p className="text-sm text-gray-500">Calls per day with success rate</p>
          </div>
          {loading ? (
            <TableSkeleton rows={6} />
          ) : (weeklyPerformanceData?.length ?? 0) === 0 ? (
            <div className="text-sm text-gray-500">No weekly data for this selection.</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={weeklyPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis yAxisId="left" allowDecimals={false} tickFormatter={(v) => compact(v)} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  formatter={(val, name) =>
                    name.includes('Rate') ? [`${val}%`, name] : [val, name]
                  }
                />
                <Legend />
                <Bar yAxisId="left" dataKey="calls" fill="#3B82F6" name="Calls" />
                {hasWeeklySuccess && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="successRate"
                    stroke="#10B981"
                    strokeWidth={3}
                    dot={false}
                    name="Success Rate (%)"
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <div className="mb-2">
            <h3 className="text-lg font-medium text-gray-900">Agent Performance</h3>
            <p className="text-sm text-gray-500">Individual agent statistics</p>
          </div>
          {isBusy ? (
            <ListSkeleton rows={3} />
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-4">
              {agentPerformanceData.length > 0 ? (
                agentPerformanceData.map((agent, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">{agent.name}</h4>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-xs text-gray-500">{agent.calls} calls</span>
                        <span className="text-xs text-gray-500">{Number(agent.successRate || 0)}% success</span>
                        <span className="text-xs text-gray-500">{formatDuration(agent.avgDuration)} avg</span>
                      </div>
                    </div>
                    <div className="w-24 h-2 bg-gray-200 rounded-full">
                      <div
                        className="h-2 bg-primary-600 rounded-full"
                        style={{
                          width: `${Math.max(0, Math.min(100, Number(agent.successRate) || 0))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">No agent performance data available.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;