import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/layout/app-shell";
import SectionTitle from "@/components/shared/section-title";
import ProfileDetailsCard from "@/components/profile/profile-details-card";
import { getUserGroupContext } from "@/lib/group-access";

export default async function ProfilePage() {
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

  const { data: currentMonth } = await supabase
    .from("months")
    .select("label")
    .eq("group_id", group.id)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();

  return (
    <AppShell>
      <div className="space-y-8">
        <SectionTitle
          title="My Profile"
          subtitle="View your account, contact, and mess information"
        />

        <ProfileDetailsCard
          memberId={member.id}
          name={member.name}
          role={member.role}
          email={user.email ?? null}
          mobileNumber={member.mobile_number ?? null}
          nidNumber={member.nid_number ?? null}
          groupName={group.name}
          monthlyRent={Number(member.monthly_rent || 0)}
          monthLabel={currentMonth?.label ?? null}
        />
      </div>
    </AppShell>
  );
}