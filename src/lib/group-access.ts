import { Role } from "@/types";

export type CurrentGroup = {
  id: string;
  name: string;
  join_code: string | null;
};

export type CurrentMember = {
  id: string;
  group_id: string;
  role: Role;
  name: string;
  is_active: boolean;
  monthly_rent: number;
  mobile_number: string;
  nid_number: string | null;
};

export async function getUserGroupContext(
  supabase: any,
  userId: string
): Promise<{
  group: CurrentGroup | null;
  member: CurrentMember | null;
}> {
  const { data: linkedMember } = await supabase
    .from("members")
    .select(
      "id, group_id, role, name, is_active, monthly_rent, mobile_number, nid_number"
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (linkedMember) {
    const { data: linkedGroup } = await supabase
      .from("mess_groups")
      .select("id, name, join_code")
      .eq("id", linkedMember.group_id)
      .single();

    return {
      group: linkedGroup ?? null,
      member: linkedMember ?? null,
    };
  }

  const { data: ownedGroup } = await supabase
    .from("mess_groups")
    .select("id, name, join_code")
    .eq("created_by", userId)
    .limit(1)
    .maybeSingle();

  if (!ownedGroup) {
    return {
      group: null,
      member: null,
    };
  }

  const { data: ownerMember } = await supabase
    .from("members")
    .select(
      "id, group_id, role, name, is_active, monthly_rent, mobile_number, nid_number"
    )
    .eq("group_id", ownedGroup.id)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  return {
    group: ownedGroup,
    member:
      ownerMember ??
      ({
        id: "owner-admin",
        group_id: ownedGroup.id,
        role: "admin",
        name: "Admin",
        is_active: true,
        monthly_rent: 0,
        mobile_number: "",
        nid_number: null,
      } as CurrentMember),
  };
}