"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Member = {
  id: string;
  name: string;
  role: "admin" | "manager" | "member";
  monthly_rent: number;
  mobile_number: string;
  nid_number: string | null;
  is_active: boolean;
};

type ChargeRow = {
  id: string;
  member_id: string;
  rent_amount: number;
};

type EditableState = Record<
  string,
  {
    defaultRent: string;
    monthRent: string;
  }
>;
// ✅ Dynamic current month
  const currentDate = new Date();
  const monthYear = currentDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

export default function MembersManager({
  groupId,
  members,
  monthId,
  charges,
  currentUserRole,
  currentUserMemberId,
}: {
  groupId: string;
  members: Member[];
  monthId: string | null;
  charges: ChargeRow[];
  currentUserRole: "admin" | "manager" | "member";
  currentUserMemberId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const isAdmin = currentUserRole === "admin";
  const isMember = currentUserRole === "member";

  const rentVisibleMembers = useMemo(() => {
    if (isMember) {
      return members.filter((member) => member.id === currentUserMemberId);
    }
    return members;
  }, [isMember, members, currentUserMemberId]);

  const initialState = useMemo<EditableState>(() => {
    const chargeMap = new Map(charges.map((item) => [item.member_id, item]));

    const result: EditableState = {};

    for (const member of members) {
      const charge = chargeMap.get(member.id);

      result[member.id] = {
        defaultRent: String(Number(member.monthly_rent ?? 0)),
        monthRent: String(
          Number(charge?.rent_amount ?? member.monthly_rent ?? 0)
        ),
      };
    }

    return result;
  }, [members, charges]);

  const [formData, setFormData] = useState<EditableState>(initialState);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [newName, setNewName] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [newNid, setNewNid] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "manager" | "member">(
    "member"
  );
  const [newRent, setNewRent] = useState("0");
  const [addLoading, setAddLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    name: "",
    mobile: "",
    nid: "",
    role: "member" as "admin" | "manager" | "member",
  });

  function updateField(
    memberId: string,
    field: keyof EditableState[string],
    value: string
  ) {
    setFormData((prev) => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        [field]: value,
      },
    }));
  }

  function startEdit(member: Member) {
    setEditingId(member.id);
    setEditData({
      name: member.name,
      mobile: member.mobile_number,
      nid: member.nid_number || "",
      role: member.role,
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

    if (memberRole === "admin" && editData.role !== "admin") {
      const adminCount = members.filter((item) => item.role === "admin").length;

      if (adminCount <= 1) {
        setMsg("At least one admin must remain in the mess.");
        return;
      }
    }

    const duplicate = members.find(
      (item) => item.id !== memberId && item.mobile_number.trim() === cleanMobile
    );

    if (duplicate) {
      setMsg("Another member already uses this mobile number.");
      return;
    }

    const { error } = await supabase
      .from("members")
      .update({
        name: cleanName,
        mobile_number: cleanMobile,
        nid_number: cleanNid || null,
        role: editData.role,
      })
      .eq("id", memberId);

    if (error) {
      setMsg(error.message);
      return;
    }

    cancelEdit();
    setMsg("Member updated successfully.");
    router.refresh();
  }

  async function handleSaveRent() {
    setMsg("");

    if (!isAdmin) {
      setMsg("Only admin can edit rent.");
      return;
    }

    setLoading(true);

    const memberUpdates = members.map((member) =>
      supabase
        .from("members")
        .update({
          monthly_rent: Number(formData[member.id]?.defaultRent || 0),
        })
        .eq("id", member.id)
    );

    const results = await Promise.all(memberUpdates);
    const error = results.find((r) => r.error)?.error;

    if (error) {
      setLoading(false);
      setMsg(error.message);
      return;
    }

    if (monthId) {
      const payload = members
        .filter((member) => member.is_active)
        .map((member) => ({
          month_id: monthId,
          member_id: member.id,
          rent_amount: Number(formData[member.id]?.monthRent || 0),
        }));

      const { error: chargeError } = await supabase
        .from("member_monthly_charges")
        .upsert(payload, {
          onConflict: "month_id,member_id",
        });

      if (chargeError) {
        setLoading(false);
        setMsg(chargeError.message);
        return;
      }
    }

    setLoading(false);
    setMsg("Rent updated successfully.");
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

    const duplicate = members.find(
      (member) => member.mobile_number.trim() === newMobile.trim()
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
        name: newName.trim(),
        mobile_number: newMobile.trim(),
        nid_number: newNid.trim() || null,
        role: newRole,
        monthly_rent: Number(newRent || 0),
        is_active: true,
      })
      .select("id")
      .single();

    if (memberError || !memberData) {
      setAddLoading(false);
      setMsg(memberError?.message || "Failed to add member.");
      return;
    }

    if (monthId) {
      await supabase.from("member_monthly_charges").upsert(
        {
          month_id: monthId,
          member_id: memberData.id,
          rent_amount: Number(newRent || 0),
        },
        {
          onConflict: "month_id,member_id",
        }
      );
    }

    setAddLoading(false);
    setNewName("");
    setNewMobile("");
    setNewNid("");
    setNewRole("member");
    setNewRent("0");
    setMsg("Member added successfully.");
    router.refresh();
  }

  async function handleDeactivate(
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
        (item) => item.role === "admin" && item.is_active
      ).length;

      if (activeAdminCount <= 1) {
        setMsg("At least one active admin must remain in the mess.");
        return;
      }
    }

    const text = active
      ? "Deactivate this member? Old data will remain."
      : "Activate this member again?";

    const ok = window.confirm(text);
    if (!ok) return;

    const { error } = await supabase
      .from("members")
      .update({
        is_active: !active,
      })
      .eq("id", memberId);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg(active ? "Member deactivated." : "Member activated.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Members</h1>
        <p className="mt-2 text-slate-600">
          Member info, status, and current month rent. Current month: <b>{monthYear}</b>
        </p>
      </div>

      {isAdmin ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Add New Member</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-600"
                placeholder="Required"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Mobile Number
              </label>
              <input
                type="text"
                value={newMobile}
                onChange={(e) => setNewMobile(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-600"
                placeholder="Required"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                NID Number
              </label>
              <input
                type="text"
                value={newNid}
                onChange={(e) => setNewNid(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-600"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Role
              </label>
              <select
                value={newRole}
                onChange={(e) =>
                  setNewRole(e.target.value as "admin" | "manager" | "member")
                }
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-teal-600"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="member">Member</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                House Rent
              </label>
              <input
                type="number"
                min="0"
                value={newRent}
                onChange={(e) => setNewRent(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div className="mt-5">
            <button
              onClick={handleAddMember}
              disabled={!isAdmin || addLoading}
              className="rounded-2xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {addLoading ? "Adding..." : "Add Member"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Member Information</h2>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-sm text-slate-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Mobile</th>
                <th className="px-3 py-2">NID</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">House Rent</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>

            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="bg-slate-50 text-sm">
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
                        className="w-full rounded-xl border border-slate-300 px-3 py-2"
                      />
                    ) : (
                      <span className="font-semibold text-slate-900">
                        {member.name}
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
                        className="w-full rounded-xl border border-slate-300 px-3 py-2"
                      />
                    ) : (
                      member.mobile_number
                    )}
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
                        className="w-full rounded-xl border border-slate-300 px-3 py-2"
                      />
                    ) : (
                      member.nid_number || "-"
                    )}
                  </td>

                  <td className="px-3 py-3">
                    {editingId === member.id ? (
                      <select
                        value={editData.role}
                        onChange={(e) =>
                          setEditData((prev) => ({
                            ...prev,
                            role: e.target.value as "admin" | "manager" | "member",
                          }))
                        }
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2"
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="member">Member</option>
                      </select>
                    ) : (
                      <span className="capitalize">{member.role}</span>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    ৳ {Number(member.monthly_rent).toFixed(0)}
                  </td>

                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        member.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {member.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>

                  <td className="px-3 py-3">
                    {isAdmin ? (
                      <div className="flex flex-wrap gap-2">
                        {editingId === member.id ? (
                          <>
                            <button
                              onClick={() => handleSaveEdit(member.id, member.role)}
                              className="rounded-xl bg-green-600 px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="rounded-xl bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
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
                                handleDeactivate(
                                  member.id,
                                  member.is_active,
                                  member.role
                                )
                              }
                              className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                                member.is_active
                                  ? "border border-red-200 bg-red-50 text-red-600"
                                  : "border border-green-200 bg-green-50 text-green-700"
                              }`}
                            >
                              {member.is_active ? "Deactivate" : "Activate"}
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">View only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          {isMember ? "My Current Month Rent" : "Current Month Rent"}
        </h2>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-sm text-slate-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">House Rent</th>
                <th className="px-3 py-2">Current Month House Rent</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>

            <tbody>
              {rentVisibleMembers.map((member) => (
                <tr key={member.id} className="bg-slate-50 text-sm">
                  <td className="px-3 py-3 font-semibold text-slate-900">
                    {member.name}
                  </td>

                  <td className="px-3 py-3 capitalize">{member.role}</td>

                  <td className="px-3 py-3">
                    <input
                      type="number"
                      value={formData[member.id]?.defaultRent}
                      onChange={(e) =>
                        updateField(member.id, "defaultRent", e.target.value)
                      }
                      disabled={!isAdmin}
                      className="w-24 rounded-xl border border-slate-300 px-2 py-1 disabled:bg-slate-100"
                    />
                  </td>

                  <td className="px-3 py-3">
                    <input
                      type="number"
                      value={formData[member.id]?.monthRent}
                      onChange={(e) =>
                        updateField(member.id, "monthRent", e.target.value)
                      }
                      disabled={!isAdmin || !monthId || !member.is_active}
                      className="w-28 rounded-xl border border-slate-300 px-2 py-1 disabled:bg-slate-100"
                    />
                  </td>

                  <td className="px-3 py-3">
                    {member.is_active ? "Active" : "Inactive"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isMember ? (
          <button
            onClick={handleSaveRent}
            disabled={!isAdmin || loading}
            className="mt-6 rounded-2xl bg-green-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Saving..." : "Save Rent"}
          </button>
        ) : null}

        {msg && <p className="mt-3 text-sm text-slate-700">{msg}</p>}
      </section>
    </div>
  );
}