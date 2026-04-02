"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [errorText, setErrorText] = useState("");

  async function handleSendReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorText("");
    setMessageText("");

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setLoading(false);
      setErrorText("Email is required.");
      return;
    }

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/reset-password`
        : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo,
    });

    setLoading(false);

    if (error) {
      setErrorText(error.message);
      return;
    }

    setMessageText(
      "If this email is registered, a password reset link has been sent."
    );
    setEmail("");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Forgot Password</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your account email. We will send a password reset link.
        </p>

        <form onSubmit={handleSendReset} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-teal-600"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {errorText ? (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {errorText}
            </p>
          ) : null}

          {messageText ? (
            <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {messageText}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-teal-700 px-4 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm font-medium text-teal-700 transition hover:text-teal-800 hover:underline"
            >
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}