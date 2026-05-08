"use client";

import { useEffect, useMemo, useState } from "react";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string | null;
  is_pro?: boolean | null;
};

type UserStats = {
  doseLogs: number;
  protocols: number;
};

const PAGE_SIZE = 25;

function supabaseHeaders() {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    apikey: anonKey ?? "",
    Authorization: `Bearer ${anonKey ?? ""}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

function supabaseUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  }

  return `${baseUrl}/rest/v1/${path}`;
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

function displayName(profile: Profile) {
  return profile.full_name?.trim() || "Unnamed user";
}

function subscriptionBadge(isPro?: boolean | null) {
  const label = isPro ? "PRO" : "FREE";
  const classes = isPro
    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
    : "border-slate-600 bg-slate-800 text-slate-300";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}>
      {label}
    </span>
  );
}

async function fetchCount(table: string, userId: string) {
  const response = await fetch(supabaseUrl(`${table}?select=id&user_id=eq.${userId}`), {
    headers: {
      ...supabaseHeaders(),
      Prefer: "count=exact",
    },
  });

  if (!response.ok) {
    return 0;
  }

  const contentRange = response.headers.get("content-range");
  const count = contentRange?.split("/").at(1);

  return count ? Number(count) : 0;
}

export default function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfiles() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          supabaseUrl("profiles?select=id,full_name,email,created_at,is_pro&order=created_at.desc"),
          { headers: supabaseHeaders() },
        );

        if (!response.ok) {
          throw new Error("Unable to load users from Supabase.");
        }

        const data = (await response.json()) as Profile[];
        setProfiles(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load users.");
      } finally {
        setLoading(false);
      }
    }

    loadProfiles();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    async function loadStats() {
      if (!selectedUser) {
        setStats(null);
        return;
      }

      setStats(null);
      const [doseLogs, protocols] = await Promise.all([
        fetchCount("dose_logs", selectedUser.id),
        fetchCount("protocols", selectedUser.id),
      ]);

      setStats({ doseLogs, protocols });
    }

    loadStats();
  }, [selectedUser]);

  const filteredProfiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return profiles;
    }

    return profiles.filter((profile) => {
      const name = profile.full_name?.toLowerCase() ?? "";
      const email = profile.email?.toLowerCase() ?? "";

      return name.includes(normalizedQuery) || email.includes(normalizedQuery);
    });
  }, [profiles, query]);

  const pageCount = Math.max(1, Math.ceil(filteredProfiles.length / PAGE_SIZE));
  const paginatedProfiles = filteredProfiles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Users</h1>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-sm font-semibold text-cyan-200">
              {profiles.length} total
            </span>
          </div>
          <input
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 md:max-w-sm"
            placeholder="Search by name or email..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </header>

        {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div> : null}

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-2xl shadow-black/20">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-900 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-4">Name</th>
                <th className="px-5 py-4">Email</th>
                <th className="px-5 py-4">Joined</th>
                <th className="px-5 py-4">Subscription</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td className="px-5 py-10 text-center text-slate-400" colSpan={5}>
                    Loading users...
                  </td>
                </tr>
              ) : paginatedProfiles.length ? (
                paginatedProfiles.map((profile) => (
                  <tr className="transition hover:bg-slate-800/40" key={profile.id}>
                    <td className="px-5 py-4 font-medium text-slate-100">{displayName(profile)}</td>
                    <td className="px-5 py-4 text-slate-300">{profile.email || "—"}</td>
                    <td className="px-5 py-4 text-slate-300">{formatDate(profile.created_at)}</td>
                    <td className="px-5 py-4">{subscriptionBadge(Boolean(profile.is_pro))}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        className="rounded-lg border border-cyan-400/30 px-3 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/10"
                        onClick={() => setSelectedUser(profile)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-10 text-center text-slate-400" colSpan={5}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <footer className="flex items-center justify-between text-sm text-slate-400">
          <span>
            Page {page} of {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={page === 1}
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            >
              Prev
            </button>
            <button
              className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={page === pageCount}
              onClick={() => setPage((currentPage) => Math.min(pageCount, currentPage + 1))}
            >
              Next
            </button>
          </div>
        </footer>
      </div>

      {selectedUser ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={() => setSelectedUser(null)}>
          <aside
            className="h-full w-full max-w-md border-l border-slate-800 bg-slate-950 p-6 shadow-2xl shadow-black/50"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-widest text-cyan-300">User details</p>
                <h2 className="mt-2 text-2xl font-bold">{displayName(selectedUser)}</h2>
              </div>
              <button className="rounded-lg border border-slate-700 px-3 py-2 text-slate-300" onClick={() => setSelectedUser(null)}>
                Close
              </button>
            </div>

            <dl className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Email</dt>
                <dd className="mt-1 text-slate-100">{selectedUser.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Joined</dt>
                <dd className="mt-1 text-slate-100">{formatDate(selectedUser.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Subscription</dt>
                <dd className="mt-2">{subscriptionBadge(Boolean(selectedUser.is_pro))}</dd>
              </div>
            </dl>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <p className="text-sm text-slate-400">Dose logs</p>
                <p className="mt-2 text-3xl font-bold text-slate-100">{stats ? stats.doseLogs : "—"}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <p className="text-sm text-slate-400">Protocols</p>
                <p className="mt-2 text-3xl font-bold text-slate-100">{stats ? stats.protocols : "—"}</p>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
