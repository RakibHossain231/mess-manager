"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createClient();
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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Reset Password</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your new password below.
        </p>

        {checking ? (
          <p className="mt-6 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Checking reset link...
          </p>
        ) : !ready ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {errorText || "Invalid or expired reset link."}
            </p>

            <div className="text-center">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-teal-700 transition hover:text-teal-800 hover:underline"
              >
                Request a new reset link
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                New Password
              </label>
              <input
                type="password"
                placeholder="Enter new password"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-teal-600"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Confirm Password
              </label>
              <input
                type="password"
                placeholder="Confirm new password"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-teal-600"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {errorText ? (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {errorText}
              </p>
            ) : null}

            {successText ? (
              <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {successText}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-teal-700 px-4 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}