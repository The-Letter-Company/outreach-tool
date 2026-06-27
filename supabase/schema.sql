-- Outreach tool — Supabase schema
-- Single-user, no auth. All access is server-side via the service-role key,
-- so Row Level Security is left disabled (the service role bypasses RLS anyway).
--
-- Apply this once:
--   • Supabase Dashboard → SQL Editor → paste & Run, or
--   • psql "$DATABASE_URL" -f supabase/schema.sql
--
-- Safe to re-run: uses IF NOT EXISTS / idempotent guards.

-- ── companies ────────────────────────────────────────────────────
create table if not exists companies (
  id                text primary key,
  name              text not null,
  domain            text not null unique,
  stage             text not null,
  raised            bigint not null default 0,
  employees         integer not null default 0,
  blog_url          text not null default '',
  blog_score        integer not null default 0,
  blog_score_reason text not null default '',
  -- enrichment metadata; NULL for seed rows so the UI shows no source badges
  source            text,                       -- 'csv' | 'manual'
  created_at        timestamptz not null default now()
);

-- ── contacts ─────────────────────────────────────────────────────
create table if not exists contacts (
  id             text primary key,
  company_id     text not null references companies(id) on delete cascade,
  name           text not null default '',
  email          text not null default '',
  title          text not null default '',
  -- enrichment metadata; NULL for seed rows
  source         text,                          -- 'scraped' | 'constructed' | 'manual'
  email_verified boolean,
  created_at     timestamptz not null default now()
);

create index if not exists contacts_company_id_idx on contacts (company_id);

-- ── prospects (the review state that must survive reloads) ────────
create table if not exists prospects (
  seq                  bigint generated always as identity,
  id                   text primary key,
  company_id           text not null references companies(id) on delete cascade,
  contact_id           text references contacts(id) on delete set null,
  status               text not null default 'pending'
                         check (status in ('pending', 'drafted', 'archived')),
  selected_template_id text,
  custom_line          text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- one prospect per company, mirroring the JSON model
create unique index if not exists prospects_company_id_key on prospects (company_id);
-- stable display ordering
create index if not exists prospects_seq_idx on prospects (seq);

-- keep updated_at fresh on any change
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists prospects_set_updated_at on prospects;
create trigger prospects_set_updated_at
  before update on prospects
  for each row execute function set_updated_at();
