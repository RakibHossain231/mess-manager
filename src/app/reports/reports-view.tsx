"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Member = {
  id: string;
  name: string;
  role: "admin" | "manager" | "member";
  monthly_rent: number;
};

type MealEntry = {
  member_id: string;
  own_meal: number;
  guest_meal: number;
};

type ExpenseEntry = {
  category: string;
  amount: number;
  paid_by_member_id: string;
};

type ChargeRow = {
  member_id: string;
  rent_amount: number;
};

type MonthRow = {
  id: string;
  label: string;
  status: "open" | "closed";
  created_at?: string;
};

const sharedStatusCategories = [
  { key: "wifi", label: "WiFi" },
  { key: "utility", label: "Utility" },
  { key: "electricity", label: "Current Bill" },
  { key: "gas", label: "Gas Bill" },
  { key: "bua", label: "Bua Bill" },
] as const;

export default function ReportsView({
  messName,
  monthLabel,
  selectedMonthId,
  months,
  members,
  meals,
  expenses,
  charges,
  viewerRole,
  viewerMemberId,
  canExport,
}: {
  messName: string;
  monthLabel: string;
  selectedMonthId: string;
  months: MonthRow[];
  members: Member[];
  meals: MealEntry[];
  expenses: ExpenseEntry[];
  charges: ChargeRow[];
  viewerRole: "admin" | "manager" | "member";
  viewerMemberId: string;
  canExport: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isMemberView = viewerRole === "member";

  const totalMeals = meals.reduce(
    (sum, item) => sum + Number(item.own_meal || 0) + Number(item.guest_meal || 0),
    0
  );

  const totalBazar = expenses
    .filter((item) => item.category === "bazar")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const totalSharedBills = expenses
    .filter((item) => item.category !== "bazar")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const mealRate = totalMeals > 0 ? totalBazar / totalMeals : 0;
  const perMemberSharedCost =
    members.length > 0 ? totalSharedBills / members.length : 0;

  const chargeMap = new Map(
    charges.map((item) => [item.member_id, Number(item.rent_amount || 0)])
  );

  const expenseMap = new Map<string, number>();
  expenses
    .filter((item) => item.category !== "bazar")
    .forEach((item) => {
      expenseMap.set(
        item.category,
        (expenseMap.get(item.category) ?? 0) + Number(item.amount || 0)
      );
    });

  const rows = members.map((member) => {
    const memberMeals = meals.filter((item) => item.member_id === member.id);

    const ownMeal = memberMeals.reduce(
      (sum, item) => sum + Number(item.own_meal || 0),
      0
    );

    const guestMeal = memberMeals.reduce(
      (sum, item) => sum + Number(item.guest_meal || 0),
      0
    );

    const totalMeal = ownMeal + guestMeal;

    const bazarPaid = expenses
      .filter(
        (item) => item.category === "bazar" && item.paid_by_member_id === member.id
      )
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const chargeRent = Number(chargeMap.get(member.id) ?? 0);
    const fallbackRent = Number(member.monthly_rent ?? 0);
    const rent = chargeRent > 0 ? chargeRent : fallbackRent;

    const mealCost = totalMeal * mealRate;
    const sharedShare = perMemberSharedCost;
    const finalBalance = bazarPaid - mealCost - sharedShare - rent;

    return {
      id: member.id,
      name: member.name,
      ownMeal,
      guestMeal,
      totalMeal,
      bazarPaid,
      rent,
      mealCost,
      sharedShare,
      finalBalance,
    };
  });

  const totalRent = rows.reduce((sum, row) => sum + Number(row.rent || 0), 0);

  const totalWillReceive = rows
    .filter((row) => row.finalBalance > 0)
    .reduce((sum, row) => sum + row.finalBalance, 0);

  const totalWillPay = rows
    .filter((row) => row.finalBalance < 0)
    .reduce((sum, row) => sum + Math.abs(row.finalBalance), 0);

  const totalCharges = totalSharedBills + totalRent + totalWillReceive;
  const balanceDifference = Math.abs(totalCharges - totalWillPay);
  const isBalanced = balanceDifference < 0.01;

  const myRow =
    rows.find((row) => row.id === viewerMemberId) ?? {
      id: viewerMemberId,
      name: "My Report",
      ownMeal: 0,
      guestMeal: 0,
      totalMeal: 0,
      bazarPaid: 0,
      rent: 0,
      mealCost: 0,
      sharedShare: perMemberSharedCost,
      finalBalance: 0,
    };

  const handleMonthChange = (monthId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", monthId);
    router.push(`/reports?${params.toString()}`);
  };

// ✅ Dynamic current month
  const currentDate = new Date();
  const monthYear = currentDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Monthly Report</h1>
            <p className="mt-2 text-slate-600">
              <b>{messName} · {monthYear}</b>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Role: {viewerRole} {canExport ? "· Export allowed" : "· View only"}
            </p>
          </div>

          <div className="w-full md:w-[280px]">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Select Month
            </label>
            <select
              value={selectedMonthId}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-600"
            >
              {months.map((month) => (
                <option key={month.id} value={month.id}>
                  {month.label} {month.status === "open" ? "(Open)" : "(Closed)"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isMemberView ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Meal Rate</p>
              <h3 className="mt-2 text-2xl font-bold text-slate-900">
                ৳ {mealRate.toFixed(2)}
              </h3>
              <p className="mt-1 text-xs text-slate-500">Current month meal rate</p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Shared Per Member</p>
              <h3 className="mt-2 text-2xl font-bold text-slate-900">
                ৳ {perMemberSharedCost.toFixed(2)}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Your equal share of shared bills
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">My Final Status</p>
              <h3
                className={`mt-2 text-2xl font-bold ${
                  myRow.finalBalance >= 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                ৳ {Math.abs(myRow.finalBalance).toFixed(2)}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {myRow.finalBalance >= 0 ? "You will receive" : "You will pay"}
              </p>
            </div>
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900">My Monthly Summary</h2>
              <p className="mt-1 text-sm text-slate-500">
                You can view your own report details and shared bills status.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Own Meal</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  {myRow.ownMeal.toFixed(1)}
                </h3>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Guest Meal</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  {myRow.guestMeal.toFixed(1)}
                </h3>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Total Meal</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  {myRow.totalMeal.toFixed(1)}
                </h3>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Bazar Paid</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  ৳ {myRow.bazarPaid.toFixed(2)}
                </h3>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Meal Cost</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  ৳ {myRow.mealCost.toFixed(2)}
                </h3>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Shared Share</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  ৳ {myRow.sharedShare.toFixed(2)}
                </h3>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Rent</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  ৳ {myRow.rent.toFixed(2)}
                </h3>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Final Balance</p>
                <h3
                  className={`mt-2 text-xl font-bold ${
                    myRow.finalBalance >= 0 ? "text-green-700" : "text-red-700"
                  }`}
                >
                  ৳ {Math.abs(myRow.finalBalance).toFixed(2)}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {myRow.finalBalance >= 0 ? "Will Receive" : "Will Pay"}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900">Shared Bills Status</h2>
              <p className="mt-1 text-sm text-slate-500">
                Shared bill categories added for this month.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-sm text-slate-500">
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {sharedStatusCategories.map((item) => {
                    const amount = Number(expenseMap.get(item.key) ?? 0);
                    const added = expenseMap.has(item.key);

                    return (
                      <tr key={item.key} className="bg-slate-50 text-sm text-slate-700">
                        <td className="rounded-l-2xl px-3 py-4 font-semibold text-slate-900">
                          {item.label}
                        </td>
                        <td className="px-3 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              added
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {added ? "Added" : "Not Added"}
                          </span>
                        </td>
                        <td className="rounded-r-2xl px-3 py-4">
                          ৳ {amount.toFixed(0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900">How My Final Is Calculated</h2>
            </div>

            <div className="rounded-2xl bg-blue-50 px-4 py-4 text-sm text-blue-800">
              Final balance = Bazar Paid - Meal Cost - Shared Share - Rent
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Total Bazar</p>
              <h3 className="mt-2 text-2xl font-bold text-slate-900">
                ৳ {totalBazar.toFixed(0)}
              </h3>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Total Meals</p>
              <h3 className="mt-2 text-2xl font-bold text-slate-900">
                {totalMeals.toFixed(1)}
              </h3>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Meal Rate</p>
              <h3 className="mt-2 text-2xl font-bold text-slate-900">
                ৳ {mealRate.toFixed(2)}
              </h3>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Shared Bills</p>
              <h3 className="mt-2 text-2xl font-bold text-slate-900">
                ৳ {totalSharedBills.toFixed(0)}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Per member: ৳ {perMemberSharedCost.toFixed(2)}
              </p>
            </div>
          </div>

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Overall check</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Total Charges</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">
                  ৳ {totalCharges.toFixed(2)}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Shared Bills + Rent + Total Will Receive
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Total Will Receive</p>
                <h3 className="mt-2 text-2xl font-bold text-green-700">
                  ৳ {totalWillReceive.toFixed(2)}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Sum of all positive balances
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Total Will Pay</p>
                <h3 className="mt-2 text-2xl font-bold text-red-700">
                  ৳ {totalWillPay.toFixed(2)}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Sum of all negative balances
                </p>
              </div>
            </div>

            <div
              className={`rounded-3xl border p-7 shadow-sm ${
                isBalanced
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <p
                className={`text-sm font-semibold ${
                  isBalanced ? "text-green-700" : "text-red-700"
                }`}
              >
                Balance Check: {isBalanced ? "Balanced ✅" : "Not Balanced ❌"}
              </p>

              <p
                className={`mt-2 text-sm ${
                  isBalanced ? "text-green-700" : "text-red-700"
                }`}
              >
                Total Will payable = ৳ {totalCharges.toFixed(2)} · Total Will Pay = ৳{" "}
                {totalWillPay.toFixed(2)}
              </p>

              {!isBalanced ? (
                <p className="mt-1 text-xs text-red-600">
                  Difference: ৳ {balanceDifference.toFixed(2)}. Meal, bazar, shared bill,
                  or rent data check koro.
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900">Shared Bills Status</h2>
              <p className="mt-1 text-sm text-slate-500">
                Missing categories are shown as not added and treated as 0 in this report.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-sm text-slate-500">
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {sharedStatusCategories.map((item) => {
                    const amount = Number(expenseMap.get(item.key) ?? 0);
                    const added = expenseMap.has(item.key);

                    return (
                      <tr key={item.key} className="bg-slate-50 text-sm text-slate-700">
                        <td className="rounded-l-2xl px-3 py-4 font-semibold text-slate-900">
                          {item.label}
                        </td>
                        <td className="px-3 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              added
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {added ? "Added" : "Not Added"}
                          </span>
                        </td>
                        <td className="rounded-r-2xl px-3 py-4">৳ {amount.toFixed(0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Final Settlement</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Final balance = Bazar Paid - Meal Cost - Shared Share - Rent
                </p>
              </div>

              {canExport ? (
                <button
                  onClick={() => window.print()}
                  className="rounded-2xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 print:hidden"
                >
                  Print / Save PDF
                </button>
              ) : null}
            </div>

            {!canExport ? (
              <div className="mb-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
                Only admin can print or save PDF. Others can view report only.
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-sm text-slate-500">
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Own Meal</th>
                    <th className="px-3 py-2 font-medium">Guest Meal</th>
                    <th className="px-3 py-2 font-medium">Total Meal</th>
                    <th className="px-3 py-2 font-medium">Meal Cost</th>
                    <th className="px-3 py-2 font-medium">Bazar Paid</th>
                    <th className="px-3 py-2 font-medium">Shared Share</th>
                    <th className="px-3 py-2 font-medium">Rent</th>
                    <th className="px-3 py-2 font-medium">Final</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="rounded-2xl bg-slate-50 text-sm text-slate-700"
                    >
                      <td className="rounded-l-2xl px-3 py-4 font-semibold text-slate-900">
                        {row.name}
                      </td>
                      <td className="px-3 py-4">{row.ownMeal.toFixed(1)}</td>
                      <td className="px-3 py-4">{row.guestMeal.toFixed(1)}</td>
                      <td className="px-3 py-4">{row.totalMeal.toFixed(1)}</td>
                      <td className="px-3 py-4">৳ {row.mealCost.toFixed(2)}</td>
                      <td className="px-3 py-4">৳ {row.bazarPaid.toFixed(0)}</td>
                      <td className="px-3 py-4">৳ {row.sharedShare.toFixed(2)}</td>
                      <td className="px-3 py-4">৳ {row.rent.toFixed(0)}</td>
                      <td className="px-3 py-4 font-semibold">
                        ৳ {Math.abs(row.finalBalance).toFixed(2)}
                      </td>
                      <td className="rounded-r-2xl px-3 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            row.finalBalance >= 0
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {row.finalBalance >= 0 ? "Will Receive" : "Will Pay"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}