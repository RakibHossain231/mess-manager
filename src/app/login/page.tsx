"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/theme/theme-toggle";

function LoginForm() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const isVerifyNotice = searchParams.get("verify") === "true";
  const isVerifiedSuccess = searchParams.get("verified") === "true";
  const initialError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState(
    initialError ? decodeURIComponent(initialError) : ""
  );

  const [isEmailUnconfirmed, setIsEmailUnconfirmed] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorText("");
    setIsEmailUnconfirmed(false);
    setResendMessage("");

    const cleanEmail = email.trim().toLowerCase();

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      setLoading(false);
      const isUnconfirmed =
        error.message.toLowerCase().includes("email not confirmed") ||
        error.message.toLowerCase().includes("not confirmed");

      if (isUnconfirmed) {
        setIsEmailUnconfirmed(true);
        setErrorText(
          "Your email has not been verified yet. Please check your inbox (and Spam folder) for the verification link."
        );
      } else {
        setErrorText(error.message);
      }
      return;
    }

    // Ensure profile row exists in profiles table
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const metadata = user.user_metadata || {};
        const fullName =
          metadata.full_name || metadata.name || user.email?.split("@")[0] || "User";
        const phone = metadata.phone || null;

        await supabase.from("profiles").upsert({
          id: user.id,
          full_name: fullName,
          email: user.email,
          phone: phone,
        });
      }
    } catch {
      // Non-blocking
    }

    // Direct clean navigation ensuring fresh cookies
    window.location.href = "/";
  }

  async function handleResendVerification() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorText("Please enter your email above to resend the verification link.");
      return;
    }

    setResending(true);
    setResendMessage("");

    const emailRedirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/confirm?next=/login?verified=true`
        : undefined;

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: cleanEmail,
      options: {
        emailRedirectTo,
      },
    });

    setResending(false);

    if (error) {
      setResendMessage(`Failed to resend: ${error.message}`);
    } else {
      setResendMessage(
        "Verification email re-sent! Please check your Gmail inbox and spam folder."
      );
    }
  }

  return (
    <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Login</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Login to continue to your mess account.
      </p>

      {/* Verified banner */}
      {isVerifiedSuccess ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          <p className="font-semibold">Email verified successfully!</p>
          <p className="mt-1 text-xs">You can now login with your password.</p>
        </div>
      ) : null}

      {/* Verify pending notice banner */}
      {isVerifyNotice ? (
        <div className="mt-4 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800 dark:border-teal-900/60 dark:bg-teal-950/40 dark:text-teal-300">
          <p className="font-semibold">Please check your email!</p>
          <p className="mt-1 text-xs">
            We sent you a verification link. Please click it to activate your account before logging in.
          </p>
        </div>
      ) : null}

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
          <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-600 dark:bg-red-950/60 dark:text-red-400">
            <p>{errorText}</p>

            {isEmailUnconfirmed ? (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resending}
                className="mt-2 text-xs font-semibold text-teal-700 underline hover:text-teal-800 disabled:opacity-60 dark:text-teal-400"
              >
                {resending ? "Resending..." : "Click here to resend verification email"}
              </button>
            ) : null}
          </div>
        ) : null}

        {resendMessage ? (
          <p className="rounded-2xl bg-teal-50 px-4 py-3 text-xs font-medium text-teal-700 dark:bg-teal-950/60 dark:text-teal-400">
            {resendMessage}
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
  );
}

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="absolute right-4 top-4 sm:right-8 sm:top-8">
        <ThemeToggle />
      </div>

      <Suspense
        fallback={
          <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            Loading...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
