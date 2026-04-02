"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Member = {
  id: string;
  name: string;
  role: "admin" | "manager" | "member";
};

type ExpenseItem = {
  id: string;
  entry_date: string;
  category:
  | "bazar"
  | "wifi"
  | "utility"
  | "electricity"
  | "gas"
  | "bua"
  | "moyla"
  | "pani"
  | "other";
  amount: number;
  note: string | null;
  paid_by_member_id: string;
};

const sharedCategories = [
  { key: "wifi", label: "WiFi" },
  { key: "utility", label: "Lift Bill" },
  { key: "electricity", label: "Current Bill" },
  { key: "gas", label: "Gas Bill" },
  { key: "bua", label: "Bua Bill" },
  { key: "moyla", label: "Moylar Bill" },
  { key: "pani", label: "Panir Bill" },
] as const;

export default function ExpensesForm({
  members,
  expenses,
  memberMap,
  groupId,
  monthId,
  currentUserRole,
  currentUserMemberId,
}: {
  members: Member[];
  expenses: ExpenseItem[];
  memberMap: Record<string, string>;
  groupId: string;
  monthId: string;
  currentUserRole: "admin" | "manager" | "member";
  currentUserMemberId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const isAdmin = currentUserRole === "admin";
  const isMember = currentUserRole === "member";
  const canManageBazar =
    currentUserRole === "admin" || currentUserRole === "manager";

  const sharedExpenseMap = useMemo(() => {
    const map = new Map<string, ExpenseItem>();
    for (const item of expenses) {
      if (item.category !== "bazar" && item.category !== "other") {
        map.set(item.category, item);
      }
    }
    return map;
  }, [expenses]);

  const bazarExpenses = useMemo(
    () => expenses.filter((item) => item.category === "bazar"),
    [expenses]
  );

  const totalBazar = bazarExpenses.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const totalSharedBills = expenses
    .filter((item) => item.category !== "bazar")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const bazarByMember = useMemo(() => {
    const grouped = members.map((member) => {
      const items = bazarExpenses.filter(
        (expense) => expense.paid_by_member_id === member.id
      );

      const total = items.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      );

      return {
        member,
        items,
        total,
      };
    });

    if (isMember) {
      return grouped.filter(({ member }) => member.id === currentUserMemberId);
    }

    return grouped;
  }, [members, bazarExpenses, isMember, currentUserMemberId]);

  const [sharedValues, setSharedValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const category of sharedCategories) {
      initial[category.key] = String(
        Number(sharedExpenseMap.get(category.key)?.amount ?? 0)
      );
    }
    return initial;
  });

  const [sharedMsg, setSharedMsg] = useState("");
  const [sharedLoading, setSharedLoading] = useState(false);

  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [paidByMemberId, setPaidByMemberId] = useState(currentUserMemberId);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [editingBazarId, setEditingBazarId] = useState<string | null>(null);
  const [bazarMsg, setBazarMsg] = useState("");
  const [bazarLoading, setBazarLoading] = useState(false);

  function updateSharedValue(key: string, value: string) {
    setSharedValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleSaveSharedBills() {
    setSharedMsg("");

    if (!isAdmin) {
      setSharedMsg("Only admin can save shared bills.");
      return;
    }

    setSharedLoading(true);

    for (const category of sharedCategories) {
      const amountValue = Number(sharedValues[category.key] || 0);
      const existing = sharedExpenseMap.get(category.key);

      if (existing) {
        const { error } = await supabase
          .from("expense_entries")
          .update({
            amount: amountValue,
          })
          .eq("id", existing.id);

        if (error) {
          setSharedLoading(false);
          setSharedMsg(error.message);
          return;
        }
      } else {
        const { error } = await supabase.from("expense_entries").insert({
          group_id: groupId,
          month_id: monthId,
          paid_by_member_id: currentUserMemberId,
          amount: amountValue,
          category: category.key,
          note: `${category.label} monthly bill`,
          entry_date: new Date().toISOString().slice(0, 10),
        });

        if (error) {
          setSharedLoading(false);
          setSharedMsg(error.message);
          return;
        }
      }
    }

    setSharedLoading(false);
    setSharedMsg("Shared bills saved successfully.");
    router.refresh();
  }

  function resetBazarForm() {
    setEntryDate("");
    setPaidByMemberId(currentUserMemberId);
    setAmount("");
    setNote("");
    setEditingBazarId(null);
  }

  function startBazarEdit(item: ExpenseItem) {
    setEditingBazarId(item.id);
    setEntryDate(item.entry_date);
    setPaidByMemberId(item.paid_by_member_id);
    setAmount(String(item.amount));
    setNote(item.note || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSaveBazar() {
    setBazarMsg("");

    if (!canManageBazar) {
      setBazarMsg("Only admin or manager can add/edit bazar.");
      return;
    }

    if (!entryDate) {
      setBazarMsg("Select date first.");
      return;
    }

    if (!paidByMemberId) {
      setBazarMsg("Select member first.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setBazarMsg("Enter valid amount.");
      return;
    }

    setBazarLoading(true);

    if (editingBazarId) {
      const { error } = await supabase
        .from("expense_entries")
        .update({
          entry_date: entryDate,
          paid_by_member_id: paidByMemberId,
          amount: Number(amount),
          note: note.trim() || null,
        })
        .eq("id", editingBazarId);

      setBazarLoading(false);

      if (error) {
        setBazarMsg(error.message);
        return;
      }

      setBazarMsg("Bazar updated successfully.");
      resetBazarForm();
      router.refresh();
      return;
    }

    const { error } = await supabase.from("expense_entries").insert({
      group_id: groupId,
      month_id: monthId,
      paid_by_member_id: paidByMemberId,
      amount: Number(amount),
      category: "bazar",
      note: note.trim() || null,
      entry_date: entryDate,
    });

    setBazarLoading(false);

    if (error) {
      setBazarMsg(error.message);
      return;
    }

    setBazarMsg("Bazar saved successfully.");
    resetBazarForm();
    router.refresh();
  }

  async function handleDeleteBazar(id: string) {
    if (!canManageBazar) {
      setBazarMsg("Only admin or manager can delete bazar.");
      return;
    }

    const ok = window.confirm("Delete this bazar entry?");
    if (!ok) return;

    const { error } = await supabase
      .from("expense_entries")
      .delete()
      .eq("id", id);

    if (error) {
      setBazarMsg(error.message);
      return;
    }

    setBazarMsg("Bazar deleted successfully.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Expenses</h1>
        <p className="mt-2 text-slate-600">
          Shared bills are monthly fixed fields. Bazar entries are shown member-wise.
        </p>
      </div>

      {isAdmin ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Monthly Shared Bills</h2>
              <p className="mt-2 text-sm text-slate-500">
                Admin enters these once per month. Later they can update them.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 px-4 py-3 md:min-w-[220px]">
              <p className="text-sm text-slate-500">Shared Bills</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900">
                ৳ {totalSharedBills.toFixed(0)}
              </h3>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            {sharedCategories.map((item) => (
              <div key={item.key}>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {item.label}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={sharedValues[item.key] || "0"}
                  onChange={(e) => updateSharedValue(item.key, e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-teal-600"
                />
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={handleSaveSharedBills}
              disabled={sharedLoading}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sharedLoading ? "Saving..." : "Save Shared Bills"}
            </button>

            {sharedMsg ? <p className="text-sm text-slate-700">{sharedMsg}</p> : null}
          </div>
        </section>
      ) : null}

      {canManageBazar ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              {editingBazarId ? "Edit Bazar Entry" : "Add Bazar Entry"}
            </h2>

            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Total Bazar</p>
              <h3 className="text-lg font-bold text-slate-900">
                ৳ {totalBazar.toFixed(0)}
              </h3>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Date
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Paid By
              </label>
              <select
                value={paidByMemberId}
                onChange={(e) => setPaidByMemberId(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-teal-600"
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Amount
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-teal-600"
              />
            </div>

            <div className="md:col-span-2 xl:col-span-4">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Note
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={handleSaveBazar}
              disabled={bazarLoading}
              className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bazarLoading
                ? "Saving..."
                : editingBazarId
                  ? "Update"
                  : "Save"}
            </button>

            {editingBazarId && (
              <button
                onClick={resetBazarForm}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
            )}

            {bazarMsg ? (
              <p className="text-xs text-slate-600">{bazarMsg}</p>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Total Bazar</h2>
              <p className="mt-1 text-sm text-slate-500">
                You can view bazar history only.
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Total Bazar</p>
              <h3 className="text-lg font-bold text-slate-900">
                ৳ {totalBazar.toFixed(0)}
              </h3>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Member-wise Bazar History
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isMember
              ? "You can view only your own bazar history."
              : "All members' bazar history is shown here."}
          </p>
        </div>

        <div className="mt-5 space-y-5">
          {bazarByMember.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No bazar entries added yet.
            </div>
          ) : (
            bazarByMember.map(({ member, items, total }) => (
              <div
                key={member.id}
                className="overflow-hidden rounded-2xl border border-slate-200"
              >
                <div className="flex flex-col gap-3 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {member.name}
                    </h3>
                    <p className="text-sm capitalize text-slate-500">
                      {member.role}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white px-4 py-2">
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="text-lg font-bold text-slate-900">
                      ৳ {total.toFixed(0)}
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-200">
                  {items.length === 0 ? (
                    <div className="bg-white px-4 py-4 text-sm text-slate-500">
                      No bazar history for this member.
                    </div>
                  ) : (
                    items.map((expense) => (
                      <div
                        key={expense.id}
                        className="rounded-2xl bg-white px-4 py-4"
                      >
                        <div className="sm:hidden space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900">
                              {expense.entry_date}
                            </p>
                            <p className="text-sm font-bold text-slate-900">
                              ৳ {Number(expense.amount).toFixed(0)}
                            </p>
                          </div>

                          <p className="text-sm text-slate-600">
                            {expense.note || "No note"}
                          </p>

                          <div>
                            {canManageBazar ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => startBazarEdit(expense)}
                                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs"
                                >
                                  Edit
                                </button>

                                <button
                                  onClick={() => handleDeleteBazar(expense.id)}
                                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-600"
                                >
                                  Delete
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">
                                View only
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="hidden sm:grid grid-cols-[1.2fr_0.8fr_1.2fr_1fr] items-center gap-3">
                          <p className="text-sm text-slate-800">
                            {expense.entry_date}
                          </p>

                          <p className="text-sm text-slate-800">
                            ৳ {Number(expense.amount).toFixed(0)}
                          </p>

                          <p className="truncate text-sm text-slate-600">
                            {expense.note || "No note"}
                          </p>

                          <div>
                            {canManageBazar ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => startBazarEdit(expense)}
                                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs"
                                >
                                  Edit
                                </button>

                                <button
                                  onClick={() => handleDeleteBazar(expense.id)}
                                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-600"
                                >
                                  Delete
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">
                                View only
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}