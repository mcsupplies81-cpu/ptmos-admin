"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string | null;
  is_pro?: boolean | null;
  banned?: boolean | null;
};

const PAGE_SIZE = 25;

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

export default function UsersPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfiles() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/admin/users", { cache: "no-store" });

        if (!response.ok) {
          const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errorBody?.error ?? "Unable to load users.");
        }

        const data = (await response.json()) as { users: Profile[] };
        setProfiles(data.users);
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

  function exportCsv() {
    window.open("/api/admin/users/export", "_blank");
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Users</h1>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-sm font-semibold text-cyan-200">
              {profiles.length} total
            </span>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 md:w-80"
              placeholder="Search by name or email..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button
              className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
              onClick={exportCsv}
            >
              Export CSV
            </button>
          </div>
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
                <th className="px-5 py-4 text-right">Details</th>
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
                  <tr
                    className="cursor-pointer transition hover:bg-slate-800/40"
                    key={profile.id}
                    onClick={() => router.push(`/users/${profile.id}`)}
                  >
                    <td className="px-5 py-4 font-medium text-slate-100">
                      <span className="inline-flex items-center gap-2">
                        {profile.banned ? <span title="Banned user">🚫</span> : null}
                        {displayName(profile)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-300">{profile.email || "—"}</td>
                    <td className="px-5 py-4 text-slate-300">{formatDate(profile.created_at)}</td>
                    <td className="px-5 py-4">{subscriptionBadge(Boolean(profile.is_pro))}</td>
                    <td className="px-5 py-4 text-right text-cyan-200">View →</td>
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
    </div>
  );
}
