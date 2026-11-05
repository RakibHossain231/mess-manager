"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/theme/theme-toggle";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  // Verification state after signup
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [submittedName, setSubmittedName] = useState("");
  const [submittedMobile, setSubmittedMobile] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState("");
  const [resendCooldown, setResendCooldown] = useState(60);

  // Countdown timer for resending verification
  useEffect(() => {
    if (!submittedEmail || resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [submittedEmail, resendCooldown]);

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorText("");

    const cleanName = fullName.trim();
    const cleanMobile = mobileNumber.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanMobile || !cleanEmail || !password || !confirmPassword) {
      setErrorText("Full name, mobile number, email, and password are required.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setErrorText("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (!/^01\d{9}$/.test(cleanMobile)) {
      setErrorText("Enter a valid Bangladeshi mobile number (e.g. 017XXXXXXXX).");
      setLoading(false);
      return;
    }

    const emailRedirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/confirm?next=/login?verified=true`
        : undefined;

    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: cleanName,
          phone: cleanMobile,
        },
        emailRedirectTo,
      },
    });

    if (signupError) {
      // If error says user already registered, check if unconfirmed to allow completing verification
      if (
        signupError.message.toLowerCase().includes("already registered") ||
        signupError.message.toLowerCase().includes("already exists")
      ) {
        const { error: resendErr } = await supabase.auth.resend({
          type: "signup",
          email: cleanEmail,
        });

        if (!resendErr) {
          setSubmittedEmail(cleanEmail);
          setSubmittedName(cleanName);
          setSubmittedMobile(cleanMobile);
          setResendCooldown(60);
          setOtpCode("");
          setVerifyError("");
          setResendStatus("A new verification code has been sent to your email. Enter the code below to complete signup.");
          setLoading(false);
          return;
        }
      }

      setErrorText(signupError.message);
      setLoading(false);
      return;
    }

    const user = signupData.user;

    if (!user) {
      setErrorText("Signup failed. Please try again.");
      setLoading(false);
      return;
    }

    // If an existing user signed up again and identities is empty (Supabase security feature)
    if (user.identities && user.identities.length === 0) {
      // Attempt to resend verification code if account is not yet confirmed
      const { error: resendErr } = await supabase.auth.resend({
        type: "signup",
        email: cleanEmail,
      });

      if (!resendErr) {
        setSubmittedEmail(cleanEmail);
        setSubmittedName(cleanName);
        setSubmittedMobile(cleanMobile);
        setResendCooldown(60);
        setOtpCode("");
        setVerifyError("");
        setResendStatus("A new verification code has been sent to your email. Enter the code below to complete signup.");
        setLoading(false);
        return;
      }

      setErrorText(
        "An account with this email already exists and is active. Please log in or use Forgot Password."
      );
      setLoading(false);
      return;
    }

    // Note: Profiles table row is NOT created here.
    // It is created ONLY AFTER the user verifies their OTP in handleVerifyOtp.

    // If email confirmation is enabled on Supabase, no active session is returned
    if (!signupData.session) {
      setSubmittedEmail(cleanEmail);
      setSubmittedName(cleanName);
      setSubmittedMobile(cleanMobile);
      setResendCooldown(60);
      setOtpCode("");
      setVerifyError("");
      setLoading(false);
      return;
    }

    // If email confirmation is disabled, user is immediately logged in
    setLoading(false);
    router.push("/");
    router.refresh();
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = otpCode.trim();

    if (!cleanCode || cleanCode.length < 6) {
      setVerifyError("Please enter the complete verification code.");
      return;
    }

    setVerifying(true);
    setVerifyError("");

    const { data, error } = await supabase.auth.verifyOtp({
      email: submittedEmail!,
      token: cleanCode,
      type: "signup",
    });

    if (error) {
      setVerifying(false);
      setVerifyError(error.message || "Invalid or expired code. Please try again.");
      return;
    }

    // Ensure profile row exists in profiles table
    if (data?.user) {
      try {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          full_name: submittedName || "User",
          email: submittedEmail,
          phone: submittedMobile || null,
        });
      } catch (err) {
        console.error("Profile sync error:", err);
      }
    }

    setVerifying(false);
    // User is now verified and logged in!
    window.location.href = "/";
  }

  async function handleResendEmail() {
    if (!submittedEmail || resendCooldown > 0) return;
    setResending(true);
    setResendStatus("");

    const emailRedirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/confirm?next=/login?verified=true`
        : undefined;

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: submittedEmail,
      options: {
        emailRedirectTo,
      },
    });

    setResending(false);
    if (error) {
      setResendStatus(`Failed to resend: ${error.message}`);
    } else {
      setResendStatus("A new verification code/link has been sent! Check your inbox.");
      setResendCooldown(60);
    }
  }

  if (submittedEmail) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 dark:bg-slate-950">
        <div className="absolute right-4 top-4 sm:right-8 sm:top-8">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400">
            <svg
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>

          <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
            Verify Your Gmail
          </h1>

          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            We sent a verification code and link to:
          </p>
          <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
            {submittedEmail}
          </p>

          {/* Form to enter 6-digit OTP code directly */}
          <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300 text-left mb-1.5">
                Enter Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                placeholder="12345678"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                className="w-full text-center text-xl font-mono tracking-[0.35em] rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
              {verifying ? "Verifying code..." : "Verify Code & Continue"}
            </button>
          </form>

          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Can&apos;t find the email? Please check your <strong>Spam / Junk</strong> folder.
          </p>

          {resendStatus ? (
            <p className="mt-4 rounded-xl bg-teal-50 px-3 py-2 text-xs font-medium text-teal-700 dark:bg-teal-950/60 dark:text-teal-400">
              {resendStatus}
            </p>
          ) : null}

          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={handleResendEmail}
              disabled={resending || resendCooldown > 0}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shadow-sm"
            >
              {resending
                ? "Resending..."
                : resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : "Resend Verification Code / Email"}
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

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 dark:bg-slate-950">
      <div className="absolute right-4 top-4 sm:right-8 sm:top-8">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Create Account</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Create your account, then join an existing mess or create a new one.
        </p>

        <form onSubmit={handleSignup} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Full Name
            </label>
            <input
              type="text"
              placeholder="Enter your full name"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Mobile Number
            </label>
            <input
              type="text"
              placeholder="Enter your mobile number"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              required
            />
          </div>

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
              placeholder="Create a password"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Confirm Password
            </label>
            <input
              type="password"
              placeholder="Re-enter your password"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
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
            {loading ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <p className="mt-5 text-sm text-slate-600 dark:text-slate-400">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-teal-700 hover:underline dark:text-teal-400">
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}
