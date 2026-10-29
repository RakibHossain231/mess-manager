"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/theme/theme-toggle";

function ResetPasswordContent() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  useEffect(() => {
    let mounted = true;

    async function prepareRecoverySession() {
      setChecking(true);
      setErrorText("");

      // A server-side error forwarded from /auth/confirm.
      const linkError = searchParams.get("error");
      if (linkError) {
        if (!mounted) return;
        setReady(false);
        setChecking(false);
        setErrorText(linkError);
        return;
      }

      // The recovery session is normally established server-side by
      // /auth/confirm before we land here. As a fallback, if the link
      // still carries a raw `code`, exchange it directly.
      const code = searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!mounted) return;

        if (error) {
          setReady(false);
          setChecking(false);
          setErrorText("Invalid or expired reset link.");
          return;
        }

        setReady(true);
        setChecking(false);
        return;
      }

      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        setReady(false);
        setChecking(false);
        setErrorText(error.message);
        return;
      }

      if (data.session) {
        setReady(true);
        setChecking(false);
        return;
      }

      setReady(false);
      setChecking(false);
      setErrorText("Invalid or expired reset link.");
    }

    prepareRecoverySession();

    return () => {
      mounted = false;
    };
  }, [searchParams, supabase]);

  async function handleResetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorText("");
    setSuccessText("");

    if (!password || password.length < 6) {
      setLoading(false);
      setErrorText("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setLoading(false);
      setErrorText("Passwords do not match.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      setErrorText(error.message);
      return;
    }

    setSuccessText("Password updated successfully. Redirecting to login...");

    setTimeout(async () => {
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    }, 1200);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="absolute right-4 top-4 sm:right-8 sm:top-8">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reset Password</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Enter your new password below.
        </p>

        {checking ? (
          <p className="mt-6 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Checking reset link...
          </p>
        ) : !ready ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/60 dark:text-red-400">
              {errorText || "Invalid or expired reset link."}
            </p>

            <div className="text-center">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-teal-700 transition hover:text-teal-800 hover:underline dark:text-teal-400 dark:hover:text-teal-300"
              >
                Request a new reset link
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                New Password
              </label>
              <input
                type="password"
                placeholder="Enter new password"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Confirm Password
              </label>
              <input
                type="password"
                placeholder="Confirm new password"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {errorText ? (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/60 dark:text-red-400">
                {errorText}
              </p>
            ) : null}

            {successText ? (
              <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                {successText}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-teal-700 px-4 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

function ResetPasswordFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reset Password</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Enter your new password below.
        </p>

        <p className="mt-6 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Checking reset link...
        </p>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
