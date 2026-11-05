"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Edit2,
  Plus,
  ShieldAlert,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { MemberItem, ReserveFundEntry } from "./page";

export default function ReserveFundView({
  groupId,
  members,
  initialEntries,
  currentUserRole,
  currentUserMemberId,
  tableMissing,
}: {
  groupId: string;
  members: MemberItem[];
  initialEntries: ReserveFundEntry[];
  currentUserRole: string;
  currentUserMemberId: string;
  tableMissing: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const canManage =
    currentUserRole === "owner" ||
    currentUserRole === "admin" ||
    currentUserRole === "manager";

  const [entries, setEntries] = useState<ReserveFundEntry[]>(initialEntries);
  const [activeTab, setActiveTab] = useState<"add" | "spend" | "handover">("add");
  const [filterType, setFilterType] = useState<"all" | "add" | "spend" | "handover">("all");
  const [copiedSql, setCopiedSql] = useState(false);

  // Form states
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  // Add form
  const [addDate, setAddDate] = useState(today);
  const [addAmount, setAddAmount] = useState("");
  const [addCustodianId, setAddCustodianId] = useState(currentUserMemberId);
  const [addTitle, setAddTitle] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addMsg, setAddMsg] = useState("");

  // Spend form
  const [spendDate, setSpendDate] = useState(today);
  const [spendAmount, setSpendAmount] = useState("");
  const [spendCustodianId, setSpendCustodianId] = useState(currentUserMemberId);
  const [spendTitle, setSpendTitle] = useState("");
  const [spendDesc, setSpendDesc] = useState("");
  const [spendLoading, setSpendLoading] = useState(false);
  const [spendMsg, setSpendMsg] = useState("");

  // Handover form
  const [handoverDate, setHandoverDate] = useState(today);
  const [handoverAmount, setHandoverAmount] = useState("");
  const [handoverFromId, setHandoverFromId] = useState(currentUserMemberId);
  const [handoverToId, setHandoverToId] = useState(
    members.find((m) => m.id !== currentUserMemberId)?.id || ""
  );
  const [handoverNote, setHandoverNote] = useState("");
  const [handoverLoading, setHandoverLoading] = useState(false);
  const [handoverMsg, setHandoverMsg] = useState("");

  // Edit modal
  const [editingEntry, setEditingEntry] = useState<ReserveFundEntry | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCustodianId, setEditCustodianId] = useState("");
  const [editToMemberId, setEditToMemberId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editMsg, setEditMsg] = useState("");

  // Quick stats
  const totalAdded = useMemo(
    () =>
      entries
        .filter((e) => e.entry_type === "add")
        .reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [entries]
  );

  const totalSpent = useMemo(
    () =>
      entries
        .filter((e) => e.entry_type === "spend")
        .reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [entries]
  );

  const totalBalance = totalAdded - totalSpent;

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === "active"),
    [members]
  );

  // Custodian Cash In Hand calculation
  const custodianBalances = useMemo(() => {
    const balanceMap = new Map<string, number>();

    // initialize for all members
    for (const m of members) {
      balanceMap.set(m.id, 0);
    }

    for (const entry of entries) {
      const amt = Number(entry.amount || 0);
      if (entry.entry_type === "add") {
        const cur = balanceMap.get(entry.custodian_member_id) || 0;
        balanceMap.set(entry.custodian_member_id, cur + amt);
      } else if (entry.entry_type === "spend") {
        const cur = balanceMap.get(entry.custodian_member_id) || 0;
        balanceMap.set(entry.custodian_member_id, cur - amt);
      } else if (entry.entry_type === "handover") {
        const curFrom = balanceMap.get(entry.custodian_member_id) || 0;
        balanceMap.set(entry.custodian_member_id, curFrom - amt);
        if (entry.to_member_id) {
          const curTo = balanceMap.get(entry.to_member_id) || 0;
          balanceMap.set(entry.to_member_id, curTo + amt);
        }
      }
    }

    return members.map((m) => ({
      member: m,
      balance: balanceMap.get(m.id) || 0,
    }));
  }, [members, entries]);

  // Only custodians who currently hold positive cash (balance > 0)
  const custodiansWithCash = useMemo(
    () => custodianBalances.filter((c) => c.balance > 0),
    [custodianBalances]
  );

  // Auto-sync selected custodian for spend and handover if invalid
  const spendCustodianBalance = useMemo(() => {
    const item = custodianBalances.find((c) => c.member.id === spendCustodianId);
    return item ? item.balance : 0;
  }, [custodianBalances, spendCustodianId]);

  const handoverFromBalance = useMemo(() => {
    const item = custodianBalances.find((c) => c.member.id === handoverFromId);
    return item ? item.balance : 0;
  }, [custodianBalances, handoverFromId]);

  // Keep spend and handover custodians valid automatically
  useEffect(() => {
    if (custodiansWithCash.length > 0) {
      if (!spendCustodianId || !custodiansWithCash.some((c) => c.member.id === spendCustodianId)) {
        setSpendCustodianId(custodiansWithCash[0].member.id);
      }
      if (!handoverFromId || !custodiansWithCash.some((c) => c.member.id === handoverFromId)) {
        setHandoverFromId(custodiansWithCash[0].member.id);
      }
    } else {
      setSpendCustodianId("");
      setHandoverFromId("");
    }
  }, [custodiansWithCash, spendCustodianId, handoverFromId]);

  useEffect(() => {
    const validReceivers = activeMembers.filter((m) => m.id !== handoverFromId);
    if (validReceivers.length > 0 && (!handoverToId || handoverToId === handoverFromId)) {
      setHandoverToId(validReceivers[0].id);
    }
  }, [activeMembers, handoverFromId, handoverToId]);

  // Filtered transactions
  const filteredEntries = useMemo(() => {
    if (filterType === "all") return entries;
    return entries.filter((e) => e.entry_type === filterType);
  }, [entries, filterType]);

  // Handlers
  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAddMsg("");

    if (!canManage) {
      setAddMsg("Only admin and manager can add fund entries.");
      return;
    }

    const num = Number(addAmount);
    if (!num || num <= 0) {
      setAddMsg("Please enter a valid amount.");
      return;
    }

    if (!addCustodianId) {
      setAddMsg("Please select who is holding this cash.");
      return;
    }

    const title = addTitle.trim() || "Reserve Fund Deposit";

    setAddLoading(true);
    const { data, error } = await supabase
      .from("reserve_fund_entries")
      .insert({
        group_id: groupId,
        entry_type: "add",
        amount: num,
        custodian_member_id: addCustodianId,
        entry_date: addDate || today,
        title,
        description: addDesc.trim() || null,
        created_by_member_id: currentUserMemberId,
      })
      .select("*")
      .single();

    setAddLoading(false);

    if (error) {
      setAddMsg(error.message);
      return;
    }

    setEntries((prev) => [data, ...prev]);
    setAddAmount("");
    setAddTitle("");
    setAddDesc("");
    setAddMsg("Fund added successfully!");
    router.refresh();
  }

  async function handleSpendSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSpendMsg("");

    if (!canManage) {
      setSpendMsg("Only admin and manager can record expenses.");
      return;
    }

    const num = Number(spendAmount);
    if (!num || num <= 0) {
      setSpendMsg("Please enter a valid amount.");
      return;
    }

    if (!spendCustodianId) {
      setSpendMsg("Please select who paid this cash.");
      return;
    }

    if (!spendTitle.trim()) {
      setSpendMsg("Please enter what was purchased (Item description).");
      return;
    }

    setSpendLoading(true);
    const { data, error } = await supabase
      .from("reserve_fund_entries")
      .insert({
        group_id: groupId,
        entry_type: "spend",
        amount: num,
        custodian_member_id: spendCustodianId,
        entry_date: spendDate || today,
        title: spendTitle.trim(),
        description: spendDesc.trim() || null,
        created_by_member_id: currentUserMemberId,
      })
      .select("*")
      .single();

    setSpendLoading(false);

    if (error) {
      setSpendMsg(error.message);
      return;
    }

    setEntries((prev) => [data, ...prev]);
    setSpendAmount("");
    setSpendTitle("");
    setSpendDesc("");
    setSpendMsg("Expense recorded from reserve fund!");
    router.refresh();
  }

  async function handleHandoverSubmit(e: React.FormEvent) {
    e.preventDefault();
    setHandoverMsg("");

    if (!canManage) {
      setHandoverMsg("Only admin and manager can record handovers.");
      return;
    }

    const num = Number(handoverAmount);
    if (!num || num <= 0) {
      setHandoverMsg("Please enter a valid amount.");
      return;
    }

    if (!handoverFromId || !handoverToId) {
      setHandoverMsg("Please select both From and To members.");
      return;
    }

    if (handoverFromId === handoverToId) {
      setHandoverMsg("From and To members must be different.");
      return;
    }

    setHandoverLoading(true);
    const fromMember = members.find((m) => m.id === handoverFromId)?.full_name || "Member";
    const toMember = members.find((m) => m.id === handoverToId)?.full_name || "Member";

    const { data, error } = await supabase
      .from("reserve_fund_entries")
      .insert({
        group_id: groupId,
        entry_type: "handover",
        amount: num,
        custodian_member_id: handoverFromId,
        to_member_id: handoverToId,
        entry_date: handoverDate || today,
        title: `Handover: ${fromMember} ➔ ${toMember}`,
        description: handoverNote.trim() || null,
        created_by_member_id: currentUserMemberId,
      })
      .select("*")
      .single();

    setHandoverLoading(false);

    if (error) {
      setHandoverMsg(error.message);
      return;
    }

    setEntries((prev) => [data, ...prev]);
    setHandoverAmount("");
    setHandoverNote("");
    setHandoverMsg("Cash handover recorded successfully!");
    router.refresh();
  }

  function startEdit(entry: ReserveFundEntry) {
    setEditingEntry(entry);
    setEditDate(entry.entry_date);
    setEditAmount(String(entry.amount));
    setEditCustodianId(entry.custodian_member_id);
    setEditToMemberId(entry.to_member_id || "");
    setEditTitle(entry.title);
    setEditDesc(entry.description || "");
    setEditMsg("");
  }

  async function handleSaveEdit() {
    if (!editingEntry) return;
    setEditMsg("");

    const num = Number(editAmount);
    if (!num || num <= 0) {
      setEditMsg("Please enter a valid amount.");
      return;
    }

    setEditLoading(true);

    const updatePayload: Record<string, unknown> = {
      entry_date: editDate,
      amount: num,
      custodian_member_id: editCustodianId,
      title: editTitle.trim() || editingEntry.title,
      description: editDesc.trim() || null,
    };

    if (editingEntry.entry_type === "handover") {
      updatePayload.to_member_id = editToMemberId;
    }

    const { error } = await supabase
      .from("reserve_fund_entries")
      .update(updatePayload)
      .eq("id", editingEntry.id);

    setEditLoading(false);

    if (error) {
      setEditMsg(error.message);
      return;
    }

    setEntries((prev) =>
      prev.map((e) =>
        e.id === editingEntry.id
          ? {
              ...e,
              ...updatePayload,
              amount: num,
            }
          : e
      )
    );

    setEditingEntry(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!canManage) return;
    const ok = window.confirm("Are you sure you want to delete this reserve fund entry?");
    if (!ok) return;

    const { error } = await supabase
      .from("reserve_fund_entries")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Error deleting entry: " + error.message);
      return;
    }

    setEntries((prev) => prev.filter((e) => e.id !== id));
    router.refresh();
  }

  function copyMigrationSql() {
    const sql = `CREATE TABLE IF NOT EXISTS public.reserve_fund_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.mess_groups(id) ON DELETE CASCADE,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('add', 'spend', 'handover')),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    custodian_member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
    to_member_id UUID REFERENCES public.members(id) ON DELETE RESTRICT,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    title TEXT NOT NULL,
    description TEXT,
    created_by_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reserve_fund_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow members to view reserve fund" ON public.reserve_fund_entries
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.members m WHERE m.group_id = reserve_fund_entries.group_id AND m.user_id = auth.uid() AND m.status = 'active')
);

CREATE POLICY "Allow privileged members to manage reserve fund" ON public.reserve_fund_entries
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.members m WHERE m.group_id = reserve_fund_entries.group_id AND m.user_id = auth.uid() AND m.status = 'active' AND m.role IN ('owner', 'admin', 'manager'))
);`;

    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  }

  return (
    <div className="space-y-6">
      {/* Missing table banner */}
      {tableMissing && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900 shadow-sm dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1 space-y-2">
              <h3 className="font-bold text-base">
                Database Table Setup Required
              </h3>
              <p className="text-sm">
                The <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs dark:bg-amber-900/60">reserve_fund_entries</code> table hasn&apos;t been created in Supabase yet.
                Please execute the migration script in your Supabase SQL Editor to enable the Reserve Fund.
              </p>
              <button
                onClick={copyMigrationSql}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-amber-800 shadow-sm"
              >
                {copiedSql ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> SQL Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Copy SQL Migration
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Mess Reserve Fund
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                canManage
                  ? "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {canManage ? "Admin / Manager Access" : "View Only (Member)"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Dedicated rolling fund for mess utility reserves, leftover charges, and shared amenities.
          </p>
        </div>
      </div>

      {/* Top 3 Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Total Reserve Balance
            </p>
            <div className="rounded-xl bg-teal-50 p-2 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <h2
            className={`mt-2 text-3xl font-extrabold ${
              totalBalance < 0
                ? "text-red-600 dark:text-red-400"
                : "text-slate-900 dark:text-white"
            }`}
          >
            ৳ {totalBalance.toLocaleString("en-US")}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Net fund currently available
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Total Added
            </p>
            <div className="rounded-xl bg-green-50 p-2 text-green-700 dark:bg-green-950/60 dark:text-green-400">
              <ArrowDownLeft className="h-5 w-5" />
            </div>
          </div>
          <h2 className="mt-2 text-3xl font-extrabold text-green-600 dark:text-green-400">
            ৳ {totalAdded.toLocaleString("en-US")}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Deposits & leftover funds collected
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Total Spent
            </p>
            <div className="rounded-xl bg-red-50 p-2 text-red-600 dark:bg-red-950/60 dark:text-red-400">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </div>
          <h2 className="mt-2 text-3xl font-extrabold text-red-600 dark:text-red-400">
            ৳ {totalSpent.toLocaleString("en-US")}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Amenities & maintenance expenses
          </p>
        </div>
      </div>

      {/* Privileged Management Forms: Add, Spend, Handover */}
      {canManage ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex border-b border-slate-200 pb-3 dark:border-slate-800 gap-2">
            <button
              onClick={() => setActiveTab("add")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                activeTab === "add"
                  ? "bg-teal-700 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <Plus className="h-4 w-4" /> Add Money (জমা)
            </button>

            <button
              onClick={() => setActiveTab("spend")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                activeTab === "spend"
                  ? "bg-red-700 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <ArrowUpRight className="h-4 w-4" /> Spend Money (খরচ)
            </button>

            <button
              onClick={() => setActiveTab("handover")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                activeTab === "handover"
                  ? "bg-blue-700 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <ArrowRightLeft className="h-4 w-4" /> Handover Cash (হাতবদল)
            </button>
          </div>

          {/* ADD FORM */}
          {activeTab === "add" && (
            <form onSubmit={handleAddSubmit} className="mt-5 space-y-4">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                Record Deposit to Reserve Fund
              </h3>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Date
                  </label>
                  <input
                    type="date"
                    value={addDate}
                    onChange={(e) => setAddDate(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Amount (৳)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    placeholder="e.g. 1500"
                    className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Cash Held By (Custodian)
                  </label>
                  <select
                    value={addCustodianId}
                    onChange={(e) => setAddCustodianId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {activeMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Title / Source
                  </label>
                  <input
                    type="text"
                    value={addTitle}
                    onChange={(e) => setAddTitle(e.target.value)}
                    placeholder="e.g. Utility reserve from left member"
                    className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  value={addDesc}
                  onChange={(e) => setAddDesc(e.target.value)}
                  placeholder="Additional details..."
                  className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={addLoading}
                  className="rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60 shadow-sm"
                >
                  {addLoading ? "Saving..." : "Save Deposit"}
                </button>
                {addMsg && <span className="text-xs text-teal-700 dark:text-teal-400">{addMsg}</span>}
              </div>
            </form>
          )}

          {/* SPEND FORM */}
          {activeTab === "spend" && (
            <form onSubmit={handleSpendSubmit} className="mt-5 space-y-4">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                Record Expense from Reserve Fund (Amenities / Repairs)
              </h3>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Date
                  </label>
                  <input
                    type="date"
                    value={spendDate}
                    onChange={(e) => setSpendDate(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Amount (৳)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={spendAmount}
                    onChange={(e) => setSpendAmount(e.target.value)}
                    placeholder="e.g. 350"
                    className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Paid From (Custodian)
                  </label>
                  <select
                    value={spendCustodianId}
                    onChange={(e) => setSpendCustodianId(e.target.value)}
                    disabled={custodiansWithCash.length === 0}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    {custodiansWithCash.length === 0 ? (
                      <option value="">No member currently holds cash</option>
                    ) : (
                      custodiansWithCash.map(({ member, balance }) => (
                        <option key={member.id} value={member.id}>
                          {member.full_name} ({member.role}) — Available: ৳ {balance.toLocaleString("en-US")}
                        </option>
                      ))
                    )}
                  </select>
                  {custodiansWithCash.length > 0 && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Currently has: ৳ {spendCustodianBalance.toLocaleString("en-US")}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Item / Reason
                  </label>
                  <input
                    type="text"
                    value={spendTitle}
                    onChange={(e) => setSpendTitle(e.target.value)}
                    placeholder="e.g. Harpic, Jharu, Water Filter"
                    className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  value={spendDesc}
                  onChange={(e) => setSpendDesc(e.target.value)}
                  placeholder="Receipt number or details..."
                  className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              {custodiansWithCash.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                  <ShieldAlert className="h-4 w-4" />
                  No member currently holds any cash. Add money to the fund first before recording expenses.
                </div>
              )}

              {Number(spendAmount) > totalBalance && totalBalance > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                  <ShieldAlert className="h-4 w-4" />
                  Warning: Amount exceeds overall reserve balance (৳ {totalBalance}).
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={spendLoading || custodiansWithCash.length === 0}
                  className="rounded-xl bg-red-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-800 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                >
                  {spendLoading ? "Saving..." : "Record Expense"}
                </button>
                {spendMsg && <span className="text-xs text-red-700 dark:text-red-400">{spendMsg}</span>}
              </div>
            </form>
          )}

          {/* HANDOVER FORM */}
          {activeTab === "handover" && (
            <form onSubmit={handleHandoverSubmit} className="mt-5 space-y-4">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                Record Cash Handover Between Custodians
              </h3>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Date
                  </label>
                  <input
                    type="date"
                    value={handoverDate}
                    onChange={(e) => setHandoverDate(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Amount (৳)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={handoverAmount}
                    onChange={(e) => setHandoverAmount(e.target.value)}
                    placeholder="e.g. 500"
                    className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    From (Giver)
                  </label>
                  <select
                    value={handoverFromId}
                    onChange={(e) => setHandoverFromId(e.target.value)}
                    disabled={custodiansWithCash.length === 0}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    {custodiansWithCash.length === 0 ? (
                      <option value="">No member currently holds cash</option>
                    ) : (
                      custodiansWithCash.map(({ member, balance }) => (
                        <option key={member.id} value={member.id}>
                          {member.full_name} ({member.role}) — Available: ৳ {balance.toLocaleString("en-US")}
                        </option>
                      ))
                    )}
                  </select>
                  {custodiansWithCash.length > 0 && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Has: ৳ {handoverFromBalance.toLocaleString("en-US")}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    To (Receiver)
                  </label>
                  <select
                    value={handoverToId}
                    onChange={(e) => setHandoverToId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {activeMembers
                      .filter((m) => m.id !== handoverFromId)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name} ({m.role})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  value={handoverNote}
                  onChange={(e) => setHandoverNote(e.target.value)}
                  placeholder="e.g. Handed over cash for market purchases"
                  className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              {custodiansWithCash.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                  <ShieldAlert className="h-4 w-4" />
                  No member currently holds cash to handover.
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={handoverLoading || custodiansWithCash.length === 0}
                  className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                >
                  {handoverLoading ? "Saving..." : "Record Handover"}
                </button>
                {handoverMsg && <span className="text-xs text-blue-700 dark:text-blue-400">{handoverMsg}</span>}
              </div>
            </form>
          )}
        </section>
      ) : null}

      {/* Custodian Breakdown: "কার কাছে কত টাকা জমা আছে" */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Cash in Hand Breakdown
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Shows members who currently hold reserve fund cash.
            </p>
          </div>

          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Total Matched: <b className="text-slate-900 dark:text-white">৳ {totalBalance.toLocaleString("en-US")}</b>
          </span>
        </div>

        {custodiansWithCash.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-400">
            No cash is currently held by any member. Add a deposit above to allocate fund.
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {custodiansWithCash
              .sort((a, b) => b.balance - a.balance)
              .map(({ member, balance }) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div>
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                      {member.full_name}
                    </h3>
                    <span className="inline-block mt-0.5 rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                      {member.role}
                    </span>
                  </div>

                  <div className="text-right">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Cash Held</p>
                    <p className="text-base font-extrabold text-teal-700 dark:text-teal-300">
                      ৳ {balance.toLocaleString("en-US")}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* Transaction History */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Reserve Fund Ledger
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              All deposits, expenses, and cash handovers recorded in this fund.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800/80">
            {(["all", "add", "spend", "handover"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition ${
                  filterType === t
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {t === "add" ? "Deposits (+)" : t === "spend" ? "Expenses (-)" : t === "handover" ? "Handovers (⇄)" : "All"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Title / Description</th>
                <th className="px-3 py-2 font-semibold">Custodian / Handover</th>
                <th className="px-3 py-2 text-right font-semibold">Amount</th>
                {canManage && <th className="px-3 py-2 text-right font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 6 : 5}
                    className="py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    No reserve fund transactions found.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => {
                  const custodian = members.find((m) => m.id === entry.custodian_member_id);
                  const toMember = entry.to_member_id
                    ? members.find((m) => m.id === entry.to_member_id)
                    : null;

                  return (
                    <tr
                      key={entry.id}
                      className="text-slate-700 dark:text-slate-300 transition hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-3 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {entry.entry_date}
                      </td>

                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            entry.entry_type === "add"
                              ? "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400"
                              : entry.entry_type === "spend"
                              ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
                          }`}
                        >
                          {entry.entry_type === "add"
                            ? "+ Deposit"
                            : entry.entry_type === "spend"
                            ? "- Expense"
                            : "⇄ Handover"}
                        </span>
                      </td>

                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {entry.title}
                        </p>
                        {entry.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {entry.description}
                          </p>
                        )}
                      </td>

                      <td className="px-3 py-3 text-xs">
                        {entry.entry_type === "handover" ? (
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {custodian?.full_name || "Unknown"} ➔ {toMember?.full_name || "Unknown"}
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {entry.entry_type === "add" ? "Held by: " : "Paid by: "}
                            <b>{custodian?.full_name || "Unknown"}</b>
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-right">
                        <span
                          className={`font-bold ${
                            entry.entry_type === "add"
                              ? "text-green-600 dark:text-green-400"
                              : entry.entry_type === "spend"
                              ? "text-red-600 dark:text-red-400"
                              : "text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {entry.entry_type === "add" ? "+" : entry.entry_type === "spend" ? "-" : ""}
                          ৳ {entry.amount.toLocaleString("en-US")}
                        </span>
                      </td>

                      {canManage && (
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => startEdit(entry)}
                              title="Edit"
                              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(entry.id)}
                              title="Delete"
                              className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Edit Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">
              Edit Reserve Fund Entry
            </h3>

            <div className="mt-4 space-y-3">
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
                  Amount (৳)
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Custodian / Giver
                </label>
                <select
                  value={editCustodianId}
                  onChange={(e) => setEditCustodianId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              {editingEntry.entry_type === "handover" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Receiver (To)
                  </label>
                  <select
                    value={editToMemberId}
                    onChange={(e) => setEditToMemberId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Description / Note
                </label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              {editMsg && <p className="text-xs text-red-600">{editMsg}</p>}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setEditingEntry(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editLoading}
                className="rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60 shadow-sm"
              >
                {editLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
