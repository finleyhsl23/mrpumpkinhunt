-- Mr Pumpkin Hunt - database
--
-- Its own schema, so a seasonal one-off stays out of the core database and
-- November's clean-up is a single `drop schema mrpumpkin cascade;`.
--
-- ONE MANUAL STEP, and nothing works without it:
--
--     Supabase > Project Settings > API > Exposed schemas > add `mrpumpkin`
--
-- On this project the dashboard toggle would not save, so it was set in SQL
-- instead. That list is now SQL-managed: to add another schema later, edit
-- and re-run this statement with the FULL list, not just the new one.
--
--     alter role authenticator set pgrst.db_schemas =
--       'public, graphql_public, smartrv, smartfitsinstallationsltd,
--        hassalls, holidaymanagement, mrpumpkin';
--     notify pgrst, 'reload config';
--     notify pgrst, 'reload schema';
--
-- BOTH notifications are needed and they are not the same thing. 'reload
-- config' picks up the schema list; 'reload schema' rebuilds the table cache.
-- With only the first you get PGRST205 - "could not find the table ... in the
-- schema cache" - which reads like the schema is still missing when it is not.
--
-- PostgREST will not serve a schema that is not on that list. The service
-- role bypasses row-level security, not that. Miss it and every write returns
-- an error the Pages functions swallow - deliberately, so a database problem
-- cannot spoil a visit - which looks exactly like nothing happening at all.
-- `/api/health` reads a row and reports the failure if this step is missed.
--
-- Nothing here is reachable from a browser: exposing the schema makes it
-- visible to the Data API, so anon and authenticated are denied explicitly
-- below rather than left to RLS alone.

create schema if not exists mrpumpkin;

-- Everything a visitor's phone reports: finds, completions, and codes that
-- did not scan cleanly. `bad_code` is the useful one - a spike against a
-- single code means that sign is damaged, dirty, or in bad light.
create table if not exists mrpumpkin.events (
  id            bigint generated always as identity primary key,
  event         text        not null check (event in ('find', 'complete', 'bad_code')),
  device        text,
  pumpkin_slug  text,
  found_count   smallint,
  client_at     text,        -- the phone's own clock; unreliable, kept for ordering
  created_at    timestamptz not null default now()
);

-- One row per guide emailed. `ip_hash` is a salted hash, never an address.
create table if not exists mrpumpkin.guide_requests (
  id            bigint generated always as identity primary key,
  email         text        not null,
  name          text,
  device        text,
  found_slugs   text[]      not null default '{}',
  ip_hash       text,
  created_at    timestamptz not null default now()
);

-- Progress kept against an email so a returning visitor can be offered it
-- back. Only ever populated for people who chose to give an address.
create table if not exists mrpumpkin.saved_hunts (
  email        text primary key,   -- stored lowercased and trimmed
  found_slugs  text[]      not null default '{}',
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now()
);

-- Rate-limit ledger for progress lookups. Without it the lookup endpoint is
-- an oracle for whether an address has ever visited. Safe to truncate.
create table if not exists mrpumpkin.lookups (
  id         bigint generated always as identity primary key,
  ip_hash    text        not null,
  created_at timestamptz not null default now()
);

create index if not exists events_created_idx on mrpumpkin.events (created_at desc);
create index if not exists events_slug_idx    on mrpumpkin.events (pumpkin_slug) where pumpkin_slug is not null;
create index if not exists guides_ip_idx      on mrpumpkin.guide_requests (ip_hash, created_at desc);
create index if not exists lookups_ip_idx     on mrpumpkin.lookups (ip_hash, created_at desc);

alter table mrpumpkin.events         enable row level security;
alter table mrpumpkin.guide_requests enable row level security;
alter table mrpumpkin.saved_hunts    enable row level security;
alter table mrpumpkin.lookups        enable row level security;

-- The service role is what the Pages functions use, and it still needs usage
-- on the schema and privileges on the tables - being able to bypass RLS is
-- not the same as being allowed in. The identity columns need the sequence
-- grant too, or inserts fail.
grant usage on schema mrpumpkin to service_role;
grant select, insert, update, delete on all tables in schema mrpumpkin to service_role;
grant usage, select on all sequences in schema mrpumpkin to service_role;
alter default privileges in schema mrpumpkin grant select, insert, update, delete on tables to service_role;
alter default privileges in schema mrpumpkin grant usage, select on sequences to service_role;

revoke all on schema mrpumpkin from anon, authenticated;
revoke all on all tables in schema mrpumpkin from anon, authenticated;
alter default privileges in schema mrpumpkin revoke all on tables from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Views for whoever is running the patch. Read these in the SQL editor.
-- ---------------------------------------------------------------------------

-- Least-found first. The pumpkin at the top probably has a sign in a bad spot.
create or replace view mrpumpkin.v_finds_by_pumpkin as
select pumpkin_slug, count(*) as finds, count(distinct device) as phones, max(created_at) as last_found
from mrpumpkin.events where event = 'find'
group by pumpkin_slug order by finds asc;

create or replace view mrpumpkin.v_daily as
select (created_at at time zone 'Europe/London')::date               as day,
       count(distinct device) filter (where event = 'find')          as hunts_with_a_find,
       count(distinct device) filter (where event = 'complete')      as hunts_completed,
       count(*) filter (where event = 'bad_code')                    as failed_scans
from mrpumpkin.events group by 1 order by 1 desc;

-- How many visitors come back, and how far they got.
create or replace view mrpumpkin.v_returning as
select count(*)                                                          as saved_hunts,
       count(*) filter (where cardinality(found_slugs) = 10)             as completed,
       count(*) filter (where last_seen > first_seen + interval '1 hour') as came_back_later,
       round(avg(cardinality(found_slugs)), 1)                           as avg_found
from mrpumpkin.saved_hunts;
