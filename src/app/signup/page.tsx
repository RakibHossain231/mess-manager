"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorText("");

    const cleanName = fullName.trim();
    const cleanMobile = mobileNumber.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanMobile || !cleanEmail || !password) {
      setErrorText("Full name, mobile number, email, and password are required.");
      setLoading(false);
      return;
    }

    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: cleanName,
        },
      },
    });

    if (signupError) {
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

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: cleanName,
      email: cleanEmail,
      mobile_number: cleanMobile,
    });

    if (profileError) {
      setErrorText(profileError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Create Account</h1>
        <p className="mt-2 text-sm text-slate-600">
          Create your account, then join an existing mess or create a new one.
        </p>

        <form onSubmit={handleSignup} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Full Name
            </label>
            <input
              type="text"
              placeholder="Enter your full name"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-teal-600"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Mobile Number
            </label>
            <input
              type="text"
              placeholder="Enter your mobile number"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-teal-600"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              required
            />
          </div>

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

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              type="password"
              placeholder="Create a password"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-teal-600"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {errorText ? (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {errorText}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-teal-700 px-4 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <p className="mt-5 text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-teal-700">
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}