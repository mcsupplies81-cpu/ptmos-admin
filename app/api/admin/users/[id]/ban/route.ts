import { NextResponse, type NextRequest } from 'next/server';

import { getAdminEmailFromRequest, logAudit } from '@/lib/audit';
import { supabaseAdmin } from '@/lib/supabase-admin';

const BAN_DURATION = '876600h';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = (await request.json()) as { banned?: unknown };

    if (typeof body.banned !== 'boolean') {
      return NextResponse.json({ error: 'banned must be a boolean.' }, { status: 400 });
    }

    const adminEmail = await getAdminEmailFromRequest(request);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(params.id, {
      ban_duration: body.banned ? BAN_DURATION : 'none',
    });

    if (error) {
      throw error;
    }

    await logAudit(adminEmail ?? 'unknown', body.banned ? 'ban_user' : 'unban_user', 'user', params.id, {
      banned: body.banned,
      banDuration: body.banned ? BAN_DURATION : 'none',
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update user ban status.' },
      { status: 500 },
    );
  }
}
