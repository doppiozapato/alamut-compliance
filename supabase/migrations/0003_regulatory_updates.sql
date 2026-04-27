-- Regulatory Updates — quarterly digest of FCA / FATF / market guidance.
-- Loaded from DOCX via `script/parseRegulatoryUpdatesDocx.py` and pushed to
-- Supabase via `script/importRegulatoryUpdates.ts`.

create table if not exists public.regulatory_updates (
  id                    bigserial primary key,
  quarter               text not null check (quarter in ('Q1','Q2','Q3','Q4')),
  year                  integer not null check (year between 2000 and 2100),
  section               text not null default 'regulatory'
                          check (section in ('regulatory','enforcement')),
  date_published        date not null,
  date_published_label  text,
  category              text,
  title                 text not null,
  body                  text not null default '',
  effective_date        date,
  effective_date_label  text,
  useful_links          jsonb not null default '[]'::jsonb,
  source_document       text,
  imported_at           timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (year, quarter, section, date_published, title)
);

create index if not exists regulatory_updates_quarter_idx
  on public.regulatory_updates (year desc, quarter desc, date_published desc);
create index if not exists regulatory_updates_section_idx
  on public.regulatory_updates (section);

alter table public.regulatory_updates enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'regulatory_updates_read'
  ) then
    create policy regulatory_updates_read
      on public.regulatory_updates for select using (true);
  end if;
end$$;
