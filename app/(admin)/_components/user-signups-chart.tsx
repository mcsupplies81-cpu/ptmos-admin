'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type UserSignupChartPoint = {
  day: string;
  signups: number;
};

type UserSignupsChartProps = {
  data: UserSignupChartPoint[];
};

function formatSignupDate(value: string) {
  const parsedDate = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(parsedDate);
}

export function UserSignupsChart({ data }: UserSignupsChartProps) {
  return (
    <article className="mt-6 max-w-5xl rounded-2xl border border-border bg-card p-6 shadow-xl shadow-black/10">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-text">30-Day User Signups</h2>
          <p className="mt-1 text-sm text-text-secondary">New auth users per day from Supabase.</p>
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-text-secondary">Last 30 days</p>
      </div>

      <div className="h-[320px]">
        <ResponsiveContainer height="100%" width="100%">
          <LineChart data={data} margin={{ bottom: 8, left: 0, right: 16, top: 12 }}>
            <CartesianGrid stroke="#2A2F45" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="day"
              stroke="#94A3B8"
              tick={{ fill: '#94A3B8', fontSize: 12 }}
              tickFormatter={formatSignupDate}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              stroke="#94A3B8"
              tick={{ fill: '#94A3B8', fontSize: 12 }}
              tickLine={false}
              width={42}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1E2235',
                border: '1px solid #2A2F45',
                borderRadius: 12,
                color: '#F8FAFC',
              }}
              formatter={(value: number | string) => [Number(value).toLocaleString(), 'Signups']}
              labelFormatter={(label: number | string) => formatSignupDate(String(label))}
              labelStyle={{ color: '#94A3B8' }}
            />
            <Line
              activeDot={{ r: 6, stroke: '#F8FAFC', strokeWidth: 2 }}
              dataKey="signups"
              dot={{ fill: '#2D6A4F', r: 3, strokeWidth: 0 }}
              name="Signups"
              stroke="#2D6A4F"
              strokeWidth={3}
              type="monotone"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
