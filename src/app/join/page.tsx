"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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

      const { data: existing } = await supabase
        .from("members")
        .select("status")
        .eq("user_id", user.id)
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
  }, [supabase]);

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

    const { data: alreadyLinked } = await supabase
      .from("members")
      .select("id, status")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (alreadyLinked) {
      setLoading(false);

      if (alreadyLinked.status === "pending") {
        setPendingApproval(true);
        return;
      }

      router.push("/");
      router.refresh();
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
      if (existingMember.status === "left") {
        setLoading(false);
        setErrorText("This member is inactive. Please contact admin.");
        return;
      }

      if (existingMember.user_id) {
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
        .eq("id", existingMember.id)
        .is("user_id", null);

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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        {pendingApproval ? (
          <>
            <h1 className="text-2xl font-bold text-slate-900">
              Request Pending
            </h1>
            <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-4 text-sm text-amber-800 ring-1 ring-amber-200">
              Your join request has been sent to the mess admin. You will get
              access as soon as an admin approves you.
            </div>

            <button
              type="button"
              onClick={() => {
                router.refresh();
              }}
              disabled={leaving}
              className="mt-6 w-full rounded-2xl bg-teal-700 px-4 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Check Approval Status
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-slate-900">Join a Mess</h1>
            <p className="mt-2 text-sm text-slate-600">
              Enter your mess join code. Your profile name and mobile number
              will be used automatically.
            </p>

            <form onSubmit={handleJoin} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Join Code
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Enter join code"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 uppercase outline-none transition focus:border-teal-600"
                  required
                />
              </div>

              {errorText ? (
                <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
                  {errorText}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading || leaving}
                className="w-full rounded-2xl bg-teal-700 px-4 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
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
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 py-3 font-semibold text-white transition hover:bg-teal-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowLeft className="h-4 w-4" />
          {leaving ? "Going to login..." : "Back to Login"}
        </button>

        <div className="mt-5 text-center text-sm text-slate-600">
          Want to create your own mess?{" "}
          <Link href="/setup" className="font-semibold text-teal-700">
            Create a new mess
          </Link>
        </div>
      </div>
    </main>
  );
}