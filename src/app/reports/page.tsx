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
        viewerRole={member.role}
        viewerMemberId={member.id}
        canExport={member.role === "owner" || member.role === "admin"}
      />
    </AppShell>
  );
}
