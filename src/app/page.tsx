import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/app-shell";
import SectionTitle from "@/components/shared/section-title";
import SummaryCard from "@/components/shared/summary-card";
import MonthActions from "@/components/dashboard/month-actions";
import JoinCodeInline from "@/components/shared/join-code-card";
import { cn } from "@/lib/utils";
import {
  Banknote,
  Receipt,
  Users,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { getUserGroupContext } from "@/lib/group-access";

type Member = {
  id: string;
  full_name: string;
};

type Month = {
  id: string;
  label: string;
};

type MealEntry = {
  member_id: string;
  own_meal: number;
  guest_meal: number;
  meal_date: string | null;
};

type ExpenseEntry = {
  expense_type: string;
  title: string;
  amount: number;
  paid_by_member_id: string | null;
};

// Meal grid cell: blank for 0, integer when whole, else one decimal.
const cellMeal = (value: number) => {
  const n = Number(value) || 0;
  if (n === 0) return "";
  return n % 1 === 0 ? String(n) : n.toFixed(1);
};

// Total meals: integer when whole, else one decimal.
const totalMealFmt = (value: number) => {
  const n = Number(value) || 0;
  return n % 1 === 0 ? String(n) : n.toFixed(1);
};

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { group, member } = await getUserGroupContext(supabase, user.id);

  if (!group || !member) {
    redirect("/join");
  }

  const isAdmin =
    member.role === "owner" || member.role === "admin";
  const isPrivileged = isAdmin;
  const canManageMonth = isAdmin;

  const { data: membersData } = await supabase
    .from("members")
    .select("id, full_name")
    .eq("group_id", group.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  const { data: currentMonth } = await supabase
    .from("months")
    .select("id, label")
    .eq("group_id", group.id)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();

  const members: Member[] = membersData ?? [];
  const month: Month | null = currentMonth ?? null;

  let mealEntries: MealEntry[] = [];
  let expenseEntries: ExpenseEntry[] = [];

  if (month) {
    const { data: mealsData } = await supabase
      .from("meal_entries")
      .select("member_id, own_meal, guest_meal, meal_date")
      .eq("month_id", month.id);

    mealEntries = mealsData ?? [];

    const { data: expensesData } = await supabase
      .from("expense_entries")
      .select("expense_type, title, amount, paid_by_member_id")
      .eq("month_id", month.id);

    expenseEntries = expensesData ?? [];
  }

  const totalMembers = members.length;

  const totalMeals = mealEntries.reduce(
    (sum, item) =>
      sum + Number(item.own_meal || 0) + Number(item.guest_meal || 0),
    0
  );

  const totalBazar = expenseEntries
    .filter((item) => item.expense_type === "bazar")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const totalSharedBills = expenseEntries
    .filter((item) => item.expense_type === "shared")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const mealRate = totalMeals > 0 ? totalBazar / totalMeals : 0;
  const perMemberSharedCost =
    totalMembers > 0 ? totalSharedBills / totalMembers : 0;

  const activeSharedBillNames = Array.from(
    new Set(
      expenseEntries
        .filter(
          (item) =>
            item.expense_type === "shared" &&
            Number(item.amount || 0) > 0 &&
            item.title
        )
        .map((item) => item.title)
    )
  );

  const sharedBillsSubtitle =
    activeSharedBillNames.length > 0
      ? activeSharedBillNames.join(", ")
      : "No shared bills added";

  const memberSummaries = members.map((memberItem) => {
    const memberMeals = mealEntries.filter(
      (item) => item.member_id === memberItem.id
    );

    const ownMeal = memberMeals.reduce(
      (sum, item) => sum + Number(item.own_meal || 0),
      0
    );

    const guestMeal = memberMeals.reduce(
      (sum, item) => sum + Number(item.guest_meal || 0),
      0
    );

    const totalMeal = ownMeal + guestMeal;

    const bazarPaid = expenseEntries
      .filter(
        (item) =>
          item.expense_type === "bazar" &&
          item.paid_by_member_id === memberItem.id
      )
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const estimatedMealCost = totalMeal * mealRate;
    const sharedShare = perMemberSharedCost;
    const estimatedBalance = bazarPaid - estimatedMealCost;

    return {
      id: memberItem.id,
      name: memberItem.full_name,
      ownMeal,
      guestMeal,
      totalMeal,
      bazarPaid,
      sharedShare,
      estimatedMealCost,
      estimatedBalance,
    };
  });

  // Day-by-day meal grid: one "Meal" row per member = own + guest meals that
  // day. Derive the month length from any meal date; fall back to 31.
  const sampleDate = mealEntries.find((item) => item.meal_date)?.meal_date;
  let daysInMonth = 31;
  if (sampleDate) {
    const [y, m] = sampleDate.slice(0, 10).split("-").map(Number);
    if (y && m) daysInMonth = new Date(y, m, 0).getDate();
  }
  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const mealGridMap = new Map<string, Map<number, number>>();
  mealEntries.forEach((entry) => {
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

  const mealGridRows = members.map((memberItem) => {
    const perDay = mealGridMap.get(memberItem.id) ?? new Map<number, number>();
    const dayValues = dayNumbers.map((day) => perDay.get(day) ?? 0);
    const rowTotal = dayValues.reduce((sum, value) => sum + value, 0);
    return { id: memberItem.id, name: memberItem.full_name, dayValues, rowTotal };
  });

  const mealGridGrandTotal = mealGridRows.reduce(
    (sum, row) => sum + row.rowTotal,
    0
  );

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <SectionTitle
            title={group.name}
            subtitle="Overview of current month meals, bazar, shared bills, and estimated balances"
            action={
              canManageMonth ? (
                <MonthActions
                  groupId={group.id}
                  currentMonthId={month?.id ?? null}
                  currentMonthLabel={month?.label ?? null}
                  members={members}
                />
              ) : null
            }
          />

          {isAdmin && group.join_code ? (
            <div className="mt-4">
              <JoinCodeInline code={group.join_code} />
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <SummaryCard
            title="Total Members"
            value={String(totalMembers)}
            subtitle="Active members in this mess"
            icon={Users}
          />
          <SummaryCard
            title="Total Bazar"
            value={`৳ ${totalBazar.toFixed(0)}`}
            subtitle="Current month bazar cost"
            icon={Banknote}
          />
          <SummaryCard
            title="Total Meals"
            value={totalMeals.toFixed(1)}
            subtitle="Current open month meals"
            icon={UtensilsCrossed}
          />
          <SummaryCard
            title="Meal Rate"
            value={`৳ ${mealRate.toFixed(2)}`}
            subtitle={month?.label ?? "No open month"}
            icon={Wallet}
          />
          <SummaryCard
            title="Shared Bills"
            value={`৳ ${totalSharedBills.toFixed(0)}`}
            subtitle={sharedBillsSubtitle}
            icon={Receipt}
          />
          <SummaryCard
            title="Per Member Share Bills"
            value={`৳ ${perMemberSharedCost.toFixed(2)}`}
            subtitle="Equal split shared bill"
            icon={Receipt}
          />
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionTitle
            title="Member Live Summary"
            subtitle="Current month meal and bazar summary for each member"
          />

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-sm text-slate-500">
                  <th className="px-4 py-2">Member</th>
                  <th className="px-4 py-2">Own Meal</th>
                  <th className="px-4 py-2">Guest Meal</th>
                  <th className="px-4 py-2">Total Meal</th>
                  <th className="px-4 py-2">Bazar Paid</th>

                  {isPrivileged && (
                    <>
                      <th className="px-4 py-2">Meal Cost</th>
                      <th className="px-4 py-2"> Estimated Balance </th>
                      <th className="px-3 py-2">Status</th>
                    </>
                  )}
                </tr>
              </thead>

              <tbody>
                {memberSummaries.map((item) => (
                  <tr
                    key={item.id}
                    className="rounded-2xl bg-slate-50 text-sm text-slate-700 shadow-sm"
                  >
                    <td className="rounded-l-2xl px-4 py-4 font-semibold text-slate-900">
                      {item.name}
                    </td>
                    <td className="px-4 py-4">{item.ownMeal.toFixed(1)}</td>
                    <td className="px-4 py-4">{item.guestMeal.toFixed(1)}</td>
                    <td className="px-4 py-4 font-medium">
                      {item.totalMeal.toFixed(1)}
                    </td>
                    <td className="px-4 py-4">৳ {item.bazarPaid.toFixed(0)}</td>

                    {isPrivileged && (
                      <>
                        <td className="px-4 py-4">
                          ৳ {item.estimatedMealCost.toFixed(2)}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-4 font-semibold",
                            item.estimatedBalance < 0
                              ? "text-red-500"
                              : item.estimatedBalance > 0
                                ? "text-teal-600"
                                : "text-slate-500"
                          )}
                        >
                          ৳ {item.estimatedBalance.toFixed(2)}
                        </td>
                          <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              item.estimatedBalance >= 0
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {item.estimatedBalance >= 0 ? "Will Receive" : "Will Pay"}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Meal Summary — SS-1 style day-by-day grid, one "Meal" row per member. */}
        {month && members.length > 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Meal Summary
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Day-by-day meals per member for {month.label} (own + guest).
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
        ) : null}

      </div>
    </AppShell>
  );
}