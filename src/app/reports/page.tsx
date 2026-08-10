import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/app-shell";
import ReportsView from "@/app/reports/reports-view";
import { getUserGroupContext } from "@/lib/group-access";
import { settlementsToReportProps } from "@/lib/report-snapshot";

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
  status: "open" | "closed";
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

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string }>;
}) {
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

  const params = searchParams ? await searchParams : {};
  const selectedMonthIdFromQuery = params?.month;

  const { data: monthsData } = await supabase
    .from("months")
    .select("id, label, status, created_at")
    .eq("group_id", group.id)
    .order("created_at", { ascending: false });

  const months: MonthRow[] = (monthsData ?? []) as MonthRow[];

  if (months.length === 0) {
    return (
      <AppShell>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Monthly Report</h1>
          <p className="mt-2 text-slate-600">No month found.</p>
        </div>
      </AppShell>
    );
  }

  const openMonth = months.find((item) => item.status === "open");
  const selectedMonth =
    months.find((item) => item.id === selectedMonthIdFromQuery) ??
    openMonth ??
    months[0];

  let members: Member[] = [];
  let meals: MealEntry[] = [];
  let expenses: ExpenseEntry[] = [];
  let charges: ChargeRow[] = [];
  let settlements: SettlementRow[] = [];

  if (selectedMonth.status === "closed") {
    // Closed months are frozen: read the per-member settlement rows saved at
    // close time and reconstruct the report shape from them.
    const { data: settlementsData } = await supabase
      .from("settlements")
      .select(
        "member_id, total_own_meal, total_guest_meal, meal_rate, bazar_paid, shared_expense, rent, wifi, electricity, water, gas, khala_bill, utility, others, discount, advance, previous_due, final_amount, paid_amount"
      )
      .eq("group_id", group.id)
      .eq("month_id", selectedMonth.id);

    const { data: membersData } = await supabase
      .from("members")
      .select("id, full_name")
      .eq("group_id", group.id);

    const nameMap = Object.fromEntries(
      (membersData ?? []).map((item) => [item.id, item.full_name])
    );

    const props = settlementsToReportProps(settlementsData ?? [], nameMap);

    members = props.members;
    meals = props.meals;
    expenses = props.expenses;
    charges = props.charges;
    settlements = props.settlementRows;
  } else {
    const { data: membersData } = await supabase
      .from("members")
      .select("id, full_name")
      .eq("group_id", group.id)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    const { data: mealsData } = await supabase
      .from("meal_entries")
      .select("member_id, own_meal, guest_meal")
      .eq("month_id", selectedMonth.id);

    const { data: expensesData } = await supabase
      .from("expense_entries")
      .select("expense_type, amount, paid_by_member_id")
      .eq("month_id", selectedMonth.id);

    const { data: chargesData } = await supabase
      .from("member_monthly_charges")
      .select(
        "member_id, rent, wifi, electricity, water, gas, khala_bill, utility, others, advance, discount, previous_due"
      )
      .eq("month_id", selectedMonth.id);

    members = (membersData ?? []) as Member[];
    meals = (mealsData ?? []) as MealEntry[];
    expenses = (expensesData ?? []) as ExpenseEntry[];
    charges = (chargesData ?? []) as ChargeRow[];
  }

  // All member names for the group (used to label the itemized bazar list,
  // including members who have since left).
  const { data: allMembersData } = await supabase
    .from("members")
    .select("id, full_name")
    .eq("group_id", group.id);

  const memberNames: Record<string, string> = Object.fromEntries(
    (allMembersData ?? []).map((item) => [item.id, item.full_name])
  );

  // Itemized bazar list for the selected month. Read straight from
  // expense_entries so we keep the per-purchase detail (date / item / who)
  // that the frozen settlement snapshot collapses into a single total.
  const { data: bazarItemsData } = await supabase
    .from("expense_entries")
    .select("id, expense_date, title, description, amount, paid_by_member_id")
    .eq("month_id", selectedMonth.id)
    .eq("expense_type", "bazar")
    .order("expense_date", { ascending: true });

  const bazarItems: BazarItem[] = (bazarItemsData ?? []) as BazarItem[];

  // Per-day meal entries for the selected month, used to build the day-by-day
  // meal grid (one "Meal" row per member = own + guest meals that day).
  const { data: dailyMealsData } = await supabase
    .from("meal_entries")
    .select("member_id, meal_date, own_meal, guest_meal")
    .eq("month_id", selectedMonth.id);

  const dailyMeals: DailyMeal[] = (dailyMealsData ?? []) as DailyMeal[];

  // How many day-columns the grid should show. Derive the real length of the
  // selected month from any meal date; fall back to 31 when there is no data.
  const sampleDate = dailyMeals.find((item) => item.meal_date)?.meal_date;
  let daysInMonth = 31;
  if (sampleDate) {
    const [y, m] = sampleDate.slice(0, 10).split("-").map(Number);
    if (y && m) daysInMonth = new Date(y, m, 0).getDate();
  }

  // Cost-per-meal trend: aggregate frozen settlement rows per closed month.
  const { data: trendData } = await supabase
    .from("settlements")
    .select("month_id, total_meal, meal_rate, bazar_paid")
    .eq("group_id", group.id);

  const trendAgg = new Map<
    string,
    { meals: number; bazar: number; rate: number }
  >();

  (trendData ?? []).forEach((item) => {
    const current = trendAgg.get(item.month_id) ?? {
      meals: 0,
      bazar: 0,
      rate: 0,
    };
    current.meals += Number(item.total_meal || 0);
    current.bazar += Number(item.bazar_paid || 0);
    current.rate = Number(item.meal_rate || 0) || current.rate;
    trendAgg.set(item.month_id, current);
  });

  // months is ordered created_at desc; reverse it so the trend reads oldest -> newest.
  const monthlyTotals: MonthlyTotal[] = [...months]
    .reverse()
    .filter((month) => trendAgg.has(month.id))
    .map((month) => {
      const agg = trendAgg.get(month.id)!;
      return {
        monthId: month.id,
        label: month.label,
        totalMeals: agg.meals,
        totalBazar: agg.bazar,
        mealRate: agg.rate,
      };
    });

  const generatedAt = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <AppShell>
      <ReportsView
        messName={group.name}
        monthLabel={selectedMonth.label}
        selectedMonthId={selectedMonth.id}
        selectedMonthStatus={selectedMonth.status}
        months={months}
        members={members}
        meals={meals}
        expenses={expenses}
        charges={charges}
        settlements={settlements}
        bazarItems={bazarItems}
        memberNames={memberNames}
        monthlyTotals={monthlyTotals}
        dailyMeals={dailyMeals}
        daysInMonth={daysInMonth}
        generatedAt={generatedAt}
        viewerRole={member.role}
        viewerMemberId={member.id}
        canExport={member.role === "owner" || member.role === "admin"}
      />
    </AppShell>
  );
}
