import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/app-shell";
import ExpensesForm from "./expenses-form";
import { getUserGroupContext } from "@/lib/group-access";

type Member = {
  id: string;
  name: string;
  role: "admin" | "manager" | "member";
};

type ExpenseItem = {
  id: string;
  entry_date: string;
  category:
    | "bazar"
    | "wifi"
    | "utility"
    | "electricity"
    | "gas"
    | "bua"
    | "other";
  amount: number;
  note: string | null;
  paid_by_member_id: string;
};

export default async function ExpensesPage() {
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

  const { data: membersData } = await supabase
    .from("members")
    .select("id, name, role")
    .eq("group_id", group.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const { data: month } = await supabase
    .from("months")
    .select("id")
    .eq("group_id", group.id)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();

  if (!month) {
    return (
      <AppShell>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
          <p className="mt-2 text-slate-600">No active month found.</p>
        </div>
      </AppShell>
    );
  }

  const { data: expenseRows } = await supabase
    .from("expense_entries")
    .select("id, entry_date, category, amount, note, paid_by_member_id")
    .eq("month_id", month.id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  const members: Member[] = membersData ?? [];
  const expenses: ExpenseItem[] = expenseRows ?? [];

  const memberMap = Object.fromEntries(
    members.map((item) => [item.id, item.name])
  );

  return (
    <AppShell>
      <ExpensesForm
        members={members}
        expenses={expenses}
        memberMap={memberMap}
        groupId={group.id}
        monthId={month.id}
        currentUserRole={member.role}
        currentUserMemberId={member.id}
      />
    </AppShell>
  );
}