"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Provider = {
  id: string;
  name?: string | null;
  type?: string | null;
  status?: string | null;
  is_active?: boolean | null;
};

type MembershipTier = "basic" | "featured" | "premium";
type MembershipStatus = "active" | "suspended" | "expired";

type Membership = {
  id?: string;
  provider_id: string;
  tier: MembershipTier;
  status: MembershipStatus;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
};

const tierDescriptions: Record<MembershipTier, string> = {
  basic: "Listed in directory",
  featured: "Listed + highlighted card + priority placement",
  premium: "Featured + verified badge + direct contact button in app",
};

const tierStyles: Record<MembershipTier, string> = {
  basic: "bg-slate-100 text-slate-700 ring-slate-200",
  featured: "bg-blue-100 text-blue-700 ring-blue-200",
  premium: "bg-purple-100 text-purple-700 ring-purple-200",
};

const statusStyles: Record<MembershipStatus, string> = {
  active: "bg-green-100 text-green-700 ring-green-200",
  suspended: "bg-red-100 text-red-700 ring-red-200",
  expired: "bg-amber-100 text-amber-700 ring-amber-200",
};

function getSupabaseConfig() {
  return {
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  };
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

function getProviderStatus(provider: Provider | null) {
  if (!provider) {
    return "Unknown";
  }

  if (typeof provider.is_active === "boolean") {
    return provider.is_active ? "Active" : "Inactive";
  }

  return provider.status ? titleCase(provider.status) : "Unknown";
}

export default function ProviderMembershipPage({ params }: { params: { id: string } }) {
  const providerId = params.id;
  const [{ url, anonKey }] = useState(getSupabaseConfig);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [tier, setTier] = useState<MembershipTier>("basic");
  const [status, setStatus] = useState<MembershipStatus>("active");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const headers = useMemo(
    () => ({
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    }),
    [anonKey],
  );

  async function loadMembership() {
    if (!url || !anonKey) {
      setError("Supabase environment variables are not configured.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const [providerResponse, membershipResponse] = await Promise.all([
      fetch(`${url}/rest/v1/providers?id=eq.${providerId}&select=*&limit=1`, { headers }),
      fetch(
        `${url}/rest/v1/provider_memberships?provider_id=eq.${providerId}&select=*&order=created_at.desc&limit=1`,
        { headers },
      ),
    ]);

    if (!providerResponse.ok) {
      setError("Unable to load provider details.");
      setIsLoading(false);
      return;
    }

    if (!membershipResponse.ok) {
      setError("Unable to load membership details.");
      setIsLoading(false);
      return;
    }

    const providers = (await providerResponse.json()) as Provider[];
    const memberships = (await membershipResponse.json()) as Membership[];
    const currentMembership = memberships[0] ?? {
      provider_id: providerId,
      tier: "basic" as MembershipTier,
      status: "active" as MembershipStatus,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: null,
      notes: "",
    };

    setProvider(providers[0] ?? null);
    setMembership(currentMembership);
    setTier(currentMembership.tier);
    setStatus(currentMembership.status);
    setEndDate(currentMembership.end_date ?? "");
    setNotes(currentMembership.notes ?? "");
    setIsLoading(false);
  }

  useEffect(() => {
    void loadMembership();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, url, anonKey]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!url || !anonKey) {
      setError("Supabase environment variables are not configured.");
      return;
    }

    setIsSaving(true);

    const payload = {
      provider_id: providerId,
      tier,
      status,
      end_date: endDate || null,
      notes: notes.trim() || null,
    };

    const response = membership?.id
      ? await fetch(`${url}/rest/v1/provider_memberships?id=eq.${membership.id}`, {
          method: "PATCH",
          headers: {
            ...headers,
            Prefer: "return=representation",
          },
          body: JSON.stringify(payload),
        })
      : await fetch(`${url}/rest/v1/provider_memberships`, {
          method: "POST",
          headers: {
            ...headers,
            Prefer: "return=representation",
          },
          body: JSON.stringify(payload),
        });

    if (!response.ok) {
      setError("Membership could not be saved.");
      setIsSaving(false);
      return;
    }

    const savedMemberships = (await response.json()) as Membership[];
    const savedMembership = savedMemberships[0];

    setMembership(savedMembership);
    setSuccess("Membership saved.");
    setIsSaving(false);
  }

  const currentTier = membership?.tier ?? tier;
  const currentStatus = membership?.status ?? status;

  return (
    <main className="space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link className="font-medium text-blue-600 hover:text-blue-700" href="/providers">
              Providers
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="font-medium text-slate-700">{provider?.name ?? "Provider"}</li>
          <li aria-hidden="true">/</li>
          <li className="text-slate-950">Membership</li>
        </ol>
      </nav>

      <header>
        <p className="text-sm font-medium text-slate-500">Manage an individual provider&apos;s listing status.</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Provider Membership</h1>
      </header>

      {currentStatus === "suspended" ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800">
          This provider is suspended and hidden from the app directory
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-medium text-green-800">
          {success}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Provider Summary</h2>
          {isLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading provider...</p>
          ) : (
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="font-medium text-slate-500">Name</dt>
                <dd className="mt-1 text-base font-semibold text-slate-950">{provider?.name ?? "Unknown provider"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Type</dt>
                <dd className="mt-1 text-slate-800">{provider?.type ?? "Not specified"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Current active status</dt>
                <dd className="mt-1 text-slate-800">{getProviderStatus(provider)}</dd>
              </div>
            </dl>
          )}
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Current Membership</h2>
          {isLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading membership...</p>
          ) : (
            <div className="mt-5 space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${tierStyles[currentTier]}`}>
                  {titleCase(currentTier)}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusStyles[currentStatus]}`}>
                  {titleCase(currentStatus)}
                </span>
              </div>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-slate-500">Start date</dt>
                  <dd className="mt-1 text-slate-800">{formatDate(membership?.start_date)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">End date</dt>
                  <dd className="mt-1 text-slate-800">{formatDate(membership?.end_date)}</dd>
                </div>
              </dl>
            </div>
          )}
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950">Edit Membership</h2>
        <form className="mt-6 grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Tier
              <select
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setTier(event.target.value as MembershipTier)}
                value={tier}
              >
                <option value="basic">Basic</option>
                <option value="featured">Featured</option>
                <option value="premium">Premium</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Status
              <select
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setStatus(event.target.value as MembershipStatus)}
                value={status}
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="expired">Expired</option>
              </select>
            </label>
          </div>

          <label className="text-sm font-medium text-slate-700">
            End date
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              onChange={(event) => setEndDate(event.target.value)}
              type="date"
              value={endDate}
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Notes
            <textarea
              className="mt-2 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Internal notes about this provider's membership."
              value={notes}
            />
          </label>

          <button
            className="w-fit rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            disabled={isSaving || isLoading}
            type="submit"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-lg font-semibold text-slate-950">Membership tier descriptions</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {(Object.keys(tierDescriptions) as MembershipTier[]).map((tierKey) => (
            <article className="rounded-lg border border-slate-200 bg-white p-4" key={tierKey}>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${tierStyles[tierKey]}`}>
                {titleCase(tierKey)}
              </span>
              <p className="mt-3 text-sm text-slate-600">{tierDescriptions[tierKey]}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
