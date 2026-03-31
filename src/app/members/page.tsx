import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/app-shell";
import MembersManager from "@/app/members/members-manager";
import { getUserGroupContext } from "@/lib/group-access";

type Member = {
  id: string;
  name: string;
  role: "admin" | "manager" | "member";
  monthly_rent: number;
  mobile_number: string;
  nid_number: string | null;
  is_active: boolean;
};

type ChargeRow = {
  id: string;
  member_id: string;
  rent_amount: number;
};

export default async function MembersPage() {
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
    .select(
      "id, name, role, monthly_rent, mobile_number, nid_number, is_active"
    )
    .eq("group_id", group.id)
    .order("created_at", { ascending: true });

  const { data: month } = await supabase
    .from("months")
    .select("id, label")
    .eq("group_id", group.id)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();

  const members: Member[] = membersData ?? [];

  let charges: ChargeRow[] = [];

  if (month) {
    const { data: chargesData } = await supabase
      .from("member_monthly_charges")
      .select("id, member_id, rent_amount")
      .eq("month_id", month.id);

    charges = chargesData ?? [];
  }

  return (
    <AppShell>
      <MembersManager
        groupId={group.id}
        members={members}
        monthId={month?.id ?? null}
        charges={charges}
        currentUserRole={member.role}
        currentUserMemberId={member.id}
      />
    </AppShell>
  );
}