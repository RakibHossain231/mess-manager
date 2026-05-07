import { redirect } from "next/navigation";
import AppShell from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getUserGroupContext } from "@/lib/group-access";
import ClosedMonthSettlementView from "./closed-month-settlement-view";
import { snapshotToLiveReportProps } from "@/lib/report-snapshot";

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
  paid_by_member_id: string | null;
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

  const { data: snapshotData } = await supabase
    .from("closed_month_reports")
    .select("report_data")
    .eq("group_id", group.id)
    .eq("month_id", selectedMonth.id)
    .maybeSingle();

  if (!snapshotData?.report_data) {
    return (
      <AppShell>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            Closed Month Settlement
          </h1>
          <p className="mt-2 text-slate-600">
            No saved snapshot found for {selectedMonth.label}. This will work for
            months closed after the snapshot update.
          </p>
        </div>
      </AppShell>
    );
  }

  const snapshotProps = snapshotToLiveReportProps(snapshotData.report_data);
  const { data: settlementsData } = await supabase
    .from("month_settlements")
    .select("member_id, final_amount, final_type, paid_amount")
    .eq("group_id", group.id)
    .eq("month_id", selectedMonth.id);

  const settlements: SettlementRow[] = (settlementsData ?? []) as SettlementRow[];

  return (
    <AppShell>
      <ClosedMonthSettlementView
        groupId={group.id}
        monthLabel={selectedMonth.label}
        selectedMonthId={selectedMonth.id}
        months={closedMonths}
        members={snapshotProps.members as Member[]}
        meals={snapshotProps.meals as MealEntry[]}
        expenses={snapshotProps.expenses as ExpenseEntry[]}
        charges={snapshotProps.charges as ChargeRow[]}
        settlements={settlements}
        viewerRole={member.role}
      />
    </AppShell>
  );
}