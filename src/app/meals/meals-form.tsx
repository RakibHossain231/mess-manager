"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Member = {
  id: string;
  name: string;
  role: "admin" | "manager" | "member";
};

type MealRow = {
  id: string;
  member_id: string;
  entry_date: string;
  own_meal: number;
  guest_meal: number;
};

export default function MealsForm({
  members,
  meals,
  allMeals,
  memberMap,
  groupId,
  monthId,
  currentUserRole,
  currentUserMemberId,
}: {
  members: Member[];
  meals: MealRow[];
  allMeals: MealRow[];
  memberMap: Record<string, string>;
  groupId: string;
  monthId: string;
  currentUserRole: "admin" | "manager" | "member";
  currentUserMemberId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const canManageMeals =
    currentUserRole === "admin" || currentUserRole === "manager";

  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [ownMeal, setOwnMeal] = useState("");
  const [guestMeal, setGuestMeal] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const availableMembers = useMemo(() => {
    if (!entryDate) return members;

    const takenMemberIds = new Set(
      allMeals
        .filter(
          (meal) =>
            meal.entry_date === entryDate &&
            (!editingId || meal.id !== editingId)
        )
        .map((meal) => meal.member_id)
    );

    return members.filter((member) => !takenMemberIds.has(member.id));
  }, [members, allMeals, entryDate, editingId]);

  const visibleMembers = useMemo(() => {
    if (canManageMeals) return members;
    return members.filter((member) => member.id === currentUserMemberId);
  }, [members, canManageMeals, currentUserMemberId]);

  const memberHistory = useMemo(() => {
    return visibleMembers.map((member) => {
      const history = meals
        .filter((meal) => meal.member_id === member.id)
        .sort((a, b) => {
          if (a.entry_date === b.entry_date) return 0;
          return a.entry_date < b.entry_date ? 1 : -1;
        });

      const totalOwn = history.reduce(
        (sum, item) => sum + Number(item.own_meal || 0),
        0
      );
      const totalGuest = history.reduce(
        (sum, item) => sum + Number(item.guest_meal || 0),
        0
      );
      const totalMeals = totalOwn + totalGuest;

      return {
        member,
        history,
        totalOwn,
        totalGuest,
        totalMeals,
      };
    });
  }, [visibleMembers, meals]);

  const myTotals = useMemo(() => {
    const myHistory = meals.filter((meal) => meal.member_id === currentUserMemberId);

    const own = myHistory.reduce(
      (sum, item) => sum + Number(item.own_meal || 0),
      0
    );
    const guest = myHistory.reduce(
      (sum, item) => sum + Number(item.guest_meal || 0),
      0
    );

    return {
      own,
      guest,
      total: own + guest,
    };
  }, [meals, currentUserMemberId]);

  const messTotals = useMemo(() => {
    const own = allMeals.reduce(
      (sum, item) => sum + Number(item.own_meal || 0),
      0
    );
    const guest = allMeals.reduce(
      (sum, item) => sum + Number(item.guest_meal || 0),
      0
    );

    return {
      own,
      guest,
      total: own + guest,
    };
  }, [allMeals]);

  useEffect(() => {
    if (!entryDate) {
      setMemberId(members[0]?.id ?? "");
      return;
    }

    const stillExists = availableMembers.some((member) => member.id === memberId);

    if (!stillExists) {
      setMemberId(availableMembers[0]?.id ?? "");
    }
  }, [entryDate, availableMembers, memberId, members]);

  function resetForm() {
    setEntryDate("");
    setMemberId(members[0]?.id ?? "");
    setOwnMeal("");
    setGuestMeal("");
    setEditingId(null);
  }

  function startEdit(item: MealRow) {
    if (!canManageMeals) return;

    setEditingId(item.id);
    setEntryDate(item.entry_date);
    setMemberId(item.member_id);
    setOwnMeal(String(item.own_meal));
    setGuestMeal(String(item.guest_meal));
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave() {
    setMsg("");

    if (!canManageMeals) {
      setMsg("Only admin or manager can add/edit meals.");
      return;
    }

    if (!entryDate) {
      setMsg("Select date first.");
      return;
    }

    if (!memberId) {
      setMsg("No available member found for this date.");
      return;
    }

    const own = Number(ownMeal || 0);
    const guest = Number(guestMeal || 0);

    if (Number.isNaN(own) || Number.isNaN(guest)) {
      setMsg("Meal values must be valid numbers.");
      return;
    }

    if (own < 0 || guest < 0) {
      setMsg("Meal count cannot be negative.");
      return;
    }

    const duplicateEntry = allMeals.find(
      (meal) =>
        meal.entry_date === entryDate &&
        meal.member_id === memberId &&
        meal.id !== editingId
    );

    if (duplicateEntry) {
      setMsg("This member already has a meal entry for the selected date.");
      return;
    }

    setLoading(true);

    if (editingId) {
      const { error } = await supabase
        .from("meal_entries")
        .update({
          entry_date: entryDate,
          member_id: memberId,
          own_meal: own,
          guest_meal: guest,
        })
        .eq("id", editingId);

      setLoading(false);

      if (error) {
        setMsg(error.message);
        return;
      }

      setMsg("Meal updated successfully.");
      resetForm();
      router.refresh();
      return;
    }

    const { error } = await supabase.from("meal_entries").insert({
      group_id: groupId,
      month_id: monthId,
      member_id: memberId,
      entry_date: entryDate,
      own_meal: own,
      guest_meal: guest,
    });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Meal added successfully.");
    resetForm();
    router.refresh();
  }

  const noMembersAvailableForDate =
    !!entryDate && availableMembers.length === 0 && !editingId;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Meal Entry</h1>
        <p className="mt-2 text-slate-600">
          {canManageMeals
            ? "Admin and manager can add and edit meal entries."
            : "You can only view your own meal history and overall mess total meals."}
        </p>
      </div>

      {canManageMeals ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            {editingId ? "Edit Meal Entry" : "Add Meal Entry"}
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Date
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-teal-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Member
              </label>
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                disabled={!editingId && (!entryDate || availableMembers.length === 0)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-teal-600 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                {!entryDate ? (
                  <option value="">Select date first</option>
                ) : availableMembers.length === 0 ? (
                  <option value="">No members available</option>
                ) : (
                  availableMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))
                )}
              </select>

              {noMembersAvailableForDate ? (
                <p className="mt-2 text-sm text-amber-600">
                  All members already have meal entries for this date.
                </p>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Own Meal
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={ownMeal}
                onChange={(e) => setOwnMeal(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-teal-600"
                placeholder="0"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Guest Meal
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={guestMeal}
                onChange={(e) => setGuestMeal(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-teal-600"
                placeholder="0"
              />
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Note: If someone had no meal on a date, save 0 so their history stays
            complete. <b>And also select date first to meal entry</b>
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleSave}
              disabled={
                loading ||
                !entryDate ||
                !memberId ||
                (!editingId && availableMembers.length === 0)
              }
              className="rounded-2xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Saving..." : editingId ? "Update Meal" : "Save Meal"}
            </button>

            {editingId ? (
              <button
                onClick={resetForm}
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel Edit
              </button>
            ) : null}
          </div>

          {msg ? <p className="mt-4 text-sm text-slate-700">{msg}</p> : null}
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {canManageMeals ? "Member-wise Meal History" : "My Meal History"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {canManageMeals
                ? "Each member's date-wise meal history for easy tracking."
                : "Your own history with overall mess meal summary."}
            </p>
          </div>

          {!canManageMeals ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  My Total Meals
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {myTotals.total.toFixed(1)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Own: {myTotals.own.toFixed(1)} | Guest: {myTotals.guest.toFixed(1)}
                </p>
              </div>

              <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
                  Mess Total Meals
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {messTotals.total.toFixed(1)}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Own: {messTotals.own.toFixed(1)} | Guest: {messTotals.guest.toFixed(1)}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {memberHistory.map(({ member, history, totalOwn, totalGuest, totalMeals }) => (
            <div
              key={member.id}
              className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {member.name}
                  </h3>
                  <p className="text-sm capitalize text-slate-500">
                    Role: {member.role}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                    <p className="text-xs text-slate-500">Own</p>
                    <p className="text-sm font-bold text-slate-900">
                      {totalOwn.toFixed(1)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                    <p className="text-xs text-slate-500">Guest</p>
                    <p className="text-sm font-bold text-slate-900">
                      {totalGuest.toFixed(1)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="text-sm font-bold text-slate-900">
                      {totalMeals.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-left text-xs text-slate-500">
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Own</th>
                      <th className="px-3 py-2 font-medium">Guest</th>
                      <th className="px-3 py-2 font-medium">Total</th>
                      {canManageMeals ? (
                        <th className="px-3 py-2 font-medium">Actions</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {history.length === 0 ? (
                      <tr>
                        <td
                          colSpan={canManageMeals ? 5 : 4}
                          className="rounded-2xl bg-white px-3 py-4 text-sm text-slate-500"
                        >
                          No meal history found.
                        </td>
                      </tr>
                    ) : (
                      history.map((item) => {
                        const total =
                          Number(item.own_meal || 0) + Number(item.guest_meal || 0);

                        return (
                          <tr
                            key={item.id}
                            className="bg-white text-sm text-slate-700"
                          >
                            <td className="rounded-l-2xl px-3 py-3">
                              {item.entry_date}
                            </td>
                            <td className="px-3 py-3">
                              {Number(item.own_meal || 0).toFixed(1)}
                            </td>
                            <td className="px-3 py-3">
                              {Number(item.guest_meal || 0).toFixed(1)}
                            </td>
                            <td
                              className={`px-3 py-3 font-semibold text-slate-900 ${canManageMeals ? "" : "rounded-r-2xl"
                                }`}
                            >
                              {total.toFixed(1)}
                            </td>

                            {canManageMeals ? (
                              <td className="rounded-r-2xl px-3 py-3">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => startEdit(item)}
                                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    Edit
                                  </button>
                                </div>
                              </td>
                            ) : null}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {msg && !canManageMeals ? (
          <p className="mt-4 text-sm text-slate-700">{msg}</p>
        ) : null}
      </section>
    </div>
  );
}