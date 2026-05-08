import { NextResponse, type NextRequest } from 'next/server';

import { getAdminEmailFromRequest, logAudit } from '@/lib/audit';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = (await request.json()) as { is_pro?: unknown };

    if (typeof body.is_pro !== 'boolean') {
      return NextResponse.json({ error: 'is_pro must be a boolean.' }, { status: 400 });
    }

    const adminEmail = await getAdminEmailFromRequest(request);
    const { error } = await supabaseAdmin.from('profiles').update({ is_pro: body.is_pro }).eq('id', params.id);

    if (error) {
      throw error;
    }

    await logAudit(adminEmail ?? 'unknown', body.is_pro ? 'grant_pro' : 'revoke_pro', 'user', params.id, {
      isPro: body.is_pro,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update pro status.' },
      { status: 500 },
    );
  }
}
