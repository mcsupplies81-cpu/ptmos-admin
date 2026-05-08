'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push(searchParams.get('redirectedFrom') ?? '/');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-text">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl shadow-black/30">
        <div className="mb-8 text-center">
          <p className="text-3xl font-black tracking-tight text-accent">PT-OS</p>
          <h1 className="mt-3 text-2xl font-bold text-text">Admin Sign In</h1>
          <p className="mt-2 text-sm text-text-secondary">Use your Supabase email credentials.</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-text-secondary">Email</span>
            <input
              className="w-full rounded-xl border border-border bg-sidebar px-4 py-3 text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-text-secondary">Password</span>
            <input
              className="w-full rounded-xl border border-border bg-sidebar px-4 py-3 text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <button
            className="w-full rounded-xl bg-accent px-4 py-3 font-bold text-text transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
