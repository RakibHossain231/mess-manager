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

  const [membersRes, monthRes] = await Promise.all([
    supabase
      .from("members")
      .select("*")
      .eq("group_id", group.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("months")
      .select("id, label")
      .eq("group_id", group.id)
      .eq("status", "open")
      .limit(1)
      .maybeSingle(),
  ]);

  const members: Member[] = membersRes.data ?? [];
  const month = monthRes.data;
  const memberIds = members.map((m) => m.id);

  const [defaultsRes, chargesRes] = await Promise.all([
    memberIds.length > 0
      ? supabase
          .from("member_default_charges")
          .select("*")
          .in("member_id", memberIds)
      : Promise.resolve({ data: [] }),
    month
      ? supabase
          .from("member_monthly_charges")
          .select("*")
          .eq("month_id", month.id)
      : Promise.resolve({ data: [] }),
  ]);

  const defaultChargeMap = new Map(
    (defaultsRes.data as MemberDefaultCharge[] | null)?.map((c) => [
      c.member_id,
      c,
    ]) ?? []
  );

  const monthlyCharges: MemberMonthlyCharge[] = (chargesRes.data ?? []) as MemberMonthlyCharge[];

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
