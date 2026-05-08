"use client";

import { useEffect, useMemo, useState } from "react";

type RevenueEvent = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  event_type: string | null;
  product_id: string | null;
  price_usd: number | string | null;
  currency: string | null;
  period_type: string | null;
  occurred_at: string | null;
};

type RevenueResponse = {
  mrr: number;
  total_revenue: number;
  new_this_month: number;
  cancellations_this_month: number;
  events_last_30: RevenueEvent[];
};

type ChartPoint = {
  date: string;
  label: string;
  revenue: number;
};

const badgeClasses: Record<string, string> = {
  INITIAL_PURCHASE: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  RENEWAL: "border-blue-400/30 bg-blue-400/10 text-blue-300",
  CANCELLATION: "border-red-400/30 bg-red-400/10 text-red-300",
  EXPIRATION: "border-orange-400/30 bg-orange-400/10 text-orange-300",
  BILLING_ISSUE: "border-red-400/30 bg-red-400/10 text-red-300",
};

function money(value: number | string | null | undefined, currency = "USD") {
  const parsedValue = typeof value === "number" ? value : Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(parsedValue) ? parsedValue : 0);
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getLastThirtyDays() {
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (29 - index));

    return date;
  });
}

function buildChartData(events: RevenueEvent[]) {
  const revenueByDate = new Map<string, number>();

  for (const event of events) {
    if (!event.occurred_at || !["INITIAL_PURCHASE", "RENEWAL"].includes(event.event_type ?? "")) {
      continue;
    }

    const dateKey = new Date(event.occurred_at).toISOString().slice(0, 10);
    const price = typeof event.price_usd === "number" ? event.price_usd : Number(event.price_usd ?? 0);

    revenueByDate.set(dateKey, (revenueByDate.get(dateKey) ?? 0) + (Number.isFinite(price) ? price : 0));
  }

  return getLastThirtyDays().map((date) => {
    const dateKey = date.toISOString().slice(0, 10);

    return {
      date: dateKey,
      label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date),
      revenue: revenueByDate.get(dateKey) ?? 0,
    };
  });
}

function RevenueAreaChart({ data }: { data: ChartPoint[] }) {
  const width = 960;
  const height = 280;
  const padding = 32;
  const maxRevenue = Math.max(...data.map((point) => point.revenue), 1);
  const points = data.map((point, index) => {
    const x = padding + (index / Math.max(data.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - (point.revenue / maxRevenue) * (height - padding * 2);

    return { ...point, x, y };
  });
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const areaPath = `${linePath} L${width - padding},${height - padding} L${padding},${height - padding} Z`;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Revenue over time</h2>
          <p className="text-sm text-slate-400">Daily purchase and renewal revenue from the last 30 days.</p>
        </div>
        <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-sm font-semibold text-cyan-200">
          Last 30 days
        </span>
      </div>
      <svg className="h-[280px] w-full" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`} role="img">
        <title>Revenue Area Chart</title>
        <defs>
          <linearGradient id="revenueGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = padding + tick * (height - padding * 2);

          return <line key={tick} stroke="#1e293b" strokeDasharray="4 6" x1={padding} x2={width - padding} y1={y} y2={y} />;
        })}
        <path d={areaPath} fill="url(#revenueGradient)" />
        <path d={linePath} fill="none" stroke="#22d3ee" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        {points.map((point, index) =>
          index % 5 === 0 || index === points.length - 1 ? (
            <g key={point.date}>
              <circle cx={point.x} cy={point.y} fill="#020617" r="5" stroke="#67e8f9" strokeWidth="3" />
              <text fill="#94a3b8" fontSize="12" textAnchor="middle" x={point.x} y={height - 8}>
                {point.label}
              </text>
            </g>
          ) : null,
        )}
      </svg>
    </div>
  );
}

function EventBadge({ type }: { type: string | null }) {
  const eventType = type ?? "UNKNOWN";
  const classes = badgeClasses[eventType] ?? "border-slate-600 bg-slate-800 text-slate-300";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}>{eventType}</span>;
}

export default function RevenuePage() {
  const [data, setData] = useState<RevenueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRevenue() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/admin/revenue");

        if (!response.ok) {
          throw new Error("Unable to load revenue metrics.");
        }

        setData((await response.json()) as RevenueResponse);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load revenue metrics.");
      } finally {
        setLoading(false);
      }
    }

    loadRevenue();
  }, []);

  const chartData = useMemo(() => buildChartData(data?.events_last_30 ?? []), [data?.events_last_30]);
  const kpis = [
    { label: "MRR", value: money(data?.mrr ?? 0) },
    { label: "Total Revenue", value: money(data?.total_revenue ?? 0) },
    { label: "New Subs This Month", value: data?.new_this_month ?? 0 },
    { label: "Cancellations This Month", value: data?.cancellations_this_month ?? 0 },
  ];

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="border-b border-slate-800 pb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">RevenueCat</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Revenue</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Track subscription MRR, monthly subscriber movement, and recent RevenueCat webhook events.
          </p>
        </header>

        {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div> : null}

        <section className="grid gap-4 md:grid-cols-4">
          {kpis.map((kpi) => (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/20" key={kpi.label}>
              <p className="text-sm font-semibold text-slate-400">{kpi.label}</p>
              <p className="mt-3 text-3xl font-black text-slate-100">{loading ? "—" : kpi.value}</p>
            </div>
          ))}
        </section>

        <RevenueAreaChart data={chartData} />

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-2xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100">Recent events</h2>
              <p className="text-sm text-slate-400">Up to 100 events from the last 30 days.</p>
            </div>
          </div>
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-900 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-4">Type</th>
                <th className="px-5 py-4">Product</th>
                <th className="px-5 py-4">Price</th>
                <th className="px-5 py-4">User email</th>
                <th className="px-5 py-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td className="px-5 py-10 text-center text-slate-400" colSpan={5}>
                    Loading revenue events...
                  </td>
                </tr>
              ) : data?.events_last_30.length ? (
                data.events_last_30.map((event) => (
                  <tr className="transition hover:bg-slate-800/40" key={event.id}>
                    <td className="px-5 py-4"><EventBadge type={event.event_type} /></td>
                    <td className="px-5 py-4 font-medium text-slate-100">{event.product_id || "—"}</td>
                    <td className="px-5 py-4 text-slate-300">{money(event.price_usd, event.currency ?? "USD")}</td>
                    <td className="px-5 py-4 text-slate-300">{event.user_email || "—"}</td>
                    <td className="px-5 py-4 text-slate-300">{formatDate(event.occurred_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-10 text-center text-slate-400" colSpan={5}>
                    No RevenueCat events found for the last 30 days.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
