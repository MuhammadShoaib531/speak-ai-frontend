import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  BellIcon,
  XMarkIcon,
  CheckIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import {
  RefreshButton,
  PageHeader,
  SearchAndFilters,
} from '../../lib/commonUtils';
import api from '../../api/axiosInstance';

const safeNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

const normalizeNotification = (n) => ({
  id: n.id, 
  type: (n.type || 'info').toLowerCase(), 
  title: n.title || 'Notification',
  message: n.message || '',
  timestamp: n.timestamp || new Date().toISOString(),
  read: Boolean(n.read ?? false),
});

const todayKey = () => new Date().toISOString().slice(0, 10);

const getNotificationIcon = (type) => {
  switch (type) {
    case 'alert':
      return <ExclamationTriangleIcon className="h-6 w-6 text-error-600" />;
    case 'warning':
      return <ExclamationTriangleIcon className="h-6 w-6 text-warning-600" />;
    case 'success':
      return <CheckCircleIcon className="h-6 w-6 text-success-600" />;
    case 'info':
    default:
      return <InformationCircleIcon className="h-6 w-6 text-primary-600" />;
  }
};

const formatTimestampRelative = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffInMinutes = Math.floor(diffMs / (1000 * 60));
  const diffInHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffInMinutes < 1) return 'just now';
  if (diffInHours < 1) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
  } else if (diffInHours < 48) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString();
  }
};

const readPrevSubSnapshot = () => {
  try {
    const raw = localStorage.getItem('notif.prevSubscription');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const writePrevSubSnapshot = (snap) => {
  try {
    localStorage.setItem('notif.prevSubscription', JSON.stringify(snap || {}));
  } catch {}
};

const readPersistedMap = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};
const writePersistedMap = (key, map) => {
  try {
    localStorage.setItem(key, JSON.stringify(map || {}));
  } catch {}
};

const KPISummarySkeleton = () => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {[...Array(3)].map((_, i) => (
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

const Notifications = () => {
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [readMap, setReadMap] = useState(() => readPersistedMap('notif.readMap'));         
  const [dismissedMap, setDismissedMap] = useState(() => readPersistedMap('notif.dismissedMap')); 
  const [firstSeenMap, setFirstSeenMap] = useState(() => readPersistedMap('notif.firstSeenMap')); 

  useEffect(() => writePersistedMap('notif.readMap', readMap), [readMap]);
  useEffect(() => writePersistedMap('notif.dismissedMap', dismissedMap), [dismissedMap]);
  useEffect(() => writePersistedMap('notif.firstSeenMap', firstSeenMap), [firstSeenMap]);

  const markAsRead = (id) => {
    setReadMap((prev) => ({ ...prev, [id]: true }));
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const deleteNotification = (id) => {
    setDismissedMap((prev) => ({ ...prev, [id]: true }));
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const markAllAsRead = () => {
    const ids = notifications.map((n) => n.id);
    const next = { ...readMap };
    ids.forEach((id) => { next[id] = true; });
    setReadMap(next);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    if (!window.confirm('Are you sure you want to clear all notifications?')) return;
    const next = { ...dismissedMap };
    notifications.forEach((n) => { next[n.id] = true; });
    setDismissedMap(next);
    setNotifications([]);
  };

  const fetchUsage = async () => {
    try {
      const res = await api.get('/subscription/usage');
      return res?.data || null;
    } catch {
      return null;
    }
  };

  const fetchCurrentSub = async () => {
    try {
      const res = await api.get('/subscription/current');
      return res?.data || null;
    } catch {
      return null;
    }
  };

  const fetchPayments = async () => {
    try {
      let res;
      try {
        res = await api.get('/subscription/payment-history?limit=20');
      } catch {
        res = await api.get('/subscription/payment-history?limit=10');
      }
      return res?.data || null;
    } catch {
      return null;
    }
  };

  const fetchBatchJobs = async () => {
    try {
      const res = await api.get('/auth/agent/batch-calling-status');
      return res?.data || null;
    } catch {
      return null;
    }
  };

  const fetchDashboard = async () => {
    try {
      const res = await api.post('/analysis/dashboard-analytics', { range: '30d' });
      return res?.data || null;
    } catch {
      return null;
    }
  };

  const fetchCallHistory = async () => {
    try {
      const res = await api.get('/auth/agent/call-history', { params: { limit: 100 } });
      return Array.isArray(res?.data) ? res.data : [];
    } catch {
      return [];
    }
  };

  const fetchAll = useCallback(async () => {
    setErr('');
    setLoading(true);
    try {
      const prevSub = readPrevSubSnapshot();

      const [usage, currentSub, payments, jobs, dashboard, calls] = await Promise.allSettled([
        fetchUsage(),
        fetchCurrentSub(),
        fetchPayments(),
        fetchBatchJobs(),
        fetchDashboard(),
        fetchCallHistory(),
      ]);

      const pendingFirstSeen = {};

      const getStableTs = (id, serverTs) => {
        const existing = firstSeenMap[id];
        if (existing) return existing;
        const chosen = serverTs || new Date().toISOString();
        pendingFirstSeen[id] = chosen;
        return chosen;
      };

      const buildNotifications = ({
        usage,
        currentSub,
        prevSub,
        payments,
        jobs,
        dashboard,
        calls,
      }) => {
        const out = [];

        if (usage) {
          const used =
            safeNum(usage.minutes_used) ||
            safeNum(usage.used_minutes) ||
            safeNum(usage.current_usage_minutes);
          const limit =
            safeNum(usage.minutes_limit) ||
            safeNum(usage.limit_minutes) ||
            safeNum(usage.plan_minutes);
          const periodEnd = usage.period_end || usage.current_period_end || '';
          const serverTs = usage.updated_at || usage.timestamp;

          if (limit > 0) {
            const pct = (used / limit) * 100;
            if (pct >= 95) {
              const id = `usage|${periodEnd || todayKey()}|ALERT`;
              out.push(
                normalizeNotification({
                  id,
                  type: 'alert',
                  title: 'Minutes Almost Exhausted',
                  message: `You've used ${Math.round(used)}/${limit} minutes (${Math.round(pct)}%). Consider upgrading to avoid service interruption.`,
                  timestamp: getStableTs(id, serverTs),
                  read: Boolean(readMap[id]),
                })
              );
            } else if (pct >= 80) {
              const id = `usage|${periodEnd || todayKey()}|WARN`;
              out.push(
                normalizeNotification({
                  id,
                  type: 'warning',
                  title: 'High Usage Detected',
                  message: `You've used ${Math.round(used)}/${limit} minutes (${Math.round(pct)}%).`,
                  timestamp: getStableTs(id, serverTs),
                  read: Boolean(readMap[id]),
                })
              );
            }
          }
        }

        if (currentSub) {
          const planCode =
            (currentSub?.plan_code ||
              currentSub?.code ||
              currentSub?.plan?.code ||
              currentSub?.plan?.id ||
              currentSub?.current_plan ||
              currentSub?.subscription_plan ||
              '')
              .toString()
              .toLowerCase();

          const planName =
            currentSub?.plan_name ||
            currentSub?.name ||
            currentSub?.plan?.name ||
            currentSub?.subscription_plan ||
            planCode ||
            'Current Plan';

          const status = (currentSub?.status || currentSub?.subscription_status || '').toLowerCase();

          const subUpdatedAt =
            currentSub?.updated_at ||
            currentSub?.current_period_start ||
            currentSub?.created_at;

          if (prevSub) {
            const prevPlanCode = (prevSub.planCode || '').toLowerCase();
            const prevPlanName = prevSub.planName || prevPlanCode || 'Previous Plan';
            const prevStatus = (prevSub.status || '').toLowerCase();

            if (planCode && prevPlanCode && planCode !== prevPlanCode) {
              const id = `sub|plan|${planCode}`;
              out.push(
                normalizeNotification({
                  id,
                  type: 'info',
                  title: 'Subscription Plan Changed',
                  message: `Your subscription changed from "${prevPlanName}" to "${planName}".`,
                  timestamp: getStableTs(id, subUpdatedAt),
                  read: Boolean(readMap[id]),
                })
              );
            }

            if (status && status !== prevStatus) {
              const id = `sub|status|${status}`;
              const critical = ['past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired'];
              const positive = ['active', 'trialing'];
              const type = critical.includes(status)
                ? 'alert'
                : positive.includes(status)
                ? 'success'
                : 'info';

              out.push(
                normalizeNotification({
                  id,
                  type,
                  title: 'Subscription Status Updated',
                  message: `Status changed from "${prevStatus || 'unknown'}" to "${status}".`,
                  timestamp: getStableTs(id, subUpdatedAt),
                  read: Boolean(readMap[id]),
                })
              );
            }
          }
        }

        if (payments && Array.isArray(payments.payments)) {
          payments.payments.slice(0, 20).forEach((p) => {
            const status = (p.status || p.payment_status || '').toLowerCase();
            if (status.includes('fail')) {
              const created = p.created_at || p.invoice_date || p.timestamp;
              const id = `pay|${p.id || p.invoice_id || p.cursor || created}|fail`;
              out.push(
                normalizeNotification({
                  id,
                  type: 'alert',
                  title: 'Subscription Charge Failed',
                  message: `A recent subscription charge failed. Please update your billing details.`,
                  timestamp: getStableTs(id, created),
                  read: Boolean(readMap[id]),
                })
              );
            }
          });
        }

        if (jobs && Array.isArray(jobs.jobs)) {
          jobs.jobs.forEach((j) => {
            const status = String(j.status || j?.elevenlabs_live_status?.status || 'pending').toLowerCase();
            const created = j.created_at || j?.elevenlabs_live_status?.created_at || j?.elevenlabs_live_status?.created_at_unix
              ? new Date((j?.elevenlabs_live_status?.created_at_unix || 0) * 1000).toISOString()
              : j.created_at;
            const jobId = j.batch_job_id || j.id || `${j.agent_id}|${j.call_name}`;
            if (!jobId) return;

            if (status.includes('fail')) {
              const id = `job|${jobId}|fail`;
              out.push(
                normalizeNotification({
                  id,
                  type: 'alert',
                  title: 'Batch Job Failed',
                  message: `Batch calling "${j.call_name}" for ${j.agent_name} failed.`,
                  timestamp: getStableTs(id, created),
                  read: Boolean(readMap[id]),
                })
              );
            } else if (status.includes('complete') || status === 'done' || status === 'finished') {
              const id = `job|${jobId}|ok`;
              out.push(
                normalizeNotification({
                  id,
                  type: 'success',
                  title: 'Batch Job Completed',
                  message: `Batch calling "${j.call_name}" for ${j.agent_name} completed successfully.`,
                  timestamp: getStableTs(id, created),
                  read: Boolean(readMap[id]),
                })
              );
            } else if (
              status.includes('dispatch') ||
              status.includes('schedule') ||
              status.includes('progress') ||
              status === 'pending'
            ) {
              const id = `job|${jobId}|info`;
              out.push(
                normalizeNotification({
                  id,
                  type: 'info',
                  title: 'Batch Job In Progress',
                  message: `Batch calling "${j.call_name}" for ${j.agent_name}" is in progress.`,
                  timestamp: getStableTs(id, created),
                  read: Boolean(readMap[id]),
                })
              );
            }
          });
        }

        if (dashboard && dashboard.overview) {
          const sr = safeNum(dashboard.overview.success_rate_value, 0); 
          const serverTs = dashboard.updated_at;
          if (sr > 0 && sr < 85) {
            const id = `perf|lowSR`;
            out.push(
              normalizeNotification({
                id,
                type: 'alert',
                title: 'Agent Performance Alert',
                message: `Overall success rate dropped to ${Math.round(sr)}%. Review recent calls and retrain agents if needed.`,
                timestamp: getStableTs(id, serverTs),
                read: Boolean(readMap[id]),
              })
            );
          }
        }

        if (Array.isArray(calls) && calls.length) {
          const today = todayKey();
          const callsToday = calls.filter(
            (c) => (new Date(c.created_at || c.timestamp || c.time)).toISOString().slice(0, 10) === today
          );
          if (callsToday.length >= 100) {
            const id = `calls|${today}|high`;

            const newestCallTs = callsToday
              .map((c) => c.created_at || c.timestamp || c.time)
              .filter(Boolean)
              .sort()
              .pop();
            out.push(
              normalizeNotification({
                id,
                type: 'warning',
                title: 'High Call Volume',
                message: `Unusually high call volume detected today (${callsToday.length} calls). Consider activating additional agents.`,
                timestamp: getStableTs(id, newestCallTs),
                read: Boolean(readMap[id]),
              })
            );
          }
        }

        out.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return out.filter((n) => !dismissedMap[n.id]);
      };

      const next = buildNotifications({
        usage: usage.value || null,
        currentSub: currentSub.value || null,
        prevSub,
        payments: payments.value || null,
        jobs: jobs.value || null,
        dashboard: dashboard.value || null,
        calls: calls.value || [],
      });

      const merged = next.map((n) => ({ ...n, read: Boolean(readMap[n.id]) }));
      setNotifications(merged);

      if (Object.keys(pendingFirstSeen).length) {
        setFirstSeenMap((prev) => ({ ...prev, ...pendingFirstSeen }));
      }

      const cs = currentSub.value || null;
      if (cs) {
        const planCode =
          (cs?.plan_code ||
            cs?.code ||
            cs?.plan?.code ||
            cs?.plan?.id ||
            cs?.current_plan ||
            cs?.subscription_plan ||
            '')
            .toString()
            .toLowerCase();
        const planName =
          cs?.plan_name ||
          cs?.name ||
          cs?.plan?.name ||
          cs?.subscription_plan ||
          planCode ||
          '';
        const status = (cs?.status || cs?.subscription_status || '').toLowerCase();
        writePrevSubSnapshot({ planCode, planName, status });
      }
    } catch (e) {
      setErr(e?.message || 'Failed to build notifications');
    } finally {
      setLoading(false);
    }
  }, [readMap, dismissedMap, firstSeenMap]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filteredNotifications = useMemo(() => {
    const s = (searchTerm || '').toLowerCase().trim();
    return notifications.filter((notification) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'unread' && !notification.read) ||
        (filter === 'read' && notification.read);

      const matchesSearch =
        !s ||
        notification.title.toLowerCase().includes(s) ||
        notification.message.toLowerCase().includes(s) ||
        notification.type.toLowerCase().includes(s);

      return matchesFilter && matchesSearch;
    });
  }, [notifications, filter, searchTerm]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const todayCount = notifications.filter(
    (n) => new Date(n.timestamp).toDateString() === new Date().toDateString()
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <div className="flex items-center">
            <BellIcon className="h-6 w-6 mr-2" />
            Notifications
            {unreadCount > 0 && !loading && (
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-error-100 text-error-800">
                {unreadCount} unread
              </span>
            )}
          </div>
        }
        subtitle="Stay updated with your agent performance, subscription changes, and system alerts"
      >
        <div className="flex space-x-3">
          <RefreshButton onClick={fetchAll} isLoading={loading} />
          <button onClick={markAllAsRead} className="btn btn-secondary" disabled={notifications.length === 0}>
            <CheckIcon className="h-4 w-4 mr-2" />
            Mark All Read
          </button>
          <button onClick={clearAll} className="btn btn-error" disabled={notifications.length === 0}>
            <TrashIcon className="h-4 w-4 mr-2" />
            Clear All
          </button>
        </div>
      </PageHeader>

      {loading ? (
        <KPISummarySkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="card">
            <div className="flex items-center">
              <BellIcon className="h-8 w-8 text-primary-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total</p>
                <p className="text-2xl font-bold text-gray-900">{notifications.length}</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-8 w-8 text-error-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Unread</p>
                <p className="text-2xl font-bold text-gray-900">{unreadCount}</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center">
              <ClockIcon className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Today</p>
                <p className="text-2xl font-bold text-gray-900">{todayCount}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <SearchAndFilters
        searchTerm={searchTerm}
        onSearchChange={(e) => setSearchTerm(e.target.value)}
        searchPlaceholder="Search notifications..."
        filters={[
          {
            value: filter,
            onChange: (e) => setFilter(e.target.value),
            options: [
              { value: 'all', label: 'All Notifications' },
              { value: 'unread', label: 'Unread' },
              { value: 'read', label: 'Read' },
            ],
          },
        ]}
        disabled={loading}
      />

      {err && (
        <div className="card p-4 text-sm text-red-600">
          {err}
        </div>
      )}

      <div className="space-y-4">
        {loading ? (

          [...Array(5)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="flex items-start space-x-4">
                <div className="h-6 w-6 rounded-full bg-gray-200" />
                <div className="flex-1">
                  <div className="h-4 w-40 bg-gray-200 rounded mb-2" />
                  <div className="h-3 w-3/4 bg-gray-200 rounded mb-2" />
                  <div className="h-3 w-1/3 bg-gray-200 rounded" />
                </div>
              </div>
            </div>
          ))
        ) : filteredNotifications.length === 0 ? (
          <div className="card text-center py-12">
            <BellIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications found</h3>
            <p className="text-gray-500">
              {searchTerm || filter !== 'all'
                ? 'Try adjusting your search or filter criteria'
                : "You're all caught up! No notifications to display."}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`card hover:bg-gray-50 transition-colors ${
                !notification.read ? 'border-l-4 border-l-primary-500 bg-primary-50' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <div className="mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-900">
                        {notification.title}
                        {!notification.read && (
                          <span className="ml-2 inline-block w-2 h-2 bg-primary-600 rounded-full" />
                        )}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                    <p className="text-xs text-gray-500">{formatTimestampRelative(notification.timestamp)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  {!notification.read && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      className="text-gray-400 hover:text-primary-600"
                      title="Mark as read"
                    >
                      <CheckIcon className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(notification.id)}
                    className="text-gray-400 hover:text-error-600"
                    title="Delete notification"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
