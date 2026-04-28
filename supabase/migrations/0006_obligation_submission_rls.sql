-- Allow the Express server (using the Supabase anon key) to update
-- compliance_obligations rows when admin/compliance users record a
-- submission. The 0001 migration enabled RLS on this table but only
-- created a SELECT policy, which silently rejected every UPDATE — the
-- new POST /api/obligations/:id/submit endpoint then surfaced as a
-- "Not found" 404 because the .update().select().single() returned no
-- row.
--
-- Authorisation is enforced at the Express layer via requireRole(
-- "admin", "compliance"), so the underlying anon-key write is only
-- reached after the session check. We mirror the existing
-- obligations_read policy and add open INSERT/UPDATE/DELETE policies
-- so all server-side mutations (recording a submission, manually
-- editing the next-due date, future seeds via PATCH) succeed.
--
-- Apply via Supabase SQL Editor or `supabase db push`.

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'obligations_insert'
  ) then
    create policy obligations_insert
      on public.compliance_obligations for insert with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where policyname = 'obligations_update'
  ) then
    create policy obligations_update
      on public.compliance_obligations for update using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where policyname = 'obligations_delete'
  ) then
    create policy obligations_delete
      on public.compliance_obligations for delete using (true);
  end if;
end$$;
