"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Member = {
  id: string;
  name: string;
  role: "admin" | "manager" | "member";
  monthly_rent: number;
};

type MealEntry = {
  member_id: string;
  own_meal: number;
  guest_meal: number;
};

type ExpenseEntry = {
  category: string;
  amount: number;
  paid_by_member_id: string;
};

type ChargeRow = {
  member_id: string;
  rent_amount: number;
};

type MonthRow = {
  id: string;
  label: string;
  status: "open" | "closed";
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
  viewerRole: "admin" | "manager" | "member";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const canEdit = viewerRole === "admin" || viewerRole === "manager";

  const totalMeals = meals.reduce(
    (sum, item) => sum + Number(item.own_meal || 0) + Number(item.guest_meal || 0),
    0
  );

  const totalBazar = expenses
    .filter((item) => item.category === "bazar")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const totalSharedBills = expenses
    .filter((item) => item.category !== "bazar")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const mealRate = totalMeals > 0 ? totalBazar / totalMeals : 0;
  const perMemberSharedCost =
    members.length > 0 ? totalSharedBills / members.length : 0;

  const chargeMap = new Map(
    charges.map((item) => [item.member_id, Number(item.rent_amount || 0)])
  );

  const settlementMap = new Map(
    settlements.map((item) => [
      item.member_id,
      {
        finalAmount: Number(item.final_amount || 0),
        finalType: item.final_type,
        paidAmount: Number(item.paid_amount || 0),
      },
    ])
  );

  const rows = useMemo(() => {
    return members.map((member) => {
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
          (item) => item.category === "bazar" && item.paid_by_member_id === member.id
        )
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);

      const chargeRent = Number(chargeMap.get(member.id) ?? 0);
      const fallbackRent = Number(member.monthly_rent ?? 0);
      const rent = chargeRent > 0 ? chargeRent : fallbackRent;

      const mealCost = totalMeal * mealRate;
      const sharedShare = perMemberSharedCost;
      const rawFinalBalance = bazarPaid - mealCost - sharedShare - rent;

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
        name: member.name,
        finalType,
        finalAmount,
        paidAmount,
        remaining,
        finalTypeLabel,
        statusLabel,
      };
    });
  }, [members, meals, expenses, chargeMap, mealRate, perMemberSharedCost, settlementMap]);

  // input field = new payment entry, not total paid amount
  const [entryValues, setEntryValues] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((row) => [row.id, "0.00"]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  const totalWillPay = rows
    .filter((row) => row.finalType === "pay")
    .reduce((sum, row) => sum + row.finalAmount, 0);

  const totalWillReceive = rows
    .filter((row) => row.finalType === "receive")
    .reduce((sum, row) => sum + row.finalAmount, 0);

  const totalPaidAmount = rows.reduce((sum, row) => {
    return sum + row.paidAmount;
  }, 0);

  const totalRemaining = rows.reduce((sum, row) => {
    return sum + row.remaining;
  }, 0);

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

    setSavingId(row.id);

    const { error } = await supabase.from("month_settlements").upsert(
      {
        group_id: groupId,
        month_id: selectedMonthId,
        member_id: row.id,
        final_amount: row.finalAmount,
        final_type: row.finalType,
        paid_amount: nextPaidAmount,
      },
      {
        onConflict: "group_id,month_id,member_id",
      }
    );

    setSavingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    // reset entry field after save
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
            <h1 className="text-3xl font-bold text-slate-900">Closed Month Settlement</h1>
            <p className="mt-2 text-slate-600">
              <b>{monthLabel}</b>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Admin and manager can edit. Members can view only.
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
            Total due= Paid amount + remaining
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
            Remaining= Total will pay + total will received
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

                // preview only
                const previewPaid = Math.min(row.paidAmount + previewEntry, row.finalAmount);
                const previewRemaining = Math.max(row.finalAmount - previewPaid, 0);

                // persisted status only
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
                      ৳ {(canEdit && !savedIsDone ? previewRemaining : row.remaining).toFixed(2)}
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