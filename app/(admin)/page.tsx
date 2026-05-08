import { UserSignupsChart } from './_components/user-signups-chart';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { supabase } from '@/lib/supabase';

type StatCard = {
  label: string;
  value: number;
};

type SignupCountRow = {
  day: string;
  count: number | string;
};

type UserSignupChartPoint = {
  day: string;
  signups: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setUTCHours(0, 0, 0, 0);

  return nextDate;
}

function addUtcDays(date: Date, days: number) {
  return new Date(startOfUtcDay(date).getTime() + days * DAY_MS);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildThirtyDaySignupData(rows: SignupCountRow[]): UserSignupChartPoint[] {
  const signupsByDay = new Map(
    rows.map((row) => [dateKey(new Date(row.day)), Number(row.count) || 0]),
  );
  const today = startOfUtcDay(new Date());
  const firstDay = addUtcDays(today, -29);

  return Array.from({ length: 30 }, (_, index) => {
    const day = addUtcDays(firstDay, index);
    const key = dateKey(day);

    return {
      day: key,
      signups: signupsByDay.get(key) ?? 0,
    };
  });
}

async function getDailyUserSignups(): Promise<UserSignupChartPoint[]> {
  const { data, error } = await supabaseAdmin.rpc('exec_sql', {
    sql: `
      select date_trunc('day', created_at) as day, count(*)
      from auth.users
      group by day
      order by day desc
      limit 30;
    `,
  });

  if (error) {
    console.error('Unable to load daily user signups:', error.message);
    return [];
  }

  const rows = (Array.isArray(data) ? data : []) as SignupCountRow[];

  return buildThirtyDaySignupData(rows);
}

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

  const [totalUsers, protocolsCreated, doseLogsToday, dailyUserSignups] = await Promise.all([
    getTableCount('profiles'),
    getTableCount('protocols'),
    getTableCount('dose_logs', { column: 'logged_at', value: today.toISOString() }),
    getDailyUserSignups(),
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
      <UserSignupsChart data={dailyUserSignups} />
    </section>
  );
}
