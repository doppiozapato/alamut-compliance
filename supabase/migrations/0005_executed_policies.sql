-- Executed Firm policies — operative signed/dated policy documents kept
-- separate from Compliance Manual chapters. Loaded from PDFs via
-- `script/parseExecutedPolicies.py` and pushed to Supabase via
-- `script/importExecutedPolicies.ts`.

create table if not exists public.executed_policies (
  id                    bigserial primary key,
  slug                  text not null unique,
  title                 text not null,
  category              text not null default 'Firm Policy',
  year                  integer not null check (year between 2000 and 2100),
  version               text,
  effective_date        date,
  effective_date_label  text,
  source_filename       text,
  page_count            integer not null default 0,
  summary               text,
  content               text not null default '',
  review_status         text not null default 'current'
                          check (review_status in ('current','under_review','archived')),
  imported_at           timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists executed_policies_category_idx
  on public.executed_policies (category);
create index if not exists executed_policies_year_idx
  on public.executed_policies (year desc);

alter table public.executed_policies enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'executed_policies_read'
  ) then
    create policy executed_policies_read
      on public.executed_policies for select using (true);
  end if;
end$$;
