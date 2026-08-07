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
    .select("id, label")
    .eq("group_id", group.id)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();

  // All 8 charge fields the admin sets for this member. Prefer the current
  // month's snapshot; fall back to the member's default charges.
  const emptyCharges = {
    rent: 0,
    wifi: 0,
    electricity: 0,
    water: 0,
    gas: 0,
    khala_bill: 0,
    utility: 0,
    others: 0,
  };

  let charges = { ...emptyCharges };

  if (currentMonth) {
    const { data: monthlyCharge } = await supabase
      .from("member_monthly_charges")
      .select("rent, wifi, electricity, water, gas, khala_bill, utility, others")
      .eq("month_id", currentMonth.id)
      .eq("member_id", member.id)
      .maybeSingle();

    if (monthlyCharge) {
      charges = { ...emptyCharges, ...monthlyCharge };
    }
  }

  // If no monthly snapshot yet, show the member's default charges instead.
  const hasMonthly = Object.values(charges).some((value) => Number(value) > 0);
  if (!hasMonthly) {
    const { data: defaultCharge } = await supabase
      .from("member_default_charges")
      .select("rent, wifi, electricity, water, gas, khala_bill, utility, others")
      .eq("member_id", member.id)
      .maybeSingle();

    if (defaultCharge) {
      charges = { ...emptyCharges, ...defaultCharge };
    }
  }

  return (
    <AppShell>
      <div className="space-y-8">
        <SectionTitle
          title="My Profile"
          subtitle="View your account, contact, and mess information"
        />

        <ProfileDetailsCard
          memberId={member.id}
          name={member.full_name}
          role={member.role}
          email={user.email ?? null}
          mobileNumber={member.phone ?? null}
          nidNumber={member.nid ?? null}
          groupName={group.name}
          charges={charges}
          monthLabel={currentMonth?.label ?? null}
        />
      </div>
    </AppShell>
  );
}