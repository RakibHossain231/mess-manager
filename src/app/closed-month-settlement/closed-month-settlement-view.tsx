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

// One row per member in member_monthly_charges (the snapshot keeps these at
// month-close time so closed months never change).
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
          finalAmount: Number(item.final_amount || 0),
          finalType: item.final_type,
          paidAmount: Number(item.paid_amount || 0),
        },
      ])
    );
  }, [settlements]);

  // Important:
  // Even if page accidentally sends extra members, view will only show members
  // who have a charge row in this selected closed month.
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

      const computedFinalAmount = Math.abs(rawFinalBalance);

      const savedSettlement = settlementMap.get(member.id);

      const finalType = savedSettlement?.finalType ?? computedFinalType;
      const finalAmount = Number(savedSettlement?.finalAmount ?? computedFinalAmount);
      const paidAmount = Number(savedSettlement?.paidAmount ?? 0);
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

  const [entryValues, setEntryValues] = useState<Record<string, string>>({});

  useEffect(() => {
    setEntryValues(Object.fromEntries(rows.map((row) => [row.id, "0.00"])));
  }, [selectedMonthId, rows]);

  const [savingId, setSavingId] = useState<string | null>(null);

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
    const rawEntry = Number(entryValues[row.id] ?? 0);
    const safeEntry = Math.max(rawEntry, 0);

    const maxAllowedEntry = row.remaining;
    const entryAmount = Math.min(safeEntry, maxAllowedEntry);

    if (entryAmount <= 0) {
      alert("Enter a valid amount.");
      return;
    }

    const nextPaidAmount = Math.min(row.paidAmount + entryAmount, row.finalAmount);
    const nextDue = Math.max(row.finalAmount - nextPaidAmount, 0);
    const nextStatus =
      nextDue <= 0 ? "paid" : nextPaidAmount > 0 ? "partial" : "unpaid";

    setSavingId(row.id);

    // Ledger row for this payment, then roll the aggregates on the frozen
    // settlement row so the report/settlement pages reflect it immediately.
    const { error: paymentError } = await supabase.from("payments").insert({
      group_id: groupId,
      month_id: selectedMonthId,
      member_id: row.id,
      amount: entryAmount,
      payment_date: new Date().toISOString().slice(0, 10),
      payment_method: "cash",
      status: nextStatus,
    });

    if (paymentError) {
      setSavingId(null);
      alert(paymentError.message);
      return;
    }

    const { error: settlementError } = await supabase
      .from("settlements")
      .update({
        paid_amount: nextPaidAmount,
        due_amount: nextDue,
        status: nextStatus,
      })
      .eq("group_id", groupId)
      .eq("month_id", selectedMonthId)
      .eq("member_id", row.id);

    setSavingId(null);

    if (settlementError) {
      alert(settlementError.message);
      return;
    }

    setEntryValues((prev) => ({
      ...prev,
      [row.id]: "0.00",
    }));

    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Closed Month Settlement
            </h1>
            <p className="mt-2 text-slate-600">
              <b>{monthLabel}</b>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Owner, admin and manager can edit. Members can view only.
            </p>
          </div>

          <div className="w-full md:w-[280px]">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Select Closed Month
            </label>
            <select
              value={selectedMonthId}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-600"
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
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total Due</p>
          <h3 className="mt-2 text-2xl font-bold text-red-700">
            ৳ {(totalWillPay + totalWillReceive).toFixed(2)}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Total due = paid amount + remaining
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Paid Amount</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-900">
            ৳ {totalPaidAmount.toFixed(2)}
          </h3>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Remaining</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-900">
            ৳ {totalRemaining.toFixed(2)}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Remaining = total will pay + total will receive
          </p>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-slate-900">Settlement List</h2>
          <p className="mt-1 text-sm text-slate-500">
            Update Paid Amount here. Report page for this same month will update automatically.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-sm text-slate-500">
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
                const rawEntry = Number(entryValues[row.id] ?? 0);
                const safeEntry = Math.max(rawEntry, 0);
                const previewEntry = Math.min(safeEntry, row.remaining);

                const previewPaid = Math.min(
                  row.paidAmount + previewEntry,
                  row.finalAmount
                );

                const previewRemaining = Math.max(row.finalAmount - previewPaid, 0);

                const savedIsDone = row.statusLabel === "Done";

                return (
                  <tr key={row.id} className="bg-slate-50 text-sm text-slate-700">
                    <td className="rounded-l-2xl px-3 py-4 font-semibold text-slate-900">
                      {row.name}
                    </td>

                    <td className="px-3 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          row.finalTypeLabel === "Received"
                            ? "bg-emerald-100 text-emerald-700"
                            : row.finalTypeLabel === "Paid"
                            ? "bg-blue-100 text-blue-700"
                            : row.finalType === "receive"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {row.finalTypeLabel}
                      </span>
                    </td>

                    <td className="px-3 py-4 font-semibold">
                      ৳ {row.finalAmount.toFixed(2)}
                    </td>

                    <td className="px-3 py-4">
                      {canEdit && !savedIsDone ? (
                        <input
                          type="number"
                          min="0"
                          max={row.remaining}
                          step="0.01"
                          value={entryValues[row.id] ?? "0.00"}
                          onChange={(e) => {
                            const nextValue = e.target.value;

                            if (nextValue === "") {
                              setEntryValues((prev) => ({
                                ...prev,
                                [row.id]: "",
                              }));
                              return;
                            }

                            const numericValue = Number(nextValue);

                            if (numericValue > row.remaining) {
                              setEntryValues((prev) => ({
                                ...prev,
                                [row.id]: row.remaining.toFixed(2),
                              }));
                              return;
                            }

                            setEntryValues((prev) => ({
                              ...prev,
                              [row.id]: nextValue,
                            }));
                          }}
                          className="w-[130px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-teal-600"
                        />
                      ) : (
                        <span>৳ {row.paidAmount.toFixed(2)}</span>
                      )}
                    </td>

                    <td className="px-3 py-4">
                      ৳{" "}
                      {(canEdit && !savedIsDone
                        ? previewRemaining
                        : row.remaining
                      ).toFixed(2)}
                    </td>

                    <td className="px-3 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          row.statusLabel === "Done"
                            ? "bg-green-100 text-green-700"
                            : row.statusLabel === "Partial"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {row.statusLabel}
                      </span>
                    </td>

                    {canEdit ? (
                      <td className="rounded-r-2xl px-3 py-4">
                        {!savedIsDone ? (
                          <button
                            type="button"
                            onClick={() => handleSave(row)}
                            disabled={savingId === row.id}
                            className="rounded-2xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingId === row.id ? "Saving..." : "Save"}
                          </button>
                        ) : (
                          <span className="rounded-2xl bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">
                            Closed
                          </span>
                        )}
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
