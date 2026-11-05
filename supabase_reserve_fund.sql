-- =========================================================================
-- Mess Reserve Fund Migration
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.reserve_fund_entries (
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reserve_fund_group_id ON public.reserve_fund_entries(group_id);
CREATE INDEX IF NOT EXISTS idx_reserve_fund_custodian ON public.reserve_fund_entries(custodian_member_id);
CREATE INDEX IF NOT EXISTS idx_reserve_fund_entry_date ON public.reserve_fund_entries(entry_date);

-- Enable Row Level Security
ALTER TABLE public.reserve_fund_entries ENABLE ROW LEVEL SECURITY;

-- Allow members of the same mess group to view reserve fund entries
CREATE POLICY "Allow members of mess to view reserve fund"
ON public.reserve_fund_entries
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.group_id = reserve_fund_entries.group_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
);

-- Allow admins, managers, and owners to insert
CREATE POLICY "Allow privileged members to insert reserve fund"
ON public.reserve_fund_entries
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.group_id = reserve_fund_entries.group_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.role IN ('owner', 'admin', 'manager')
    )
);

-- Allow privileged members to update
CREATE POLICY "Allow privileged members to update reserve fund"
ON public.reserve_fund_entries
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.group_id = reserve_fund_entries.group_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.role IN ('owner', 'admin', 'manager')
    )
);

-- Allow privileged members to delete
CREATE POLICY "Allow privileged members to delete reserve fund"
ON public.reserve_fund_entries
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.group_id = reserve_fund_entries.group_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.role IN ('owner', 'admin', 'manager')
    )
);
