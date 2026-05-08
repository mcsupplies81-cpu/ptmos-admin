"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type AnnouncementTarget = "all" | "pro" | "free";

type Announcement = {
  id: string;
  title: string;
  body: string;
  sent_at: string | null;
  recipient_count: number | null;
};

const MAX_TITLE_LENGTH = 60;
const MAX_BODY_LENGTH = 200;

const targetOptions: Array<{ label: string; value: AnnouncementTarget }> = [
  { label: "All Users", value: "all" },
  { label: "Pro Users Only", value: "pro" },
  { label: "Free Users Only", value: "free" },
];

function getSupabaseConfig() {
  return {
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  };
}

function formatSentDate(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AnnouncementsPage() {
  const [{ url, anonKey }] = useState(getSupabaseConfig);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<AnnouncementTarget>("all");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
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

  async function loadAnnouncements() {
    if (!url || !anonKey) {
      setError("Supabase environment variables are not configured.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const response = await fetch(
      `${url}/rest/v1/announcements?select=id,title,body,sent_at,recipient_count&order=sent_at.desc&limit=20`,
      { headers },
    );

    if (!response.ok) {
      setError("Unable to load announcement history.");
      setIsLoading(false);
      return;
    }

    setAnnouncements(await response.json());
    setIsLoading(false);
  }

  useEffect(() => {
    void loadAnnouncements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, anonKey]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (!trimmedTitle || !trimmedBody) {
      setError("Title and message are required.");
      return;
    }

    if (!url || !anonKey) {
      setError("Supabase environment variables are not configured.");
      return;
    }

    setIsSending(true);

    const insertResponse = await fetch(`${url}/rest/v1/announcements`, {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        title: trimmedTitle,
        body: trimmedBody,
      }),
    });

    if (!insertResponse.ok) {
      setError("Announcement could not be saved.");
      setIsSending(false);
      return;
    }

    const functionResponse = await fetch(`${url}/functions/v1/send-announcement`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: trimmedTitle, body: trimmedBody, target }),
    });

    if (!functionResponse.ok) {
      setError("Announcement was saved, but delivery could not be queued.");
      setIsSending(false);
      await loadAnnouncements();
      return;
    }

    setTitle("");
    setBody("");
    setTarget("all");
    setSuccess("Announcement queued for delivery");
    setIsSending(false);
    await loadAnnouncements();
  }

  return (
    <main className="space-y-8">
      <header>
        <p className="text-sm font-medium text-slate-500">Broadcast push notifications to all app users.</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Announcements</h1>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950">Send Announcement</h2>
        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div>
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium text-slate-700" htmlFor="announcement-title">
                Title
              </label>
              <span className="text-xs text-slate-500">
                {title.length}/{MAX_TITLE_LENGTH}
              </span>
            </div>
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              id="announcement-title"
              maxLength={MAX_TITLE_LENGTH}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="New update available"
              value={title}
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium text-slate-700" htmlFor="announcement-body">
                Message
              </label>
              <span className="text-xs text-slate-500">
                {body.length}/{MAX_BODY_LENGTH}
              </span>
            </div>
            <textarea
              className="mt-2 min-h-32 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              id="announcement-body"
              maxLength={MAX_BODY_LENGTH}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write a short push notification message."
              value={body}
            />
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Target</legend>
            <div className="mt-3 flex flex-wrap gap-3">
              {targetOptions.map((option) => (
                <label
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  key={option.value}
                >
                  <input
                    checked={target === option.value}
                    name="announcement-target"
                    onChange={() => setTarget(option.value)}
                    type="radio"
                    value={option.value}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          {success ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
              {success}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {error}
            </div>
          ) : null}

          <button
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            disabled={isSending}
            type="submit"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-950">Sent History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Title</th>
                <th className="px-6 py-3">Message preview</th>
                <th className="px-6 py-3">Sent</th>
                <th className="px-6 py-3">Recipients</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {isLoading ? (
                <tr>
                  <td className="px-6 py-4" colSpan={4}>
                    Loading announcements...
                  </td>
                </tr>
              ) : announcements.length > 0 ? (
                announcements.map((announcement) => (
                  <tr key={announcement.id}>
                    <td className="px-6 py-4 font-medium text-slate-950">{announcement.title}</td>
                    <td className="max-w-lg truncate px-6 py-4">{announcement.body}</td>
                    <td className="px-6 py-4">{formatSentDate(announcement.sent_at)}</td>
                    <td className="px-6 py-4">{announcement.recipient_count ?? 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-6 py-4 text-slate-500" colSpan={4}>
                    No announcements have been sent yet.
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
