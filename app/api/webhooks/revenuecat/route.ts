/*
Supabase migration:
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  event_type TEXT, -- 'INITIAL_PURCHASE', 'RENEWAL', 'CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE'
  product_id TEXT,
  price_usd NUMERIC(10,2),
  currency TEXT,
  period_type TEXT, -- 'MONTHLY', 'ANNUAL'
  occurred_at TIMESTAMPTZ DEFAULT now(),
  raw JSONB
);
*/

import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type RevenueCatEvent = {
  type?: string;
  app_user_id?: string;
  product_id?: string;
  price?: number | string;
  price_in_purchased_currency?: number | string;
  currency?: string;
  period_type?: string;
  purchased_at_ms?: number;
  event_timestamp_ms?: number;
};

type RevenueCatPayload = {
  event?: RevenueCatEvent;
};

const proEventTypes = new Set(["INITIAL_PURCHASE", "RENEWAL"]);
const inactiveEventTypes = new Set(["CANCELLATION", "EXPIRATION"]);

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name} environment variable`);
  }

  return value;
}

function createSupabaseServerClient() {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}

function digestMatchesSignature(body: string, signature: string, secret: string) {
  const digest = createHmac("sha256", secret).update(body).digest("hex");
  const normalizedSignature = signature.trim().replace(/^sha256=/i, "");

  const digestBuffer = Buffer.from(digest, "hex");
  const signatureBuffer = Buffer.from(normalizedSignature, "hex");

  if (digestBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(digestBuffer, signatureBuffer);
}

function parsePrice(event: RevenueCatEvent) {
  const rawPrice = event.price ?? event.price_in_purchased_currency ?? 0;
  const parsedPrice = typeof rawPrice === "number" ? rawPrice : Number(rawPrice);

  return Number.isFinite(parsedPrice) ? parsedPrice : 0;
}

function parseOccurredAt(event: RevenueCatEvent) {
  const timestamp = event.purchased_at_ms ?? event.event_timestamp_ms;

  if (!timestamp) {
    return new Date().toISOString();
  }

  return new Date(timestamp).toISOString();
}

function parsePeriodType(event: RevenueCatEvent) {
  if (event.period_type) {
    return event.period_type.toUpperCase();
  }

  const productId = event.product_id?.toLowerCase() ?? "";

  if (productId.includes("annual") || productId.includes("year")) {
    return "ANNUAL";
  }

  return "MONTHLY";
}

export async function POST(request: Request) {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json({ error: "Webhook secret is not configured." }, { status: 500 });
  }

  const signature = request.headers.get("x-revenuecat-signature");
  const body = await request.text();

  if (!signature || !digestMatchesSignature(body, signature, secret)) {
    return NextResponse.json({ error: "Invalid RevenueCat signature." }, { status: 401 });
  }

  let payload: RevenueCatPayload;

  try {
    payload = JSON.parse(body) as RevenueCatPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const event = payload.event;

  if (!event?.type || !event.app_user_id) {
    return NextResponse.json({ error: "Missing RevenueCat event fields." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const eventType = event.type.toUpperCase();
  const userId = event.app_user_id;

  const { error: insertError } = await supabase.from("subscription_events").insert({
    user_id: userId,
    event_type: eventType,
    product_id: event.product_id ?? null,
    price_usd: parsePrice(event),
    currency: event.currency ?? "USD",
    period_type: parsePeriodType(event),
    occurred_at: parseOccurredAt(event),
    raw: payload,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  if (proEventTypes.has(eventType) || inactiveEventTypes.has(eventType)) {
    const isPro = proEventTypes.has(eventType);
    const { error: profileError } = await supabase.from("profiles").update({ is_pro: isPro }).eq("id", userId);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
