import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/app-shell";
import MembersManager from "@/app/members/members-manager";
import { getUserGroupContext } from "@/lib/group-access";
import type {
  Member,
  MemberDefaultCharge,
  MemberMonthlyCharge,
} from "@/types";

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
    .select("*")
    .eq("group_id", group.id)
    .order("created_at", { ascending: true });

  const members: Member[] = membersData ?? [];

  // Default charges are keyed by member_id (one row per member)
  const { data: defaultsData } = await supabase
    .from("member_default_charges")
    .select("*")
    .in(
      "member_id",
      members.map((m) => m.id)
    );

  const defaultChargeMap = new Map(
    (defaultsData as MemberDefaultCharge[] | null)?.map((c) => [
      c.member_id,
      c,
    ]) ?? []
  );

  // Find the open month for this mess
  const { data: month } = await supabase
    .from("months")
    .select("id, label")
    .eq("group_id", group.id)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();

  let monthlyCharges: MemberMonthlyCharge[] = [];

  if (month) {
    const { data: chargesData } = await supabase
      .from("member_monthly_charges")
      .select("*")
      .eq("month_id", month.id);

    monthlyCharges = chargesData ?? [];
  }

  return (
    <AppShell>
      <MembersManager
        groupId={group.id}
        members={members}
        monthId={month?.id ?? null}
        defaultCharges={defaultChargeMap}
        monthlyCharges={monthlyCharges}
        currentUserRole={member.role}
        currentUserMemberId={member.id}
      />
    </AppShell>
  );
}
