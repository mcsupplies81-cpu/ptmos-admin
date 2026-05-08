import { supabase } from '@/lib/supabase';

type StatCard = {
  label: string;
  value: number;
};

async function getTableCount(tableName: string, gteFilter?: { column: string; value: string }) {
  let query = supabase.from(tableName).select('*', { count: 'exact', head: true });

  if (gteFilter) {
    query = query.gte(gteFilter.column, gteFilter.value);
  }

  const { count, error } = await query;

  if (error) {
    console.error(`Unable to count ${tableName}:`, error.message);
    return 0;
  }

  return count ?? 0;
}

export default async function DashboardPage() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [totalUsers, protocolsCreated, doseLogsToday] = await Promise.all([
    getTableCount('profiles'),
    getTableCount('protocols'),
    getTableCount('dose_logs', { column: 'logged_at', value: today.toISOString() }),
  ]);

  const stats: StatCard[] = [
    { label: 'Total Users', value: totalUsers },
    { label: 'Pro Subscribers', value: 0 },
    { label: 'Protocols Created', value: protocolsCreated },
    { label: 'Dose Logs Today', value: doseLogsToday },
  ];

  return (
    <section>
      <h1 className="mb-8 text-3xl font-black tracking-tight text-text">Dashboard</h1>
      <div className="grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2">
        {stats.map((stat) => (
          <article className="rounded-2xl border border-border bg-card p-6" key={stat.label}>
            <p className="text-[36px] font-bold leading-none text-text">{stat.value.toLocaleString()}</p>
            <h2 className="mt-4 text-sm font-semibold uppercase tracking-wide text-text-secondary">
              {stat.label}
            </h2>
          </article>
        ))}
      </div>
    </section>
  );
}
