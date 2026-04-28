-- Team member tab permissions + admin-managed lifecycle.
--
-- Adds a JSONB array column `tab_permissions` to public.team_members so
-- admins can fine-tune which sidebar tabs each user sees from the Admin /
-- Team Oversight screen. NULL means "use the role default" (computed in
-- application code), so seeded rows continue to work without backfill.
--
-- Also opens INSERT/UPDATE/DELETE policies on public.team_members so the
-- Express server (running with the Supabase anon key) can provision new
-- accounts and reset passwords. Authorisation is enforced at the Express
-- layer via requireRole("admin"), which gates every mutating endpoint.
-- This mirrors the pattern used in 0006_obligation_submission_rls.sql.
--
-- Apply via Supabase SQL Editor or `supabase db push`.

-- ─── Column ────────────────────────────────────────────────────────────────
alter table public.team_members
  add column if not exists tab_permissions jsonb;

-- Optional small helper index — kept cheap; useful only if we ever query
-- by permission membership directly.
create index if not exists team_members_tab_permissions_idx
  on public.team_members using gin (tab_permissions);

-- ─── RLS policies for admin-managed lifecycle ──────────────────────────────
-- public.team_members already has RLS enabled and a `team_members_read`
-- policy from 0001. Add idempotent INSERT/UPDATE/DELETE policies so the
-- server can manage rows. Authorisation lives in the Express layer.

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'team_members_insert'
  ) then
    create policy team_members_insert
      on public.team_members for insert with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where policyname = 'team_members_update'
  ) then
    create policy team_members_update
      on public.team_members for update using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where policyname = 'team_members_delete'
  ) then
    create policy team_members_delete
      on public.team_members for delete using (true);
  end if;
end$$;
