"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import EditHistoryBadge, { type ActivityLogEntry } from "@/components/shared/edit-history-badge";
import { recordActivityLog } from "@/lib/activity-logger";

type Member = {
  id: string;
  user_id?: string | null;
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
  { key: "others", label: "Others" },
] as const;

export default function ExpensesForm({
  members,
  expenses,
  groupId,
  monthId,
  currentUserRole,
  currentUserMemberId,
  currentUserId,
  initialActivityLogs = [],
}: {
  members: Member[];
  expenses: ExpenseItem[];
  groupId: string;
  monthId: string;
  currentUserRole: "owner" | "admin" | "manager" | "member";
  currentUserMemberId: string;
  currentUserId?: string;
  initialActivityLogs?: ActivityLogEntry[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>(
    initialActivityLogs ?? []
  );

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
      if (
        item.expense_type === "shared" &&
        item.title !== "Home Amenities" &&
        item.title !== "Mess Amenities"
      ) {
        map.set(item.title, item);
      }
    }
    return map;
  }, [expenses]);

  const amenityExpenses = useMemo(
    () =>
      expenses
        .filter(
          (item) =>
            item.expense_type === "shared" &&
            (item.title === "Mess Amenities" || item.title === "Home Amenities")
        )
        .sort((a, b) => (b.expense_date || "").localeCompare(a.expense_date || "")),
    [expenses]
  );

  const totalAmenities = useMemo(
    () =>
      amenityExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [amenityExpenses]
  );

  const bazarExpenses = useMemo(
    () => expenses.filter((item) => item.expense_type === "bazar"),
    [expenses]
  );

  const totalBazar = bazarExpenses.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const totalSharedBills = expenses
    .filter(
      (item) =>
        item.expense_type === "shared" &&
        item.title !== "Home Amenities" &&
        item.title !== "Mess Amenities"
    )
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

  // Mess Amenities state
  const [amenityDate, setAmenityDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [amenityPaidByMemberId, setAmenityPaidByMemberId] =
    useState(currentUserMemberId);
  const [amenityAmount, setAmenityAmount] = useState("");
  const [amenityItemName, setAmenityItemName] = useState("");
  const [amenityMsg, setAmenityMsg] = useState("");
  const [amenityLoading, setAmenityLoading] = useState(false);

  const [editingAmenityId, setEditingAmenityId] = useState<string | null>(null);
  const [editAmenityDate, setEditAmenityDate] = useState("");
  const [editAmenityAmount, setEditAmenityAmount] = useState("");
  const [editAmenityItemName, setEditAmenityItemName] = useState("");
  const [editAmenityPaidBy, setEditAmenityPaidBy] = useState("");
  const [editAmenityLoading, setEditAmenityLoading] = useState(false);

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

    // Auto-sync shared bills to active members' monthly charges (Option 2)
    const activeMembers = members;
    const activeCount = activeMembers.length;

    if (activeCount > 0) {
      const wifiTotal = Number(sharedValues["wifi"] || 0);
      const liftTotal = Number(sharedValues["utility"] || 0);
      const currentTotal = Number(sharedValues["electricity"] || 0);
      const gasTotal = Number(sharedValues["gas"] || 0);
      const buaTotal = Number(sharedValues["bua"] || 0);
      const moylaTotal = Number(sharedValues["moyla"] || 0);
      const paniTotal = Number(sharedValues["pani"] || 0);

      const perWifi = Math.round(wifiTotal / activeCount);
      const perUtility = Math.round(liftTotal / activeCount);
      const perElectricity = Math.round(currentTotal / activeCount);
      const perGas = Math.round(gasTotal / activeCount);
      const perMoyla = Math.round(moylaTotal / activeCount);
      const perPani = Math.round(paniTotal / activeCount);
      const perBua = buaTotal > 0 ? Math.round(buaTotal / activeCount) : null;

      const { data: existingCharges, error: fetchErr } = await supabase
        .from("member_monthly_charges")
        .select("*")
        .eq("month_id", monthId);

      if (fetchErr) {
        setSharedLoading(false);
        setSharedMsg(fetchErr.message);
        return;
      }

      const chargesMap = new Map(
        (existingCharges ?? []).map((c) => [c.member_id, c])
      );

      const missingMemberIds = activeMembers
        .filter((m) => !chargesMap.has(m.id))
        .map((m) => m.id);

      let defaultChargesMap = new Map();
      if (missingMemberIds.length > 0) {
        const { data: defCharges } = await supabase
          .from("member_default_charges")
          .select("*")
          .in("member_id", missingMemberIds);

        defaultChargesMap = new Map(
          (defCharges ?? []).map((d) => [d.member_id, d])
        );
      }

      const syncPayload = activeMembers.map((member) => {
        const existing = chargesMap.get(member.id);
        const def = defaultChargesMap.get(member.id);

        const rent = existing
          ? Number(existing.rent || 0)
          : Number(def?.rent || 0);

        const khala =
          perBua !== null
            ? perBua
            : existing
            ? Number(existing.khala_bill || 0)
            : Number(def?.khala_bill || 0);

        return {
          month_id: monthId,
          member_id: member.id,
          rent,
          wifi: perWifi,
          utility: perUtility,
          electricity: perElectricity,
          gas: perGas,
          water: perPani,
          others: perMoyla,
          khala_bill: khala,
          discount: existing ? Number(existing.discount || 0) : 0,
          advance: existing ? Number(existing.advance || 0) : 0,
          previous_due: existing ? Number(existing.previous_due || 0) : 0,
        };
      });

      const { error: syncError } = await supabase
        .from("member_monthly_charges")
        .upsert(syncPayload, { onConflict: "month_id,member_id" });

      if (syncError) {
        setSharedLoading(false);
        setSharedMsg(syncError.message);
        return;
      }
    }

    setSharedLoading(false);
    setSharedMsg("Shared bills saved and distributed equally among active members.");
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

    if (currentUserId) {
      const oldItem = expenses.find((e) => e.id === item.id) ?? item;
      const logPayload = {
        groupId,
        actorUserId: currentUserId,
        action: "update_bazar",
        targetTable: "expense_entries",
        targetId: item.id,
        oldData: {
          amount: Number(oldItem.amount),
          date: oldItem.expense_date,
          note: oldItem.description,
        },
        newData: {
          amount: Number(editAmount),
          date: editDate,
          note: editNote.trim() || null,
        },
      };
      await recordActivityLog(supabase, logPayload);
      setActivityLogs((prev) => [
        {
          id: crypto.randomUUID(),
          actor_user_id: currentUserId,
          action: "update_bazar",
          target_table: "expense_entries",
          target_id: item.id,
          old_data: logPayload.oldData,
          new_data: logPayload.newData,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
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

  function startAmenityEdit(item: ExpenseItem) {
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

  async function handleSaveAmenity() {
    setAmenityMsg("");

    if (!canManageBazar) {
      setAmenityMsg("Only admin or manager can add amenities.");
      return;
    }

    if (!amenityDate) {
      setAmenityMsg("Select date first.");
      return;
    }

    if (!amenityPaidByMemberId) {
      setAmenityMsg("Select member first.");
      return;
    }

    if (!amenityAmount || Number(amenityAmount) <= 0) {
      setAmenityMsg("Enter valid amount.");
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

  async function handleSaveAmenityEdit(id: string) {
    setAmenityMsg("");

    if (!canManageBazar) {
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
        description: editAmenityItemName.trim() || "Mess Amenities",
        paid_by_member_id: editAmenityPaidBy,
      })
      .eq("id", id);

    setEditAmenityLoading(false);

    if (error) {
      setAmenityMsg(error.message);
      return;
    }

    if (currentUserId) {
      const oldItem = expenses.find((e) => e.id === id);
      const logPayload = {
        groupId,
        actorUserId: currentUserId,
        action: "update_amenity",
        targetTable: "expense_entries",
        targetId: id,
        oldData: {
          amount: Number(oldItem?.amount ?? 0),
          date: oldItem?.expense_date,
          note: oldItem?.description,
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
    if (!canManageBazar) {
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

          <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
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

      {/* Mess Amenities Entry Section */}
      {canManageBazar ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Add Mess Amenities Entry
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Supplies (Harpic, Jharu, Tissue, etc.) split equally among active members.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-right dark:bg-slate-800/60">
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Amenities</p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  ৳ {totalAmenities.toFixed(0)}
                </h3>
              </div>
              <div className="rounded-xl bg-teal-50 px-3 py-2 text-right dark:bg-teal-950/40">
                <p className="text-xs text-teal-700 dark:text-teal-400">Per Member</p>
                <h3 className="text-lg font-bold text-teal-700 dark:text-teal-300">
                  ৳ {members.length > 0 ? (totalAmenities / members.length).toFixed(1) : "0"}
                </h3>
              </div>
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
                className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Paid By
              </label>
              <select
                value={amenityPaidByMemberId}
                onChange={(e) => setAmenityPaidByMemberId(e.target.value)}
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
                value={amenityAmount}
                onChange={(e) => setAmenityAmount(e.target.value)}
                placeholder="e.g. 250"
                className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
                className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={handleSaveAmenity}
              disabled={amenityLoading}
              className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
            >
              {amenityLoading ? "Saving..." : "Save"}
            </button>

            {amenityMsg && !editingAmenityId ? (
              <p className="text-xs text-slate-600 dark:text-slate-400">{amenityMsg}</p>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mess Amenities</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                You can view amenities history only.
              </p>
            </div>

            <div className="flex gap-2">
              <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Amenities</p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  ৳ {totalAmenities.toFixed(0)}
                </h3>
              </div>
              <div className="rounded-xl bg-teal-50 px-3 py-2 dark:bg-teal-950/40">
                <p className="text-xs text-teal-700 dark:text-teal-400">Per Member</p>
                <h3 className="text-lg font-bold text-teal-700 dark:text-teal-300">
                  ৳ {members.length > 0 ? (totalAmenities / members.length).toFixed(1) : "0"}
                </h3>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Mess Amenities History */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Mess Amenities History
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Shared household items split equally among active members (does not affect meal rate).
            </p>
          </div>

          <div className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
            {amenityExpenses.length} {amenityExpenses.length === 1 ? "entry" : "entries"}
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {amenityExpenses.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                No mess amenities added yet for this month.
              </div>
            ) : (
              amenityExpenses.map((expense) => {
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
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
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

                      {canManageBazar ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => startAmenityEdit(expense)}
                            className="rounded-lg border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteAmenity(expense.id)}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
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
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                  {expense.expense_date}
                                </p>
                                <EditHistoryBadge
                                  logs={activityLogs.filter((l) => l.target_id === expense.id)}
                                  members={members}
                                />
                              </div>
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
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-slate-800 dark:text-slate-200">
                                {expense.expense_date}
                              </p>
                              <EditHistoryBadge
                                logs={activityLogs.filter((l) => l.target_id === expense.id)}
                                members={members}
                              />
                            </div>

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
