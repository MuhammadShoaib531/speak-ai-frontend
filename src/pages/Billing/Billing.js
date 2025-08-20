import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import useAppStore from '../../store/appStore';
import { toast } from 'react-toastify';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { PageHeader, RefreshButton, toTitle, getStatusColor, formatDate } from '../../lib/commonUtils';

const Billing = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'plans');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const TOAST_IDS = {
    updated: 'billing-updated',
    cancelled: 'billing-cancelled',
  };

  const {
    updateSubscription,

    billing,
    billingBootstrap,
    billingRefreshCore,
    billingFetchPayments,
    billingLoadMorePayments,
    billingCreateCheckoutSession,
    billingDowngradeToFree,
  } = useAppStore();

  const {
    plans,
    plansLoading,
    plansError,

    currentSub,
    currentLoading,
    currentError,

    usage,
    usageLoading,
    usageError,

    compareData,
    compareLoading,
    compareError,

    payments,
    paymentsLoading,
    paymentsLoadingMore,
    paymentsError,
    totalPayments,
    hasMorePayments,

    redirectingPlan,
  } = billing;

  const setTab = useCallback(
    (tab) => {
      setActiveTab(tab);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', tab);
        return next;
      });
    },
    [setSearchParams]
  );

  useEffect(() => {
    setActiveTab(searchParams.get('tab') || 'plans');
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      await billingBootstrap();
      await billingFetchPayments({ limit: 50 }, { append: false });
      try {
        updateSubscription?.(currentSub || null);
      } catch {}
    })();
  }, []); 

  const isNum = (v) => typeof v === 'number' && !Number.isNaN(v);

  const moneyFmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  const displayMoney = (v) => {
    if (isNum(v)) return moneyFmt.format(v);
    if (v === 0) return moneyFmt.format(0);
    if (v === null || v === undefined || v === '') return '—';
    return String(v);
  };
  const displayAnyMoney = (v) => (isNum(v) ? displayMoney(v) : (v ?? '—'));
  const displayMinutes = (v) => {
    if (isNum(v)) return `${v}`;
    if (v === 0) return '0';
    if (v == null || v === '') return '—';
    return String(v);
  };
  const priceOf = (plan) => (isNum(plan?.monthly_price) ? plan.monthly_price : null);
  const hasCustomPricing = (plan) => priceOf(plan) === null;
  const displayMonthlyPrice = (plan) => {
    const mp = priceOf(plan);
    return mp === null ? 'Custom Pricing' : `${displayMoney(mp)} / month`;
  };

  const isIncluded = (v) => {
    const s = String(v ?? '').trim().toLowerCase();
    if (v === false || v === 0 || s === '' || s === '0' || s === 'false' || s === 'no' || v == null) return false;
    return true;
  };

  const renderFeatures = (featuresObj) => {
    if (!featuresObj || typeof featuresObj !== 'object') return [];
    return Object.entries(featuresObj).map(([k, v]) => {
      const label = toTitle(k);
      const included = isIncluded(v);
      const detail =
        typeof v === 'string' && v.trim()
          ? `: ${v}`
          : isNum(v)
          ? `: ${v}`
          : '';
      return { key: k, text: `${label}${detail}`, included };
    });
  };

  const currentPlan = useMemo(() => {
    if (!plans?.length) return null;
    const nameFromUsage = toTitle(usage?.current_plan);
    const nameFromSub = toTitle(currentSub?.plan);
    const codeFromSub = String(currentSub?.plan_code || '').toLowerCase();
    return (
      plans.find((p) => toTitle(p.name) === nameFromUsage) ||
      plans.find((p) => toTitle(p.name) === nameFromSub) ||
      plans.find((p) => String(p.code || '').toLowerCase() === codeFromSub) ||
      null
    );
  }, [plans, usage, currentSub]);

  const currentPlanNameLower = (currentPlan?.name || '').toLowerCase();

  const hasActiveSubscription = useMemo(() => {
    const s = String(currentSub?.status || '').toLowerCase();
    return s === 'active' || s === 'trialing' || s === 'past_due';
  }, [currentSub]);

  const createCheckoutSession = async (planNameOrObj) => {
    const res = await billingCreateCheckoutSession(planNameOrObj);
    if (res.success && res.url) {
      window.location.assign(res.url);
    } else if (!res.success && res.error) {
      toast.error(res.error);
    }
  };

  const refreshAll = useCallback(async () => {
    await billingRefreshCore();
    await billingFetchPayments({ limit: 50 }, { append: false });
    try {
      updateSubscription?.(currentSub || null);
    } catch {}
  }, [billingRefreshCore, billingFetchPayments, updateSubscription, currentSub]);

  const handledCheckoutRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    if (!checkout) return;
    (async () => {
      if (handledCheckoutRef.current) return;
      handledCheckoutRef.current = true;
      if (checkout === 'success') {
        await refreshAll();
        toast.dismiss(TOAST_IDS.updated);
        toast.success('Subscription updated.', { toastId: TOAST_IDS.updated });
        setTab('current');
      }
      if (checkout === 'cancelled') {
        toast.info('Checkout cancelled.');
        setTab('plans');
      }
      const url = new URL(window.location.href);
      url.searchParams.delete('checkout');
      url.searchParams.delete('session_id');
      window.history.replaceState({}, '', url.toString());
    })();
  }, [refreshAll]);

  const isCurrentFree = useMemo(() => {
    const raw = String(
      currentSub?.plan_code ??
      currentSub?.plan ??
      usage?.current_plan ??
      currentPlan?.code ??
      currentPlan?.name ??
      ''
    ).toLowerCase().trim();
    return ['free', 'free_tier', 'free tier', 'starter_free'].some((k) => raw.includes(k));
  }, [currentPlan, usage, currentSub]);

  const busy = !!redirectingPlan;

  const PlansSkeleton = () => (
    <div className="grid md:grid-cols-3 gap-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-lg bg-white border-2 border-gray-200 p-6 animate-pulse">
          <div className="h-6 w-32 bg-gray-200 rounded mx-auto mb-6" />
          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            {[...Array(4)].map((__, j) => (
              <div key={j} className="rounded-md border border-gray-200 p-3">
                <div className="h-3 w-24 bg-gray-200 rounded mb-2" />
                <div className="h-4 w-20 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
          <ul className="space-y-3 mb-6">
            {[...Array(5)].map((__, k) => (
              <li key={k} className="flex items-center">
                <div className="h-5 w-5 bg-gray-200 rounded mr-2" />
                <div className="h-3 w-40 bg-gray-200 rounded" />
              </li>
            ))}
          </ul>
          <div className="h-10 w-full bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );

  const CurrentSkeleton = () => (
    <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 w-48 bg-gray-200 rounded" />
        <div className="h-6 w-24 bg-gray-200 rounded-full" />
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="h-5 w-40 bg-gray-200 rounded" />
          <div className="h-4 w-56 bg-gray-200 rounded" />
          <div className="space-y-2 mt-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 w-32 bg-gray-200 rounded" />
                <div className="h-4 w-24 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-5 w-40 bg-gray-200 rounded" />
          <div>
            <div className="flex justify-between mb-1">
              <div className="h-4 w-28 bg-gray-200 rounded" />
              <div className="h-4 w-16 bg-gray-200 rounded" />
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="h-2 rounded-full bg-gray-300 w-1/2" />
            </div>
          </div>
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="h-4 w-28 bg-gray-200 rounded" />
              <div className="h-4 w-16 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 mt-6">
        <div className="h-10 w-32 bg-gray-200 rounded" />
        <div className="h-10 w-40 bg-gray-200 rounded" />
        <div className="h-10 w-44 bg-gray-200 rounded" />
      </div>
    </div>
  );

  const HistorySkeleton = () => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden animate-pulse">
      <div className="h-10 bg-gray-100" />
      <div className="divide-y divide-gray-200">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="grid grid-cols-6 gap-4 px-6 py-4">
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-4 w-56 bg-gray-200 rounded col-span-2" />
            <div className="h-4 w-20 bg-gray-200 rounded" />
            <div className="h-6 w-16 bg-gray-200 rounded-full" />
            <div className="h-4 w-24 bg-gray-200 rounded justify-self-end" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between p-4 border-t">
        <div className="h-4 w-40 bg-gray-200 rounded" />
        <div className="h-8 w-28 bg-gray-200 rounded" />
      </div>
    </div>
  );

  const isFreePlan = (p) => String(p?.name || p?.code || '').toLowerCase().includes('free');

  const PlanCard = ({ plan }) => {
    const isCurrent = (currentPlan?.name || '').toLowerCase() === (plan?.name || '').toLowerCase();
    const isEnterprise = (plan?.name || '').toLowerCase() === 'enterprise';
    const customPricing = hasCustomPricing(plan);
    const features = renderFeatures(plan?.features);
    const upgradingThisPlan = (redirectingPlan || '').toLowerCase() === (plan?.name || '').toLowerCase();
    const isFree = isFreePlan(plan);

    return (
      <div className={`relative rounded-lg bg-white border-2 ${isCurrent ? 'border-primary-500 shadow-lg' : 'border-gray-200 hover:border-gray-300'} p-6 transition-all duration-200`}>
        {plan?.name?.toLowerCase() === 'pro' && (
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
            <span className="bg-primary-500 text-white px-3 py-1 rounded-full text-sm font-medium">Most Popular</span>
          </div>
        )}

        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name || 'Plan'}</h3>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md border border-gray-200 p-3">
            <div className="text-gray-500">Monthly Price</div>
            <div className="font-semibold">{displayMonthlyPrice(plan)}</div>
          </div>
          <div className="rounded-md border border-gray-200 p-3">
            <div className="text-gray-500">Setup Fee</div>
            <div className="font-semibold">{displayMoney(plan.setup_fee)}</div>
          </div>
          <div className="rounded-md border border-gray-200 p-3">
            <div className="text-gray-500">Included Minutes</div>
            <div className="font-semibold">{displayMinutes(plan.included_minutes)}</div>
          </div>
          <div className="rounded-md border border-gray-200 p-3">
            <div className="text-gray-500">Extra Minute Rate</div>
            <div className="font-semibold">
              {isNum(plan.extra_minute_rate) ? `${displayMoney(plan.extra_minute_rate)}/min` : displayMoney(plan.extra_minute_rate)}
            </div>
          </div>
        </div>

        <ul className="space-y-3 mb-6">
          {features.map((f) => (
            <li key={f.key} className="flex items-start">
              {f.included ? (
                <>
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">{f.text}</span>
                </>
              ) : (
                <>
                  <XCircleIcon className="h-5 w-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-red-600 text-sm">{f.text.replace(/:.*$/, '')}</span>
                </>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-auto">
          {isCurrent ? (
            <button disabled className="w-full bg-gray-100 text-gray-400 py-3 px-5 rounded-xl font-medium cursor-not-allowed">Current Plan</button>
          ) : isEnterprise ? (
            <button
              onClick={() => (window.location.href = 'mailto:hello@speakai.ai')}
              className="w-full bg-primary-600 text-white hover:bg-primary-700 py-3 px-5 rounded-xl font-medium transition-colors"
            >
              Contact Sales Team
            </button>
          ) : isFree ? (
            <button
              disabled
              className="w-full bg-gray-100 text-gray-400 py-3 px-5 rounded-xl font-medium cursor-not-allowed"
              title="Free plan can only be reached by cancelling (which downgrades to Free)."
            >
              Free Plan
            </button>
          ) : customPricing ? (
            <button
              onClick={() => createCheckoutSession(plan)}
              disabled={!!redirectingPlan}
              className={`w-full text-white py-3 px-5 rounded-xl font-medium transition-colors ${
                upgradingThisPlan ? 'bg-primary-400 cursor-wait' : 'bg-primary-600 hover:bg-primary-700'
              }`}
            >
              {upgradingThisPlan ? 'Redirecting…' : `Switch to ${plan?.name}`}
            </button>
          ) : (
            <button
              onClick={() => createCheckoutSession(plan)}
              disabled={!!redirectingPlan}
              className={`w-full text-white py-3 px-5 rounded-xl font-medium transition-colors ${
                upgradingThisPlan ? 'bg-primary-400 cursor-wait' : 'bg-primary-600 hover:bg-primary-700'
              }`}
            >
              {upgradingThisPlan ? 'Redirecting…' : `Switch to ${plan?.name}`}
            </button>
          )}
        </div>
      </div>
    );
  };

  const CancelModal = () => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted || typeof window === 'undefined') return null;
    return ReactDOM.createPortal(
      <div className="fixed top-0 left-0 right-0 bottom-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center mb-4">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Cancel Subscription</h3>
          </div>
          <p className="text-gray-600 mb-4">
            This will end your paid plan at period end and move you to the Free Tier.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Your subscription will remain active until {formatDate(usage?.current_period_end)}
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowCancelModal(false)}
              className="flex-1 bg-gray-100 text-gray-700 py-3 px-5 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              Keep Subscription
            </button>
            <button
              onClick={async () => {
                const r = await billingDowngradeToFree();
                if (r.success) {
                  setShowCancelModal(false);
                  toast.dismiss(TOAST_IDS.cancelled);
                  toast.success(r.already ? 'You are already on the Free plan.' : 'Downgraded to Free.', { toastId: TOAST_IDS.cancelled });
                  setTab('current');
                  await refreshAll();
                } else {
                  toast.error(r.error || 'Failed to downgrade to Free');
                }
              }}
              className="flex-1 bg-red-600 text-white py-3 px-5 rounded-xl font-medium hover:bg-red-700 transition-colors"
            >
              Confirm Cancel
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const CompareModal = () => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted || typeof window === 'undefined') return null;

    const dataset = compareData?.plans?.length ? compareData.plans : (plans || {});
    const currency = compareData?.currency || 'USD';
    const billingCycle = compareData?.billing_cycle || 'monthly';
    const note = compareData?.note || '';

    const val = (x) => (x == null || x === '' ? null : Number.isFinite(+x) ? +x : null);
    const sortedPlans = [...(Array.isArray(dataset) ? dataset : [])].sort((a, b) => {
      const pa = val(a?.monthly_price);
      const pb = val(b?.monthly_price);
      if (pa == null && pb == null) return 0;
      if (pa == null) return 1;
      if (pb == null) return -1;
      return pa - pb;
    });

    const headerCellClass = 'px-4 py-3 text-left font-medium text-gray-600';
    const stickyFeatureClass = 'sticky left-0 bg-white px-4 py-3 font-medium text-gray-900 w-64';

    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Compare Plans</h3>
              <p className="text-xs text-gray-500">
                {currency} • {billingCycle}
              </p>
            </div>
            <button onClick={() => setShowCompareModal(false)} className="text-gray-500 hover:text-gray-700">
              <XMarkIcon className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {compareLoading && (
            <div className="p-6">
              <div className="h-4 w-40 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="h-64 w-full bg-gray-100 rounded animate-pulse" />
            </div>
          )}
          {compareError && <p className="p-4 text-red-600">{compareError}</p>}

          {!compareLoading && !compareError && (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className={`${headerCellClass} sticky left-0 bg-gray-50 w-64`}>Feature</th>
                      {sortedPlans.map((p) => {
                        const isPopular = !!p.is_popular;
                        const isCurrent = currentPlanNameLower && String(p?.name || '').toLowerCase() === currentPlanNameLower;
                        return (
                          <th key={p.plan || p.code || p.id || p.name} className={`${headerCellClass} ${isCurrent ? 'text-primary-700' : ''}`}>
                            <div className="flex items-center gap-2">
                              <span>{p.name}</span>
                              {isPopular && (
                                <span className="inline-block text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                                  Most Popular
                                </span>
                              )}
                              {isCurrent && (
                                <span className="inline-block text-[10px] uppercase tracking-wide bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
                                  Current
                                </span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className={stickyFeatureClass}>Monthly Price</td>
                      {sortedPlans.map((p) => (
                        <td key={(p.plan || p.name) + '_price'} className="px-4 py-3">
                          {typeof p.monthly_price === 'number' ? `${displayMoney(p.monthly_price)} / month` : displayAnyMoney(p.monthly_price)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className={stickyFeatureClass}>Setup Fee</td>
                      {sortedPlans.map((p) => (
                        <td key={(p.plan || p.name) + '_setup'} className="px-4 py-3">
                          {displayAnyMoney(p.setup_fee)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className={stickyFeatureClass}>Included Minutes</td>
                      {sortedPlans.map((p) => (
                        <td key={(p.plan || p.name) + '_minutes'} className="px-4 py-3">
                          {displayMinutes(p.included_minutes)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className={stickyFeatureClass}>Extra Minute Rate</td>
                      {sortedPlans.map((p) => (
                        <td key={(p.plan || p.name) + '_extra'} className="px-4 py-3">
                          {typeof p.extra_minute_rate === 'number' ? `${displayMoney(p.extra_minute_rate)}/min` : displayAnyMoney(p.extra_minute_rate)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className={stickyFeatureClass}>Recommended For</td>
                      {sortedPlans.map((p) => (
                        <td key={(p.plan || p.name) + '_rec'} className="px-4 py-3 text-gray-700">
                          {p.recommended_for || '—'}
                        </td>
                      ))}
                    </tr>
                    {Array.from(new Set(sortedPlans.flatMap((p) => Object.keys(p.features || {})))).map((k) => (
                      <tr key={k} className="align-top">
                        <td className={stickyFeatureClass}>{toTitle(k)}</td>
                        {sortedPlans.map((p) => {
                          const v = p?.features?.[k];
                          if (v === undefined) {
                            return (
                              <td key={(p.plan || p.name) + k} className="px-4 py-3 text-gray-400">
                                —
                              </td>
                            );
                          }
                          const inc = isIncluded(v);
                          const text = typeof v === 'string' && v.trim() ? v : typeof v === 'number' ? String(v) : inc ? 'Included' : 'Not included';
                          return (
                            <td key={(p.plan || p.name) + k} className="px-4 py-3">
                              {inc ? (
                                <div className="flex items-center gap-1">
                                  <CheckCircleIcon className="h-4 w-4 text-green-600" />
                                  <span className="text-gray-900">{text}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <XCircleIcon className="h-4 w-4 text-red-500" />
                                  <span className="text-gray-500">{text}</span>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {note ? <p className="px-6 py-3 text-xs text-gray-500 border-t">{note}</p> : null}
            </>
          )}
        </div>
      </div>,
      document.body
    );
  };

  const minutesLimit = isNum(usage?.minutes_limit) ? usage.minutes_limit : 0;
  const minutesUsed = isNum(usage?.minutes_used) ? usage.minutes_used : 0;
  const minutesPercent = minutesLimit > 0 ? Math.min(100, Math.round((minutesUsed / minutesLimit) * 100)) : 0;
  const minutesRemaining = minutesLimit > 0 ? Math.max(0, minutesLimit - minutesUsed) : null;

  const filteredPayments = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return payments;
    return payments.filter((item) => {
      const id = String(item?.invoice_id || item?.id || '').toLowerCase();
      const desc = String(item?.description || '').toLowerCase();
      const pm = String(item?.payment_method || '').toLowerCase();
      const status = String(item?.status || '').toLowerCase();
      const cur = String(item?.currency || '').toLowerCase();
      return id.includes(needle) || desc.includes(needle) || pm.includes(needle) || status.includes(needle) || cur.includes(needle);
    });
  }, [payments, searchTerm]);

  const downloadCsv = () => {
    const rows = [
      ['Created', 'Payment ID', 'Description', 'Amount', 'Currency', 'Status', 'Payment Method', 'Invoice URL', 'Receipt URL'],
      ...filteredPayments.map((it) => [
        new Date(it?.created || Date.now()).toLocaleString(),
        it?.id || '',
        it?.description || '',
        typeof it?.amount === 'number' ? it.amount : '',
        (it?.currency || 'USD').toUpperCase(),
        it?.status || '',
        it?.payment_method || '',
        it?.invoice_url || '',
        it?.receipt_url || '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payment-history.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const openPaymentLinks = (p) => {
    const url = p?.invoice_url || p?.receipt_url || '';
    if (typeof url === 'string' && url.startsWith('http')) window.open(url, '_blank', 'noopener,noreferrer');
    else toast.info('No downloadable link is available for this payment yet.');
  };

  const loadMorePayments = async () => {
    await billingLoadMorePayments();
  };

  const isAnyLoading = plansLoading || currentLoading || usageLoading || compareLoading || paymentsLoading;

  return (
    <div className="space-y-6">
      <PageHeader title="Billing & Subscriptions" subtitle="Manage your subscription and billing information">
        <RefreshButton onClick={refreshAll} isLoading={isAnyLoading} />
      </PageHeader>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setTab('plans')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'plans'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Plans & Pricing
          </button>
          <button
            onClick={() => setTab('current')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'current'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Current Subscription
          </button>
          <button
            onClick={() => setTab('history')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'history'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Billing History
          </button>
        </nav>
      </div>

      {activeTab === 'plans' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="text-left">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Choose Your Plan</h2>
              <p className="text-gray-600">Select the plan that best fits your needs</p>
            </div>
            {!plansLoading && !plansError && (plans?.length > 0 || compareData?.plans?.length) && (
              <button
                onClick={() => setShowCompareModal(true)}
                className="bg-white border border-gray-300 text-gray-700 py-3 px-5 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Compare Plans
              </button>
            )}
          </div>

          {plansLoading && <PlansSkeleton />}
          {plansError && <p className="text-center text-red-600">{plansError}</p>}

          {!plansLoading && !plansError && (
            <div className="grid md:grid-cols-3 gap-6">
              {(plans ?? []).map((plan, idx) => (
                <PlanCard key={plan.id || plan.code || plan.name || idx} plan={plan} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'current' && (
        <div className="space-y-6">
          {(currentLoading || usageLoading) && <CurrentSkeleton />}
          {(currentError || usageError) && !currentLoading && !usageLoading && <p className="text-red-600">{currentError || usageError}</p>}

          {!currentLoading && !usageLoading && !currentError && !usageError && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Current Subscription</h2>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(currentSub?.status)}`}>
                  {currentSub?.status || '—'}
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {currentPlan?.name || toTitle(usage?.current_plan) || 'Plan'}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {currentPlan
                      ? isNum(currentPlan.included_minutes)
                        ? `${currentPlan.included_minutes} included minutes`
                        : String(currentPlan.included_minutes || '')
                      : isNum(usage?.minutes_limit)
                      ? `${usage.minutes_limit} included minutes`
                      : ''}
                  </p>

                  {priceOf(currentPlan) !== null && (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Monthly Cost:</span>
                        <span className="font-medium">{displayMonthlyPrice(currentPlan)}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 mt-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cancel At Period End:</span>
                      <span className="font-medium">{currentSub?.cancel_at_period_end ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Usage This Month</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-600">Minutes Used</span>
                        <span className="text-sm font-medium">
                          {isNum(usage?.minutes_used) && isNum(usage?.minutes_limit) ? `${usage.minutes_used} of ${usage.minutes_limit}` : '—'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-primary-600 h-2 rounded-full" style={{ width: `${minutesPercent}%` }} />
                      </div>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Minutes Remaining</span>
                      <span className="text-sm font-medium">{minutesRemaining != null ? minutesRemaining : '—'}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Overage Cost</span>
                      <span className="text-sm font-medium">{isNum(usage?.overage_cost) ? displayMoney(usage.overage_cost) : '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mt-6">
                <button
                  onClick={() => setTab('plans')}
                  disabled={busy}
                  className={`py-3 px-5 rounded-xl font-medium transition-colors ${
                    busy ? 'bg-primary-400 text-white cursor-not-allowed' : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  {hasActiveSubscription ? 'Change Plan' : 'Choose a Plan'}
                </button>

                {hasActiveSubscription && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="py-3 px-5 rounded-xl font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    Cancel Subscription
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Billing History {totalPayments ? `• ${totalPayments} payments` : ''}
            </h2>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search payments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <button
                onClick={downloadCsv}
                disabled={!filteredPayments.length}
                className={`py-3 px-5 rounded-xl font-medium transition-colors ${
                  filteredPayments.length ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                Export
              </button>
            </div>
          </div>

          {paymentsLoading && !payments.length && <HistorySkeleton />}
          {paymentsError && <p className="text-red-600">{paymentsError}</p>}

          {!paymentsLoading && !paymentsError && filteredPayments.length === 0 && (
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
              <h3 className="mt-2 text-lg font-semibold text-gray-900">No payments found</h3>
              <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
                Your billing history will appear here once you have payments.
              </p>
            </div>
          )}

          {!paymentsError && filteredPayments.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment / Invoice ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPayments.map((it) => {
                    const created = new Date(it?.created || Date.now()).toLocaleString();
                    const id = it?.id || '—';
                    const invoiceId = it?.invoice_id || '';
                    const desc = it?.description || '—';
                    const amountFormatted =
                      it?.amount_formatted ||
                      (typeof it?.amount === 'number'
                        ? new Intl.NumberFormat(undefined, {
                            style: 'currency',
                            currency: (it?.currency || 'USD').toUpperCase(),
                            maximumFractionDigits: 2,
                          }).format(it.amount)
                        : '—');
                    const status = it?.status || '—';
                    return (
                      <tr key={`${id}-${invoiceId}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{created}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex flex-col">
                            <span className="font-medium">{id}</span>
                            {invoiceId ? <span className="text-gray-500 text-xs">Invoice: {invoiceId}</span> : null}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{desc}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{amountFormatted}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              status === 'succeeded' || status === 'paid'
                                ? 'text-green-600 bg-green-50'
                                : status === 'failed'
                                ? 'text-red-600 bg-red-50'
                                : 'text-yellow-600 bg-yellow-50'
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <button onClick={() => openPaymentLinks(it)} className="text-primary-600 hover:text-primary-700 font-medium mr-3">
                            Download
                          </button>
                          <button onClick={() => openPaymentLinks(it)} className="text-gray-600 hover:text-gray-700 font-medium">
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-gray-600">
                  {filteredPayments.length} of {totalPayments ?? payments.length} shown
                </div>
                {hasMorePayments ? (
                  <button
                    onClick={loadMorePayments}
                    disabled={paymentsLoadingMore}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      paymentsLoadingMore ? 'bg-gray-200 text-gray-500 cursor-wait' : 'bg-white border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {paymentsLoadingMore ? 'Loading…' : 'Load more'}
                  </button>
                ) : (
                  <span className="text-sm text-gray-400">No more payments</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showCancelModal && <CancelModal />}
      {showCompareModal && <CompareModal />}
    </div>
  );
};

export default Billing;
