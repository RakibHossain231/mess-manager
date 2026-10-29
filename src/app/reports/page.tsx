import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
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
  const user = await getAuthUser(supabase);

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
  let dailyMeals: DailyMeal[] = [];
  let memberNames: Record<string, string> = {};
  let trendRows: { month_id: string; total_meal: number; meal_rate: number; bazar_paid: number }[] = [];

  // Common parallel fetches: all members, trend data, and daily meals
  const allMembersPromise = supabase
    .from("members")
    .select("id, full_name, status")
    .eq("group_id", group.id)
    .order("created_at", { ascending: true });

  const trendPromise = supabase
    .from("settlements")
    .select("month_id, total_meal, meal_rate, bazar_paid")
    .eq("group_id", group.id);

  const dailyMealsPromise = supabase
    .from("meal_entries")
    .select("member_id, meal_date, own_meal, guest_meal")
    .eq("month_id", selectedMonth.id);

  if (selectedMonth.status === "closed") {
    const settlementsPromise = supabase
      .from("settlements")
      .select(
        "member_id, total_own_meal, total_guest_meal, meal_rate, bazar_paid, shared_expense, rent, wifi, electricity, water, gas, khala_bill, utility, others, discount, advance, previous_due, final_amount, paid_amount"
      )
      .eq("group_id", group.id)
      .eq("month_id", selectedMonth.id);

    const [allMembersRes, trendRes, dailyMealsRes, settlementsRes] =
      await Promise.all([
        allMembersPromise,
        trendPromise,
        dailyMealsPromise,
        settlementsPromise,
      ]);

    const allMembersData = allMembersRes.data ?? [];
    memberNames = Object.fromEntries(
      allMembersData.map((item: { id: string; full_name: string }) => [item.id, item.full_name])
    );

    const props = settlementsToReportProps(settlementsRes.data ?? [], memberNames);
    members = props.members;
    meals = props.meals;
    expenses = props.expenses;
    charges = props.charges;
    settlements = props.settlementRows;
    dailyMeals = (dailyMealsRes.data ?? []) as DailyMeal[];
    trendRows = trendRes.data ?? [];
  } else {
    const expensesPromise = supabase
      .from("expense_entries")
      .select("expense_type, amount, paid_by_member_id")
      .eq("month_id", selectedMonth.id);

    const chargesPromise = supabase
      .from("member_monthly_charges")
      .select(
        "member_id, rent, wifi, electricity, water, gas, khala_bill, utility, others, advance, discount, previous_due"
      )
      .eq("month_id", selectedMonth.id);

    const [allMembersRes, trendRes, dailyMealsRes, expensesRes, chargesRes] =
      await Promise.all([
        allMembersPromise,
        trendPromise,
        dailyMealsPromise,
        expensesPromise,
        chargesPromise,
      ]);

    const allMembersData = allMembersRes.data ?? [];
    memberNames = Object.fromEntries(
      allMembersData.map((item: { id: string; full_name: string }) => [item.id, item.full_name])
    );

    members = allMembersData
      .filter((item: { status?: string }) => item.status === "active")
      .map((item: { id: string; full_name: string }) => ({ id: item.id, full_name: item.full_name }));

    dailyMeals = (dailyMealsRes.data ?? []) as DailyMeal[];
    meals = dailyMeals;
    expenses = (expensesRes.data ?? []) as ExpenseEntry[];
    charges = (chargesRes.data ?? []) as ChargeRow[];
    trendRows = trendRes.data ?? [];
  }

  // How many day-columns the grid should show. Derive the real length of the
  // selected month from any meal date; fall back to 31 when there is no data.
  const sampleDate = dailyMeals.find((item) => item.meal_date)?.meal_date;
  let daysInMonth = 31;
  if (sampleDate) {
    const [y, m] = sampleDate.slice(0, 10).split("-").map(Number);
    if (y && m) daysInMonth = new Date(y, m, 0).getDate();
  }

  // Cost-per-meal trend: aggregate frozen settlement rows per closed month.
  const trendAgg = new Map<
    string,
    { meals: number; bazar: number; rate: number }
  >();

  trendRows.forEach((item) => {
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
