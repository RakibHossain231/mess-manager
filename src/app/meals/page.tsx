import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/app-shell";
import MealsForm from "./meals-form";
import { getUserGroupContext } from "@/lib/group-access";

type Member = {
  id: string;
  name: string;
  role: "admin" | "manager" | "member";
};

type MealRow = {
  id: string;
  member_id: string;
  entry_date: string;
  own_meal: number;
  guest_meal: number;
};

export default async function MealsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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
          <h1 className="text-2xl font-bold text-slate-900">Meals</h1>
          <p className="mt-2 text-slate-600">No active month found.</p>
        </div>
      </AppShell>
    );
  }

  const { data: allMealRows } = await supabase
    .from("meal_entries")
    .select("id, member_id, entry_date, own_meal, guest_meal")
    .eq("month_id", month.id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  let meals: MealRow[] = allMealRows ?? [];

  if (member.role === "member") {
    meals = meals.filter((item) => item.member_id === member.id);
  }

  const members: Member[] = membersData ?? [];
  const memberMap = Object.fromEntries(members.map((m) => [m.id, m.name]));

  return (
    <AppShell>
      <MealsForm
        members={members}
        meals={meals}
        allMeals={allMealRows ?? []}
        memberMap={memberMap}
        groupId={group.id}
        monthId={month.id}
        currentUserRole={member.role}
        currentUserMemberId={member.id}
      />
    </AppShell>
  );
}