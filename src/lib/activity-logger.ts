import type { SupabaseClient } from "@supabase/supabase-js";

export type LogActivityParams = {
  groupId: string;
  actorUserId?: string | null;
  action: string;
  targetTable: string;
  targetId: string;
  oldData: Record<string, unknown>;
  newData: Record<string, unknown>;
};

export async function recordActivityLog(
  supabase: SupabaseClient,
  params: LogActivityParams
) {
  try {
    const { error } = await supabase.from("activity_logs").insert({
      group_id: params.groupId,
      actor_user_id: params.actorUserId || null,
      action: params.action,
      target_table: params.targetTable,
      target_id: params.targetId,
      old_data: params.oldData,
      new_data: params.newData,
    });

    if (error) {
      console.warn("Failed to record activity log:", error.message);
    }
  } catch (err) {
    console.warn("Error logging activity:", err);
  }
}
