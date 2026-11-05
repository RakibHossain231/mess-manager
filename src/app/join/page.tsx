"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/theme/theme-toggle";

type JoinRole = "admin" | "manager" | "member";

export default function JoinPage() {
  const router = useRouter();
  const supabase = createClient();

  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [pendingApproval, setPendingApproval] = useState(false);

  // If the user already has a pending membership, show the waiting state
  // instead of the empty form (so a reload/return does not loop them back).
  useEffect(() => {
    let active = true;

    async function checkPending() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // If user has an active membership in any mess, redirect to dashboard
      const { data: activeMember } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (active && activeMember) {
        router.push("/");
        router.refresh();
        return;
      }

      // Check if user has an ongoing pending join request
      const { data: existing } = await supabase
        .from("members")
        .select("status")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (active && existing?.status === "pending") {
        setPendingApproval(true);
      }
    }

    checkPending();

    return () => {
      active = false;
    };
  }, [supabase, router]);

  async function handleBackToLogin() {
    setLeaving(true);
    setErrorText("");

    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorText("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      setErrorText("Please login first.");
      return;
    }

    const cleanCode = joinCode.trim().toUpperCase();

    if (!cleanCode) {
      setLoading(false);
      setErrorText("Join code is required.");
      return;
    }

    // Check if the user is currently an active member of an existing mess
    const { data: activeMember } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (activeMember) {
      setLoading(false);
      router.push("/");
      router.refresh();
      return;
    }

    // Check if user already has an ongoing pending request
    const { data: pendingMember } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    if (pendingMember) {
      setLoading(false);
      setPendingApproval(true);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      setLoading(false);
      setErrorText("Profile not found.");
      return;
    }

    const profileName = (profile.full_name || "").trim();
    const profileMobile = (profile.phone || "").trim();

    if (!profileName || !profileMobile) {
      setLoading(false);
      setErrorText("Your profile name or mobile number is missing.");
      return;
    }

    const { data: group, error: groupError } = await supabase
      .from("mess_groups")
      .select("id, name")
      .eq("join_code", cleanCode)
      .limit(1)
      .maybeSingle();

    if (groupError || !group) {
      setLoading(false);
      setErrorText("Invalid join code.");
      return;
    }

    const defaultRole: JoinRole = "member";

    const { data: existingMember, error: existingMemberError } = await supabase
      .from("members")
      .select("id, user_id, status, role")
      .eq("group_id", group.id)
      .eq("phone", profileMobile)
      .limit(1)
      .maybeSingle();

    if (existingMemberError) {
      setLoading(false);
      setErrorText(existingMemberError.message);
      return;
    }

    if (existingMember) {
      if (existingMember.user_id && existingMember.user_id !== user.id) {
        setLoading(false);
        setErrorText("This member is already linked to another account.");
        return;
      }

      const { error: updateError } = await supabase
        .from("members")
        .update({
          user_id: user.id,
          full_name: profileName,
          phone: profileMobile,
          status: "pending",
        })
        .eq("id", existingMember.id);

      if (updateError) {
        setLoading(false);
        setErrorText(updateError.message);
        return;
      }
    } else {
      const { error: insertError } = await supabase.from("members").insert({
        group_id: group.id,
        user_id: user.id,
        full_name: profileName,
        phone: profileMobile,
        nid: null,
        role: defaultRole,
        status: "pending",
      });

      if (insertError) {
        setLoading(false);
        setErrorText(insertError.message);
        return;
      }
    }

    setLoading(false);
    setJoinCode("");
    setPendingApproval(true);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="absolute right-4 top-4 sm:right-8 sm:top-8">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        {pendingApproval ? (
          <>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Request Pending
            </h1>
            <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-4 text-sm text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800">
              Your join request has been sent to the mess admin. You will get
              access as soon as an admin approves you.
            </div>

            <button
              type="button"
              onClick={() => {
                router.refresh();
              }}
              disabled={leaving}
              className="mt-6 w-full rounded-2xl bg-teal-700 px-4 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
            >
              Check Approval Status
            </button>

            <button
              type="button"
              onClick={async () => {
                setLeaving(true);
                const {
                  data: { user },
                } = await supabase.auth.getUser();
                if (user) {
                  await supabase
                    .from("members")
                    .delete()
                    .eq("user_id", user.id)
                    .eq("status", "pending");
                }
                setPendingApproval(false);
                setLeaving(false);
              }}
              disabled={leaving}
              className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shadow-sm"
            >
              Cancel Request / Enter Different Code
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Join a Mess</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Enter your mess join code. Your profile name and mobile number
              will be used automatically.
            </p>

            <form onSubmit={handleJoin} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Join Code
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Enter join code"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 uppercase outline-none transition focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
                disabled={loading || leaving}
                className="w-full rounded-2xl bg-teal-700 px-4 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
              >
                {loading ? "Joining..." : "Join Mess"}
              </button>
            </form>
          </>
        )}

        <button
          type="button"
          onClick={handleBackToLogin}
          disabled={loading || leaving}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 py-3 font-semibold text-white transition hover:bg-teal-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          {leaving ? "Going to login..." : "Back to Login"}
        </button>

        <div className="mt-5 text-center text-sm text-slate-600 dark:text-slate-400">
          Want to create your own mess?{" "}
          <Link href="/setup" className="font-semibold text-teal-700 hover:underline dark:text-teal-400">
            Create a new mess
          </Link>
        </div>
      </div>
    </main>
  );
}