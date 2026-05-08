"use client";

import { useEffect, useMemo, useState } from "react";

type FeatureFlag = {
  key: string;
  enabled: boolean | null;
  description: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

type AuditEntry = {
  id: string;
  admin_email: string | null;
  action: string | null;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDetails(details: AuditEntry["details"]) {
  if (!details || Object.keys(details).length === 0) {
    return "—";
  }

  return JSON.stringify(details);
}

function actionBadgeClass(action: string | null) {
  const normalized = action?.toLowerCase() ?? "";

  if (normalized.includes("create")) {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }

  if (normalized.includes("delete") || normalized.includes("ban")) {
    return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  }

  if (normalized.includes("update") || normalized.includes("toggle")) {
    return "border-blue-400/30 bg-blue-400/10 text-blue-200";
  }

  return "border-slate-500/30 bg-slate-500/10 text-slate-200";
}

export default function SettingsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loadingFlags, setLoadingFlags] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedFlags = useMemo(
    () => [...flags].sort((left, right) => left.key.localeCompare(right.key)),
    [flags],
  );

  async function loadFlags() {
    setLoadingFlags(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/flags", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Unable to load feature flags.");
      }

      const data = (await response.json()) as { flags: FeatureFlag[] };
      setFlags(data.flags);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load feature flags.");
    } finally {
      setLoadingFlags(false);
    }
  }

  async function loadAuditEntries() {
    setLoadingAudit(true);

    try {
      const response = await fetch("/api/admin/audit", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Unable to load audit entries.");
      }

      const data = (await response.json()) as { entries: AuditEntry[] };
      setAuditEntries(data.entries);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load audit entries.");
    } finally {
      setLoadingAudit(false);
    }
  }

  useEffect(() => {
    void loadFlags();
    void loadAuditEntries();
  }, []);

  async function toggleFlag(flag: FeatureFlag) {
    const nextEnabled = !Boolean(flag.enabled);
    setSavingKey(flag.key);
    setError(null);

    try {
      const response = await fetch("/api/admin/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: flag.key, enabled: nextEnabled }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Unable to update feature flag.");
      }

      const data = (await response.json()) as { flag: FeatureFlag };
      setFlags((currentFlags) => currentFlags.map((currentFlag) => (currentFlag.key === flag.key ? data.flag : currentFlag)));
      await loadAuditEntries();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Unable to update feature flag.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <main className="space-y-8">
      <header>
        <p className="text-sm font-medium text-slate-400">Control app behavior and review administrator activity.</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-100">Settings</h1>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm font-medium text-rose-100">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-black/20">
        <div className="border-b border-slate-800 px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Feature Flags</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-100">Mobile app controls</h2>
        </div>

        <div className="overflow-hidden rounded-b-2xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-4">Key</th>
                <th className="px-5 py-4">Description</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Last updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loadingFlags ? (
                <tr>
                  <td className="px-5 py-10 text-center text-slate-400" colSpan={4}>
                    Loading feature flags...
                  </td>
                </tr>
              ) : sortedFlags.length ? (
                sortedFlags.map((flag) => {
                  const isMaintenanceMode = flag.key === "maintenance_mode";
                  const enabled = Boolean(flag.enabled);

                  return (
                    <tr className={isMaintenanceMode ? "bg-rose-950/20" : "transition hover:bg-slate-800/40"} key={flag.key}>
                      <td className="px-5 py-4 align-top">
                        <div className={isMaintenanceMode ? "font-bold text-rose-200" : "font-semibold text-slate-100"}>{flag.key}</div>
                        {isMaintenanceMode ? (
                          <div className="mt-1 text-xs font-semibold text-rose-300">
                            Enabling this will lock all app users out
                          </div>
                        ) : null}
                      </td>
                      <td className="max-w-xl px-5 py-4 align-top text-slate-300">{flag.description ?? "—"}</td>
                      <td className="px-5 py-4 align-top">
                        <label className="inline-flex cursor-pointer items-center gap-3">
                          <input
                            checked={enabled}
                            className="peer sr-only"
                            disabled={savingKey === flag.key}
                            onChange={() => void toggleFlag(flag)}
                            type="checkbox"
                          />
                          <span
                            className={`h-7 w-12 rounded-full p-1 transition ${
                              enabled ? "bg-cyan-500" : "bg-slate-700"
                            } ${savingKey === flag.key ? "opacity-60" : ""}`}
                          >
                            <span
                              className={`block h-5 w-5 rounded-full bg-white shadow transition ${
                                enabled ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </span>
                          <span className={enabled ? "font-semibold text-cyan-200" : "font-semibold text-slate-400"}>
                            {savingKey === flag.key ? "Saving..." : enabled ? "Enabled" : "Disabled"}
                          </span>
                        </label>
                      </td>
                      <td className="px-5 py-4 align-top text-slate-300">
                        <div>{formatDate(flag.updated_at)}</div>
                        <div className="mt-1 text-xs text-slate-500">{flag.updated_by ?? "No admin recorded"}</div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-5 py-10 text-center text-slate-400" colSpan={4}>
                    No feature flags found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-black/20">
        <div className="border-b border-slate-800 px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Audit Log</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-100">Last 200 administrator actions</h2>
        </div>

        <div className="overflow-x-auto rounded-b-2xl">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-4">Admin</th>
                <th className="px-5 py-4">Action</th>
                <th className="px-5 py-4">Target</th>
                <th className="px-5 py-4">Details</th>
                <th className="px-5 py-4">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loadingAudit ? (
                <tr>
                  <td className="px-5 py-10 text-center text-slate-400" colSpan={5}>
                    Loading audit log...
                  </td>
                </tr>
              ) : auditEntries.length ? (
                auditEntries.map((entry) => (
                  <tr className="transition hover:bg-slate-800/40" key={entry.id}>
                    <td className="px-5 py-4 text-slate-300">{entry.admin_email ?? "—"}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${actionBadgeClass(entry.action)}`}>
                        {entry.action ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      <div className="font-semibold text-slate-200">{entry.target_type ?? "—"}</div>
                      <div className="mt-1 text-xs text-slate-500">{entry.target_id ?? "No target id"}</div>
                    </td>
                    <td className="max-w-md px-5 py-4 text-xs text-slate-400">
                      <code className="whitespace-pre-wrap break-words rounded-lg bg-slate-950/70 px-2 py-1">{formatDetails(entry.details)}</code>
                    </td>
                    <td className="px-5 py-4 text-slate-300">{formatDate(entry.created_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-10 text-center text-slate-400" colSpan={5}>
                    No audit entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
