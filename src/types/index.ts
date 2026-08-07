export type Role = "owner" | "admin" | "manager" | "member";

export type MemberStatus = "pending" | "active" | "left";

export type MonthStatus = "open" | "closed";

export type JoinRequestStatus = "pending" | "approved" | "rejected";

export type ExpenseType = "bazar" | "shared";

export type PaymentStatus = "unpaid" | "partial" | "paid" | "advance";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface MessGroup {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  owner_id: string;
  join_code: string;
  currency: string;
  payment_deadline: number;
  allow_auto_join: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  group_id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string;
  nid: string | null;
  role: Role;
  status: MemberStatus;
  joined_at: string;
  left_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberDefaultCharge {
  id: string;
  member_id: string;
  rent: number;
  wifi: number;
  electricity: number;
  water: number;
  gas: number;
  khala_bill: number;
  utility: number;
  others: number;
  created_at: string;
  updated_at: string;
}

export interface Month {
  id: string;
  group_id: string;
  label: string;
  month_start: string;
  month_end: string;
  status: MonthStatus;
  meal_rate: number;
  total_meals: number;
  total_bazar: number;
  total_shared_expense: number;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberMonthlyCharge {
  id: string;
  month_id: string;
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
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface MealEntry {
  id: string;
  group_id: string;
  month_id: string;
  member_id: string;
  meal_date: string;
  own_meal: number;
  guest_meal: number;
  note: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ExpenseEntry {
  id: string;
  group_id: string;
  month_id: string;
  expense_type: ExpenseType;
  amount: number;
  paid_by_member_id: string | null;
  expense_date: string;
  title: string;
  description: string | null;
  receipt_url: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Payment {
  id: string;
  group_id: string;
  month_id: string;
  member_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  transaction_id: string | null;
  note: string | null;
  status: PaymentStatus;
  received_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface JoinRequest {
  id: string;
  group_id: string;
  user_id: string;
  message: string | null;
  status: JoinRequestStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  group_id: string;
  actor_user_id: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  group_id: string | null;
  title: string;
  body: string | null;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface Settlement {
  id: string;
  group_id: string;
  month_id: string;
  member_id: string;
  total_own_meal: number;
  total_guest_meal: number;
  total_meal: number;
  meal_rate: number;
  meal_cost: number;
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
  previous_due: number;
  advance: number;
  discount: number;
  gross_amount: number;
  rounding_adjustment: number;
  final_amount: number;
  paid_amount: number;
  due_amount: number;
  status: PaymentStatus;
  created_at: string;
  updated_at: string;
}
