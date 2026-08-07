import { MemberStatus, Role } from "@/types";

export type CurrentGroup = {
  id: string;
  name: string;
  join_code: string;
  owner_id: string;
};

export type CurrentMember = {
  id: string;
  group_id: string;
  user_id: string | null;
  role: Role;
  full_name: string;
  email: string | null;
  phone: string;
  nid: string | null;
  status: MemberStatus;
};

const MEMBER_COLUMNS =
  "id, group_id, user_id, role, full_name, email, phone, nid, status";

const GROUP_COLUMNS = "id, name, join_code, owner_id";

export async function getUserGroupContext(
  supabase: any,
  userId: string
): Promise<{
  group: CurrentGroup | null;
  member: CurrentMember | null;
}> {
  const { data: linkedMember } = await supabase
    .from("members")
    .select(MEMBER_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (linkedMember) {
    const { data: linkedGroup } = await supabase
      .from("mess_groups")
      .select(GROUP_COLUMNS)
      .eq("id", linkedMember.group_id)
      .single();

    return {
      group: linkedGroup ?? null,
      member: linkedMember ?? null,
    };
  }

  const { data: ownedGroup } = await supabase
    .from("mess_groups")
    .select(GROUP_COLUMNS)
    .eq("owner_id", userId)
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
    .select(MEMBER_COLUMNS)
    .eq("group_id", ownedGroup.id)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  return {
    group: ownedGroup,
    member:
      ownerMember ??
      ({
        id: "owner-fallback",
        group_id: ownedGroup.id,
        user_id: userId,
        role: "owner",
        full_name: "Owner",
        email: null,
        phone: "",
        nid: null,
        status: "active",
      } as CurrentMember),
  };
}
