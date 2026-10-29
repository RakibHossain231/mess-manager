import { cache } from "react";
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

export const getUserGroupContext = cache(
  async (
    supabase: any,
    userId: string
  ): Promise<{
    group: CurrentGroup | null;
    member: CurrentMember | null;
  }> => {
    // 1-query fetch: join mess_groups directly with members in a single roundtrip
    const { data: linkedMember } = await supabase
      .from("members")
      .select(`${MEMBER_COLUMNS}, mess_groups(${GROUP_COLUMNS})`)
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (linkedMember) {
      const rawGroup = linkedMember.mess_groups;
      const group = Array.isArray(rawGroup) ? rawGroup[0] : rawGroup;

      return {
        group: (group as CurrentGroup) ?? null,
        member: {
          id: linkedMember.id,
          group_id: linkedMember.group_id,
          user_id: linkedMember.user_id,
          role: linkedMember.role,
          full_name: linkedMember.full_name,
          email: linkedMember.email,
          phone: linkedMember.phone,
          nid: linkedMember.nid,
          status: linkedMember.status,
        },
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
);
