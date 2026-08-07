"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildSettlementRows } from "@/lib/report-snapshot";

type Member = {
  id: string;
  full_name: string;
};

type Charge = {
  member_id: string;
  rent: number;
  wifi: number;
  electricity: number;
  water: number;
  gas: number;
  khala_bill: number;
  utility: number;
  others: number;
  discount: number;
  advance: number;
  previous_due: number;
};

export default function MonthActions({
  groupId,
  currentMonthId,
  currentMonthLabel,
  members,
}: {
  groupId: string;
  currentMonthId: string |null;
  currentMonthLabel: string |null;
  members: Member[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [reviewChecked, setReviewChecked] = useState(false);
  const [forceClose, setForceClose] = useState(false);

  const todayDate = useMemo(() => new Date(),[]);
  const dayOfMonth = todayDate.getDate();
  const normalCloseAllowed = dayOfMonth >= 25;

  function getNextMonthInfo(label: string) {
    const baseDate = new Date(`${label}-01T00:00:00`);
    const nextDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);

    const year = nextDate.getFullYear();
    const month = String(nextDate.getMonth() + 1).padStart(2, "0");

    const startDate = new Date(year, nextDate.getMonth(), 1);
    const endDate = new Date(year, nextDate.getMonth() + 1, 0);

    return {
      label: `${year}-${month}`,
      monthStart: startDate.toISOString().slice(0, 10),
      monthEnd: endDate.toISOString().slice(0, 10),
    };
  }

  async function handleCloseAndCreateNextMonth() {
    setMsg("");

    if (!currentMonthId || !currentMonthLabel) {
      setMsg("No open month found.");
      return;
    }

    if (!reviewChecked) {
      setMsg("Please confirm that you reviewed/downloaded the report.");
      return;
    }

    if (!normalCloseAllowed && !forceClose) {
      setMsg("Month close is normally allowed after 25th. Use force close if needed.");
      return;
    }

    setLoading(true);
    const nextMonthInfo = getNextMonthInfo(currentMonthLabel);

    const { data: existingNextMonth, error: existingMonthError } = await supabase
      .from("months")
      .select("id, status")
      .eq("group_id", groupId)
      .eq("label", nextMonthInfo.label)
      .limit(1)
      .maybeSingle();

    if (existingMonthError) {
      setLoading(false);
      setMsg(existingMonthError.message);
      return;
    }

    if (existingNextMonth) {
      setLoading(false);
      setMsg(`Next month (${nextMonthInfo.label}) already exists.`);
      return;
    }

    const [{ data: mealsData, error: mealsError }, { data: expensesData, error: expensesError }, { data: chargesData, error: chargesError }] =
      await Promise.all([
        supabase
          .from("meal_entries")
          .select("member_id, own_meal, guest_meal")
          .eq("month_id", currentMonthId),
        supabase
          .from("expense_entries")
          .select("expense_type, amount, paid_by_member_id")
          .eq("month_id", currentMonthId),
        supabase
          .from("member_monthly_charges")
          .select(
            "member_id, rent, wifi, electricity, water, gas, khala_bill, utility, others, discount, advance, previous_due"
          )
          .eq("month_id", currentMonthId),
      ]);

    if (mealsError || expensesError || chargesError) {
      setLoading(false);
      setMsg(
        mealsError?.message || expensesError?.message || chargesError?.message ||
          "Failed to load current month data."
      );
      return;
    }

    const charges: Charge[] = (chargesData ?? []).map((charge) => ({
      member_id: charge.member_id,
      rent: Number(charge.rent || 0),
      wifi: Number(charge.wifi || 0),
      electricity: Number(charge.electricity || 0),
      water: Number(charge.water || 0),
      gas: Number(charge.gas || 0),
      khala_bill: Number(charge.khala_bill || 0),
      utility: Number(charge.utility || 0),
      others: Number(charge.others || 0),
      discount: Number(charge.discount || 0),
      advance: Number(charge.advance || 0),
      previous_due: Number(charge.previous_due || 0),
    }));

    const settlementRows = buildSettlementRows({
      groupId,
      monthId: currentMonthId,
      members,
      meals: mealsData ?? [],
      expenses: expensesData ?? [],
      charges,
    });

    if (settlementRows.length > 0) {
      const { error: settlementError } = await supabase
        .from("settlements")
        .insert(settlementRows);

      if (settlementError) {
        setLoading(false);
        setMsg(settlementError.message);
        return;
      }
    }

    const { error: closeError } = await supabase
      .from("months")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
      })
      .eq("id", currentMonthId)
      .eq("status", "open");

    if (closeError) {
      setLoading(false);
      setMsg(closeError.message);
      return;
    }

    const { data: newMonth, error: createError } = await supabase
      .from("months")
      .insert({
        group_id: groupId,
        label: nextMonthInfo.label,
        month_start: nextMonthInfo.monthStart,
        month_end: nextMonthInfo.monthEnd,
        status: "open",
      })
      .select("id")
      .single();

    if (createError || !newMonth) {
      setLoading(false);
      setMsg(createError?.message || "Failed to create next month.");
      return;
    }

    if (charges.length > 0) {
      const chargesPayload = charges.map((charge) => ({
        month_id: newMonth.id,
        member_id: charge.member_id,
        rent: charge.rent,
        wifi: charge.wifi,
        electricity: charge.electricity,
        water: charge.water,
        gas: charge.gas,
        khala_bill: charge.khala_bill,
        utility: charge.utility,
        others: charge.others,
        discount: 0,
        advance: 0,
        previous_due: 0,
      }));

      const { error: chargesInsertError } = await supabase
        .from("member_monthly_charges")
        .insert(chargesPayload);

      if (chargesInsertError) {
        setLoading(false);
        setMsg(chargesInsertError.message);
        return;
      }
    }

    setLoading(false);
    setShowConfirm(false);
    setReviewChecked(false);
    setForceClose(false);
    setMsg(`Month closed successfully. New month ${nextMonthInfo.label} created.`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <a
          href="/reports"
          className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Review / Download Report
        </a>

        <button
          onClick={() => setShowConfirm((prev) => !prev)}
          className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Close Current Month
        </button>
      </div>

      {!normalCloseAllowed ? (
        <p className="text-sm text-amber-700">
          Normal month close is allowed after 25th. Before that, force close is required.
        </p>
      ) :null}

      {showConfirm ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-base font-bold text-slate-900">Confirm Month Close</h3>

          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <p>
              This will close the current month, save frozen settlement rows, and
              create the next month automatically.
            </p>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={reviewChecked}
                onChange={(e) => setReviewChecked(e.target.checked)}
                className="mt-1"
              />
              <span>I reviewed the final report / downloaded PDF before closing.</span>
            </label>

            {!normalCloseAllowed ? (
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={forceClose}
                  onChange={(e) => setForceClose(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  Force close this month before 25th. I understand this is an early close.
                </span>
              </label>
            ) :null}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={handleCloseAndCreateNextMonth}
              disabled={loading}
              className="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Processing..." : "Confirm Close Month"}
            </button>

            <button
              onClick={() => setShowConfirm(false)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) :null}

      {msg ? <p className="text-sm text-slate-700">{msg}</p> :null}
    </div>
  );
}
