-- Alamut Compliance Dashboard — initial schema.
-- Apply via Supabase SQL Editor or `supabase db push`.

-- ─── team_members ────────────────────────────────────────────────────────────
create table if not exists public.team_members (
  id            bigserial primary key,
  email         text unique not null,
  full_name     text not null,
  role          text not null check (role in ('admin','compliance','operations','finance','team')),
  password_hash text,                         -- bcrypt hash; null while seeded
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ─── manual_chapters ─────────────────────────────────────────────────────────
create table if not exists public.manual_chapters (
  id              bigserial primary key,
  number          text not null,
  title           text not null,
  slug            text unique not null,
  summary         text,
  content         text not null,              -- markdown
  parent_id       bigint references public.manual_chapters(id) on delete set null,
  order_index     integer not null default 0,
  version         text,
  effective_date  date,
  owner           text,
  fca_refs        text[] not null default '{}',
  tags            text[] not null default '{}',
  updated_at      timestamptz not null default now()
);

create index if not exists manual_chapters_order_idx on public.manual_chapters (order_index);

-- ─── compliance_obligations (calendar) ───────────────────────────────────────
create table if not exists public.compliance_obligations (
  id          bigserial primary key,
  title       text not null,
  scope       text not null check (scope in ('firm','fund','both')),
  category    text not null,
  frequency   text not null check (frequency in ('annual','semi_annual','quarterly','monthly','ad_hoc')),
  next_due    date not null,
  fca_refs    text[] not null default '{}',
  owner       text,
  status      text not null default 'upcoming' check (status in ('upcoming','in_progress','submitted','overdue')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists obligations_due_idx on public.compliance_obligations (next_due);
create index if not exists obligations_scope_idx on public.compliance_obligations (scope);

-- ─── attestation_templates ───────────────────────────────────────────────────
create table if not exists public.attestation_templates (
  id          bigserial primary key,
  topic       text not null,
  category    text not null,
  description text,
  frequency   text not null default 'annual' check (frequency in ('annual','quarterly','monthly','ad_hoc')),
  fca_refs    text[] not null default '{}'
);

-- ─── attestations (per team member) ──────────────────────────────────────────
create table if not exists public.attestations (
  id            bigserial primary key,
  user_id       bigint not null references public.team_members(id) on delete cascade,
  topic         text not null,
  category      text not null,
  description   text,
  due_date      date not null,
  status        text not null default 'pending' check (status in ('pending','completed','overdue')),
  completed_at  timestamptz,
  comment       text,
  fca_refs      text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists attestations_user_idx on public.attestations (user_id);
create index if not exists attestations_status_idx on public.attestations (status);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- The Express server uses the Supabase anon key over a trusted server context,
-- so RLS rules below should be combined with service_role in production for
-- write access. For client-direct queries (none today) use these policies.

alter table public.team_members          enable row level security;
alter table public.manual_chapters       enable row level security;
alter table public.compliance_obligations enable row level security;
alter table public.attestation_templates enable row level security;
alter table public.attestations          enable row level security;

-- Anon read of public reference data (chapters, obligations, modules registry).
do $$
begin
  if not exists (select 1 from pg_policies where polname = 'manual_chapters_read') then
    create policy manual_chapters_read on public.manual_chapters for select using (true);
  end if;
  if not exists (select 1 from pg_policies where polname = 'obligations_read') then
    create policy obligations_read on public.compliance_obligations for select using (true);
  end if;
  if not exists (select 1 from pg_policies where polname = 'team_members_read') then
    create policy team_members_read on public.team_members for select using (true);
  end if;
  if not exists (select 1 from pg_policies where polname = 'attestations_read') then
    create policy attestations_read on public.attestations for select using (true);
  end if;
  if not exists (select 1 from pg_policies where polname = 'templates_read') then
    create policy templates_read on public.attestation_templates for select using (true);
  end if;
end$$;
