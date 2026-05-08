import { NextResponse } from 'next/server';

import { listAdminAnalyticsUsers } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const users = await listAdminAnalyticsUsers();

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Unable to load analytics users:', error);

    return NextResponse.json({ error: 'Unable to load analytics users.' }, { status: 500 });
  }
}
