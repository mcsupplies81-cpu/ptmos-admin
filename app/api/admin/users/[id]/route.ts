import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

const BAN_DURATION = '876600h';

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string | null;
  is_pro?: boolean | null;
  admin_notes?: string | null;
};

type UserStats = {
  doseLogs: number;
  protocols: number;
  lifestyleLogs: number;
};

type UserResponse = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string | null;
  is_pro: boolean;
  admin_notes: string;
  banned: boolean;
  last_sign_in_at: string | null;
  stats?: UserStats;
};

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured.');
  }

  return url;
}

function getServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }

  return key;
}

function createAdminClient() {
  return createClient(getSupabaseUrl(), getServiceRoleKey(), {
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
    sql: `
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT false;
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_notes TEXT;
    `,
  });
}

function isUserBanned(user: User | null) {
  const bannedUntil = user?.banned_until;

  if (!bannedUntil) {
    return false;
  }

  return new Date(bannedUntil).getTime() > Date.now();
}

function serializeUser(user: User, profile: Profile | null, stats?: UserStats): UserResponse {
  return {
    id: user.id,
    email: user.email ?? profile?.email ?? null,
    full_name: profile?.full_name ?? (typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null),
    created_at: profile?.created_at ?? user.created_at ?? null,
    is_pro: Boolean(profile?.is_pro),
    admin_notes: profile?.admin_notes ?? '',
    banned: isUserBanned(user),
    last_sign_in_at: user.last_sign_in_at ?? null,
    stats,
  };
}


async function getTableCount(supabase: SupabaseClient, table: string, userId: string) {
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId);

  if (error) {
    return 0;
  }

  return count ?? 0;
}

async function getStats(supabase: SupabaseClient, id: string): Promise<UserStats> {
  const [doseLogs, protocols, lifestyleLogs] = await Promise.all([
    getTableCount(supabase, 'dose_logs', id),
    getTableCount(supabase, 'protocols', id),
    getTableCount(supabase, 'lifestyle_logs', id),
  ]);

  return { doseLogs, protocols, lifestyleLogs };
}

async function getProfile(supabase: SupabaseClient, id: string) {
  let { data, error } = await supabase
    .from('profiles')
    .select('id,full_name,email,created_at,is_pro,admin_notes')
    .eq('id', id)
    .maybeSingle<Profile>();

  if (isMissingColumnError(error)) {
    await ensureProfileAdminColumns(supabase);
    const retry = await supabase
      .from('profiles')
      .select('id,full_name,email,created_at,is_pro,admin_notes')
      .eq('id', id)
      .maybeSingle<Profile>();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    throw error;
  }

  return data;
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createAdminClient();
    const [{ data: authData, error: authError }, profile, stats] = await Promise.all([
      supabase.auth.admin.getUserById(params.id),
      getProfile(supabase, params.id),
      getStats(supabase, params.id),
    ]);

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message ?? 'User not found.' }, { status: 404 });
    }

    return NextResponse.json(serializeUser(authData.user, profile, stats));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load user.' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = (await request.json()) as { is_pro?: unknown; banned?: unknown; notes?: unknown };
    const profileUpdates: { is_pro?: boolean; admin_notes?: string } = {};

    if (body.is_pro !== undefined) {
      if (typeof body.is_pro !== 'boolean') {
        return NextResponse.json({ error: 'is_pro must be a boolean.' }, { status: 400 });
      }
      profileUpdates.is_pro = body.is_pro;
    }

    if (body.banned !== undefined && typeof body.banned !== 'boolean') {
      return NextResponse.json({ error: 'banned must be a boolean.' }, { status: 400 });
    }

    if (body.notes !== undefined) {
      if (typeof body.notes !== 'string') {
        return NextResponse.json({ error: 'notes must be a string.' }, { status: 400 });
      }
      profileUpdates.admin_notes = body.notes;
    }

    if (!Object.keys(profileUpdates).length && body.banned === undefined) {
      return NextResponse.json({ error: 'No supported fields provided.' }, { status: 400 });
    }

    const supabase = createAdminClient();
    await ensureProfileAdminColumns(supabase);

    if (Object.keys(profileUpdates).length) {
      const { error } = await supabase.from('profiles').update(profileUpdates).eq('id', params.id);

      if (error) {
        throw error;
      }
    }

    if (typeof body.banned === 'boolean') {
      const { error } = await supabase.auth.admin.updateUserById(params.id, {
        ban_duration: body.banned ? BAN_DURATION : 'none',
      });

      if (error) {
        throw error;
      }
    }

    const [{ data: authData, error: authError }, profile, stats] = await Promise.all([
      supabase.auth.admin.getUserById(params.id),
      getProfile(supabase, params.id),
      getStats(supabase, params.id),
    ]);

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message ?? 'User not found.' }, { status: 404 });
    }

    return NextResponse.json(serializeUser(authData.user, profile, stats));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update user.' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = (await request.json().catch(() => null)) as { confirm?: unknown } | null;

    if (body?.confirm !== 'DELETE') {
      return NextResponse.json({ error: 'Type DELETE to confirm account deletion.' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase.auth.admin.deleteUser(params.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to delete user.' },
      { status: 500 },
    );
  }
}
