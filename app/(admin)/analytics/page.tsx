'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type AnalyticsUser = {
  id: string;
  created_at: string;
  last_sign_in_at: string | null;
};

type UsageFeature = {
  key: string;
  feature: string;
  totalRecords: number;
  avgPerUser: number;
  lastSevenDays: number;
};

type UsersResponse = {
  users: AnalyticsUser[];
  error?: string;
};

type UsageResponse = {
  activeNow: number;
  features: UsageFeature[];
  error?: string;
};

type KpiCard = {
  label: string;
  value: number;
  helper: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setUTCHours(0, 0, 0, 0);

  return nextDate;
}

function firstDayOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addUtcDays(date: Date, days: number) {
  return new Date(startOfUtcDay(date).getTime() + days * DAY_MS);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shortDateLabel(date: Date) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
}

function toNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function buildDailyDates(days: number) {
  const today = startOfUtcDay(new Date());
  const firstDate = addUtcDays(today, -(days - 1));

  return Array.from({ length: days }, (_, index) => addUtcDays(firstDate, index));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en').format(value);
}

function isOnOrAfter(value: string | null, threshold: Date) {
  if (!value) {
    return false;
  }

  return new Date(value).getTime() >= threshold.getTime();
}

function getUsageTableEmptyState(loading: boolean, error: string | null) {
  if (loading) {
    return 'Loading feature usage...';
  }

  if (error) {
    return error;
  }

  return 'No feature usage records found.';
}

export default function AnalyticsPage() {
  const [users, setUsers] = useState<AnalyticsUser[]>([]);
  const [usageFeatures, setUsageFeatures] = useState<UsageFeature[]>([]);
  const [activeNow, setActiveNow] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      setError(null);

      try {
        const [usersResponse, usageResponse] = await Promise.all([
          fetch('/api/admin/analytics/users', { cache: 'no-store' }),
          fetch('/api/admin/analytics/usage', { cache: 'no-store' }),
        ]);

        const usersPayload = (await usersResponse.json()) as UsersResponse;
        const usagePayload = (await usageResponse.json()) as UsageResponse;

        if (!usersResponse.ok) {
          throw new Error(usersPayload.error ?? 'Unable to load analytics users.');
        }

        if (!usageResponse.ok) {
          throw new Error(usagePayload.error ?? 'Unable to load feature usage.');
        }

        setUsers(usersPayload.users ?? []);
        setActiveNow(usagePayload.activeNow ?? 0);
        setUsageFeatures(usagePayload.features ?? []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load analytics.');
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, []);

  const today = useMemo(() => startOfUtcDay(new Date()), []);
  const firstDayThisMonth = useMemo(() => firstDayOfUtcMonth(new Date()), []);
  const thirtyDaysAgo = useMemo(() => addUtcDays(today, -30), [today]);

  const kpis = useMemo<KpiCard[]>(() => {
    const totalUsers = users.length;
    const newThisMonth = users.filter((user) => isOnOrAfter(user.created_at, firstDayThisMonth)).length;
    const dau = users.filter((user) => isOnOrAfter(user.last_sign_in_at, today)).length;
    const mau = users.filter((user) => isOnOrAfter(user.last_sign_in_at, thirtyDaysAgo)).length;

    return [
      { label: 'Total Users', value: totalUsers, helper: 'Auth users' },
      { label: 'Active (30m)', value: activeNow, helper: 'Profiles active in last 30 min' },
      { label: 'New This Month', value: newThisMonth, helper: 'Created since month start' },
      { label: 'DAU', value: dau, helper: 'Signed in today' },
      { label: 'MAU', value: mau, helper: 'Signed in last 30 days' },
    ];
  }, [activeNow, firstDayThisMonth, thirtyDaysAgo, today, users]);

  const growthData = useMemo(() => {
    const dates = buildDailyDates(30);
    const firstDate = dates[0];
    const createdByDay = new Map<string, number>();
    let runningTotal = users.filter((user) => new Date(user.created_at).getTime() < firstDate.getTime()).length;

    users.forEach((user) => {
      const createdDate = startOfUtcDay(new Date(user.created_at));
      const key = dateKey(createdDate);
      createdByDay.set(key, (createdByDay.get(key) ?? 0) + 1);
    });

    return dates.map((date) => {
      runningTotal += createdByDay.get(dateKey(date)) ?? 0;

      return {
        date: shortDateLabel(date),
        users: runningTotal,
      };
    });
  }, [users]);

  const signupData = useMemo(() => {
    const dates = buildDailyDates(14);
    const createdByDay = new Map<string, number>();

    users.forEach((user) => {
      const createdDate = startOfUtcDay(new Date(user.created_at));
      const key = dateKey(createdDate);
      createdByDay.set(key, (createdByDay.get(key) ?? 0) + 1);
    });

    return dates.map((date) => ({
      date: shortDateLabel(date),
      signups: createdByDay.get(dateKey(date)) ?? 0,
    }));
  }, [users]);

  return (
    <section className="min-h-screen bg-background text-text">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-text-secondary">Admin analytics</p>
          <h1 className="text-3xl font-black tracking-tight text-text">Analytics Dashboard</h1>
        </div>
        <p className="max-w-xl text-sm leading-6 text-text-secondary">
          Live Supabase auth activity and feature usage metrics for the PT-OS admin console.
        </p>
      </div>

      {error ? <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <article className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-black/10" key={kpi.label}>
            <p className="text-sm font-semibold uppercase tracking-wide text-text-secondary">{kpi.label}</p>
            <p className="mt-4 text-[36px] font-bold leading-none text-text">
              {loading ? '—' : formatNumber(kpi.value)}
            </p>
            <p className="mt-3 text-sm text-text-secondary">{kpi.helper}</p>
          </article>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-black/10">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-text">User Growth</h2>
            <p className="mt-1 text-sm text-text-secondary">Cumulative auth user count over the last 30 days.</p>
          </div>
          <div className="h-[340px]">
            <ResponsiveContainer height="100%" width="100%">
              <LineChart data={growthData} margin={{ bottom: 8, left: 0, right: 16, top: 12 }}>
                <CartesianGrid stroke="#2A2F45" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 12 }} tickLine={false} />
                <YAxis stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 12 }} tickLine={false} width={42} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E2235', border: '1px solid #2A2F45', borderRadius: 12, color: '#F8FAFC' }}
                  labelStyle={{ color: '#94A3B8' }}
                />
                <Line dataKey="users" dot={false} name="Users" stroke="#2D6A4F" strokeWidth={3} type="monotone" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-black/10">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-text">Signups by Day</h2>
            <p className="mt-1 text-sm text-text-secondary">New auth users per day over the last 14 days.</p>
          </div>
          <div className="h-[340px]">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={signupData} margin={{ bottom: 8, left: 0, right: 16, top: 12 }}>
                <CartesianGrid stroke="#2A2F45" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 12 }} tickLine={false} />
                <YAxis stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 12 }} tickLine={false} width={42} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E2235', border: '1px solid #2A2F45', borderRadius: 12, color: '#F8FAFC' }}
                  labelStyle={{ color: '#94A3B8' }}
                />
                <Bar dataKey="signups" fill="#2D6A4F" name="Signups" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      <article className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-black/10">
        <div className="border-b border-border p-6">
          <h2 className="text-xl font-bold text-text">Feature Usage</h2>
          <p className="mt-1 text-sm text-text-secondary">Real record counts from Supabase usage tables.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-border bg-[#181C2E] text-xs uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-6 py-4">Feature</th>
                <th className="px-6 py-4 text-right">Total Records</th>
                <th className="px-6 py-4 text-right">Avg Per User</th>
                <th className="px-6 py-4 text-right">Last 7 Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!usageFeatures.length ? (
                <tr>
                  <td className="px-6 py-10 text-center text-text-secondary" colSpan={4}>
                    {getUsageTableEmptyState(loading, error)}
                  </td>
                </tr>
              ) : (
                usageFeatures.map((feature) => (
                  <tr className="transition hover:bg-[#242941]" key={feature.key}>
                    <td className="px-6 py-4 font-semibold text-text">{feature.feature}</td>
                    <td className="px-6 py-4 text-right text-text-secondary">{formatNumber(feature.totalRecords)}</td>
                    <td className="px-6 py-4 text-right text-text-secondary">{toNumber(feature.avgPerUser).toFixed(2)}</td>
                    <td className="px-6 py-4 text-right text-text-secondary">{formatNumber(feature.lastSevenDays)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
