"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Member = {
  id: string;
  full_name: string;
  role: "owner" | "admin" | "manager" | "member";
};

type MealRow = {
  id: string;
  member_id: string;
  meal_date: string;
  own_meal: number;
  guest_meal: number;
};

type MealInput = { own: string; guest: string };

export default function MealsForm({
  members,
  meals,
  allMeals,
  groupId,
  monthId,
  currentUserRole,
  currentUserMemberId,
}: {
  members: Member[];
  meals: MealRow[];
  allMeals: MealRow[];
  groupId: string;
  monthId: string;
  currentUserRole: "owner" | "admin" | "manager" | "member";
  currentUserMemberId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const canManageMeals =
    currentUserRole === "owner" ||
    currentUserRole === "admin" ||
    currentUserRole === "manager";

  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [mealInputs, setMealInputs] = useState<Record<string, MealInput>>({});
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Inline edit for a single history row (one member, one date).
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [historyOwn, setHistoryOwn] = useState("0");
  const [historyGuest, setHistoryGuest] = useState("0");
  const [historyLoading, setHistoryLoading] = useState(false);

  // Existing entries for the selected date, keyed by member id.
  const existingForDate = useMemo(() => {
    const map: Record<string, MealRow> = {};
    for (const meal of allMeals) {
      if (meal.meal_date === entryDate) {
        map[meal.member_id] = meal;
      }
    }
    return map;
  }, [allMeals, entryDate]);

  // Whenever the date (or the saved data) changes, rebuild the input grid:
  // pre-fill from existing entries, otherwise default to 0.
  useEffect(() => {
    const next: Record<string, MealInput> = {};
    for (const member of members) {
      const existing = existingForDate[member.id];
      next[member.id] = existing
        ? { own: String(existing.own_meal), guest: String(existing.guest_meal) }
        : { own: "0", guest: "0" };
    }
    setMealInputs(next);
  }, [entryDate, existingForDate, members]);

  const visibleMembers = useMemo(() => {
    if (canManageMeals) return members;
    return members.filter((member) => member.id === currentUserMemberId);
  }, [members, canManageMeals, currentUserMemberId]);

  const memberHistory = useMemo(() => {
    return visibleMembers.map((member) => {
      const history = meals
        .filter((meal) => meal.member_id === member.id)
        .sort((a, b) => {
          if (a.meal_date === b.meal_date) return 0;
          return a.meal_date < b.meal_date ? 1 : -1;
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

  const enteredCount = useMemo(
    () => Object.keys(existingForDate).length,
    [existingForDate]
  );

  function updateInput(memberId: string, field: keyof MealInput, value: string) {
    setMealInputs((prev) => ({
      ...prev,
      [memberId]: {
        own: prev[memberId]?.own ?? "0",
        guest: prev[memberId]?.guest ?? "0",
        [field]: value,
      },
    }));
  }

  function setAllOwn(value: string) {
    setMealInputs((prev) => {
      const next: Record<string, MealInput> = {};
      for (const member of members) {
        next[member.id] = {
          own: value,
          guest: prev[member.id]?.guest ?? "0",
        };
      }
      return next;
    });
  }

  // Inline-edit a single meal-history row in place.
  function startHistoryEdit(item: MealRow) {
    if (!canManageMeals) return;
    setEditingHistoryId(item.id);
    setHistoryOwn(String(item.own_meal));
    setHistoryGuest(String(item.guest_meal));
    setMsg("");
  }

  function cancelHistoryEdit() {
    setEditingHistoryId(null);
    setHistoryOwn("0");
    setHistoryGuest("0");
  }

  async function saveHistoryEdit(item: MealRow) {
    if (!canManageMeals) return;

    const own = Number(historyOwn || 0);
    const guest = Number(historyGuest || 0);

    if (Number.isNaN(own) || Number.isNaN(guest)) {
      setMsg("Meal values must be valid numbers.");
      return;
    }

    if (own < 0 || guest < 0) {
      setMsg("Meal count cannot be negative.");
      return;
    }

    setHistoryLoading(true);

    const { error } = await supabase
      .from("meal_entries")
      .update({ own_meal: own, guest_meal: guest })
      .eq("id", item.id);

    setHistoryLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    cancelHistoryEdit();
    setMsg(`Updated ${item.meal_date} meal.`);
    router.refresh();
  }

  async function handleSaveAll() {
    setMsg("");

    if (!canManageMeals) {
      setMsg("Only admin or manager can add/edit meals.");
      return;
    }

    if (!entryDate) {
      setMsg("Select a date first.");
      return;
    }

    // Validate every row before touching the database.
    for (const member of members) {
      const input = mealInputs[member.id] ?? { own: "0", guest: "0" };
      const own = Number(input.own || 0);
      const guest = Number(input.guest || 0);

      if (Number.isNaN(own) || Number.isNaN(guest)) {
        setMsg(`Meal value for ${member.full_name} must be a valid number.`);
        return;
      }

      if (own < 0 || guest < 0) {
        setMsg(`Meal count for ${member.full_name} cannot be negative.`);
        return;
      }
    }

    const toInsert: {
      group_id: string;
      month_id: string;
      member_id: string;
      meal_date: string;
      own_meal: number;
      guest_meal: number;
    }[] = [];
    const toUpdate: { id: string; own_meal: number; guest_meal: number }[] = [];

    for (const member of members) {
      const input = mealInputs[member.id] ?? { own: "0", guest: "0" };
      const own = Number(input.own || 0);
      const guest = Number(input.guest || 0);
      const existing = existingForDate[member.id];

      if (existing) {
        // Only update rows that actually changed.
        if (
          Number(existing.own_meal) !== own ||
          Number(existing.guest_meal) !== guest
        ) {
          toUpdate.push({ id: existing.id, own_meal: own, guest_meal: guest });
        }
      } else {
        toInsert.push({
          group_id: groupId,
          month_id: monthId,
          member_id: member.id,
          meal_date: entryDate,
          own_meal: own,
          guest_meal: guest,
        });
      }
    }

    if (toInsert.length === 0 && toUpdate.length === 0) {
      setMsg("No changes to save.");
      return;
    }

    setLoading(true);

    try {
      if (toInsert.length > 0) {
        const { error } = await supabase.from("meal_entries").insert(toInsert);
        if (error) throw error;
      }

      if (toUpdate.length > 0) {
        const results = await Promise.all(
          toUpdate.map((row) =>
            supabase
              .from("meal_entries")
              .update({ own_meal: row.own_meal, guest_meal: row.guest_meal })
              .eq("id", row.id)
          )
        );

        const failed = results.find((result) => result.error);
        if (failed?.error) throw failed.error;
      }

      setLoading(false);
      setMsg(
        `Saved meals for ${toInsert.length + toUpdate.length} member(s) on ${entryDate}.`
      );
      router.refresh();
    } catch (err) {
      setLoading(false);
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message)
          : "Failed to save meals.";
      setMsg(message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Meal Entry</h1>
        <p className="mt-2 text-slate-600">
          {canManageMeals
            ? "Pick a date once, then enter meals for every member together."
            : "You can only view your own meal history and overall mess total meals."}
        </p>
      </div>

      {canManageMeals ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Add Daily Meals</h2>

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
              <p className="mt-2 text-xs text-slate-500">
                {enteredCount > 0
                  ? `${enteredCount} member(s) already have entries on this date — shown below and editable.`
                  : "No entries yet on this date."}
              </p>
            </div>

            <div className="flex items-end">
              <div className="w-full">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Quick fill (Own meal for everyone)
                </label>
                <div className="flex flex-wrap gap-2">
                  {["0", "1", "2"].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAllOwn(value)}
                      className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-600 hover:text-teal-700"
                    >
                      Set all to {value}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-[640px] border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-sm text-slate-500">
                  <th className="px-3 py-2">Member</th>
                  <th className="px-3 py-2">Own Meal</th>
                  <th className="px-3 py-2">Guest Meal</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="rounded-2xl bg-slate-50 px-3 py-4 text-sm text-slate-500"
                    >
                      No active members found.
                    </td>
                  </tr>
                ) : (
                  members.map((member) => {
                    const input = mealInputs[member.id] ?? {
                      own: "0",
                      guest: "0",
                    };
                    const rowTotal =
                      Number(input.own || 0) + Number(input.guest || 0);
                    const alreadySaved = Boolean(existingForDate[member.id]);

                    return (
                      <tr key={member.id} className="bg-slate-50 text-sm">
                        <td className="rounded-l-2xl px-3 py-3">
                          <span className="font-semibold text-slate-900">
                            {member.full_name}
                          </span>
                          <span className="ml-2 text-xs capitalize text-slate-500">
                            {member.role}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={input.own}
                            onChange={(e) =>
                              updateInput(member.id, "own", e.target.value)
                            }
                            className="w-24 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-teal-600"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={input.guest}
                            onChange={(e) =>
                              updateInput(member.id, "guest", e.target.value)
                            }
                            className="w-24 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-teal-600"
                          />
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-900">
                          {rowTotal.toFixed(1)}
                        </td>
                        <td className="rounded-r-2xl px-3 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              alreadySaved
                                ? "bg-green-100 text-green-700"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {alreadySaved ? "Saved" : "New"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Note: Everyone defaults to 0. Enter each member&apos;s meals, then
            save once — members already saved on this date will be updated.
          </p>

          <div className="mt-6">
            <button
              onClick={handleSaveAll}
              disabled={loading || !entryDate || members.length === 0}
              className="rounded-2xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Saving..." : "Save All Meals"}
            </button>
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
                    {member.full_name}
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
                        const isEditing = editingHistoryId === item.id;
                        const total = isEditing
                          ? Number(historyOwn || 0) + Number(historyGuest || 0)
                          : Number(item.own_meal || 0) +
                            Number(item.guest_meal || 0);

                        return (
                          <tr
                            key={item.id}
                            className="bg-white text-sm text-slate-700"
                          >
                            <td className="rounded-l-2xl px-3 py-3">
                              {item.meal_date}
                            </td>
                            <td className="px-3 py-3">
                              {isEditing ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={historyOwn}
                                  onChange={(e) => setHistoryOwn(e.target.value)}
                                  className="w-20 rounded-lg border border-slate-300 px-2 py-1 outline-none focus:border-teal-600"
                                />
                              ) : (
                                Number(item.own_meal || 0).toFixed(1)
                              )}
                            </td>
                            <td className="px-3 py-3">
                              {isEditing ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={historyGuest}
                                  onChange={(e) =>
                                    setHistoryGuest(e.target.value)
                                  }
                                  className="w-20 rounded-lg border border-slate-300 px-2 py-1 outline-none focus:border-teal-600"
                                />
                              ) : (
                                Number(item.guest_meal || 0).toFixed(1)
                              )}
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
                                  {isEditing ? (
                                    <>
                                      <button
                                        onClick={() => saveHistoryEdit(item)}
                                        disabled={historyLoading}
                                        className="rounded-xl bg-green-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {historyLoading ? "Saving..." : "Save"}
                                      </button>
                                      <button
                                        onClick={cancelHistoryEdit}
                                        disabled={historyLoading}
                                        className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => startHistoryEdit(item)}
                                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                      Edit
                                    </button>
                                  )}
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
