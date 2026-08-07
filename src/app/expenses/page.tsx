import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/app-shell";
import ExpensesForm from "./expenses-form";
import { getUserGroupContext } from "@/lib/group-access";

type Member = {
  id: string;
  full_name: string;
  role: "owner" | "admin" | "manager" | "member";
};

type ExpenseItem = {
  id: string;
  expense_date: string;
  expense_type: "bazar" | "shared";
  amount: number;
  title: string;
  description: string | null;
  paid_by_member_id: string | null;
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
    .select("id, full_name, role")
    .eq("group_id", group.id)
    .eq("status", "active")
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
    .select("id, expense_date, expense_type, amount, title, description, paid_by_member_id")
    .eq("month_id", month.id)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  const members: Member[] = membersData ?? [];
  const expenses: ExpenseItem[] = expenseRows ?? [];

  return (
    <AppShell>
      <ExpensesForm
        members={members}
        expenses={expenses}
        groupId={group.id}
        monthId={month.id}
        currentUserRole={member.role}
        currentUserMemberId={member.id}
      />
    </AppShell>
  );
}