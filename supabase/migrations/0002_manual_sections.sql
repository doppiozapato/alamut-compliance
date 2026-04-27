-- 0002_manual_sections.sql
--
-- Extend the manual schema to support PDF-imported manuals with nested
-- sections. Adds:
--   * manual_chapters.kind          ("chapter" | "appendix")
--   * manual_chapters.start_page    page anchor in source PDF
--   * manual_chapters.end_page
--   * manual_chapters.source_pdf    filename of imported PDF
--   * manual_sections               new table for per-section content
--
-- Re-run safely; uses `if not exists` / `add column if not exists`.

alter table public.manual_chapters
  add column if not exists kind        text default 'chapter' check (kind in ('chapter','appendix')),
  add column if not exists start_page  integer,
  add column if not exists end_page    integer,
  add column if not exists source_pdf  text;

create table if not exists public.manual_sections (
  id            bigserial primary key,
  chapter_id    bigint not null references public.manual_chapters(id) on delete cascade,
  number        text not null,                -- "1.1", "16.10"
  title         text not null,
  slug          text not null,
  page          integer,
  content       text not null default '',
  order_index   integer not null default 0,
  updated_at    timestamptz not null default now(),
  unique (chapter_id, number)
);

create index if not exists manual_sections_chapter_idx on public.manual_sections (chapter_id);
create index if not exists manual_sections_order_idx   on public.manual_sections (chapter_id, order_index);

alter table public.manual_sections enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'manual_sections_read') then
    create policy manual_sections_read on public.manual_sections for select using (true);
  end if;
end$$;
