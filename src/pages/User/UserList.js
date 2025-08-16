import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import {
  UserIcon,
  UsersIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import {
  RefreshButton,
  PageHeader,
  SearchAndFilters,
} from '../../lib/commonUtils';

const fmtDate = (iso) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso ?? '—';
  }
};

const useDebounced = (value, delay = 250) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
};

const formatPlanName = (plan) =>
  plan
    ? plan.toString().replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    : '—';

const formatLabel = (value) =>
  value
    ? value
        .toString()
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : '—';

const Badge = ({ children, color = 'gray' }) => (
  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-${color}-100 text-${color}-800`}>
    {children}
  </span>
);

const VerifiedBadge = ({ verified }) =>
  verified ? (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800">
      Verified
    </span>
  ) : (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800">
      Unverified
    </span>
  );

const ActiveBadge = ({ active }) =>
  active ? (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
      Inactive
    </span>
  );

const PlanBadge = ({ plan }) => (
  <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800">
    {formatPlanName(plan)}
  </span>
);

const SummarySkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="card px-6 py-4 flex items-center space-x-4 animate-pulse">
        <div className="h-8 w-8 rounded bg-gray-200 flex-shrink-0" />
        <div className="flex-1">
          <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
          <div className="h-6 w-16 bg-gray-200 rounded" />
        </div>
      </div>
    ))}
  </div>
);

const UserList = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const { usersAdmin, adminUsersError, loading, fetchAdminUsers } = useAppStore();

  const [booting, setBooting] = useState(true);
  const [refreshing, setRefreshing] = useState(false); 
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounced(searchTerm, 250);

  const [filterVerified, setFilterVerified] = useState('all');
  const [filterActive, setFilterActive] = useState('all');

  useEffect(() => {
    let active = true;
    (async () => {
      await fetchAdminUsers();
      if (active) setBooting(false);
    })();
    return () => {
      active = false;
    };
  }, [fetchAdminUsers]);

  const baseUsers = useMemo(() => {
    const meId = currentUser?.id ?? currentUser?._id ?? currentUser?.uid;
    return (usersAdmin || []).filter((u) => !(u.role === 'superadmin' && u.id !== meId));
  }, [usersAdmin, currentUser]);

  const usersSorted = useMemo(
    () => [...baseUsers].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [baseUsers]
  );

  const filteredUsers = useMemo(() => {
    const s = debouncedSearch.trim().toLowerCase();
    return usersSorted.filter((u) => {
      const textOk = !s
        ? true
        : [u.name, u.email, u.company_name, u.role, u.subscription_plan, u.subscription_status]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(s));
      const verOk =
        filterVerified === 'all' ||
        (filterVerified === 'verified' && Boolean(u.is_verified)) ||
        (filterVerified === 'unverified' && !Boolean(u.is_verified));
      const actOk =
        filterActive === 'all' ||
        (filterActive === 'active' && Boolean(u.is_active)) ||
        (filterActive === 'inactive' && !Boolean(u.is_active));
      return textOk && verOk && actOk;
    });
  }, [usersSorted, debouncedSearch, filterVerified, filterActive]);

  const usersWithAgents = useMemo(
    () => baseUsers.filter((u) => (u.total_agents ?? 0) > 0).length,
    [baseUsers]
  );
  const usersWithoutAgents = Math.max(0, (baseUsers?.length ?? 0) - usersWithAgents);

  const isInitialLoading = booting || loading;
  const isSummaryLoading = isInitialLoading || refreshing; 

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await fetchAdminUsers();
    } finally {
      setRefreshing(false);
    }
  }, [fetchAdminUsers]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="All Users"
        subtitle="Manage and monitor your Users"
      >
        <RefreshButton onClick={handleRefresh} isLoading={isInitialLoading || refreshing} />
      </PageHeader>

      {/* SUMMARY CARDS */}
      {isSummaryLoading ? (
        <SummarySkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card px-6 py-4 flex items-center space-x-4">
            <UsersIcon className="h-8 w-8 text-primary-600 flex-shrink-0" />
            <div>
              <p className="text-sm text-gray-500">Total Users</p>
              <p className="text-2xl font-extrabold text-gray-900">{baseUsers.length}</p>
            </div>
          </div>

          <div className="card px-6 py-4 flex items-center space-x-4">
            <UserIcon className="h-8 w-8 text-primary-600 flex-shrink-0" />
            <div>
              <p className="text-sm text-gray-500">With Agents</p>
              <p className="text-2xl font-extrabold text-gray-900">{usersWithAgents}</p>
            </div>
          </div>

          <div className="card px-6 py-4 flex items-center space-x-4">
            <UserIcon className="h-8 w-8 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-sm text-gray-500">Without Agents</p>
              <p className="text-2xl font-extrabold text-gray-900">{usersWithoutAgents}</p>
            </div>
          </div>
        </div>
      )}

      <SearchAndFilters
        searchTerm={searchTerm}
        onSearchChange={(e) => setSearchTerm(e.target.value)}
        searchPlaceholder="Search by name, email, company, role, or plan…"
        filters={[
          {
            value: filterVerified,
            onChange: (e) => setFilterVerified(e.target.value),
            options: [
              { value: 'all', label: 'All Verification' },
              { value: 'verified', label: 'Verified' },
              { value: 'unverified', label: 'Unverified' }
            ]
          },
          {
            value: filterActive,
            onChange: (e) => setFilterActive(e.target.value),
            options: [
              { value: 'all', label: 'All Activity' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' }
            ]
          }
        ]}
        disabled={isInitialLoading}
      />

      {adminUsersError && !isInitialLoading && (
        <div className="card p-6">
          <p className="text-sm text-red-600">{adminUsersError}</p>
        </div>
      )}

      {isInitialLoading ? (
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="w-full flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="h-6 w-6 rounded-full bg-gray-200" />
                  <div>
                    <div className="h-4 w-40 bg-gray-200 rounded" />
                    <div className="h-3 w-56 bg-gray-200 rounded mt-2" />
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-5 w-16 bg-gray-200 rounded" />
                      <div className="h-5 w-16 bg-gray-200 rounded" />
                      <div className="h-5 w-24 bg-gray-200 rounded" />
                      <div className="h-5 w-20 bg-gray-200 rounded" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-6">
                  <div className="text-right">
                    <div className="h-3 w-24 bg-gray-200 rounded mb-2" />
                    <div className="h-3 w-28 bg-gray-200 rounded mb-2" />
                    <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
                    <div className="h-3 w-24 bg-gray-200 rounded" />
                  </div>
                  <div className="h-5 w-5 rounded-full bg-gray-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !adminUsersError && (
        <>
          {filteredUsers.length > 0 ? (
            <div className="space-y-4">
              {filteredUsers.map((u) => (
                <button
                  key={u.id ?? u.email}
                  className="card p-4 w-full flex justify-between items-center hover:shadow transition text-left"
                  onClick={() => navigate(`/agents?fromUser=true&email=${encodeURIComponent(u.email)}`)}
                  title="View user's agents"
                >
                  <div className="flex items-center space-x-4">
                    <UserIcon className="h-6 w-6 text-primary-600" />
                    <div>
                      <h3 className="text-lg font-semibold">{u.name ?? '—'}</h3>
                      <p className="text-sm text-gray-500">{u.email ?? '—'}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <VerifiedBadge verified={u.is_verified} />
                        <ActiveBadge active={u.is_active} />
                        <PlanBadge plan={u.subscription_plan} />
                        <Badge color="gray">{formatLabel(u.role)}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    <div className="text-right text-sm text-gray-600">
                      <p>
                        Company: <span className="font-medium">{u.company_name ?? '—'}</span>
                      </p>
                      <p>
                        Minutes:{' '}
                        <span className="font-medium">
                          {(u.call_minutes_used ?? 0)}/{(u.call_minutes_limit ?? 0)}
                        </span>
                      </p>
                      <p>
                        Agents: <span className="font-medium">{u.total_agents ?? 0}</span>
                      </p>
                      <p>Joined: {fmtDate(u.created_at)}</p>
                    </div>
                    <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                  </div>
                </button>
              ))}
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 15c1.333 1 2.667 1 4 0" />
              </svg>
              <h3 className="mt-2 text-lg font-semibold text-gray-900">No users yet</h3>
              <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
                You haven't added any users yet. Once users join, they’ll appear here for quick access.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UserList;