import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

type DoseLog = {
  type: 'dose';
  logged_at: string | null;
  peptide_name: string | null;
  amount: number | string | null;
  unit: string | null;
};

type LifestyleLog = {
  type: 'lifestyle';
  logged_at: string | null;
  mood: string | null;
  sleep_hours: number | string | null;
  water_oz: number | string | null;
};

type Protocol = {
  type: 'protocol';
  created_at: string | null;
  name: string | null;
  status: string | null;
};

type ActivityEvent = DoseLog | LifestyleLog | Protocol;

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured.');
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function eventDate(event: ActivityEvent) {
  return 'created_at' in event ? event.created_at : event.logged_at;
}

function byNewestActivity(a: ActivityEvent, b: ActivityEvent) {
  return new Date(eventDate(b) ?? 0).getTime() - new Date(eventDate(a) ?? 0).getTime();
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createAdminClient();

    const [doseLogs, lifestyleLogs, protocols] = await Promise.all([
      supabase
        .from('dose_logs')
        .select('logged_at,peptide_name,amount,unit')
        .eq('user_id', params.id)
        .order('logged_at', { ascending: false })
        .limit(50),
      supabase
        .from('lifestyle_logs')
        .select('logged_at,mood,sleep_hours,water_oz')
        .eq('user_id', params.id)
        .order('logged_at', { ascending: false })
        .limit(50),
      supabase
        .from('protocols')
        .select('created_at,name,status')
        .eq('user_id', params.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    for (const response of [doseLogs, lifestyleLogs, protocols]) {
      if (response.error) {
        throw response.error;
      }
    }

    const activity: ActivityEvent[] = [
      ...((doseLogs.data ?? []) as Omit<DoseLog, 'type'>[]).map((event) => ({ ...event, type: 'dose' as const })),
      ...((lifestyleLogs.data ?? []) as Omit<LifestyleLog, 'type'>[]).map((event) => ({
        ...event,
        type: 'lifestyle' as const,
      })),
      ...((protocols.data ?? []) as Omit<Protocol, 'type'>[]).map((event) => ({ ...event, type: 'protocol' as const })),
    ]
      .sort(byNewestActivity)
      .slice(0, 50);

    return NextResponse.json({ activity });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load user activity.' },
      { status: 500 },
    );
  }
}
