"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type GroupMode = "managed" | "collaborative";
type JoinRole = "admin" | "manager" | "member";

export default function JoinPage() {
  const router = useRouter();
  const supabase = createClient();

  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  function getDefaultRoleByMode(mode: GroupMode): JoinRole {
    if (mode === "collaborative") {
      return "manager";
    }

    return "member";
  }

  async function handleJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorText("");
    setSuccessText("");

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
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (alreadyLinked) {
      setLoading(false);
      router.push("/");
      router.refresh();
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, mobile_number")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      setLoading(false);
      setErrorText("Profile not found.");
      return;
    }

    const profileName = (profile.full_name || "").trim();
    const profileMobile = (profile.mobile_number || "").trim();

    if (!profileName || !profileMobile) {
      setLoading(false);
      setErrorText("Your profile name or mobile number is missing.");
      return;
    }

    const { data: group, error: groupError } = await supabase
      .from("mess_groups")
      .select("id, name, mode")
      .eq("join_code", cleanCode)
      .limit(1)
      .maybeSingle();

    if (groupError || !group) {
      setLoading(false);
      setErrorText("Invalid join code.");
      return;
    }

    const defaultRole = getDefaultRoleByMode(group.mode as GroupMode);

    const { data: existingMember, error: existingMemberError } = await supabase
      .from("members")
      .select("id, user_id, is_active, role")
      .eq("group_id", group.id)
      .eq("mobile_number", profileMobile)
      .limit(1)
      .maybeSingle();

    if (existingMemberError) {
      setLoading(false);
      setErrorText(existingMemberError.message);
      return;
    }

    if (existingMember) {
      if (!existingMember.is_active) {
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
          name: profileName,
          mobile_number: profileMobile,
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
        name: profileName,
        mobile_number: profileMobile,
        nid_number: null,
        role: defaultRole,
        monthly_rent: 0,
        is_active: true,
      });

      if (insertError) {
        setLoading(false);
        setErrorText(insertError.message);
        return;
      }
    }

    setLoading(false);
    setSuccessText(`Successfully joined ${group.name}. Redirecting...`);

    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 700);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Join a Mess</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your mess join code. Your profile name and mobile number will be
          used automatically.
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
            {loading ? "Joining..." : "Join Mess"}
          </button>
        </form>

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