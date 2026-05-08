export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <section className="max-w-md rounded-2xl border border-rose-400/30 bg-slate-900 p-8 text-center shadow-2xl shadow-black/40">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-400/10 text-3xl">🚫</div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Unauthorized</h1>
        <p className="mt-3 text-slate-300">You don&apos;t have admin access.</p>
        <a
          className="mt-8 inline-flex rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
          href="/login"
        >
          Return to login
        </a>
      </section>
    </main>
  );
}
