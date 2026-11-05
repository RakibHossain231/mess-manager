"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/theme/theme-toggle";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  // OTP step state
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState("");
  const [resendCooldown, setResendCooldown] = useState(60);

  // Countdown timer for resend
  useEffect(() => {
    if (!submittedEmail || resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [submittedEmail, resendCooldown]);

  async function handleSendReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorText("");

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setLoading(false);
      setErrorText("Email is required.");
      return;
    }

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/confirm?next=/reset-password`
        : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo,
    });

    setLoading(false);

    if (error) {
      setErrorText(error.message);
      return;
    }

    // Switch to OTP verification view
    setSubmittedEmail(trimmedEmail);
    setResendCooldown(60);
    setOtpCode("");
    setVerifyError("");
    setResendStatus("");
  }

  async function handleVerifyOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleanCode = otpCode.trim();

    if (!cleanCode || cleanCode.length < 6) {
      setVerifyError("Please enter the complete verification code.");
      return;
    }

    if (!submittedEmail) return;

    setVerifying(true);
    setVerifyError("");

    const { error } = await supabase.auth.verifyOtp({
      email: submittedEmail,
      token: cleanCode,
      type: "recovery",
    });

    if (error) {
      setVerifying(false);
      setVerifyError(error.message || "Invalid or expired code. Please try again.");
      return;
    }

    // Successfully verified! Supabase sets recovery session cookies.
    // Redirect directly to the reset password page.
    window.location.href = "/reset-password";
  }

  async function handleResendCode() {
    if (!submittedEmail || resendCooldown > 0) return;
    setResending(true);
    setResendStatus("");

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/confirm?next=/reset-password`
        : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(submittedEmail, {
      redirectTo,
    });

    setResending(false);

    if (error) {
      setResendStatus(error.message);
    } else {
      setResendCooldown(60);
      setResendStatus("A new verification code has been sent to your email.");
    }
  }

  // Step 2: OTP Verification UI
  if (submittedEmail) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 dark:bg-slate-950">
        <div className="absolute right-4 top-4 sm:right-8 sm:top-8">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-2xl text-teal-600 dark:bg-teal-950/60 dark:text-teal-400">
            ✉️
          </div>

          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Verify Reset Code
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            We sent a verification code to
          </p>
          <p className="mt-1 font-semibold text-teal-700 dark:text-teal-400 break-all">
            {submittedEmail}
          </p>

          <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Enter Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                placeholder="12345678"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                className="w-full text-center text-xl font-mono tracking-[0.25em] rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
                autoFocus
              />
            </div>

            {verifyError ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-950/60 dark:text-red-400">
                {verifyError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={verifying || otpCode.length < 6}
              className="w-full rounded-2xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
            >
              {verifying ? "Verifying code..." : "Verify Code & Change Password"}
            </button>
          </form>

          <div className="relative my-5 flex items-center justify-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            <span className="absolute bg-white px-3 text-xs font-semibold text-slate-400 dark:bg-slate-900">
              OR
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              Alternative Option:
            </p>
            <p className="mt-1">
              You can also click the <strong>password reset link</strong> directly in your email inbox to change your password.
            </p>
            <p className="mt-1.5 text-slate-500 dark:text-slate-400">
              Can&apos;t find it? Please check your <strong>Spam / Junk</strong> folder.
            </p>
          </div>

          {resendStatus ? (
            <p className="mt-4 rounded-xl bg-teal-50 px-3 py-2 text-xs font-medium text-teal-700 dark:bg-teal-950/60 dark:text-teal-400">
              {resendStatus}
            </p>
          ) : null}

          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={handleResendCode}
              disabled={resending || resendCooldown > 0}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shadow-sm"
            >
              {resending
                ? "Resending..."
                : resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : "Resend Code / Email"}
            </button>

            <Link
              href="/login"
              className="block text-xs font-medium text-teal-700 hover:underline dark:text-teal-400"
            >
              Back to Login
            </Link>

            <div>
              <button
                type="button"
                onClick={() => {
                  setSubmittedEmail(null);
                  setResendStatus("");
                  setVerifyError("");
                  setOtpCode("");
                }}
                className="text-xs text-slate-500 hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
              >
                Entered wrong email? Change email
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Step 1: Request Email UI
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="absolute right-4 top-4 sm:right-8 sm:top-8">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Forgot Password</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Enter your account email. We will send a verification code to reset your password.
        </p>

        <form onSubmit={handleSendReset} className="mt-6 space-y-4">
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
            {loading ? "Sending Code..." : "Send Verification Code"}
          </button>

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm font-medium text-teal-700 transition hover:text-teal-800 hover:underline dark:text-teal-400 dark:hover:text-teal-300"
            >
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
