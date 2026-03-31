export type Role = "admin" | "manager" | "member";

export type MessMode = "managed" | "collaborative";

export interface MessGroup {
  id: string;
  name: string;
  mode: MessMode;
  payment_deadline: number;
  currency: string;
  created_by: string;
  created_at: string;
}

export interface Member {
  id: string;
  group_id: string;
  name: string;
  role: Role;
  monthly_rent: number;
  is_active: boolean;
  created_at: string;
}

export interface MealEntry {
  id: string;
  group_id: string;
  member_id: string;
  entry_date: string;
  own_meal: number;
  guest_meal: number;
  created_at: string;
}

export interface ExpenseEntry {
  id: string;
  group_id: string;
  paid_by_member_id: string;
  amount: number;
  category: "bazar" | "wifi" | "utility" | "electricity" | "maid" | "other";
  note?: string | null;
  entry_date: string;
  created_at: string;
}