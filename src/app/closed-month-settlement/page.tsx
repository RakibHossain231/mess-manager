import { redirect } from "next/navigation";
import AppShell from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getUserGroupContext } from "@/lib/group-access";
import ClosedMonthSettlementView from "./closed-month-settlement-view";
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
          <h1 className="text-2xl font-bold text-slate-900">
            Closed Month Settlement
          </h1>
          <p className="mt-2 text-slate-600">
            No closed month found. Close a month first, then settlement will appear here.
          </p>
        </div>
      </AppShell>
    );
  }

  const selectedMonth =
    closedMonths.find((item) => item.id === selectedMonthIdFromQuery) ??
    closedMonths[0];

  const { data: settlementsData } = await supabase
    .from("settlements")
    .select(
      "member_id, total_own_meal, total_guest_meal, meal_rate, bazar_paid, shared_expense, rent, wifi, electricity, water, gas, khala_bill, utility, others, discount, advance, previous_due, final_amount, paid_amount"
    )
    .eq("group_id", group.id)
    .eq("month_id", selectedMonth.id);

  if (!settlementsData || settlementsData.length === 0) {
    return (
      <AppShell>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            Closed Month Settlement
          </h1>
          <p className="mt-2 text-slate-600">
            No saved settlement found for {selectedMonth.label}. This appears for
            months closed after the settlement update.
          </p>
        </div>
      </AppShell>
    );
  }

  const { data: membersData } = await supabase
    .from("members")
    .select("id, full_name")
    .eq("group_id", group.id);

  const nameMap = Object.fromEntries(
    (membersData ?? []).map((item) => [item.id, item.full_name])
  );

  const props = settlementsToReportProps(settlementsData, nameMap);

  return (
    <AppShell>
      <ClosedMonthSettlementView
        groupId={group.id}
        monthLabel={selectedMonth.label}
        selectedMonthId={selectedMonth.id}
        months={closedMonths}
        members={props.members as Member[]}
        meals={props.meals as MealEntry[]}
        expenses={props.expenses as ExpenseEntry[]}
        charges={props.charges as ChargeRow[]}
        settlements={props.settlementRows as SettlementRow[]}
        viewerRole={member.role}
      />
    </AppShell>
  );
}
