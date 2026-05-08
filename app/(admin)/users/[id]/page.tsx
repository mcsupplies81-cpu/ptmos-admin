"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type UserDetails = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string | null;
  is_pro: boolean;
  admin_notes: string;
  banned: boolean;
  last_sign_in_at: string | null;
  stats?: {
    doseLogs: number;
    protocols: number;
    lifestyleLogs: number;
  };
};

type DoseActivity = {
  type: "dose";
  logged_at: string | null;
  peptide_name: string | null;
  amount: number | string | null;
  unit: string | null;
};

type LifestyleActivity = {
  type: "lifestyle";
  logged_at: string | null;
  mood: string | null;
  sleep_hours: number | string | null;
  water_oz: number | string | null;
};

type ProtocolActivity = {
  type: "protocol";
  created_at: string | null;
  name: string | null;
  status: string | null;
};

type ActivityEvent = DoseActivity | LifestyleActivity | ProtocolActivity;

function displayName(user: UserDetails | null) {
  return user?.full_name?.trim() || "Unnamed user";
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function subscriptionBadge(isPro?: boolean | null) {
  const classes = isPro
    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
    : "border-slate-600 bg-slate-800 text-slate-300";

  return <span className={`rounded-full border px-3 py-1 text-xs font-bold ${classes}`}>{isPro ? "PRO" : "FREE"}</span>;
}

function eventTimestamp(event: ActivityEvent) {
  return "created_at" in event ? event.created_at : event.logged_at;
}

function eventIcon(event: ActivityEvent) {
  if (event.type === "dose") {
    return "💉";
  }

  if (event.type === "lifestyle") {
    return "🌙";
  }

  return "📋";
}

function eventDescription(event: ActivityEvent) {
  if (event.type === "dose") {
    const dose = [event.amount, event.unit].filter(Boolean).join(" ");
    return `Logged ${event.peptide_name || "peptide dose"}${dose ? ` (${dose})` : ""}`;
  }

  if (event.type === "lifestyle") {
    const details = [
      event.mood ? `Mood: ${event.mood}` : null,
      event.sleep_hours ? `Sleep: ${event.sleep_hours}h` : null,
      event.water_oz ? `Water: ${event.water_oz} oz` : null,
    ].filter(Boolean);

    return details.length ? details.join(" • ") : "Logged lifestyle check-in";
  }

  return `Created protocol ${event.name || "Untitled protocol"}${event.status ? ` (${event.status})` : ""}`;
}

export default function UserDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [user, setUser] = useState<UserDetails | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(
    () => [
      { label: "Dose logs", value: user?.stats?.doseLogs ?? 0 },
      { label: "Protocols", value: user?.stats?.protocols ?? 0 },
      { label: "Lifestyle logs", value: user?.stats?.lifestyleLogs ?? 0 },
    ],
    [user?.stats?.doseLogs, user?.stats?.protocols, user?.stats?.lifestyleLogs],
  );

  useEffect(() => {
    async function loadUser() {
      setLoading(true);
      setError(null);

      try {
        const [userResponse, activityResponse] = await Promise.all([
          fetch(`/api/admin/users/${params.id}`, { cache: "no-store" }),
          fetch(`/api/admin/users/${params.id}/activity`, { cache: "no-store" }),
        ]);

        if (!userResponse.ok) {
          const errorBody = (await userResponse.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errorBody?.error ?? "Unable to load user.");
        }

        if (!activityResponse.ok) {
          const errorBody = (await activityResponse.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errorBody?.error ?? "Unable to load user activity.");
        }

        const userData = (await userResponse.json()) as UserDetails;
        const activityData = (await activityResponse.json()) as { activity: ActivityEvent[] };
        setUser(userData);
        setNotes(userData.admin_notes ?? "");
        setActivity(activityData.activity);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load user.");
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [params.id]);

  async function patchUser(body: { is_pro?: boolean; banned?: boolean; notes?: string }, label: string) {
    setSaving(label);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorBody?.error ?? "Unable to update user.");
      }

      const updatedUser = (await response.json()) as UserDetails;
      setUser(updatedUser);
      setNotes(updatedUser.admin_notes ?? "");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update user.");
    } finally {
      setSaving(null);
    }
  }

  function toggleBan() {
    if (!user) {
      return;
    }

    const action = user.banned ? "unban" : "ban";
    if (window.confirm(`Are you sure you want to ${action} ${displayName(user)}?`)) {
      patchUser({ banned: !user.banned }, "ban");
    }
  }

  async function deleteAccount() {
    if (!user) {
      return;
    }

    const confirmation = window.prompt(`Type DELETE to permanently delete ${displayName(user)}.`);

    if (confirmation !== "DELETE") {
      return;
    }

    setSaving("delete");
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${params.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorBody?.error ?? "Unable to delete user.");
      }

      router.push("/users");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete user.");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-slate-300">Loading user...</div>;
  }

  if (error && !user) {
    return (
      <div className="space-y-4">
        <Link className="text-sm font-semibold text-cyan-300 hover:text-cyan-200" href="/users">
          ← Back to users
        </Link>
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 text-slate-100">
      <Link className="text-sm font-semibold text-cyan-300 hover:text-cyan-200" href="/users">
        ← Back to users
      </Link>

      {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div> : null}

      <header className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight">{displayName(user)}</h1>
              {subscriptionBadge(user?.is_pro)}
              {user?.banned ? (
                <span className="rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs font-bold text-red-300">
                  BANNED
                </span>
              ) : null}
            </div>
            <p className="text-slate-300">{user?.email || "No email on file"}</p>
            <p className="mt-2 text-sm text-slate-500">Joined {formatDate(user?.created_at ?? null)}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-50"
              disabled={Boolean(saving)}
              onClick={() => patchUser({ is_pro: !user?.is_pro }, "pro")}
            >
              {user?.is_pro ? "Revoke Pro" : "Grant Pro"}
            </button>
            <button
              className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
              disabled={Boolean(saving)}
              onClick={toggleBan}
            >
              {user?.banned ? "Unban User" : "Ban User"}
            </button>
            <button
              className="rounded-xl border border-red-500 bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-500 disabled:opacity-50"
              disabled={Boolean(saving)}
              onClick={deleteAccount}
            >
              Delete Account
            </button>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5" key={stat.label}>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
            <p className="mt-3 text-4xl font-black text-slate-100">{stat.value.toLocaleString()}</p>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Admin Notes</h2>
            {saving === "notes" ? <span className="text-xs font-semibold text-cyan-300">Saving...</span> : null}
          </div>
          <textarea
            className="min-h-[260px] w-full rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400"
            onBlur={() => {
              if (notes !== (user?.admin_notes ?? "")) {
                patchUser({ notes }, "notes");
              }
            }}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add private admin notes about this user..."
            value={notes}
          />
        </article>

        <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Activity Timeline</h2>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Last 50 events</span>
          </div>
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-2">
            {activity.length ? (
              activity.map((event, index) => (
                <div className="flex gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4" key={`${event.type}-${eventTimestamp(event)}-${index}`}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-lg">
                    {eventIcon(event)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-100">{eventDescription(event)}</p>
                    <p className="mt-1 text-sm text-slate-500">{formatTimestamp(eventTimestamp(event))}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-8 text-center text-slate-400">
                No recent activity found.
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
