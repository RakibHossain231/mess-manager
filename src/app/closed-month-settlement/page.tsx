import { redirect } from "next/navigation";
import AppShell from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getUserGroupContext } from "@/lib/group-access";
import ClosedMonthSettlementView from "./closed-month-settlement-view";

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

export default async function ClosedMonthSettlementPage({
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
    .eq("status", "closed")
    .order("created_at", { ascending: false });

  const closedMonths: MonthRow[] = (monthsData ?? []) as MonthRow[];

  if (closedMonths.length === 0) {
    return (
      <AppShell>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Closed Month Settlement</h1>
          <p className="mt-2 text-slate-600">
            No closed month found. Close a month first, then settlement will appear here.
          </p>
        </div>
      </AppShell>
    );
  }

  const selectedMonth =
    closedMonths.find((item) => item.id === selectedMonthIdFromQuery) ?? closedMonths[0];

  const { data: membersData } = await supabase
    .from("members")
    .select("id, name, role, monthly_rent")
    .eq("group_id", group.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const { data: mealsData } = await supabase
    .from("meal_entries")
    .select("member_id, own_meal, guest_meal")
    .eq("month_id", selectedMonth.id);

  const { data: expensesData } = await supabase
    .from("expense_entries")
    .select("category, amount, paid_by_member_id")
    .eq("month_id", selectedMonth.id);

  const { data: chargesData } = await supabase
    .from("member_monthly_charges")
    .select("member_id, rent_amount")
    .eq("month_id", selectedMonth.id);

  const { data: settlementsData } = await supabase
    .from("month_settlements")
    .select("member_id, final_amount, final_type, paid_amount")
    .eq("group_id", group.id)
    .eq("month_id", selectedMonth.id);

  const members: Member[] = (membersData ?? []) as Member[];
  const meals: MealEntry[] = (mealsData ?? []) as MealEntry[];
  const expenses: ExpenseEntry[] = (expensesData ?? []) as ExpenseEntry[];
  const charges: ChargeRow[] = (chargesData ?? []) as ChargeRow[];
  const settlements: SettlementRow[] = (settlementsData ?? []) as SettlementRow[];

  return (
    <AppShell>
      <ClosedMonthSettlementView
        groupId={group.id}
        monthLabel={selectedMonth.label}
        selectedMonthId={selectedMonth.id}
        months={closedMonths}
        members={members}
        meals={meals}
        expenses={expenses}
        charges={charges}
        settlements={settlements}
        viewerRole={member.role}
      />
    </AppShell>
  );
}