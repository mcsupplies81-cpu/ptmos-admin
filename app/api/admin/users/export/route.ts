import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string | null;
  is_pro?: boolean | null;
};

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

function isMissingColumnError(error: { code?: string; message?: string } | null) {
  return error?.code === '42703' || error?.message?.toLowerCase().includes('column') === true;
}

async function ensureProfileAdminColumns(supabase: SupabaseClient) {
  await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT false;',
  });
}

async function getProfiles(supabase: SupabaseClient) {
  let { data, error } = await supabase.from('profiles').select('id,full_name,email,created_at,is_pro').returns<Profile[]>();

  if (isMissingColumnError(error)) {
    await ensureProfileAdminColumns(supabase);
    const retry = await supabase.from('profiles').select('id,full_name,email,created_at,is_pro').returns<Profile[]>();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    throw error;
  }

  return new Map<string, Profile>((data ?? []).map((profile: Profile) => [profile.id, profile]));
}

async function getAllAuthUsers(supabase: SupabaseClient) {
  const users: User[] = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw error;
    }

    users.push(...data.users);

    if (data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
}

function csvCell(value: unknown) {
  const normalized = value === null || value === undefined ? '' : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}

function toCsv(users: User[], profiles: Map<string, Profile>) {
  const headers = ['id', 'email', 'full_name', 'created_at', 'is_pro', 'last_sign_in_at'];
  const rows = users.map((user) => {
    const profile = profiles.get(user.id);
    return [
      user.id,
      user.email ?? profile?.email ?? '',
      profile?.full_name ?? '',
      profile?.created_at ?? user.created_at ?? '',
      Boolean(profile?.is_pro),
      user.last_sign_in_at ?? '',
    ];
  });

  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const [users, profiles] = await Promise.all([getAllAuthUsers(supabase), getProfiles(supabase)]);

    return new NextResponse(toCsv(users, profiles), {
      headers: {
        'Content-Disposition': 'attachment; filename=users.csv',
        'Content-Type': 'text/csv; charset=utf-8',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to export users.' },
      { status: 500 },
    );
  }
}
