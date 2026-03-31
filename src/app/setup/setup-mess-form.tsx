"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function generateJoinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function SetupMessForm({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [messName, setMessName] = useState("");
  const [mode, setMode] = useState<"managed" | "collaborative">("managed");
  const [paymentDeadline, setPaymentDeadline] = useState("10");
  const [currency, setCurrency] = useState("BDT");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorText("");

    if (!messName.trim()) {
      setErrorText("Mess name is required.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, mobile_number")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      setErrorText("Profile not found. Please complete signup again.");
      setLoading(false);
      return;
    }

    const profileName = (profile.full_name || "").trim();
    const profileMobile = (profile.mobile_number || "").trim();

    if (!profileName || !profileMobile) {
      setErrorText("Your profile must have full name and mobile number.");
      setLoading(false);
      return;
    }

    const { data: groupData, error: groupError } = await supabase
      .from("mess_groups")
      .insert({
        name: messName.trim(),
        mode,
        payment_deadline: Number(paymentDeadline),
        currency,
        created_by: userId,
        join_code: generateJoinCode(),
      })
      .select("id")
      .single();

    if (groupError || !groupData) {
      setErrorText(groupError?.message || "Failed to create mess group.");
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase.from("members").insert({
      group_id: groupData.id,
      user_id: userId,
      name: profileName,
      mobile_number: profileMobile,
      nid_number: null,
      role: "admin",
      monthly_rent: 0,
      is_active: true,
    });

    if (memberError) {
      setErrorText(memberError.message);
      setLoading(false);
      return;
    }

    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const label = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      "0"
    )}`;

    const { data: monthData, error: monthError } = await supabase
      .from("months")
      .insert({
        group_id: groupData.id,
        label,
        month_start: start.toISOString().slice(0, 10),
        month_end: end.toISOString().slice(0, 10),
        status: "open",
      })
      .select("id")
      .single();

    if (!monthError && monthData) {
      const { data: adminMember } = await supabase
        .from("members")
        .select("id, monthly_rent")
        .eq("group_id", groupData.id)
        .eq("user_id", userId)
        .single();

      if (adminMember) {
        await supabase.from("member_monthly_charges").insert({
          month_id: monthData.id,
          member_id: adminMember.id,
          rent_amount: adminMember.monthly_rent,
        });
      }
    }

    setLoading(false);
    router.push("/");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Mess Name
          </label>
          <input
            type="text"
            value={messName}
            onChange={(e) => setMessName(e.target.value)}
            placeholder="Enter mess name"
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-teal-600"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Mess Mode
          </label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "managed" | "collaborative")}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-teal-600"
          >
            <option value="managed">Managed</option>
            <option value="collaborative">Collaborative</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Payment Deadline
          </label>
          <input
            type="number"
            value={paymentDeadline}
            onChange={(e) => setPaymentDeadline(e.target.value)}
            min={1}
            max={31}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-teal-600"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Currency
          </label>
          <input
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-teal-600"
          />
        </div>
      </div>

      {errorText ? (
        <p className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorText}
        </p>
      ) : null}

      <div className="mt-8">
        <button
          type="submit"
          disabled={loading}
          className="rounded-2xl bg-teal-700 px-5 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create Mess"}
        </button>
      </div>
    </form>
  );
}