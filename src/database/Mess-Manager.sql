-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  actor_user_id uuid,
  action text NOT NULL,
  target_table text,
  target_id uuid,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT activity_logs_pkey PRIMARY KEY (id),
  CONSTRAINT activity_logs_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.mess_groups(id),
  CONSTRAINT activity_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.expense_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  month_id uuid NOT NULL,
  paid_by_member_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0::numeric),
  category USER-DEFINED NOT NULL,
  note text,
  entry_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT expense_entries_pkey PRIMARY KEY (id),
  CONSTRAINT expense_entries_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.mess_groups(id),
  CONSTRAINT expense_entries_month_id_fkey FOREIGN KEY (month_id) REFERENCES public.months(id),
  CONSTRAINT expense_entries_paid_by_member_id_fkey FOREIGN KEY (paid_by_member_id) REFERENCES public.members(id)
);
CREATE TABLE public.meal_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  month_id uuid NOT NULL,
  member_id uuid NOT NULL,
  entry_date date NOT NULL,
  own_meal numeric NOT NULL DEFAULT 0,
  guest_meal numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT meal_entries_pkey PRIMARY KEY (id),
  CONSTRAINT meal_entries_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.mess_groups(id),
  CONSTRAINT meal_entries_month_id_fkey FOREIGN KEY (month_id) REFERENCES public.months(id),
  CONSTRAINT meal_entries_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id)
);
CREATE TABLE public.member_monthly_charges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  month_id uuid NOT NULL,
  member_id uuid NOT NULL,
  rent_amount numeric NOT NULL DEFAULT 0,
  extra_charge numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT member_monthly_charges_pkey PRIMARY KEY (id),
  CONSTRAINT member_monthly_charges_month_id_fkey FOREIGN KEY (month_id) REFERENCES public.months(id),
  CONSTRAINT member_monthly_charges_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id)
);
CREATE TABLE public.members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  name text NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'member'::mess_role,
  monthly_rent numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  mobile_number text NOT NULL DEFAULT ''::text,
  nid_number text,
  linked_user_id uuid,
  user_id uuid,
  CONSTRAINT members_pkey PRIMARY KEY (id),
  CONSTRAINT members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.mess_groups(id),
  CONSTRAINT members_linked_user_id_fkey FOREIGN KEY (linked_user_id) REFERENCES auth.users(id),
  CONSTRAINT members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.mess_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mode USER-DEFINED NOT NULL DEFAULT 'managed'::mess_mode,
  payment_deadline integer NOT NULL DEFAULT 10 CHECK (payment_deadline >= 1 AND payment_deadline <= 31),
  currency text NOT NULL DEFAULT 'BDT'::text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  join_code text UNIQUE,
  CONSTRAINT mess_groups_pkey PRIMARY KEY (id),
  CONSTRAINT mess_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.months (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  label text NOT NULL,
  month_start date NOT NULL,
  month_end date NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'open'::month_status,
  meal_rate numeric NOT NULL DEFAULT 0,
  total_bazar numeric NOT NULL DEFAULT 0,
  total_meals numeric NOT NULL DEFAULT 0,
  total_shared_bills numeric NOT NULL DEFAULT 0,
  closed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT months_pkey PRIMARY KEY (id),
  CONSTRAINT months_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.mess_groups(id)
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  month_id uuid NOT NULL,
  member_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status USER-DEFINED NOT NULL DEFAULT 'unpaid'::payment_status,
  paid_date date,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_month_id_fkey FOREIGN KEY (month_id) REFERENCES public.months(id),
  CONSTRAINT payments_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  mobile_number text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.settlements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  month_id uuid NOT NULL,
  member_id uuid NOT NULL,
  total_own_meal numeric NOT NULL DEFAULT 0,
  total_guest_meal numeric NOT NULL DEFAULT 0,
  total_meal_count numeric NOT NULL DEFAULT 0,
  meal_cost numeric NOT NULL DEFAULT 0,
  bazar_paid numeric NOT NULL DEFAULT 0,
  shared_bill_share numeric NOT NULL DEFAULT 0,
  rent_amount numeric NOT NULL DEFAULT 0,
  extra_charge numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  final_balance numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT settlements_pkey PRIMARY KEY (id),
  CONSTRAINT settlements_month_id_fkey FOREIGN KEY (month_id) REFERENCES public.months(id),
  CONSTRAINT settlements_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id)
);