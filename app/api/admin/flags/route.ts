import { NextResponse, type NextRequest } from "next/server";

import { logAudit } from "@/lib/audit";
import { supabase } from "@/lib/supabase";

type SupabaseSessionCookie = {
  access_token?: string;
};

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");

  return Buffer.from(padded, "base64").toString("utf8");
}

function getJwtPayload(token: string) {
  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(payload)) as { email?: string };
  } catch {
    return null;
  }
}

function getAdminEmail(request: NextRequest) {
  const sessionCookie = request.cookies
    .getAll()
    .find((cookie) => cookie.name.startsWith("sb-") && cookie.name.endsWith("-auth-token"));

  if (!sessionCookie?.value) {
    return null;
  }

  try {
    const decodedValue = decodeURIComponent(sessionCookie.value);
    const jsonValue = decodedValue.startsWith("base64-")
      ? decodeBase64Url(decodedValue.replace("base64-", ""))
      : decodedValue;
    const session = JSON.parse(jsonValue) as SupabaseSessionCookie | [string, string];
    const token = Array.isArray(session) ? session[0] : session.access_token;

    return token ? (getJwtPayload(token)?.email ?? null) : null;
  } catch {
    return null;
  }
}

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
  const adminEmail = getAdminEmail(request);
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

  try {
    await logAudit(supabase, {
      adminEmail,
      action: "update_feature_flag",
      targetType: "feature_flag",
      targetId: key,
      details: {
        enabled: body.enabled,
        previousEnabled: existingFlag?.enabled ?? null,
      },
    });
  } catch (auditError) {
    return NextResponse.json(
      { error: auditError instanceof Error ? auditError.message : "Feature flag was saved, but audit logging failed." },
      { status: 500 },
    );
  }

  return NextResponse.json({ flag: data });
}
