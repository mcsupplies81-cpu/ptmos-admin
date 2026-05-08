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

async function getProfiles(supabase: SupabaseClient, ids: string[]) {
  if (!ids.length) {
    return [];
  }

  let { data, error } = await supabase
    .from('profiles')
    .select('id,full_name,email,created_at,is_pro')
    .in('id', ids)
    .returns<Profile[]>();

  if (isMissingColumnError(error)) {
    await ensureProfileAdminColumns(supabase);
    const retry = await supabase
      .from('profiles')
      .select('id,full_name,email,created_at,is_pro')
      .in('id', ids)
      .returns<Profile[]>();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function getAuthUsers(supabase: SupabaseClient, page: number, perPage: number) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

  if (error) {
    throw error;
  }

  const listData = data as typeof data & { total?: number };

  return {
    users: listData.users,
    total: listData.total ?? listData.users.length,
  };
}

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function normalizeSearchQuery(value: string | null) {
  return value?.trim().toLowerCase() ?? '';
}

function matchesSearch(user: { full_name: string | null; email: string | null }, search: string) {
  if (!search) {
    return true;
  }

  const fullName = user.full_name?.toLowerCase() ?? '';
  const email = user.email?.toLowerCase() ?? '';

  return fullName.includes(search) || email.includes(search);
}

function isUserBanned(user: User | undefined) {
  const bannedUntil = user?.banned_until;

  if (!bannedUntil) {
    return false;
  }

  return new Date(bannedUntil).getTime() > Date.now();
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const page = parsePositiveInteger(request.nextUrl.searchParams.get('page'), 1);
    const perPage = parsePositiveInteger(request.nextUrl.searchParams.get('perPage'), 25);
    const search = normalizeSearchQuery(request.nextUrl.searchParams.get('search'));

    let authUsers: User[];
    let total: number;

    if (search) {
      // When searching, fetch all users so we can filter and paginate accurately.
      // listUsers maxes at 1000 per page; loop until exhausted.
      const allUsers: User[] = [];
      let fetchPage = 1;
      while (true) {
        const { users: batch, total: batchTotal } = await getAuthUsers(supabase, fetchPage, 1000);
        allUsers.push(...batch);
        if (allUsers.length >= batchTotal || batch.length < 1000) break;
        fetchPage++;
      }
      authUsers = allUsers;
      total = allUsers.length; // will be narrowed after filter below
    } else {
      const result = await getAuthUsers(supabase, page, perPage);
      authUsers = result.users;
      total = result.total;
    }

    const profiles = await getProfiles(
      supabase,
      authUsers.map((user: User) => user.id),
    );
    const profileById = new Map<string, Profile>(profiles.map((profile: Profile) => [profile.id, profile]));

    let users = authUsers
      .map((authUser: User) => {
        const profile = profileById.get(authUser.id);
        return {
          id: authUser.id,
          full_name:
            profile?.full_name ??
            (typeof authUser.user_metadata?.full_name === 'string' ? authUser.user_metadata.full_name : null),
          email: authUser.email ?? profile?.email ?? null,
          created_at: profile?.created_at ?? authUser.created_at ?? null,
          is_pro: Boolean(profile?.is_pro),
          banned: isUserBanned(authUser),
          last_sign_in_at: authUser.last_sign_in_at ?? null,
        };
      })
      .filter((user) => matchesSearch(user, search))
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());

    if (search) {
      total = users.length;
      users = users.slice((page - 1) * perPage, page * perPage);
    }

    return NextResponse.json({ users, total, page, perPage });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load users.' },
      { status: 500 },
    );
  }
}
