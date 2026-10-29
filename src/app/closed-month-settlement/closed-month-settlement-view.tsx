"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/types";

type Member = {
  id: string;
  full_name: string;
};

type MealEntry = {
  member_id: string;
  own_meal: number;
  guest_meal: number;
};

type ExpenseEntry = {
  expense_type: string;
  amount: number;
  paid_by_member_id: string | null;
};

type ChargeRow = {
  member_id: string;
  rent: number;
  wifi: number;
  electricity: number;
  water: number;
  gas: number;
  khala_bill: number;
  utility: number;
  others: number;
  advance: number;
  discount: number;
  previous_due: number;
};

type MonthRow = {
  id: string;
  label: string;
  status: "open" | "closed" | "archived";
  created_at?: string;
};

type SettlementRow = {
  member_id: string;
  final_amount: number;
  final_type: "pay" | "receive";
  paid_amount: number;
};

// Formatter for rounded whole Taka numbers
const fmtMoney = (value: number) =>
  "৳ " + Math.round(Number(value) || 0).toLocaleString("en-US");

const roundNum = (value: number) => Math.round(Number(value) || 0);

export default function ClosedMonthSettlementView({
  groupId,
  monthLabel,
  selectedMonthId,
  months,
  members,
  meals,
  expenses,
  charges,
  settlements,
  viewerRole,
}: {
  groupId: string;
  monthLabel: string;
  selectedMonthId: string;
  months: MonthRow[];
  members: Member[];
  meals: MealEntry[];
  expenses: ExpenseEntry[];
  charges: ChargeRow[];
  settlements: SettlementRow[];
  viewerRole: Role;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const canEdit =
    viewerRole === "owner" || viewerRole === "admin" || viewerRole === "manager";

  // Sum all fixed charges from member_monthly_charges for each member.
  const chargeMap = useMemo(() => {
    return new Map(
      charges.map((item) => {
        const total =
          Number(item.rent || 0) +
          Number(item.wifi || 0) +
          Number(item.electricity || 0) +
          Number(item.water || 0) +
          Number(item.gas || 0) +
          Number(item.khala_bill || 0) +
          Number(item.utility || 0) +
          Number(item.others || 0) -
          Number(item.discount || 0) -
          Number(item.advance || 0) +
          Number(item.previous_due || 0);
        return [item.member_id, total] as const;
      })
    );
  }, [charges]);

  const settlementMap = useMemo(() => {
    return new Map(
      settlements.map((item) => [
        item.member_id,
        {
          finalAmount: roundNum(item.final_amount),
          finalType: item.final_type,
          paidAmount: roundNum(item.paid_amount),
        },
      ])
    );
  }, [settlements]);

  const monthMembers = useMemo(() => {
    return members.filter((member) => chargeMap.has(member.id));
  }, [members, chargeMap]);

  const totalMeals = meals.reduce(
    (sum, item) => sum + Number(item.own_meal || 0) + Number(item.guest_meal || 0),
    0
  );

  const totalBazar = expenses
    .filter((item) => item.expense_type === "bazar")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const totalSharedBills = expenses
    .filter((item) => item.expense_type === "shared")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const mealRate = totalMeals > 0 ? totalBazar / totalMeals : 0;

  const perMemberSharedCost =
    monthMembers.length > 0 ? totalSharedBills / monthMembers.length : 0;

  const rows = useMemo(() => {
    return monthMembers.map((member) => {
      const memberMeals = meals.filter((item) => item.member_id === member.id);

      const ownMeal = memberMeals.reduce(
        (sum, item) => sum + Number(item.own_meal || 0),
        0
      );

      const guestMeal = memberMeals.reduce(
        (sum, item) => sum + Number(item.guest_meal || 0),
        0
      );

      const totalMeal = ownMeal + guestMeal;

      const bazarPaid = expenses
        .filter(
          (item) =>
            item.expense_type === "bazar" && item.paid_by_member_id === member.id
        )
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);

      const chargesTotal = Number(chargeMap.get(member.id) ?? 0);

      const mealCost = totalMeal * mealRate;
      const sharedShare = perMemberSharedCost;
      const rawFinalBalance = bazarPaid - mealCost - sharedShare - chargesTotal;

      const computedFinalType: "pay" | "receive" =
        rawFinalBalance >= 0 ? "receive" : "pay";

      const computedFinalAmount = roundNum(Math.abs(rawFinalBalance));

      const savedSettlement = settlementMap.get(member.id);

      const finalType = savedSettlement?.finalType ?? computedFinalType;
      const finalAmount = roundNum(savedSettlement?.finalAmount ?? computedFinalAmount);
      const paidAmount = roundNum(savedSettlement?.paidAmount ?? 0);
      const remaining = Math.max(finalAmount - paidAmount, 0);

      const finalTypeLabel =
        remaining <= 0
          ? finalType === "receive"
            ? "Received"
            : "Paid"
          : finalType === "receive"
          ? "Will Receive"
          : "Will Pay";

      const statusLabel =
        remaining <= 0 && finalAmount > 0
          ? "Done"
          : paidAmount > 0
          ? "Partial"
          : "Pending";

      return {
        id: member.id,
        name: member.full_name,
        finalType,
        finalAmount,
        paidAmount,
        remaining,
        finalTypeLabel,
        statusLabel,
      };
    });
  }, [
    monthMembers,
    meals,
    expenses,
    chargeMap,
    mealRate,
    perMemberSharedCost,
    settlementMap,
  ]);

  // Editable inputs for Paid Amount, initialized with current saved paidAmount
  const [entryValues, setEntryValues] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Sync inputs on selected month change
  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const row of rows) {
      initial[row.id] = String(row.paidAmount);
    }
    setEntryValues(initial);
  }, [selectedMonthId, settlements]);

  const totalWillPay = rows
    .filter((row) => row.finalType === "pay")
    .reduce((sum, row) => sum + row.finalAmount, 0);

  const totalWillReceive = rows
    .filter((row) => row.finalType === "receive")
    .reduce((sum, row) => sum + row.finalAmount, 0);

  const totalPaidAmount = rows.reduce((sum, row) => sum + row.paidAmount, 0);
  const totalRemaining = rows.reduce((sum, row) => sum + row.remaining, 0);

  const handleMonthChange = (monthId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", monthId);
    router.push(`/closed-month-settlement?${params.toString()}`);
  };

  const handleSave = async (row: (typeof rows)[number]) => {
    const rawEntry = entryValues[row.id];
    let newPaidAmount =
      rawEntry !== undefined && rawEntry !== ""
        ? roundNum(Number(rawEntry))
        : row.paidAmount;

    if (isNaN(newPaidAmount) || newPaidAmount < 0) {
      alert("Please enter a valid amount.");
      return;
    }

    if (newPaidAmount > row.finalAmount) {
      newPaidAmount = row.finalAmount;
    }

    const nextDue = Math.max(row.finalAmount - newPaidAmount, 0);
    const nextStatus =
      nextDue <= 0 && row.finalAmount > 0
        ? "paid"
        : newPaidAmount > 0
        ? "partial"
        : "unpaid";

    setSavingId(row.id);

    // Update the settlement row in database
    const { error: settlementError } = await supabase
      .from("settlements")
      .update({
        paid_amount: newPaidAmount,
        due_amount: nextDue,
        status: nextStatus,
      })
      .eq("group_id", groupId)
      .eq("month_id", selectedMonthId)
      .eq("member_id", row.id);

    if (settlementError) {
      setSavingId(null);
      alert(settlementError.message);
      return;
    }

    // Record delta in payments ledger if increased
    const delta = newPaidAmount - row.paidAmount;
    if (delta > 0) {
      await supabase.from("payments").insert({
        group_id: groupId,
        month_id: selectedMonthId,
        member_id: row.id,
        amount: delta,
        payment_date: new Date().toISOString().slice(0, 10),
        payment_method: "cash",
        status: nextStatus,
      });
    }

    setSavingId(null);
    router.refresh();
  };

  const fillFull = (memberId: string, finalAmount: number) => {
    setEntryValues((prev) => ({
      ...prev,
      [memberId]: String(finalAmount),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Closed Month Settlement
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              <b>{monthLabel}</b>
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Owner, admin and manager can edit paid amounts. Members can view only.
            </p>
          </div>

          <div className="w-full md:w-[280px]">
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Select Closed Month
            </label>
            <select
              value={selectedMonthId}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {months.map((month) => (
                <option key={month.id} value={month.id}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Due</p>
          <h3 className="mt-2 text-2xl font-bold text-red-700 dark:text-red-400">
            {fmtMoney(totalWillPay + totalWillReceive)}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Total settlement amount for this month
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Paid Amount</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {fmtMoney(totalPaidAmount)}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Total collected / cleared</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Remaining</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {fmtMoney(totalRemaining)}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Total outstanding balance</p>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Settlement List</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Enter any paid amount (partial or full). Values are automatically rounded to whole Taka.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-sm text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Final Amount</th>
                <th className="px-3 py-2 font-medium">Paid Amount</th>
                <th className="px-3 py-2 font-medium">Remaining</th>
                <th className="px-3 py-2 font-medium">Status</th>
                {canEdit ? <th className="px-3 py-2 font-medium">Action</th> : null}
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const currentVal = entryValues[row.id];
                const enteredPaid =
                  currentVal !== undefined && currentVal !== ""
                    ? Math.max(0, roundNum(Number(currentVal) || 0))
                    : row.paidAmount;

                const previewPaid = Math.min(enteredPaid, row.finalAmount);
                const previewRemaining = Math.max(row.finalAmount - previewPaid, 0);

                const isDone = previewRemaining <= 0 && row.finalAmount > 0;
                const isPartial = previewPaid > 0 && previewRemaining > 0;

                const previewStatusLabel = isDone
                  ? "Done"
                  : isPartial
                  ? "Partial"
                  : "Pending";

                const previewFinalTypeLabel = isDone
                  ? row.finalType === "receive"
                    ? "Received"
                    : "Paid"
                  : row.finalType === "receive"
                  ? "Will Receive"
                  : "Will Pay";

                return (
                  <tr key={row.id} className="bg-slate-50 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
                    <td className="rounded-l-2xl px-3 py-4 font-semibold text-slate-900 dark:text-white">
                      {row.name}
                    </td>

                    <td className="px-3 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          previewFinalTypeLabel === "Received"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                            : previewFinalTypeLabel === "Paid"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
                            : row.finalType === "receive"
                            ? "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                        }`}
                      >
                        {previewFinalTypeLabel}
                      </span>
                    </td>

                    <td className="px-3 py-4 font-semibold text-slate-900 dark:text-white">
                      {fmtMoney(row.finalAmount)}
                    </td>

                    <td className="px-3 py-4">
                      {canEdit ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 dark:text-slate-500 font-medium">৳</span>
                          <input
                            type="number"
                            min="0"
                            max={row.finalAmount}
                            step="1"
                            value={entryValues[row.id] ?? ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEntryValues((prev) => ({
                                ...prev,
                                [row.id]: val,
                              }));
                            }}
                            className="w-28 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-600 focus:ring-1 focus:ring-teal-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </div>
                      ) : (
                        <span>{fmtMoney(row.paidAmount)}</span>
                      )}
                    </td>

                    <td className="px-3 py-4 font-medium text-slate-900 dark:text-white">
                      {fmtMoney(canEdit ? previewRemaining : row.remaining)}
                    </td>

                    <td className="px-3 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          previewStatusLabel === "Done"
                            ? "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400"
                            : previewStatusLabel === "Partial"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                            : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {previewStatusLabel}
                      </span>
                    </td>

                    {canEdit ? (
                      <td className="rounded-r-2xl px-3 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSave(row)}
                            disabled={savingId === row.id}
                            className="rounded-xl bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
                          >
                            {savingId === row.id ? "Saving..." : "Save"}
                          </button>

                          <button
                            type="button"
                            onClick={() => fillFull(row.id, row.finalAmount)}
                            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                            title="Fill full remaining amount"
                          >
                            Full
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
