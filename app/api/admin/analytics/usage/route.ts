import { NextResponse } from 'next/server';

import { listAdminAnalyticsUsers, supabaseAdmin } from '@/lib/supabase-admin';

type FeatureConfig = {
  key: string;
  feature: string;
  table: string;
  dateColumn: 'created_at' | 'logged_at';
};

const FEATURES: FeatureConfig[] = [
  { key: 'dose_logs', feature: 'Dose Logs', table: 'dose_logs', dateColumn: 'logged_at' },
  { key: 'protocols', feature: 'Protocols', table: 'protocols', dateColumn: 'created_at' },
  { key: 'lifestyle_logs', feature: 'Lifestyle Logs', table: 'lifestyle_logs', dateColumn: 'logged_at' },
];

export const dynamic = 'force-dynamic';

async function countRows(table: string, filter?: { column: string; value: string }) {
  let query = supabaseAdmin.from(table).select('*', { count: 'exact', head: true });

  if (filter) {
    query = query.gte(filter.column, filter.value);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function GET() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

    const users = await listAdminAnalyticsUsers();
    const totalUsers = users.length;

    const features = await Promise.all(
      FEATURES.map(async (feature) => {
        const [totalRecords, lastSevenDays] = await Promise.all([
          countRows(feature.table),
          countRows(feature.table, { column: feature.dateColumn, value: sevenDaysAgo.toISOString() }),
        ]);

        return {
          key: feature.key,
          feature: feature.feature,
          totalRecords,
          avgPerUser: totalUsers > 0 ? totalRecords / totalUsers : 0,
          lastSevenDays,
        };
      }),
    );

    return NextResponse.json({ generatedAt: new Date().toISOString(), totalUsers, features });
  } catch (error) {
    console.error('Unable to load analytics usage:', error);

    return NextResponse.json({ error: 'Unable to load analytics usage.' }, { status: 500 });
  }
}
