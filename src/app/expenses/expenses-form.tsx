"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Member = {
  id: string;
  full_name: string;
  role: "owner" | "admin" | "manager" | "member";
};

type ExpenseItem = {
  id: string;
  expense_date: string;
  expense_type: "bazar" | "shared";
  amount: number;
  title: string;
  description: string | null;
  paid_by_member_id: string | null;
};

// Shared monthly bills. In the new schema these are stored as expense_entries
// rows with expense_type = "shared"; the category is kept in the title so the
// labelled inputs below still map one-to-one.
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
  groupId,
  monthId,
  currentUserRole,
  currentUserMemberId,
}: {
  members: Member[];
  expenses: ExpenseItem[];
  groupId: string;
  monthId: string;
  currentUserRole: "owner" | "admin" | "manager" | "member";
  currentUserMemberId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const isAdmin = currentUserRole === "owner" || currentUserRole === "admin";
  const isMember = currentUserRole === "member";
  const canManageBazar =
    currentUserRole === "owner" ||
    currentUserRole === "admin" ||
    currentUserRole === "manager";

  // Shared bills keyed by their title (which holds the category label).
  const sharedExpenseMap = useMemo(() => {
    const map = new Map<string, ExpenseItem>();
    for (const item of expenses) {
      if (item.expense_type === "shared") {
        map.set(item.title, item);
      }
    }
    return map;
  }, [expenses]);

  const bazarExpenses = useMemo(
    () => expenses.filter((item) => item.expense_type === "bazar"),
    [expenses]
  );

  const totalBazar = bazarExpenses.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const totalSharedBills = expenses
    .filter((item) => item.expense_type === "shared")
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
        Number(sharedExpenseMap.get(category.label)?.amount ?? 0)
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
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editLoading, setEditLoading] = useState(false);
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
      const existing = sharedExpenseMap.get(category.label);

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
          expense_type: "shared",
          title: category.label,
          description: `${category.label} monthly bill`,
          expense_date: new Date().toISOString().slice(0, 10),
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
    setEntryDate(new Date().toISOString().slice(0, 10));
    setPaidByMemberId(currentUserMemberId);
    setAmount("");
    setNote("");
  }

  // Inline-edit a single bazar row in place (date / amount / note).
  function startBazarEdit(item: ExpenseItem) {
    if (!canManageBazar) return;
    setEditingBazarId(item.id);
    setEditDate(item.expense_date);
    setEditAmount(String(item.amount));
    setEditNote(item.description || "");
    setBazarMsg("");
  }

  function cancelBazarEdit() {
    setEditingBazarId(null);
    setEditDate("");
    setEditAmount("");
    setEditNote("");
  }

  async function saveBazarEdit(item: ExpenseItem) {
    if (!canManageBazar) {
      setBazarMsg("Only admin or manager can edit bazar.");
      return;
    }

    if (!editDate) {
      setBazarMsg("Select a date.");
      return;
    }

    if (!editAmount || Number(editAmount) <= 0) {
      setBazarMsg("Enter a valid amount.");
      return;
    }

    setEditLoading(true);

    const { error } = await supabase
      .from("expense_entries")
      .update({
        expense_date: editDate,
        amount: Number(editAmount),
        description: editNote.trim() || null,
      })
      .eq("id", item.id);

    setEditLoading(false);

    if (error) {
      setBazarMsg(error.message);
      return;
    }

    cancelBazarEdit();
    setBazarMsg("Bazar updated successfully.");
    router.refresh();
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

    const { error } = await supabase.from("expense_entries").insert({
      group_id: groupId,
      month_id: monthId,
      paid_by_member_id: paidByMemberId,
      amount: Number(amount),
      expense_type: "bazar",
      title: "Bazar",
      description: note.trim() || null,
      expense_date: entryDate,
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
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Expenses</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Shared bills are monthly fixed fields. Bazar entries are shown member-wise.
        </p>
      </div>

      {isAdmin ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Monthly Shared Bills</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Admin enters these once per month. Later they can update them.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 px-4 py-3 md:min-w-[220px] dark:bg-slate-800/60">
              <p className="text-sm text-slate-500 dark:text-slate-400">Shared Bills</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                ৳ {totalSharedBills.toFixed(0)}
              </h3>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            {sharedCategories.map((item) => (
              <div key={item.key}>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  {item.label}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={sharedValues[item.key] || "0"}
                  onChange={(e) => updateSharedValue(item.key, e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={handleSaveSharedBills}
              disabled={sharedLoading}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-700 dark:hover:bg-teal-600 shadow-sm"
            >
              {sharedLoading ? "Saving..." : "Save Shared Bills"}
            </button>

            {sharedMsg ? <p className="text-sm text-slate-700 dark:text-slate-300">{sharedMsg}</p> : null}
          </div>
        </section>
      ) : null}

      {canManageBazar ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add Bazar Entry</h2>

            <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Bazar</p>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                ৳ {totalBazar.toFixed(0)}
              </h3>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Date
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Paid By
              </label>
              <select
                value={paidByMemberId}
                onChange={(e) => setPaidByMemberId(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="md:col-span-2 xl:col-span-4">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Note
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={handleSaveBazar}
              disabled={bazarLoading}
              className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
            >
              {bazarLoading ? "Saving..." : "Save"}
            </button>

            {bazarMsg && !editingBazarId ? (
              <p className="text-xs text-slate-600 dark:text-slate-400">{bazarMsg}</p>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Total Bazar</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                You can view bazar history only.
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Bazar</p>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                ৳ {totalBazar.toFixed(0)}
              </h3>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Member-wise Bazar History
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isMember
              ? "You can view only your own bazar history."
              : "All members' bazar history is shown here."}
          </p>
        </div>

        <div className="mt-5 space-y-5">
          {bazarByMember.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
              No bazar entries added yet.
            </div>
          ) : (
            bazarByMember.map(({ member, items, total }) => (
              <div
                key={member.id}
                className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800"
              >
                <div className="flex flex-col gap-3 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-800/60">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {member.full_name}
                    </h3>
                    <p className="text-sm capitalize text-slate-500 dark:text-slate-400">
                      {member.role}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white px-4 py-2 shadow-sm dark:bg-slate-900">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      ৳ {total.toFixed(0)}
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {items.length === 0 ? (
                    <div className="bg-white px-4 py-4 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                      No bazar history for this member.
                    </div>
                  ) : (
                    items.map((expense) => {
                      const isEditing = editingBazarId === expense.id;

                      if (isEditing) {
                        return (
                          <div
                            key={expense.id}
                            className="rounded-2xl bg-teal-50/40 px-4 py-4 dark:bg-teal-950/30"
                          >
                            <div className="grid gap-3 sm:grid-cols-[1.2fr_0.8fr_1.6fr_auto] sm:items-end">
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                                  Date
                                </label>
                                <input
                                  type="date"
                                  value={editDate}
                                  onChange={(e) => setEditDate(e.target.value)}
                                  className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                />
                              </div>

                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                                  Amount
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editAmount}
                                  onChange={(e) => setEditAmount(e.target.value)}
                                  className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                />
                              </div>

                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                                  Note
                                </label>
                                <input
                                  type="text"
                                  value={editNote}
                                  onChange={(e) => setEditNote(e.target.value)}
                                  className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                  placeholder="No note"
                                />
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveBazarEdit(expense)}
                                  disabled={editLoading}
                                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {editLoading ? "Saving..." : "Save"}
                                </button>
                                <button
                                  onClick={cancelBazarEdit}
                                  disabled={editLoading}
                                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>

                            {bazarMsg ? (
                              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                                {bazarMsg}
                              </p>
                            ) : null}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={expense.id}
                          className="rounded-2xl bg-white px-4 py-4 dark:bg-slate-900"
                        >
                          <div className="sm:hidden space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {expense.expense_date}
                              </p>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">
                                ৳ {Number(expense.amount).toFixed(0)}
                              </p>
                            </div>

                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {expense.description || "No note"}
                            </p>

                            <div>
                              {canManageBazar ? (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => startBazarEdit(expense)}
                                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                  >
                                    Edit
                                  </button>

                                  <button
                                    onClick={() => handleDeleteBazar(expense.id)}
                                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
                                  >
                                    Delete
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  View only
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="hidden sm:grid grid-cols-[1.2fr_0.8fr_1.2fr_1fr] items-center gap-3">
                            <p className="text-sm text-slate-800 dark:text-slate-200">
                              {expense.expense_date}
                            </p>

                            <p className="text-sm text-slate-800 dark:text-slate-200">
                              ৳ {Number(expense.amount).toFixed(0)}
                            </p>

                            <p className="truncate text-sm text-slate-600 dark:text-slate-400">
                              {expense.description || "No note"}
                            </p>

                            <div>
                              {canManageBazar ? (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => startBazarEdit(expense)}
                                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                  >
                                    Edit
                                  </button>

                                  <button
                                    onClick={() => handleDeleteBazar(expense.id)}
                                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
                                  >
                                    Delete
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  View only
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
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
