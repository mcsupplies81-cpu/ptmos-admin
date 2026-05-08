import { NextResponse, type NextRequest } from "next/server";

import { getAdminEmailFromRequest, logAudit } from "@/lib/audit";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase.from("feature_flags").select("*").order("key", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ flags: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { enabled?: unknown; key?: unknown };

  if (typeof body.key !== "string" || !body.key.trim() || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "A flag key and enabled boolean are required." }, { status: 400 });
  }

  const key = body.key.trim();
  const adminEmail = await getAdminEmailFromRequest(request);
  const { data: existingFlag } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("key", key)
    .maybeSingle();

  const { data, error } = await supabase
    .from("feature_flags")
    .upsert(
      {
        key,
        enabled: body.enabled,
        updated_at: new Date().toISOString(),
        updated_by: adminEmail,
      },
      { onConflict: "key" },
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit(adminEmail ?? 'unknown', "toggle_feature_flag", "feature_flag", key, {
    enabled: body.enabled,
    previousEnabled: existingFlag?.enabled ?? null,
  });

  return NextResponse.json({ flag: data });
}
