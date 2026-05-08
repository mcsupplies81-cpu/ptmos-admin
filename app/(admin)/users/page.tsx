"use client";

import { useEffect, useState } from "react";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string | null;
  is_pro?: boolean | null;
  banned?: boolean | null;
  last_sign_in_at?: string | null;
};

type UserDetails = Profile & {
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

type UsersResponse = {
  users: Profile[];
  total: number;
  page: number;
  perPage: number;
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

function displayName(profile: Pick<Profile, "full_name"> | null) {
  return profile?.full_name?.trim() || "Unnamed user";
}

function formatTimestamp(value: string | null | undefined) {
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
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProfiles() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(page),
          perPage: String(PAGE_SIZE),
        });
        const trimmedQuery = debouncedQuery.trim();

        if (trimmedQuery) {
          params.set("search", trimmedQuery);
        }

        const response = await fetch(`/api/admin/users?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errorBody?.error ?? "Unable to load users.");
        }

        const data = (await response.json()) as UsersResponse;
        setProfiles(data.users);
        setTotal(data.total);
        setPerPage(data.perPage);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load users.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadProfiles();

    return () => controller.abort();
  }, [page, debouncedQuery]);

  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUser(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadUserDetails() {
      setDetailLoading(true);
      setDetailError(null);

      try {
        const response = await fetch(`/api/admin/users/${selectedUserId}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errorBody?.error ?? "Unable to load user details.");
        }

        const data = (await response.json()) as UserDetails;
        setSelectedUser(data);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        setDetailError(loadError instanceof Error ? loadError.message : "Unable to load user details.");
      } finally {
        if (!controller.signal.aborted) {
          setDetailLoading(false);
        }
      }
    }

    loadUserDetails();

    return () => controller.abort();
  }, [selectedUserId]);

  const pageCount = Math.max(1, Math.ceil(total / perPage));

  function exportCsv() {
    window.open("/api/admin/users/export", "_blank");
  }

  function openUserPanel(profile: Profile) {
    setSelectedUserId(profile.id);
    setSelectedUser({
      ...profile,
      is_pro: Boolean(profile.is_pro),
      admin_notes: "",
      banned: Boolean(profile.banned),
      last_sign_in_at: profile.last_sign_in_at ?? null,
    });
  }

  function closeUserPanel() {
    setSelectedUserId(null);
  }

  const isPanelOpen = Boolean(selectedUserId);
  const displayedUser = selectedUser;
  const detailStats = [
    { label: "Protocols", value: displayedUser?.stats?.protocols ?? 0 },
    { label: "Lifestyle logs", value: displayedUser?.stats?.lifestyleLogs ?? 0 },
  ];

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Users</h1>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-sm font-semibold text-cyan-200">
              {total} total
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
              ) : profiles.length ? (
                profiles.map((profile) => (
                  <tr
                    className="cursor-pointer transition hover:bg-slate-800/40"
                    key={profile.id}
                    onClick={() => openUserPanel(profile)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openUserPanel(profile);
                      }
                    }}
                    role="button"
                    tabIndex={0}
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
                    <td className="px-5 py-4 text-right text-cyan-200">View details →</td>
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
              disabled={loading || page === 1}
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            >
              Prev
            </button>
            <button
              className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={loading || page === pageCount}
              onClick={() => setPage((currentPage) => Math.min(pageCount, currentPage + 1))}
            >
              Next
            </button>
          </div>
        </footer>
      </div>

      {isPanelOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end" aria-modal="true" role="dialog">
          <button
            aria-label="Close user details"
            className="absolute inset-0 cursor-default bg-slate-950/70 backdrop-blur-sm"
            onClick={closeUserPanel}
            type="button"
          />
          <aside className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-slate-800 bg-slate-950 p-6 shadow-2xl shadow-black/40">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">User details</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-100">{displayName(displayedUser)}</h2>
                <p className="mt-2 text-sm text-slate-400">{displayedUser?.email || "No email on file"}</p>
              </div>
              <button
                className="rounded-full border border-slate-700 px-3 py-1.5 text-sm font-bold text-slate-300 transition hover:border-slate-500 hover:text-white"
                onClick={closeUserPanel}
                type="button"
              >
                ✕
              </button>
            </div>

            {detailError ? (
              <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{detailError}</div>
            ) : null}

            <div className="space-y-5">
              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-slate-100">Profile info</h3>
                  {displayedUser?.banned ? (
                    <span className="rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs font-bold text-red-300">
                      SUSPENDED
                    </span>
                  ) : null}
                </div>
                <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-slate-500">Name</dt>
                    <dd className="mt-1 text-slate-100">{displayName(displayedUser)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-slate-500">Email</dt>
                    <dd className="mt-1 break-words text-slate-100">{displayedUser?.email || "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-slate-500">Joined</dt>
                    <dd className="mt-1 text-slate-100">{formatDate(displayedUser?.created_at ?? null)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-slate-500">Last active</dt>
                    <dd className="mt-1 text-slate-100">{formatTimestamp(displayedUser?.last_sign_in_at)}</dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <h3 className="mb-4 text-lg font-bold text-slate-100">Subscription</h3>
                <div className="flex flex-wrap gap-3">
                  {subscriptionBadge(Boolean(displayedUser?.is_pro))}
                  <span className="inline-flex rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300">
                    {displayedUser?.banned ? "Suspended" : "Active"}
                  </span>
                </div>
                <dl className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-slate-500">Status</dt>
                    <dd className="mt-1 text-slate-100">{displayedUser?.banned ? "Suspended" : "Active"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-slate-500">Tier</dt>
                    <dd className="mt-1 text-slate-100">{displayedUser?.is_pro ? "Pro" : "Free"}</dd>
                  </div>
                </dl>
              </section>

              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {detailStats.map((stat) => (
                  <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5" key={stat.label}>
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
                    <p className="mt-3 text-4xl font-black text-slate-100">
                      {detailLoading ? "…" : stat.value.toLocaleString()}
                    </p>
                  </article>
                ))}
              </section>

              <button
                className="w-full rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200 transition hover:bg-red-500/20"
                type="button"
              >
                Suspend Account
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
