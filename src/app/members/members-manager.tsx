"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  Member,
  MemberDefaultCharge,
  MemberMonthlyCharge,
  Role,
} from "@/types";

const CHARGE_KEYS = [
  "rent",
  "wifi",
  "electricity",
  "water",
  "gas",
  "khala_bill",
  "utility",
  "others",
] as const;

type ChargeKey = (typeof CHARGE_KEYS)[number];

type MemberProps = {
  groupId: string;
  members: Member[];
  monthId: string | null;
  defaultCharges: Map<string, MemberDefaultCharge>;
  monthlyCharges: MemberMonthlyCharge[];
  currentUserRole: Role;
  currentUserMemberId: string;
};

const EMPTY_CHARGES: Record<ChargeKey, number> = {
  rent: 0,
  wifi: 0,
  electricity: 0,
  water: 0,
  gas: 0,
  khala_bill: 0,
  utility: 0,
  others: 0,
};

// Extract ONLY the 8 charge fields (as numbers) from any source row.
// Prevents DB columns like id / member_id / created_at from leaking into
// the update/upsert payload when a member already has a charge row.
function pickCharges(
  source: Partial<Record<ChargeKey, number>> | null | undefined
): Record<ChargeKey, number> {
  const result = { ...EMPTY_CHARGES };
  if (!source) return result;
  for (const key of CHARGE_KEYS) {
    result[key] = Number(source[key] ?? 0);
  }
  return result;
}

export default function MembersManager({
  groupId,
  members,
  monthId,
  defaultCharges,
  monthlyCharges,
  currentUserRole,
}: MemberProps) {
  const router = useRouter();
  const supabase = createClient();

  const isAdmin = currentUserRole === "admin" || currentUserRole === "owner";

  const currentDate = new Date();
  const monthYear = currentDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const monthChargeMap = useMemo(() => {
    return new Map(monthlyCharges.map((item) => [item.member_id, item]));
  }, [monthlyCharges]);

  const [msg, setMsg] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [newNid, setNewNid] = useState("");
  const [newRole, setNewRole] = useState<Role>("member");
  const [newCharges, setNewCharges] = useState({ ...EMPTY_CHARGES });
  const [addLoading, setAddLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    name: "",
    mobile: "",
    nid: "",
    role: "member" as Role,
    charges: { ...EMPTY_CHARGES },
  });

  function startEdit(member: Member) {
    const monthCharge = monthChargeMap.get(member.id);
    const defaultCharge = defaultCharges.get(member.id);

    setEditingId(member.id);
    setEditData({
      name: member.full_name,
      mobile: member.phone,
      nid: member.nid || "",
      role: member.role,
      // Prefer this month's snapshot; fall back to the member's defaults.
      charges: pickCharges(monthCharge ?? defaultCharge),
    });
    setMsg("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditData({
      name: "",
      mobile: "",
      nid: "",
      role: "member",
      charges: { ...EMPTY_CHARGES },
    });
  }

  async function handleSaveEdit(memberId: string, memberRole: Member["role"]) {
    setMsg("");

    if (!isAdmin) {
      setMsg("Only admin can edit member information.");
      return;
    }

    const cleanName = editData.name.trim();
    const cleanMobile = editData.mobile.trim();
    const cleanNid = editData.nid.trim();

    if (!cleanName) {
      setMsg("Member name is required.");
      return;
    }

    if (!cleanMobile) {
      setMsg("Mobile number is required.");
      return;
    }

    for (const key of CHARGE_KEYS) {
      if (editData.charges[key] < 0) {
        setMsg("Charges cannot be negative.");
        return;
      }
    }

    if (memberRole === "admin" && editData.role !== "admin") {
      const adminCount = members.filter((item) => item.role === "admin").length;

      if (adminCount <= 1) {
        setMsg("At least one admin must remain in the mess.");
        return;
      }
    }

    const duplicate = members.find(
      (item) =>
        item.id !== memberId &&
        item.phone.trim().toLowerCase() === cleanMobile.trim().toLowerCase()
    );

    if (duplicate) {
      setMsg("Another member already uses this mobile number.");
      return;
    }

    setLoadingId(memberId);

    const { error: memberError } = await supabase
      .from("members")
      .update({
        full_name: cleanName,
        phone: cleanMobile,
        nid: cleanNid || null,
        role: editData.role,
      })
      .eq("id", memberId);

    if (memberError) {
      setLoadingId(null);
      setMsg(memberError.message);
      return;
    }

    // Upsert default charges (the member's ongoing template)
    const defaultCharge = defaultCharges.get(memberId);
    if (defaultCharge) {
      const { error } = await supabase
        .from("member_default_charges")
        .update({ ...editData.charges })
        .eq("id", defaultCharge.id);

      if (error) {
        setLoadingId(null);
        setMsg(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("member_default_charges").insert({
        member_id: memberId,
        ...editData.charges,
      });

      if (error) {
        setLoadingId(null);
        setMsg(error.message);
        return;
      }
    }

    // Upsert monthly snapshot (only when a month is open)
    if (monthId) {
      const { error } = await supabase.from("member_monthly_charges").upsert(
        {
          month_id: monthId,
          member_id: memberId,
          ...editData.charges,
        },
        { onConflict: "month_id,member_id" }
      );

      if (error) {
        setLoadingId(null);
        setMsg(error.message);
        return;
      }
    }

    setLoadingId(null);
    cancelEdit();
    setMsg("Member updated successfully.");
    router.refresh();
  }

  async function handleAddMember() {
    setMsg("");

    if (!isAdmin) {
      setMsg("Only admin can add member.");
      return;
    }

    if (!newName.trim()) {
      setMsg("Member name is required.");
      return;
    }

    if (!newMobile.trim()) {
      setMsg("Mobile number is required.");
      return;
    }

    for (const key of CHARGE_KEYS) {
      if (newCharges[key] < 0) {
        setMsg("Charges cannot be negative.");
        return;
      }
    }

    const duplicate = members.find(
      (member) =>
        member.phone.trim().toLowerCase() === newMobile.trim().toLowerCase()
    );

    if (duplicate) {
      setMsg("This mobile number already exists in this mess.");
      return;
    }

    setAddLoading(true);

    const { data: memberData, error: memberError } = await supabase
      .from("members")
      .insert({
        group_id: groupId,
        full_name: newName.trim(),
        phone: newMobile.trim(),
        nid: newNid.trim() || null,
        role: newRole,
        status: "active",
        joined_at: new Date().toISOString().split("T")[0],
      })
      .select("id")
      .single();

    if (memberError || !memberData) {
      setAddLoading(false);
      setMsg(memberError?.message || "Failed to add member.");
      return;
    }

    // Create default charges for the new member
    const { error: defaultError } = await supabase
      .from("member_default_charges")
      .insert({
        member_id: memberData.id,
        ...newCharges,
      });

    if (defaultError) {
      setAddLoading(false);
      setMsg(defaultError.message);
      return;
    }

    // Snapshot for the open month
    if (monthId) {
      await supabase.from("member_monthly_charges").upsert(
        {
          month_id: monthId,
          member_id: memberData.id,
          ...newCharges,
        },
        { onConflict: "month_id,member_id" }
      );
    }

    setAddLoading(false);
    setNewName("");
    setNewMobile("");
    setNewNid("");
    setNewRole("member");
    setNewCharges({ ...EMPTY_CHARGES });
    setMsg("Member added successfully.");
    router.refresh();
  }

  async function handleToggleActive(
    memberId: string,
    active: boolean,
    memberRole: Member["role"]
  ) {
    setMsg("");

    if (!isAdmin) {
      setMsg("Only admin can change member status.");
      return;
    }

    if (active && memberRole === "admin") {
      const activeAdminCount = members.filter(
        (item) => item.role === "admin" && item.status === "active"
      ).length;

      if (activeAdminCount <= 1) {
        setMsg("At least one active admin must remain in the mess.");
        return;
      }
    }

    const text = active
      ? "Mark this member as left? Old data will remain."
      : "Activate this member?";

    const ok = window.confirm(text);
    if (!ok) return;

    const { error } = await supabase
      .from("members")
      .update({
        status: active ? "left" : "active",
        left_at: active ? new Date().toISOString().split("T")[0] : null,
      })
      .eq("id", memberId);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg(active ? "Member marked as left." : "Member activated.");
    router.refresh();
  }

  const chargeLabels: Record<ChargeKey, string> = {
    rent: "Rent",
    wifi: "Wifi",
    electricity: "Electricity",
    water: "Water",
    gas: "Gas",
    khala_bill: "Khala Bill",
    utility: "Utility",
    others: "Others",
  };

  const renderChargeInput = (
    key: ChargeKey,
    current: Record<ChargeKey, number>,
    onChange: (next: Record<ChargeKey, number>) => void
  ) => {
    return (
      <div key={key}>
        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          {chargeLabels[key]}
        </label>
        <input
          type="number"
          min="0"
          value={current[key]}
          onChange={(e) =>
            onChange({ ...current, [key]: Number(e.target.value || 0) })
          }
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>
    );
  };

  const defaultChargeFields = CHARGE_KEYS.map((key) =>
    renderChargeInput(key, newCharges, (next) => setNewCharges(next))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Members</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Member info, status, and current month rent. Current month:{" "}
          <b>{monthYear}</b>
        </p>
      </div>

      {isAdmin ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add New Member</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                placeholder="Required"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Mobile Number
              </label>
              <input
                type="text"
                value={newMobile}
                onChange={(e) => setNewMobile(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                placeholder="Required"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                NID Number
              </label>
              <input
                type="text"
                value={newNid}
                onChange={(e) => setNewNid(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Role
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="member">Member</option>
              </select>
            </div>
          </div>

          {/* Default monthly charges */}
          <div className="mt-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
              Default Monthly Charges
            </h3>
            <div className="grid gap-4 md:grid-cols-4">{defaultChargeFields}</div>
          </div>

          <div className="mt-5">
            <button
              onClick={handleAddMember}
              disabled={!isAdmin || addLoading}
              className="rounded-2xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
            >
              {addLoading ? "Adding..." : "Add Member"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Member Information</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Current month rent: <span className="font-semibold text-slate-800 dark:text-slate-200">{monthYear}</span>
          </p>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[1500px] border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-sm text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Mobile</th>
                <th className="px-3 py-2">Gmail</th>
                <th className="px-3 py-2">NID</th>
                <th className="px-3 py-2">Role</th>
                {CHARGE_KEYS.map((key) => (
                  <th key={key} className="px-3 py-2 text-right whitespace-nowrap">
                    {chargeLabels[key]}
                  </th>
                ))}
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>

            <tbody>
              {members.map((member) => {
                const defaultCharge = defaultCharges.get(member.id);
                const monthCharge = monthChargeMap.get(member.id);
                const isEditingRow = editingId === member.id;

                // While editing, mirror the live panel values; otherwise show
                // this month's snapshot, falling back to the member's defaults.
                const displayCharges = isEditingRow
                  ? editData.charges
                  : pickCharges(monthCharge ?? defaultCharge);
                const rowTotal = CHARGE_KEYS.reduce(
                  (sum, key) => sum + Number(displayCharges[key] ?? 0),
                  0
                );

                return (
                  <Fragment key={member.id}>
                    <tr className="bg-slate-50 text-sm dark:bg-slate-800/60 dark:text-slate-200">
                    <td className="px-3 py-3">
                      {editingId === member.id ? (
                        <input
                          value={editData.name}
                          onChange={(e) =>
                            setEditData((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      ) : (
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {member.full_name}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      {editingId === member.id ? (
                        <input
                          value={editData.mobile}
                          onChange={(e) =>
                            setEditData((prev) => ({
                              ...prev,
                              mobile: e.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      ) : (
                        member.phone
                      )}
                    </td>

                    <td className="px-3 py-3 font-medium text-slate-600 dark:text-slate-400">
                      {member.email || "-"}
                    </td>

                    <td className="px-3 py-3">
                      {editingId === member.id ? (
                        <input
                          value={editData.nid}
                          onChange={(e) =>
                            setEditData((prev) => ({
                              ...prev,
                              nid: e.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      ) : (
                        member.nid || "-"
                      )}
                    </td>

                    <td className="px-3 py-3">
                      {editingId === member.id ? (
                        <select
                          value={editData.role}
                          onChange={(e) =>
                            setEditData((prev) => ({
                              ...prev,
                              role: e.target.value as Role,
                            }))
                          }
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="member">Member</option>
                        </select>
                      ) : (
                        <span className="capitalize">{member.role}</span>
                      )}
                    </td>

                    {CHARGE_KEYS.map((key) => (
                      <td
                        key={key}
                        className="px-3 py-3 text-right whitespace-nowrap"
                      >
                        {isEditingRow ? (
                          <span className="font-medium text-teal-700 dark:text-teal-400">
                            ৳ {Number(displayCharges[key]).toFixed(0)}
                          </span>
                        ) : (
                          `৳ ${Number(displayCharges[key]).toFixed(0)}`
                        )}
                      </td>
                    ))}

                    <td className="px-3 py-3 text-right whitespace-nowrap font-semibold text-slate-900 dark:text-white">
                      ৳ {rowTotal.toFixed(0)}
                    </td>

                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          member.status === "active"
                            ? "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400"
                            : member.status === "pending"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                              : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {member.status}
                      </span>
                    </td>

                    <td className="px-3 py-3">
                      {isAdmin ? (
                        <div className="flex flex-wrap gap-2">
                          {editingId === member.id ? (
                            <>
                              <button
                                onClick={() => handleSaveEdit(member.id, member.role)}
                                disabled={loadingId === member.id}
                                className="rounded-xl bg-green-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {loadingId === member.id ? "Saving..." : "Save"}
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={loadingId === member.id}
                                className="rounded-xl bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-700 dark:text-slate-200"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(member)}
                                className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                              >
                                Edit
                              </button>

                              <button
                                onClick={() =>
                                  handleToggleActive(
                                    member.id,
                                    member.status === "active",
                                    member.role
                                  )
                                }
                                className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                                  member.status === "active"
                                    ? "border border-red-200 bg-red-50 text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
                                    : "border border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-400"
                                }`}
                              >
                                {member.status === "active" ? "Mark Left" : "Activate"}
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 dark:text-slate-400">View only</span>
                      )}
                    </td>
                    </tr>

                    {editingId === member.id ? (
                      <tr className="bg-slate-50 dark:bg-slate-800/60">
                        <td colSpan={16} className="px-3 pb-4">
                          <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-4 dark:border-teal-900/60 dark:bg-teal-950/30">
                            <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                              Monthly Charges — {member.full_name}
                            </h4>
                            <div className="grid gap-4 md:grid-cols-4">
                              {CHARGE_KEYS.map((key) =>
                                renderChargeInput(
                                  key,
                                  editData.charges,
                                  (next) =>
                                    setEditData((prev) => ({
                                      ...prev,
                                      charges: next,
                                    }))
                                )
                              )}
                            </div>
                            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                              These values are saved to the member&apos;s
                              defaults and to the current open month.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {msg && <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">{msg}</p>}
      </section>
    </div>
  );
}
