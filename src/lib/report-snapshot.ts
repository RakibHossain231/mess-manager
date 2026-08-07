// Shared billing logic for the "close month" flow and the closed-month report /
// settlement pages. There is no JSONB snapshot table in the database: closed
// months are frozen by writing one fully-computed row per member into the
// `settlements` table at close time. These helpers are the single source of
// truth for that computation and for reading it back.

type BuildInput = {
  groupId: string;
  monthId: string;
  members: { id: string }[];
  meals: { member_id: string; own_meal: number; guest_meal: number }[];
  expenses: {
    expense_type: string;
    amount: number;
    paid_by_member_id: string | null;
  }[];
  charges: {
    member_id: string;
    rent: number;
    wifi: number;
    electricity: number;
    water: number;
    gas: number;
    khala_bill: number;
    utility: number;
    others: number;
    discount: number;
    advance: number;
    previous_due: number;
  }[];
};

// One insert-ready row per member for the `settlements` table.
// Formula (reference):
//   Final = Bazar Paid - (Meal Cost + rent + wifi + electricity + gas + water
//                         + khala + utility + others - advance - discount
//                         + previous_due)
// final_amount is stored SIGNED: positive => member will receive, negative =>
// member will pay (due). due_amount starts at abs(final_amount); paid_amount 0.
export function buildSettlementRows({
  groupId,
  monthId,
  members,
  meals,
  expenses,
  charges,
}: BuildInput) {
  const totalMeals = meals.reduce(
    (sum, m) => sum + Number(m.own_meal || 0) + Number(m.guest_meal || 0),
    0
  );

  const totalBazar = expenses
    .filter((e) => e.expense_type === "bazar")
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const totalShared = expenses
    .filter((e) => e.expense_type === "shared")
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const mealRate = totalMeals > 0 ? totalBazar / totalMeals : 0;
  const perMemberShared = members.length > 0 ? totalShared / members.length : 0;

  const chargeMap = new Map(charges.map((c) => [c.member_id, c]));

  return members.map((member) => {
    const memberMeals = meals.filter((m) => m.member_id === member.id);

    const ownMeal = memberMeals.reduce(
      (sum, m) => sum + Number(m.own_meal || 0),
      0
    );
    const guestMeal = memberMeals.reduce(
      (sum, m) => sum + Number(m.guest_meal || 0),
      0
    );
    const totalMeal = ownMeal + guestMeal;

    const bazarPaid = expenses
      .filter(
        (e) => e.expense_type === "bazar" && e.paid_by_member_id === member.id
      )
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const c = chargeMap.get(member.id);
    const rent = Number(c?.rent || 0);
    const wifi = Number(c?.wifi || 0);
    const electricity = Number(c?.electricity || 0);
    const water = Number(c?.water || 0);
    const gas = Number(c?.gas || 0);
    const khala = Number(c?.khala_bill || 0);
    const utility = Number(c?.utility || 0);
    const others = Number(c?.others || 0);
    const discount = Number(c?.discount || 0);
    const advance = Number(c?.advance || 0);
    const previousDue = Number(c?.previous_due || 0);

    const mealCost = totalMeal * mealRate;
    const sharedExpense = perMemberShared;

    const chargesSum =
      rent +
      wifi +
      electricity +
      water +
      gas +
      khala +
      utility +
      others -
      advance -
      discount +
      previousDue;

    // What the member owes to the mess before their bazar contribution.
    const grossAmount = mealCost + sharedExpense + chargesSum;

    // Signed: positive => receive, negative => pay.
    const finalAmount = bazarPaid - grossAmount;

    return {
      group_id: groupId,
      month_id: monthId,
      member_id: member.id,
      total_own_meal: ownMeal,
      total_guest_meal: guestMeal,
      total_meal: totalMeal,
      meal_rate: mealRate,
      meal_cost: mealCost,
      bazar_paid: bazarPaid,
      shared_expense: sharedExpense,
      rent,
      wifi,
      electricity,
      water,
      gas,
      khala_bill: khala,
      utility,
      others,
      previous_due: previousDue,
      advance,
      discount,
      gross_amount: grossAmount,
      rounding_adjustment: 0,
      final_amount: finalAmount,
      paid_amount: 0,
      due_amount: Math.abs(finalAmount),
      status: "unpaid",
    };
  });
}

type SettlementRecord = {
  member_id: string;
  total_own_meal: number;
  total_guest_meal: number;
  meal_rate: number;
  bazar_paid: number;
  shared_expense: number;
  rent: number;
  wifi: number;
  electricity: number;
  water: number;
  gas: number;
  khala_bill: number;
  utility: number;
  others: number;
  discount: number;
  advance: number;
  previous_due: number;
  final_amount: number;
  paid_amount: number;
};

// Reads saved `settlements` rows back into the { members, meals, expenses,
// charges } shape the report / settlement views already know how to render, so
// a closed month displays exactly the frozen numbers regardless of later edits
// to the live meal/expense/charge tables.
export function settlementsToReportProps(
  settlements: SettlementRecord[],
  nameMap: Record<string, string>
) {
  const members = settlements.map((s) => ({
    id: s.member_id,
    full_name: nameMap[s.member_id] ?? "Unknown",
  }));

  const meals = settlements.map((s) => ({
    member_id: s.member_id,
    own_meal: Number(s.total_own_meal || 0),
    guest_meal: Number(s.total_guest_meal || 0),
  }));

  const charges = settlements.map((s) => ({
    member_id: s.member_id,
    rent: Number(s.rent || 0),
    wifi: Number(s.wifi || 0),
    electricity: Number(s.electricity || 0),
    water: Number(s.water || 0),
    gas: Number(s.gas || 0),
    khala_bill: Number(s.khala_bill || 0),
    utility: Number(s.utility || 0),
    others: Number(s.others || 0),
    advance: Number(s.advance || 0),
    discount: Number(s.discount || 0),
    previous_due: Number(s.previous_due || 0),
  }));

  // Reconstruct expenses so the views recompute the same meal rate and shares:
  // one bazar row per member (their paid amount) plus one shared row holding the
  // summed per-member shares.
  const expenses: {
    expense_type: string;
    amount: number;
    paid_by_member_id: string | null;
  }[] = settlements.map((s) => ({
    expense_type: "bazar",
    amount: Number(s.bazar_paid || 0),
    paid_by_member_id: s.member_id,
  }));

  const totalShared = settlements.reduce(
    (sum, s) => sum + Number(s.shared_expense || 0),
    0
  );

  if (totalShared > 0) {
    expenses.push({
      expense_type: "shared",
      amount: totalShared,
      paid_by_member_id: null,
    });
  }

  // Settlement rows the views consume directly (signed final -> type + abs).
  const settlementRows = settlements.map((s) => {
    const signed = Number(s.final_amount || 0);
    return {
      member_id: s.member_id,
      final_amount: Math.abs(signed),
      final_type: (signed >= 0 ? "receive" : "pay") as "pay" | "receive",
      paid_amount: Number(s.paid_amount || 0),
    };
  });

  return { members, meals, expenses, charges, settlementRows };
}
