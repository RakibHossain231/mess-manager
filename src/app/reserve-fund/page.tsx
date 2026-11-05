import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import AppShell from "@/components/layout/app-shell";
import { getUserGroupContext } from "@/lib/group-access";
import ReserveFundView from "./reserve-fund-view";

export type MemberItem = {
  id: string;
  full_name: string;
  role: "owner" | "admin" | "manager" | "member";
  status: string;
};

export type ReserveFundEntry = {
  id: string;
  group_id: string;
  entry_type: "add" | "spend" | "handover";
  amount: number;
  custodian_member_id: string;
  to_member_id: string | null;
  entry_date: string;
  title: string;
  description: string | null;
  created_by_member_id: string | null;
  created_at: string;
};

export default async function ReserveFundPage() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const { group, member } = await getUserGroupContext(supabase, user.id);

  if (!group || !member || member.status !== "active") {
    redirect("/join");
  }

  const { data: membersData } = await supabase
    .from("members")
    .select("id, full_name, role, status")
    .eq("group_id", group.id)
    .order("created_at", { ascending: true });

  const members: MemberItem[] = membersData ?? [];

  // Query reserve_fund_entries
  let entries: ReserveFundEntry[] = [];
  let tableMissing = false;

  const { data: entriesData, error } = await supabase
    .from("reserve_fund_entries")
    .select("*")
    .eq("group_id", group.id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    // If table doesn't exist yet in Supabase schema
    if (
      error.code === "42P01" ||
      error.message?.toLowerCase().includes("does not exist") ||
      error.message?.toLowerCase().includes("schema cache")
    ) {
      tableMissing = true;
    }
  } else {
    entries = (entriesData ?? []).map((e) => ({
      ...e,
      amount: Number(e.amount || 0),
    }));
  }

  return (
    <AppShell>
      <ReserveFundView
        groupId={group.id}
        members={members}
        initialEntries={entries}
        currentUserRole={member.role}
        currentUserMemberId={member.id}
        tableMissing={tableMissing}
      />
    </AppShell>
  );
}
