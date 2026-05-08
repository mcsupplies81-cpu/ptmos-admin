/*
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Clinic', 'Med Spa', 'Online', 'Pharmacy')),
  location TEXT,
  website TEXT,
  phone TEXT,
  description TEXT,
  verified BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  rating NUMERIC(3,1) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
*/
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ProviderType = "Clinic" | "Med Spa" | "Online" | "Pharmacy";
type FilterType = "All" | ProviderType;

type Provider = {
  id: string;
  name: string;
  type: ProviderType;
  location: string | null;
  website: string | null;
  phone: string | null;
  description: string | null;
  verified: boolean | null;
  active: boolean | null;
  rating: number | null;
  review_count: number | null;
  created_at: string | null;
};

type ProviderFormState = {
  name: string;
  type: ProviderType;
  location: string;
  website: string;
  phone: string;
  description: string;
  verified: boolean;
  active: boolean;
  rating: string;
  review_count: string;
};

const providerTypes: ProviderType[] = ["Clinic", "Med Spa", "Online", "Pharmacy"];
const filters: FilterType[] = ["All", ...providerTypes];

const emptyForm: ProviderFormState = {
  name: "",
  type: "Clinic",
  location: "",
  website: "",
  phone: "",
  description: "",
  verified: false,
  active: true,
  rating: "0",
  review_count: "0",
};

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

function providerToForm(provider: Provider): ProviderFormState {
  return {
    name: provider.name,
    type: provider.type,
    location: provider.location ?? "",
    website: provider.website ?? "",
    phone: provider.phone ?? "",
    description: provider.description ?? "",
    verified: Boolean(provider.verified),
    active: provider.active !== false,
    rating: String(provider.rating ?? 0),
    review_count: String(provider.review_count ?? 0),
  };
}

function formToPayload(form: ProviderFormState) {
  return {
    name: form.name.trim(),
    type: form.type,
    location: form.location.trim() || null,
    website: form.website.trim() || null,
    phone: form.phone.trim() || null,
    description: form.description.trim() || null,
    verified: form.verified,
    active: form.active,
    rating: Number(form.rating) || 0,
    review_count: Number.parseInt(form.review_count, 10) || 0,
  };
}

function typeBadge(type: ProviderType) {
  const palette: Record<ProviderType, string> = {
    Clinic: "border-sky-400/30 bg-sky-400/10 text-sky-200",
    "Med Spa": "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200",
    Online: "border-violet-400/30 bg-violet-400/10 text-violet-200",
    Pharmacy: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  };

  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${palette[type]}`}>{type}</span>;
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [form, setForm] = useState<ProviderFormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadProviders() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(supabaseUrl("providers?select=*&order=created_at.desc"), {
        headers: supabaseHeaders(),
      });

      if (!response.ok) {
        throw new Error("Unable to load providers from Supabase.");
      }

      setProviders((await response.json()) as Provider[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load providers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProviders();
  }, []);

  const filteredProviders = useMemo(() => {
    if (activeFilter === "All") {
      return providers;
    }

    return providers.filter((provider) => provider.type === activeFilter);
  }, [activeFilter, providers]);

  function openCreateModal() {
    setSelectedProvider(null);
    setForm(emptyForm);
    setModalMode("create");
  }

  function openEditModal(provider: Provider) {
    setSelectedProvider(provider);
    setForm(providerToForm(provider));
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setSelectedProvider(null);
    setForm(emptyForm);
  }

  async function patchProvider(id: string, payload: Partial<Provider>) {
    const response = await fetch(supabaseUrl(`providers?id=eq.${id}`), {
      method: "PATCH",
      headers: supabaseHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Unable to update provider.");
    }

    const [updatedProvider] = (await response.json()) as Provider[];
    setProviders((currentProviders) => currentProviders.map((provider) => (provider.id === id ? updatedProvider : provider)));
  }

  async function toggleActive(provider: Provider) {
    await patchProvider(provider.id, { active: provider.active === false });
  }

  async function toggleVerified(provider: Provider) {
    await patchProvider(provider.id, { verified: !provider.verified });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = formToPayload(form);
      const response = await fetch(supabaseUrl(modalMode === "edit" && selectedProvider ? `providers?id=eq.${selectedProvider.id}` : "providers"), {
        method: modalMode === "edit" ? "PATCH" : "POST",
        headers: supabaseHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Unable to save provider.");
      }

      const [savedProvider] = (await response.json()) as Provider[];
      setProviders((currentProviders) => {
        if (modalMode === "edit") {
          return currentProviders.map((provider) => (provider.id === savedProvider.id ? savedProvider : provider));
        }

        return [savedProvider, ...currentProviders];
      });
      closeModal();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save provider.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProvider() {
    if (!selectedProvider) {
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedProvider.name}? This cannot be undone.`);

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(supabaseUrl(`providers?id=eq.${selectedProvider.id}`), {
        method: "DELETE",
        headers: supabaseHeaders(),
      });

      if (!response.ok) {
        throw new Error("Unable to delete provider.");
      }

      setProviders((currentProviders) => currentProviders.filter((provider) => provider.id !== selectedProvider.id));
      closeModal();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete provider.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Admin</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Provider Directory</h1>
          </div>
          <button
            className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-400/20 transition hover:bg-cyan-300"
            onClick={openCreateModal}
          >
            + Add Provider
          </button>
        </header>

        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                activeFilter === filter
                  ? "border-cyan-400 bg-cyan-400/10 text-cyan-200"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
              }`}
              key={filter}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>

        {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div> : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-10 text-center text-slate-400">Loading providers...</div>
        ) : filteredProviders.length ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredProviders.map((provider) => {
              const isActive = provider.active !== false;

              return (
                <article
                  className={`cursor-pointer rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/10 transition hover:-translate-y-0.5 hover:border-slate-600 ${
                    isActive ? "" : "opacity-45 grayscale"
                  }`}
                  key={provider.id}
                  onClick={() => openEditModal(provider)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-100">{provider.name}</h2>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {typeBadge(provider.type)}
                        <button
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            provider.verified
                              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                              : "border-slate-700 bg-slate-800 text-slate-400"
                          }`}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleVerified(provider);
                          }}
                        >
                          {provider.verified ? "✓ Verified" : "Unverified"}
                        </button>
                      </div>
                    </div>
                    <button
                      className={`rounded-full px-3 py-1 text-xs font-bold ${isActive ? "bg-emerald-400/15 text-emerald-200" : "bg-slate-700 text-slate-300"}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleActive(provider);
                      }}
                    >
                      {isActive ? "Active" : "Inactive"}
                    </button>
                  </div>

                  <p className="mt-5 text-sm text-slate-400">{provider.location || "No location listed"}</p>
                  <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-300">{provider.description || "No description provided."}</p>
                  <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4 text-sm text-slate-400">
                    <span>★ {provider.rating ?? 0}</span>
                    <span>{provider.review_count ?? 0} reviews</span>
                    <a href={`/providers/${provider.id}/membership`} onClick={(e) => e.stopPropagation()} className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20">Membership</a>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-10 text-center text-slate-400">No providers found.</div>
        )}
      </div>

      {modalMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={closeModal}>
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl shadow-black/60"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">{modalMode === "edit" ? "Edit" : "Create"}</p>
                <h2 className="mt-2 text-2xl font-bold">{modalMode === "edit" ? "Edit Provider" : "Add Provider"}</h2>
              </div>
              <button className="rounded-lg border border-slate-700 px-3 py-2 text-slate-300" onClick={closeModal}>
                Close
              </button>
            </div>

            <form className="grid gap-4" onSubmit={handleSubmit}>
              <label className="grid gap-2 text-sm font-semibold text-slate-300">
                Name
                <input
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400"
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-300">
                  Type
                  <select
                    className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400"
                    value={form.type}
                    onChange={(event) => setForm({ ...form, type: event.target.value as ProviderType })}
                  >
                    {providerTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-300">
                  Location
                  <input
                    className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400"
                    value={form.location}
                    onChange={(event) => setForm({ ...form, location: event.target.value })}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-300">
                  Website
                  <input
                    className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400"
                    value={form.website}
                    onChange={(event) => setForm({ ...form, website: event.target.value })}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-300">
                  Phone
                  <input
                    className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-semibold text-slate-300">
                Description
                <textarea
                  className="min-h-28 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-300">
                  Rating
                  <input
                    className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400"
                    max="9.9"
                    min="0"
                    step="0.1"
                    type="number"
                    value={form.rating}
                    onChange={(event) => setForm({ ...form, rating: event.target.value })}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-300">
                  Review count
                  <input
                    className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400"
                    min="0"
                    type="number"
                    value={form.review_count}
                    onChange={(event) => setForm({ ...form, review_count: event.target.value })}
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <input checked={form.verified} type="checkbox" onChange={(event) => setForm({ ...form, verified: event.target.checked })} />
                  Verified
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <input checked={form.active} type="checkbox" onChange={(event) => setForm({ ...form, active: event.target.checked })} />
                  Active
                </label>
              </div>

              <div className="mt-2 flex flex-col gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:justify-between">
                {modalMode === "edit" ? (
                  <button
                    className="rounded-xl border border-red-500/40 px-5 py-3 text-sm font-bold text-red-200 transition hover:bg-red-500/10"
                    disabled={saving}
                    onClick={deleteProvider}
                    type="button"
                  >
                    Delete
                  </button>
                ) : (
                  <span />
                )}
                <button
                  className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={saving}
                  type="submit"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
