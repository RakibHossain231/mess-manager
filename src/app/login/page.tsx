"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/theme/theme-toggle";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorText("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      setErrorText(error.message);
      return;
    }

    // Direct clean navigation ensuring fresh cookies without triggering duplicate router refreshes
    window.location.href = "/";
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="absolute right-4 top-4 sm:right-8 sm:top-8">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Login</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Login to continue to your mess account.
        </p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Email
            </label>
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Password
            </label>
            <input
              type="password"
              placeholder="Enter your password"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {errorText ? (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/60 dark:text-red-400">
              {errorText}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-teal-700 px-4 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
          >
            {loading ? "Logging in..." : "Login"}
          </button>

          <div className="text-center">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-teal-700 transition hover:text-teal-800 hover:underline dark:text-teal-400 dark:hover:text-teal-300"
            >
              Forgot password?
            </Link>
          </div>
        </form>

        <p className="mt-5 text-sm text-slate-600 dark:text-slate-400">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-teal-700 hover:underline dark:text-teal-400">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
