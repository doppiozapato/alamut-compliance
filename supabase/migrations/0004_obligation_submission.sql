-- Adds submission tracking to compliance_obligations so the calendar can
-- record when each reporting obligation has been submitted, who submitted
-- it, and any free-text comments captured at submission time.
--
-- The existing `status` column already includes a `submitted` value, so this
-- migration only adds the auxiliary metadata. Apply via Supabase SQL Editor
-- or `supabase db push`.

alter table public.compliance_obligations
  add column if not exists submission_comment text,
  add column if not exists submitted_at        timestamptz,
  add column if not exists submitted_by        bigint references public.team_members(id) on delete set null,
  add column if not exists submitted_by_name   text;

create index if not exists obligations_submitted_at_idx
  on public.compliance_obligations (submitted_at);
