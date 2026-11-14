"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import EditHistoryBadge, {
  type ActivityLogEntry,
} from "@/components/shared/edit-history-badge";
import { recordActivityLog } from "@/lib/activity-logger";
import type { MemberItem, AmenityItem } from "./page";

export default function AmenitiesView({
  members,
  amenities,
  groupId,
  monthId,
  currentUserRole,
  currentUserMemberId,
  currentUserId,
  initialActivityLogs = [],
}: {
  members: MemberItem[];
  amenities: AmenityItem[];
  groupId: string;
  monthId: string;
  currentUserRole: "owner" | "admin" | "manager" | "member";
  currentUserMemberId: string;
  currentUserId?: string;
  initialActivityLogs?: ActivityLogEntry[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const canManage =
    currentUserRole === "owner" ||
    currentUserRole === "admin" ||
    currentUserRole === "manager";

  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>(
    initialActivityLogs ?? []
  );

  // Form state
  const [amenityDate, setAmenityDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [amenityPaidByMemberId, setAmenityPaidByMemberId] =
    useState(currentUserMemberId);
  const [amenityAmount, setAmenityAmount] = useState("");
  const [amenityItemName, setAmenityItemName] = useState("");
  const [amenityMsg, setAmenityMsg] = useState("");
  const [amenityLoading, setAmenityLoading] = useState(false);

  // Inline edit state
  const [editingAmenityId, setEditingAmenityId] = useState<string | null>(null);
  const [editAmenityDate, setEditAmenityDate] = useState("");
  const [editAmenityAmount, setEditAmenityAmount] = useState("");
  const [editAmenityItemName, setEditAmenityItemName] = useState("");
  const [editAmenityPaidBy, setEditAmenityPaidBy] = useState("");
  const [editAmenityLoading, setEditAmenityLoading] = useState(false);

  const totalAmenities = useMemo(
    () =>
      amenities.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [amenities]
  );

  const perMemberCost = useMemo(
    () => (members.length > 0 ? totalAmenities / members.length : 0),
    [totalAmenities, members.length]
  );

  async function handleSaveAmenity() {
    setAmenityMsg("");

    if (!canManage) {
      setAmenityMsg("Only admin or manager can add amenities.");
      return;
    }

    if (!amenityDate) {
      setAmenityMsg("Select date first.");
      return;
    }

    if (!amenityPaidByMemberId) {
      setAmenityMsg("Select payer first.");
      return;
    }

    if (!amenityAmount || Number(amenityAmount) <= 0) {
      setAmenityMsg("Enter a valid amount.");
      return;
    }

    setAmenityLoading(true);

    const { error } = await supabase.from("expense_entries").insert({
      group_id: groupId,
      month_id: monthId,
      paid_by_member_id: amenityPaidByMemberId,
      amount: Number(amenityAmount),
      expense_type: "shared",
      title: "Mess Amenities",
      description: amenityItemName.trim() || "Mess Amenities",
      expense_date: amenityDate,
    });

    setAmenityLoading(false);

    if (error) {
      setAmenityMsg(error.message);
      return;
    }

    setAmenityMsg("Mess amenity added successfully.");
    setAmenityAmount("");
    setAmenityItemName("");
    router.refresh();
  }

  function startAmenityEdit(item: AmenityItem) {
    setEditingAmenityId(item.id);
    setEditAmenityDate(item.expense_date || "");
    setEditAmenityAmount(String(item.amount || ""));
    setEditAmenityItemName(item.description || "");
    setEditAmenityPaidBy(item.paid_by_member_id || currentUserMemberId);
    setAmenityMsg("");
  }

  function cancelAmenityEdit() {
    setEditingAmenityId(null);
    setEditAmenityDate("");
    setEditAmenityAmount("");
    setEditAmenityItemName("");
    setEditAmenityPaidBy("");
  }

  async function handleSaveAmenityEdit(id: string) {
    setAmenityMsg("");

    if (!canManage) {
      setAmenityMsg("Only admin or manager can edit amenities.");
      return;
    }

    if (!editAmenityDate) {
      setAmenityMsg("Select date.");
      return;
    }

    if (!editAmenityAmount || Number(editAmenityAmount) <= 0) {
      setAmenityMsg("Enter valid amount.");
      return;
    }

    setEditAmenityLoading(true);

    const { error } = await supabase
      .from("expense_entries")
      .update({
        expense_date: editAmenityDate,
        amount: Number(editAmenityAmount),
        paid_by_member_id: editAmenityPaidBy || currentUserMemberId,
        description: editAmenityItemName.trim() || "Mess Amenities",
      })
      .eq("id", id);

    setEditAmenityLoading(false);

    if (error) {
      setAmenityMsg(error.message);
      return;
    }

    if (currentUserId) {
      const oldItem = amenities.find((e) => e.id === id);
      const logPayload = {
        groupId,
        actorUserId: currentUserId,
        action: "update_amenity",
        targetTable: "expense_entries",
        targetId: id,
        oldData: {
          amount: Number(oldItem?.amount || 0),
          date: oldItem?.expense_date,
          note: oldItem?.description || "Mess Amenities",
        },
        newData: {
          amount: Number(editAmenityAmount),
          date: editAmenityDate,
          note: editAmenityItemName.trim() || "Mess Amenities",
        },
      };
      await recordActivityLog(supabase, logPayload);
      setActivityLogs((prev) => [
        {
          id: crypto.randomUUID(),
          actor_user_id: currentUserId,
          action: "update_amenity",
          target_table: "expense_entries",
          target_id: id,
          old_data: logPayload.oldData,
          new_data: logPayload.newData,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    }

    cancelAmenityEdit();
    setAmenityMsg("Mess amenity updated successfully.");
    router.refresh();
  }

  async function handleDeleteAmenity(id: string) {
    if (!canManage) {
      setAmenityMsg("Only admin or manager can delete amenities.");
      return;
    }

    const ok = window.confirm("Delete this amenity entry?");
    if (!ok) return;

    const { error } = await supabase
      .from("expense_entries")
      .delete()
      .eq("id", id);

    if (error) {
      setAmenityMsg(error.message);
      return;
    }

    setAmenityMsg("Mess amenity deleted successfully.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                Mess Amenities
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Shared household items split equally among active members
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 text-right">
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Amenities</p>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              ৳ {totalAmenities.toFixed(0)}
            </h3>
          </div>
          <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-2.5 shadow-sm dark:border-teal-900/60 dark:bg-teal-950/40 text-right">
            <p className="text-xs text-teal-700 dark:text-teal-400">Per Member</p>
            <h3 className="text-lg sm:text-xl font-bold text-teal-700 dark:text-teal-300">
              ৳ {perMemberCost.toFixed(1)}
            </h3>
          </div>
        </div>
      </div>

      {/* Add Mess Amenities Entry Section */}
      {canManage ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                Add Mess Amenities Entry
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Supplies (Harpic, Jharu, Tissue, etc.) split equally among active members.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Date
              </label>
              <input
                type="date"
                value={amenityDate}
                onChange={(e) => setAmenityDate(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Paid By
              </label>
              <select
                value={amenityPaidByMemberId}
                onChange={(e) => setAmenityPaidByMemberId(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Amount
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amenityAmount}
                onChange={(e) => setAmenityAmount(e.target.value)}
                placeholder="e.g. 250"
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="md:col-span-2 xl:col-span-4">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Note / Item Description
              </label>
              <input
                type="text"
                value={amenityItemName}
                onChange={(e) => setAmenityItemName(e.target.value)}
                placeholder="e.g. Harpic, Jharu, Tissue, Vimbar"
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={handleSaveAmenity}
              disabled={amenityLoading}
              className="rounded-xl bg-teal-700 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {amenityLoading ? "Saving..." : "Save"}
            </button>

            {amenityMsg && !editingAmenityId ? (
              <p className="text-xs text-slate-600 dark:text-slate-400">{amenityMsg}</p>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            You can view amenities history. Only Admin or Manager can add or edit amenities.
          </p>
        </section>
      )}

      {/* Mess Amenities History */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              Mess Amenities History
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Shared household items split equally among active members (does not affect meal rate).
            </p>
          </div>

          <div className="self-start rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
            {amenities.length} {amenities.length === 1 ? "entry" : "entries"}
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {amenities.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No mess amenities added yet for this month.
              </div>
            ) : (
              amenities.map((expense) => {
                const payer = members.find((m) => m.id === expense.paid_by_member_id);
                const isEditing = editingAmenityId === expense.id;

                if (isEditing) {
                  return (
                    <div
                      key={expense.id}
                      className="bg-teal-50/40 p-4 dark:bg-teal-950/30 grid gap-3 sm:grid-cols-[1fr_1.5fr_1fr_1fr_auto] items-end"
                    >
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                          Date
                        </label>
                        <input
                          type="date"
                          value={editAmenityDate}
                          onChange={(e) => setEditAmenityDate(e.target.value)}
                          className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                          Item Description
                        </label>
                        <input
                          type="text"
                          value={editAmenityItemName}
                          onChange={(e) => setEditAmenityItemName(e.target.value)}
                          className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                          Paid By
                        </label>
                        <select
                          value={editAmenityPaidBy}
                          onChange={(e) => setEditAmenityPaidBy(e.target.value)}
                          className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        >
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.full_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                          Amount
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editAmenityAmount}
                          onChange={(e) => setEditAmenityAmount(e.target.value)}
                          className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveAmenityEdit(expense.id)}
                          disabled={editAmenityLoading}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelAmenityEdit}
                          disabled={editAmenityLoading}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={expense.id}
                    className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-slate-900"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {expense.expense_date}
                      </span>
                      <span className="font-semibold text-sm text-slate-900 dark:text-white">
                        {expense.description || "Mess Amenities"}
                      </span>
                      <EditHistoryBadge
                        logs={activityLogs.filter((l) => l.target_id === expense.id)}
                        members={members}
                      />
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Paid by: {payer?.full_name || "Unknown"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <span className="text-base font-bold text-slate-900 dark:text-white">
                        ৳ {Number(expense.amount).toFixed(0)}
                      </span>

                      {canManage ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => startAmenityEdit(expense)}
                            className="rounded-lg border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteAmenity(expense.id)}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/40"
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
