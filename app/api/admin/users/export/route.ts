import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string | null;
  is_pro?: boolean | null;
};

type ExportUser = {
  id: string;
  email: string | null | undefined;
  full_name: string | null;
  is_pro: boolean;
  created_at: string | null;
  last_sign_in_at: string | null;
  banned: boolean;
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
  let { data, error } = await supabase
    .from('profiles')
    .select('id,full_name,email,created_at,is_pro')
    .order('created_at', { ascending: false })
    .returns<Profile[]>();

  if (isMissingColumnError(error)) {
    await ensureProfileAdminColumns(supabase);
    const retry = await supabase
      .from('profiles')
      .select('id,full_name,email,created_at,is_pro')
      .order('created_at', { ascending: false })
      .returns<Profile[]>();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    throw error;
  }

  return data ?? [];
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

function isUserBanned(user: User | undefined) {
  const bannedUntil = user?.banned_until;

  if (!bannedUntil) {
    return false;
  }

  return new Date(bannedUntil).getTime() > Date.now();
}

function getExportUsers(profiles: Profile[], authUsers: User[]): ExportUser[] {
  const authUserById = new Map<string, User>(authUsers.map((user: User) => [user.id, user]));
  const profileIds = new Set<string>(profiles.map((profile: Profile) => profile.id));

  return [
    ...profiles.map((profile: Profile) => {
      const authUser = authUserById.get(profile.id);

      return {
        id: profile.id,
        full_name: profile.full_name,
        email: authUser?.email ?? profile.email,
        created_at: profile.created_at ?? authUser?.created_at ?? null,
        is_pro: Boolean(profile.is_pro),
        banned: isUserBanned(authUser),
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
      };
    }),
    ...authUsers
      .filter((user: User) => !profileIds.has(user.id))
      .map((user: User) => ({
        id: user.id,
        full_name: typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null,
        email: user.email ?? null,
        created_at: user.created_at ?? null,
        is_pro: false,
        banned: isUserBanned(user),
        last_sign_in_at: user.last_sign_in_at ?? null,
      })),
  ].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
}

function csvCell(value: unknown) {
  const normalized = value === null || value === undefined ? '' : String(value);

  if (normalized.includes(',') || normalized.includes('\n') || normalized.includes('\r') || normalized.includes('"')) {
    return `"${normalized.replaceAll('"', '""')}"`;
  }

  return normalized;
}

function toCsv(users: ExportUser[]) {
  const headers = ['id', 'email', 'full_name', 'is_pro', 'created_at', 'last_sign_in_at', 'banned'];
  const rows = users.map((user) => [
    user.id,
    user.email,
    user.full_name,
    user.is_pro,
    user.created_at,
    user.last_sign_in_at,
    user.banned,
  ]);

  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

function csvFilename() {
  return `ptmos-users-${new Date().toISOString().slice(0, 10)}.csv`;
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const [profiles, authUsers] = await Promise.all([getProfiles(supabase), getAllAuthUsers(supabase)]);
    const users = getExportUsers(profiles, authUsers);

    return new NextResponse(toCsv(users), {
      headers: {
        'Content-Disposition': `attachment; filename="${csvFilename()}"`,
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
