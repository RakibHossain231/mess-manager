"use client";

import { useRouter, useSearchParams } from "next/navigation";
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

type BazarItem = {
  id: string;
  expense_date: string | null;
  title: string | null;
  description: string | null;
  amount: number;
  paid_by_member_id: string | null;
};

type MonthlyTotal = {
  monthId: string;
  label: string;
  totalMeals: number;
  totalBazar: number;
  mealRate: number;
};

type DailyMeal = {
  member_id: string;
  meal_date: string | null;
  own_meal: number;
  guest_meal: number;
};

const chargeCategories = [
  { key: "rent", label: "House Rent" },
  { key: "wifi", label: "WiFi" },
  { key: "utility", label: "Utility" },
  { key: "electricity", label: "Current Bill" },
  { key: "gas", label: "Gas Bill" },
  { key: "water", label: "Pani Bill" },
  { key: "khala_bill", label: "Khala Bill" },
  { key: "others", label: "Others" },
] as const;

const CHARGE_FIELDS = [
  "rent",
  "wifi",
  "utility",
  "electricity",
  "gas",
  "water",
  "khala_bill",
  "others",
] as const;

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Whole-taka amount with thousands separators (deterministic across server /
// client, so no hydration mismatch).
const money = (value: number) =>
  "৳ " + Math.round(Number(value) || 0).toLocaleString("en-US");

// Same, but keeps 2 decimals (used where we intentionally do NOT round).
const money2 = (value: number) =>
  "৳ " +
  (Number(value) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const num1 = (value: number) => (Number(value) || 0).toFixed(1);

// Meal grid cell: blank for 0, integer when whole, else one decimal.
const cellMeal = (value: number) => {
  const n = Number(value) || 0;
  if (n === 0) return "";
  return n % 1 === 0 ? String(n) : n.toFixed(1);
};

const totalMealFmt = (value: number) => {
  const n = Number(value) || 0;
  return n % 1 === 0 ? String(n) : n.toFixed(1);
};

const shortDate = (value: string | null) => {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  const monthIndex = Number(month) - 1;
  if (!day || monthIndex < 0 || monthIndex > 11) return value;
  return `${day} ${MONTH_SHORT[monthIndex]}${year ? ` '${year.slice(2)}` : ""}`;
};

// Small compact metric box used on the summary row.
function StatBox({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "teal" | "amber" | "green" | "red" | "slate";
}) {
  const accentText =
    accent === "teal"
      ? "text-teal-700"
      : accent === "amber"
      ? "text-amber-600"
      : accent === "green"
      ? "text-green-700"
      : accent === "red"
      ? "text-red-700"
      : "text-slate-900";

  return (
    <div className="report-avoid-break rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-lg font-bold ${accentText}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-[10px] text-slate-400">{sub}</p> : null}
    </div>
  );
}

// Horizontal share bar (meal share / bazar contribution).
function ShareBar({
  label,
  valueLabel,
  pct,
  color,
}: {
  label: string;
  valueLabel: string;
  pct: number;
  color: string;
}) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div className="report-avoid-break">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">{valueLabel}</span>
      </div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// Inline SVG line chart for the cost-per-meal trend. SVG prints reliably,
// unlike canvas-based chart libraries.
function TrendChart({
  points,
}: {
  points: { label: string; value: number }[];
}) {
  if (points.length < 2) {
    return (
      <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        Not enough history yet — the trend appears once at least two months are
        closed.
      </p>
    );
  }

  const W = 640;
  const H = 210;
  const padL = 42;
  const padR = 16;
  const padT = 22;
  const padB = 40;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxVal = Math.max(...points.map((p) => p.value), 1);
  const x = (i: number) => padL + (innerW * i) / (points.length - 1);
  const y = (v: number) => padT + innerH - (v / maxVal) * innerH;

  const linePath = points
    .map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        style={{ maxWidth: W }}
      >
        {[0, 0.5, 1].map((g, idx) => {
          const gy = padT + innerH - g * innerH;
          return (
            <g key={idx}>
              <line
                x1={padL}
                y1={gy}
                x2={W - padR}
                y2={gy}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x={padL - 6}
                y={gy + 3}
                textAnchor="end"
                fontSize="9"
                fill="#94a3b8"
              >
                {(maxVal * g).toFixed(1)}
              </text>
            </g>
          );
        })}

        <polyline
          points={linePath}
          fill="none"
          stroke="#0f766e"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r="3.5" fill="#0f766e" />
            <text
              x={x(i)}
              y={y(p.value) - 8}
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fill="#0f172a"
            >
              {p.value.toFixed(1)}
            </text>
            <text
              x={x(i)}
              y={H - padB + 16}
              textAnchor="middle"
              fontSize="9"
              fill="#64748b"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function ReportsView({
  messName,
  monthLabel,
  selectedMonthId,
  selectedMonthStatus,
  months,
  members,
  meals,
  expenses,
  charges,
  settlements,
  bazarItems,
  memberNames,
  monthlyTotals,
  dailyMeals,
  daysInMonth,
  generatedAt,
  viewerRole,
  viewerMemberId,
  canExport,
}: {
  messName: string;
  monthLabel: string;
  selectedMonthId: string;
  selectedMonthStatus: "open" | "closed" | "archived";
  months: MonthRow[];
  members: Member[];
  meals: MealEntry[];
  expenses: ExpenseEntry[];
  charges: ChargeRow[];
  settlements: SettlementRow[];
  bazarItems: BazarItem[];
  memberNames: Record<string, string>;
  monthlyTotals: MonthlyTotal[];
  dailyMeals: DailyMeal[];
  daysInMonth: number;
  generatedAt: string;
  viewerRole: Role;
  viewerMemberId: string;
  canExport: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isMemberView = viewerRole === "member";
  const isClosedMonth = selectedMonthStatus !== "open";

  const totalMeals = meals.reduce(
    (sum, item) =>
      sum + Number(item.own_meal || 0) + Number(item.guest_meal || 0),
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
    members.length > 0 ? totalSharedBills / members.length : 0;

  const chargeMap = new Map(charges.map((item) => [item.member_id, item]));

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

  // Total per charge field across all members, for the shared-bills status table.
  const chargeFieldMap = new Map<string, number>();
  charges.forEach((item) => {
    CHARGE_FIELDS.forEach((key) => {
      chargeFieldMap.set(
        key,
        (chargeFieldMap.get(key) ?? 0) + Number(item[key] || 0)
      );
    });
  });

  const rows = members.map((member) => {
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

    const chargeRow = chargeMap.get(member.id);

    const rent = chargeRow ? Number(chargeRow.rent || 0) : 0;

    const otherCharges = chargeRow
      ? Number(chargeRow.wifi || 0) +
        Number(chargeRow.electricity || 0) +
        Number(chargeRow.water || 0) +
        Number(chargeRow.gas || 0) +
        Number(chargeRow.khala_bill || 0) +
        Number(chargeRow.utility || 0) +
        Number(chargeRow.others || 0)
      : 0;

    // Reference formula: Meal Cost + rent + wifi + electricity + gas + water +
    // khala + utility + others - advance - discount + previous_due
    const chargesTotal = chargeRow
      ? rent +
        otherCharges -
        Number(chargeRow.discount || 0) -
        Number(chargeRow.advance || 0) +
        Number(chargeRow.previous_due || 0)
      : 0;

    const mealCost = totalMeal * mealRate;
    const sharedShare = perMemberSharedCost;
    const rawFinalBalance = bazarPaid - mealCost - sharedShare - chargesTotal;

    const computedFinalType: "pay" | "receive" =
      rawFinalBalance >= 0 ? "receive" : "pay";
    const computedFinalAmount = Math.abs(rawFinalBalance);

    const savedSettlement = settlementMap.get(member.id);

    const settlementFinalType =
      isClosedMonth && savedSettlement
        ? savedSettlement.finalType
        : computedFinalType;

    const settlementFinalAmount =
      isClosedMonth && savedSettlement
        ? savedSettlement.finalAmount
        : computedFinalAmount;

    const paidAmount = isClosedMonth
      ? Number(savedSettlement?.paidAmount ?? 0)
      : 0;
    const remaining = Math.max(settlementFinalAmount - paidAmount, 0);

    const settlementTypeLabel =
      remaining <= 0
        ? settlementFinalType === "receive"
          ? "Received"
          : "Paid"
        : settlementFinalType === "receive"
        ? "Will Receive"
        : "Will Pay";

    const settlementStatus =
      remaining <= 0 && settlementFinalAmount > 0
        ? "Done"
        : paidAmount > 0
        ? "Partial"
        : "Pending";

    return {
      id: member.id,
      name: member.full_name,
      ownMeal,
      guestMeal,
      totalMeal,
      bazarPaid,
      rent,
      otherCharges,
      chargesTotal,
      mealCost,
      sharedShare,
      rawFinalBalance,
      settlementFinalType,
      settlementFinalAmount,
      paidAmount,
      remaining,
      settlementTypeLabel,
      settlementStatus,
    };
  });

  const totalRent = rows.reduce((sum, row) => sum + Number(row.rent || 0), 0);
  const totalOtherCharges = rows.reduce(
    (sum, row) => sum + Number(row.otherCharges || 0),
    0
  );
  const totalMealCost = rows.reduce((sum, row) => sum + row.mealCost, 0);

  const totalFixedCharges = rows.reduce(
    (sum, row) => sum + Number(row.chargesTotal || 0),
    0
  );

  const totalWillReceive = rows
    .filter((row) => row.rawFinalBalance > 0)
    .reduce((sum, row) => sum + row.rawFinalBalance, 0);

  const totalWillPay = rows
    .filter((row) => row.rawFinalBalance < 0)
    .reduce((sum, row) => sum + Math.abs(row.rawFinalBalance), 0);

  const totalCharges = totalSharedBills + totalFixedCharges + totalWillReceive;
  const balanceDifference = Math.abs(totalCharges - totalWillPay);
  const isBalanced = balanceDifference < 0.01;

  // Highlights.
  const rankByMeal = [...rows].sort((a, b) => b.totalMeal - a.totalMeal);
  const rankByBazar = [...rows].sort((a, b) => b.bazarPaid - a.bazarPaid);
  const topMeal = rankByMeal[0];
  const topBazar = rankByBazar[0];

  // Cost-per-meal trend points (append the live open month when it isn't
  // frozen yet so the current month is always the last point).
  const trendPoints = (() => {
    const base = monthlyTotals.map((item) => ({
      label: item.label,
      value:
        item.mealRate ||
        (item.totalMeals > 0 ? item.totalBazar / item.totalMeals : 0),
    }));

    if (
      !isClosedMonth &&
      !monthlyTotals.some((item) => item.monthId === selectedMonthId)
    ) {
      base.push({ label: monthLabel, value: mealRate });
    }

    return base.slice(-6);
  })();

  const currentRate =
    trendPoints.length > 0 ? trendPoints[trendPoints.length - 1].value : mealRate;
  const previousRate =
    trendPoints.length > 1 ? trendPoints[trendPoints.length - 2].value : null;
  const rateDeltaPct =
    previousRate && previousRate > 0
      ? ((currentRate - previousRate) / previousRate) * 100
      : null;

  const bazarItemsTotal = bazarItems.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  // Day-by-day meal grid: one "Meal" row per member showing that day's total
  // (own + guest) meals, plus a per-member and grand total.
  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const mealGridMap = new Map<string, Map<number, number>>();
  dailyMeals.forEach((entry) => {
    if (!entry.meal_date) return;
    const day = Number(entry.meal_date.slice(8, 10));
    if (!day) return;
    const value = Number(entry.own_meal || 0) + Number(entry.guest_meal || 0);
    if (!mealGridMap.has(entry.member_id)) {
      mealGridMap.set(entry.member_id, new Map());
    }
    const perDay = mealGridMap.get(entry.member_id)!;
    perDay.set(day, (perDay.get(day) ?? 0) + value);
  });

  const mealGridRows = rows.map((row) => {
    const perDay = mealGridMap.get(row.id) ?? new Map<number, number>();
    const dayValues = dayNumbers.map((day) => perDay.get(day) ?? 0);
    const rowTotal = dayValues.reduce((sum, value) => sum + value, 0);
    return { id: row.id, name: row.name, dayValues, rowTotal };
  });

  const mealGridGrandTotal = mealGridRows.reduce(
    (sum, row) => sum + row.rowTotal,
    0
  );

  const myRow =
    rows.find((row) => row.id === viewerMemberId) ?? {
      id: viewerMemberId,
      name: "My Report",
      ownMeal: 0,
      guestMeal: 0,
      totalMeal: 0,
      bazarPaid: 0,
      rent: 0,
      otherCharges: 0,
      chargesTotal: 0,
      mealCost: 0,
      sharedShare: perMemberSharedCost,
      rawFinalBalance: 0,
      settlementFinalType: "pay" as const,
      settlementFinalAmount: 0,
      paidAmount: 0,
      remaining: 0,
      settlementTypeLabel: "Will Pay",
      settlementStatus: "Pending",
    };

  const handleMonthChange = (monthId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", monthId);
    router.push(`/reports?${params.toString()}`);
  };

  const statusChip =
    selectedMonthStatus === "open"
      ? "Open"
      : selectedMonthStatus === "archived"
      ? "Archived"
      : "Closed";

  return (
    <div className="space-y-6">
      {/* Controls — screen only, hidden from the printed report. */}
      <div className="print:hidden flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:w-[260px]">
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Select Month
          </label>
          <select
            value={selectedMonthId}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-600"
          >
            {months.map((month) => (
              <option key={month.id} value={month.id}>
                {month.label}{" "}
                {month.status === "open"
                  ? "(Open)"
                  : month.status === "archived"
                  ? "(Archived)"
                  : "(Closed)"}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            Role: {viewerRole} {canExport ? "· Export allowed" : "· View only"}
          </span>
          {canExport ? (
            <button
              onClick={() => window.print()}
              className="rounded-2xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              Print / Save PDF
            </button>
          ) : null}
        </div>
      </div>

      {!canExport ? (
        <div className="print:hidden rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
          Only admin can print or save the PDF. Others can view the report only.
        </div>
      ) : null}

      {/* Report header — the PDF cover heading. */}
      <div className="report-avoid-break overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-teal-700 px-6 py-8 text-center text-white">
          <h1 className="text-3xl font-extrabold tracking-tight">{messName}</h1>
          <p className="mt-1 text-sm font-medium text-teal-100">
            Monthly Settlement Report
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 px-6 py-3 text-sm text-slate-600">
          <span>
            <b className="text-slate-800">Month:</b> {monthLabel}
          </span>
          <span>
            <b className="text-slate-800">Status:</b> {statusChip}
          </span>
          <span>
            <b className="text-slate-800">Members:</b> {rows.length}
          </span>
          <span>
            <b className="text-slate-800">Generated:</b> {generatedAt}
          </span>
        </div>
      </div>

      {isMemberView ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Meal Rate</p>
              <h3 className="mt-2 text-2xl font-bold text-slate-900">
                {money2(mealRate)}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {monthLabel} meal rate
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">My Final Status</p>
              <h3
                className={`mt-2 text-2xl font-bold ${
                  myRow.rawFinalBalance >= 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                {myRow.rawFinalBalance >= 0 ? "+" : "-"}
                {money(Math.abs(myRow.rawFinalBalance))}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {myRow.rawFinalBalance >= 0
                  ? "You will receive (+ve)"
                  : "You will pay (-ve)"}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Paid Amount</p>
              <h3 className="mt-2 text-2xl font-bold text-slate-900">
                {money2(myRow.paidAmount)}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {isClosedMonth
                  ? "Updated from payment"
                  : "Available after month close"}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Remaining</p>
              <h3 className="mt-2 text-2xl font-bold text-slate-900">
                {money2(myRow.remaining)}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {myRow.settlementStatus}
              </p>
            </div>
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900">
                My Monthly Summary
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                You can view your own report details and payment-based
                settlement status.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Own Meal</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  {num1(myRow.ownMeal)}
                </h3>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Guest Meal</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  {num1(myRow.guestMeal)}
                </h3>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Total Meal</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  {num1(myRow.totalMeal)}
                </h3>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Bazar Paid</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  {money(myRow.bazarPaid)}
                </h3>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Meal Cost</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  {money2(myRow.mealCost)}
                </h3>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Shared Share</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  {money2(myRow.sharedShare)}
                </h3>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">All Charges</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  {money2(myRow.chargesTotal)}
                </h3>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Payment Summary</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  {myRow.settlementStatus}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Paid: {money2(myRow.paidAmount)} · Remaining:{" "}
                  {money2(myRow.remaining)}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900">Charges Status</h2>
              <p className="mt-1 text-sm text-slate-500">
                Charge categories for this month.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-sm text-slate-500">
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {chargeCategories.map((item) => {
                    const amount = Number(chargeFieldMap.get(item.key) ?? 0);
                    const added = amount > 0;

                    return (
                      <tr
                        key={item.key}
                        className="bg-slate-50 text-sm text-slate-700"
                      >
                        <td className="rounded-l-2xl px-3 py-4 font-semibold text-slate-900">
                          {item.label}
                        </td>
                        <td className="px-3 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              added
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {added ? "Added" : "Not Added"}
                          </span>
                        </td>
                        <td className="rounded-r-2xl px-3 py-4">
                          {money(amount)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50 text-sm text-slate-700">
                    <td className="rounded-l-2xl px-3 py-4 font-semibold text-slate-900">
                      Shared Expense
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          totalSharedBills > 0
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {totalSharedBills > 0 ? "Added" : "Not Added"}
                      </span>
                    </td>
                    <td className="rounded-r-2xl px-3 py-4">
                      {money(totalSharedBills)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <>
          {/* Compact summary stat boxes. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatBox
              label="Total Meals"
              value={num1(totalMeals)}
              accent="teal"
            />
            <StatBox label="Total Bazar" value={money(totalBazar)} accent="amber" />
            <StatBox
              label="Meal Rate"
              value={money2(mealRate)}
              sub="per meal"
              accent="teal"
            />
            <StatBox
              label="Shared Bills"
              value={money(totalSharedBills)}
              sub={`per head ${money2(perMemberSharedCost)}`}
            />
            <StatBox label="House Rent" value={money(totalRent)} />
            <StatBox label="Members" value={String(rows.length)} />
          </div>

          {/* Highlights. */}
          {rows.length > 0 ? (
            <div className="report-avoid-break grid grid-cols-1 gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
              <div className="rounded-2xl bg-teal-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                  Top Meal
                </p>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {topMeal.name}
                </p>
                <p className="text-xs text-slate-500">
                  {num1(topMeal.totalMeal)} meals
                </p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Top Bazar Contributor
                </p>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {topBazar.name}
                </p>
                <p className="text-xs text-slate-500">
                  {money(topBazar.bazarPaid)}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Cost / Meal
                </p>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {money2(mealRate)}
                </p>
                <p className="text-xs text-slate-500">
                  {rateDeltaPct === null
                    ? "no previous month"
                    : `${rateDeltaPct >= 0 ? "▲ +" : "▼ "}${rateDeltaPct.toFixed(
                        1
                      )}% vs last month`}
                </p>
              </div>
            </div>
          ) : null}

          {/* Final settlement — the detailed table. */}
          <div className="report-break-before rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-900">
                Final Settlement
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Final = Bazar Paid − (Meal Cost + Shared Bill + House Rent +
                Other Charges). (+ve) = will receive, (-ve) = will pay.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2 font-semibold">Name</th>
                    <th className="px-2 py-2 text-right font-semibold">Own</th>
                    <th className="px-2 py-2 text-right font-semibold">Guest</th>
                    <th className="px-2 py-2 text-right font-semibold">Total</th>
                    <th className="px-2 py-2 text-right font-semibold">
                      Meal Cost
                    </th>
                    <th className="px-2 py-2 text-right font-semibold">Bazar</th>
                    <th className="px-2 py-2 text-right font-semibold">Shared</th>
                    <th className="px-2 py-2 text-right font-semibold">Rent</th>
                    <th className="px-2 py-2 text-right font-semibold">Other</th>
                    <th className="px-2 py-2 text-right font-semibold">Final</th>
                    <th className="px-2 py-2 font-semibold">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => {
                    const finalRounded = Math.round(row.rawFinalBalance);
                    const receive = row.rawFinalBalance >= 0;
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-slate-100 text-slate-700"
                      >
                        <td className="px-2 py-3 font-semibold text-slate-900">
                          {row.name}
                        </td>
                        <td className="px-2 py-3 text-right">
                          {num1(row.ownMeal)}
                        </td>
                        <td className="px-2 py-3 text-right">
                          {num1(row.guestMeal)}
                        </td>
                        <td className="px-2 py-3 text-right">
                          {num1(row.totalMeal)}
                        </td>
                        <td className="px-2 py-3 text-right">
                          {money2(row.mealCost)}
                        </td>
                        <td className="px-2 py-3 text-right">
                          {money2(row.bazarPaid)}
                        </td>
                        <td className="px-2 py-3 text-right">
                          {money2(row.sharedShare)}
                        </td>
                        <td className="px-2 py-3 text-right">
                          {money2(row.rent)}
                        </td>
                        <td className="px-2 py-3 text-right">
                          {money2(row.otherCharges)}
                        </td>
                        <td
                          className={`px-2 py-3 text-right font-bold ${
                            receive ? "text-green-700" : "text-red-700"
                          }`}
                        >
                          {receive ? "+" : "-"}৳{" "}
                          {Math.abs(finalRounded).toLocaleString("en-US")}
                        </td>
                        <td
                          className={`px-2 py-3 font-semibold ${
                            receive ? "text-green-700" : "text-red-700"
                          }`}
                        >
                          {receive ? "Will Receive" : "Will Pay"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr className="border-t-2 border-slate-300 font-bold text-slate-900">
                    <td className="px-2 py-3">Total</td>
                    <td className="px-2 py-3 text-right">
                      {num1(rows.reduce((s, r) => s + r.ownMeal, 0))}
                    </td>
                    <td className="px-2 py-3 text-right">
                      {num1(rows.reduce((s, r) => s + r.guestMeal, 0))}
                    </td>
                    <td className="px-2 py-3 text-right">{num1(totalMeals)}</td>
                    <td className="px-2 py-3 text-right">
                      {money2(totalMealCost)}
                    </td>
                    <td className="px-2 py-3 text-right">{money2(totalBazar)}</td>
                    <td className="px-2 py-3 text-right">
                      {money2(totalSharedBills)}
                    </td>
                    <td className="px-2 py-3 text-right">{money2(totalRent)}</td>
                    <td className="px-2 py-3 text-right">
                      {money2(totalOtherCharges)}
                    </td>
                    <td className="px-2 py-3 text-right">—</td>
                    <td className="px-2 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>


          {/* Overall / balance check. */}
          <section className="report-avoid-break space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Overall Check</h2>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                <p className="text-sm text-green-700">Total Will Receive</p>
                <h3 className="mt-2 text-2xl font-bold text-green-700">
                  {money2(totalWillReceive)}
                </h3>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">Total Will Pay</p>
                <h3 className="mt-2 text-2xl font-bold text-red-700">
                  {money2(totalWillPay)}
                </h3>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Total Charges</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">
                  {money2(totalCharges)}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Shared + Charges + Will Receive
                </p>
              </div>
            </div>

            <div
              className={`rounded-2xl border p-5 shadow-sm ${
                isBalanced
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <p
                className={`text-sm font-semibold ${
                  isBalanced ? "text-green-700" : "text-red-700"
                }`}
              >
                Balance Check: {isBalanced ? "Balanced ✅" : "Not Balanced ❌"}
              </p>
              <p
                className={`mt-2 text-sm ${
                  isBalanced ? "text-green-700" : "text-red-700"
                }`}
              >
                Total Charge = {money2(totalCharges)} · All members Will Pay ={" "}
                {money2(totalWillPay)}
              </p>
              {!isBalanced ? (
                <p className="mt-1 text-xs text-red-600">
                  Difference: {money2(balanceDifference)}. Meal, bazar, shared
                  bill, or charges data check koro.
                </p>
              ) : null}
            </div>
          </section>

          {/* Analysis: cost-per-meal trend + meal share + bazar contribution. */}
          <section className="report-avoid-break space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Analysis</h2>
              <p className="mt-1 text-sm text-slate-500">
                Cost-per-meal trend, meal share and bazar contribution.
              </p>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-800">
                  Cost per Meal — last {trendPoints.length} month
                  {trendPoints.length === 1 ? "" : "s"}
                </h3>
                {rateDeltaPct !== null ? (
                  <span
                    className={`text-xs font-semibold ${
                      rateDeltaPct >= 0 ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {rateDeltaPct >= 0 ? "▲ +" : "▼ "}
                    {rateDeltaPct.toFixed(1)}% vs previous
                  </span>
                ) : null}
              </div>
              <TrendChart points={trendPoints} />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm font-semibold text-slate-800">
                  Meal Share by Member
                </h3>
                <div className="space-y-2.5">
                  {rankByMeal.map((row) => (
                    <ShareBar
                      key={row.id}
                      label={row.name}
                      valueLabel={`${num1(row.totalMeal)} · ${
                        totalMeals > 0
                          ? ((row.totalMeal / totalMeals) * 100).toFixed(0)
                          : "0"
                      }%`}
                      pct={totalMeals > 0 ? (row.totalMeal / totalMeals) * 100 : 0}
                      color="#0d9488"
                    />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-slate-800">
                  Bazar Contribution by Member
                </h3>
                <div className="space-y-2.5">
                  {rankByBazar.map((row) => (
                    <ShareBar
                      key={row.id}
                      label={row.name}
                      valueLabel={`${money(row.bazarPaid)} · ${
                        totalBazar > 0
                          ? ((row.bazarPaid / totalBazar) * 100).toFixed(0)
                          : "0"
                      }%`}
                      pct={totalBazar > 0 ? (row.bazarPaid / totalBazar) * 100 : 0}
                      color="#f59e0b"
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Meal summary — SS-1 style day-by-day grid, one "Meal" row per member. */}
          <section className="report-break-before rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Meal Summary
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Day-by-day meals per member for {monthLabel} (own + guest).
                </p>
              </div>
              <p className="rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-700">
                Grand Total Meals: {totalMealFmt(mealGridGrandTotal)}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th className="sticky left-0 z-10 border border-slate-200 bg-slate-50 px-2 py-1.5 text-left font-semibold">
                      Member
                    </th>
                    <th className="border border-slate-200 px-1.5 py-1.5 font-semibold">
                      Type
                    </th>
                    <th className="border border-slate-200 px-1.5 py-1.5 text-right font-semibold">
                      Total
                    </th>
                    {dayNumbers.map((day) => (
                      <th
                        key={day}
                        className="border border-slate-200 px-1 py-1.5 text-center font-semibold"
                      >
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mealGridRows.map((row) => (
                    <tr key={row.id} className="text-slate-700">
                      <td className="sticky left-0 z-10 whitespace-nowrap border border-slate-200 bg-white px-2 py-1.5 font-medium text-slate-900">
                        {row.name}
                      </td>
                      <td className="border border-slate-200 px-1.5 py-1.5 text-center text-slate-500">
                        Meal
                      </td>
                      <td className="border border-slate-200 px-1.5 py-1.5 text-right font-semibold text-slate-900">
                        {totalMealFmt(row.rowTotal)}
                      </td>
                      {row.dayValues.map((value, index) => (
                        <td
                          key={index}
                          className="border border-slate-200 px-1 py-1.5 text-center"
                        >
                          {cellMeal(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold text-slate-900">
                    <td className="sticky left-0 z-10 border border-slate-200 bg-slate-50 px-2 py-1.5">
                      Grand Total
                    </td>
                    <td className="border border-slate-200 px-1.5 py-1.5" />
                    <td className="border border-slate-200 px-1.5 py-1.5 text-right">
                      {totalMealFmt(mealGridGrandTotal)}
                    </td>
                    {dayNumbers.map((day, index) => {
                      const dayTotal = mealGridRows.reduce(
                        (sum, row) => sum + row.dayValues[index],
                        0
                      );
                      return (
                        <td
                          key={day}
                          className="border border-slate-200 px-1 py-1.5 text-center"
                        >
                          {cellMeal(dayTotal)}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          

          {/* Itemized bazar list. */}
          <section className="report-avoid-break rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900">
                Bazar Details
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Every bazar purchase for {monthLabel}.
              </p>
            </div>

            {bazarItems.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                No bazar entries recorded for this month.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2 font-semibold">Date</th>
                      <th className="px-2 py-2 font-semibold">Paid By</th>
                      <th className="px-2 py-2 font-semibold">Item</th>
                      <th className="px-2 py-2 text-right font-semibold">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bazarItems.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100 text-slate-700"
                      >
                        <td className="whitespace-nowrap px-2 py-2.5">
                          {shortDate(item.expense_date)}
                        </td>
                        <td className="px-2 py-2.5">
                          {item.paid_by_member_id
                            ? memberNames[item.paid_by_member_id] ?? "Unknown"
                            : "—"}
                        </td>
                        <td className="px-2 py-2.5">
                          <span className="font-medium text-slate-900">
                            {item.title || "Bazar"}
                          </span>
                          {item.description ? (
                            <span className="block text-xs text-slate-400">
                              {item.description}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          {money(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 font-bold text-slate-900">
                      <td className="px-2 py-3" colSpan={3}>
                        Total Bazar
                      </td>
                      <td className="px-2 py-3 text-right">
                        {money(bazarItemsTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {/* Charges status. */}
          <section className="report-avoid-break rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900">Charges Status</h2>
              <p className="mt-1 text-sm text-slate-500">
                Missing categories are shown as not added and treated as 0 in
                this report.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 font-semibold">Category</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {chargeCategories.map((item) => {
                    const amount = Number(chargeFieldMap.get(item.key) ?? 0);
                    const added = amount > 0;

                    return (
                      <tr
                        key={item.key}
                        className="border-b border-slate-100 text-slate-700"
                      >
                        <td className="px-3 py-2.5 font-semibold text-slate-900">
                          {item.label}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              added
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {added ? "Added" : "Not Added"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {money(amount)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-b border-slate-100 text-slate-700">
                    <td className="px-3 py-2.5 font-semibold text-slate-900">
                      Shared Expense
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          totalSharedBills > 0
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {totalSharedBills > 0 ? "Added" : "Not Added"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {money(totalSharedBills)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
