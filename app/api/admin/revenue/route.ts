import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type SubscriptionEvent = {
  id: string;
  user_id: string | null;
  event_type: string | null;
  product_id: string | null;
  price_usd: number | string | null;
  currency: string | null;
  period_type: string | null;
  occurred_at: string | null;
  raw?: unknown;
};

type RevenueEvent = SubscriptionEvent & {
  user_email: string | null;
};

const revenueEventTypes = new Set(["INITIAL_PURCHASE", "RENEWAL"]);
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

function priceAsNumber(price: number | string | null) {
  const parsedPrice = typeof price === "number" ? price : Number(price ?? 0);

  return Number.isFinite(parsedPrice) ? parsedPrice : 0;
}

function firstDayOfCurrentMonth() {
  const now = new Date();

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function monthlyEquivalentRevenue(event: SubscriptionEvent) {
  const price = priceAsNumber(event.price_usd);
  const periodType = event.period_type?.toUpperCase();

  return periodType === "ANNUAL" ? price / 12 : price;
}

function calculateMrr(events: SubscriptionEvent[]) {
  const latestByUser = new Map<string, SubscriptionEvent>();

  for (const event of events) {
    if (!event.user_id || !event.event_type) {
      continue;
    }

    const existing = latestByUser.get(event.user_id);
    const eventTime = new Date(event.occurred_at ?? 0).getTime();
    const existingTime = new Date(existing?.occurred_at ?? 0).getTime();

    if (!existing || eventTime > existingTime) {
      latestByUser.set(event.user_id, event);
    }
  }

  return [...latestByUser.values()].reduce((total, event) => {
    const eventType = event.event_type?.toUpperCase() ?? "";

    if (revenueEventTypes.has(eventType) && !inactiveEventTypes.has(eventType)) {
      return total + monthlyEquivalentRevenue(event);
    }

    return total;
  }, 0);
}

async function addUserEmails(events: SubscriptionEvent[]) {
  const supabase = createSupabaseServerClient();
  const userIds = [...new Set(events.map((event) => event.user_id).filter(Boolean))] as string[];

  if (!userIds.length) {
    return events.map((event) => ({ ...event, user_email: null }));
  }

  const { data: profiles } = await supabase.from("profiles").select("id,email").in("id", userIds);
  const emailByUserId = new Map((profiles ?? []).map((profile) => [profile.id as string, profile.email as string | null]));

  return events.map((event) => ({
    ...event,
    user_email: event.user_id ? emailByUserId.get(event.user_id) ?? null : null,
  }));
}

export async function GET() {
  const supabase = createSupabaseServerClient();
  const monthStart = firstDayOfCurrentMonth();
  const { data: allEvents, error } = await supabase
    .from("subscription_events")
    .select("id,user_id,event_type,product_id,price_usd,currency,period_type,occurred_at,raw")
    .order("occurred_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = (allEvents ?? []) as SubscriptionEvent[];
  const lastThirtyDays = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const eventsLast30 = events.filter((event) => (event.occurred_at ?? "") >= lastThirtyDays).slice(0, 100);
  const enrichedEvents = (await addUserEmails(eventsLast30)) as RevenueEvent[];

  const totalRevenue = events.reduce((total, event) => {
    const eventType = event.event_type?.toUpperCase() ?? "";

    return revenueEventTypes.has(eventType) ? total + priceAsNumber(event.price_usd) : total;
  }, 0);

  const newThisMonth = events.filter(
    (event) => event.event_type === "INITIAL_PURCHASE" && (event.occurred_at ?? "") >= monthStart,
  ).length;

  const cancellationsThisMonth = events.filter(
    (event) => event.event_type === "CANCELLATION" && (event.occurred_at ?? "") >= monthStart,
  ).length;

  return NextResponse.json({
    mrr: calculateMrr(events),
    total_revenue: totalRevenue,
    new_this_month: newThisMonth,
    cancellations_this_month: cancellationsThisMonth,
    events_last_30: enrichedEvents,
  });
}
