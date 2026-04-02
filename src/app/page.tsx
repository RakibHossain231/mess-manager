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
  name: string;
  monthly_rent: number;
};

type Month = {
  id: string;
  label: string;
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

  const isAdmin = member.role === "admin";
  const isPrivileged = isAdmin;
  const canManageMonth = isAdmin;

  const { data: membersData } = await supabase
    .from("members")
    .select("id, name, monthly_rent")
    .eq("group_id", group.id)
    .eq("is_active", true)
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
      .select("member_id, own_meal, guest_meal")
      .eq("month_id", month.id);

    mealEntries = mealsData ?? [];

    const { data: expensesData } = await supabase
      .from("expense_entries")
      .select("category, amount, paid_by_member_id")
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
    .filter((item) => item.category === "bazar")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const totalSharedBills = expenseEntries
    .filter((item) => item.category !== "bazar")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const mealRate = totalMeals > 0 ? totalBazar / totalMeals : 0;
  const perMemberSharedCost =
    totalMembers > 0 ? totalSharedBills / totalMembers : 0;

  const sharedBillLabelMap: Record<string, string> = {
    wifi: "WiFi",
    utility: "Utility",
    electricity: "Electricity",
    gas: "Gas",
    bua: "Bua",
    moyla: "Molya",
    pani: "Pani"
  };

  const activeSharedBillNames = Array.from(
    new Set(
      expenseEntries
        .filter(
          (item) =>
            item.category !== "bazar" &&
            Number(item.amount || 0) > 0 &&
            sharedBillLabelMap[item.category]
        )
        .map((item) => sharedBillLabelMap[item.category])
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
          item.category === "bazar" &&
          item.paid_by_member_id === memberItem.id
      )
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const estimatedMealCost = totalMeal * mealRate;
    const sharedShare = perMemberSharedCost;
    const estimatedBalance = bazarPaid - estimatedMealCost - sharedShare;

    return {
      id: memberItem.id,
      name: memberItem.name,
      ownMeal,
      guestMeal,
      totalMeal,
      bazarPaid,
      sharedShare,
      estimatedMealCost,
      estimatedBalance,
    };
  });

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
                  members={members.map((item) => ({
                    id: item.id,
                    monthly_rent: Number(item.monthly_rent || 0),
                  }))}
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
            subtitle="Current month meal, bazar, and shared bill summary for each member"
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
                      <th className="px-4 py-2">Shared Cost</th>
                      <th className="px-4 py-2">Meal Cost</th>
                      <th className="px-4 py-2"> Estimated Balance </th>
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
                          ৳ {item.sharedShare.toFixed(2)}
                        </td>
                        <td className="px-4 py-4">
                          ৳ {item.estimatedMealCost.toFixed(2)}
                        </td>
                        <td
                          className={cn(
                            "rounded-r-2xl px-4 py-4 font-semibold",
                            item.estimatedBalance < 0
                              ? "text-red-500"
                              : item.estimatedBalance > 0
                                ? "text-teal-600"
                                : "text-slate-500"
                          )}
                        >
                          ৳ {item.estimatedBalance.toFixed(2)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}