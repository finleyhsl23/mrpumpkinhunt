-- Mr Pumpkin Hunt - schema
--
-- Kept in its own schema rather than as prefixed tables in `public`, because
-- this is a seasonal one-off for a single client. In November the whole thing
-- is `drop schema mrpumpkin cascade;` and the core database is untouched.
--
-- Nothing here is reachable from a browser. The two Cloudflare Pages
-- functions talk to it with the service role key; the anon and authenticated
-- roles are explicitly denied below, so there is no key in the client to lift
-- and no RLS policy to get subtly wrong.

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

create index if not exists events_created_idx on mrpumpkin.events (created_at desc);
create index if not exists events_slug_idx    on mrpumpkin.events (pumpkin_slug) where pumpkin_slug is not null;
create index if not exists events_device_idx  on mrpumpkin.events (device);

-- One row per guide emailed. `ip_hash` is a salted hash, never an address:
-- it exists only to cap one phone hammering the send endpoint.
create table if not exists mrpumpkin.guide_requests (
  id            bigint generated always as identity primary key,
  email         text        not null,
  name          text,
  device        text,
  found_slugs   text[]      not null default '{}',
  ip_hash       text,
  created_at    timestamptz not null default now()
);

create index if not exists guide_requests_ip_idx    on mrpumpkin.guide_requests (ip_hash, created_at desc);
create index if not exists guide_requests_email_idx on mrpumpkin.guide_requests (lower(email));

-- Belt and braces. The service role bypasses RLS anyway; this makes sure a
-- future mistake - adding mrpumpkin to the exposed schemas, say - still does
-- not hand the anon key a way in.
alter table mrpumpkin.events         enable row level security;
alter table mrpumpkin.guide_requests enable row level security;

revoke all on schema mrpumpkin from anon, authenticated;
revoke all on all tables in schema mrpumpkin from anon, authenticated;
alter default privileges in schema mrpumpkin revoke all on tables from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Views for whoever is running the patch. Read these in the SQL editor.
-- ---------------------------------------------------------------------------

-- Which pumpkin is found least? That sign is probably in a bad spot, badly
-- lit, or knocked over.
create or replace view mrpumpkin.v_finds_by_pumpkin as
select pumpkin_slug,
       count(*)                          as finds,
       count(distinct device)            as phones,
       max(created_at)                   as last_found
from mrpumpkin.events
where event = 'find'
group by pumpkin_slug
order by finds asc;

-- Hunts started vs finished, by day.
create or replace view mrpumpkin.v_daily as
select (created_at at time zone 'Europe/London')::date       as day,
       count(distinct device) filter (where event = 'find')     as hunts_with_a_find,
       count(distinct device) filter (where event = 'complete') as hunts_completed,
       count(*) filter (where event = 'bad_code')               as failed_scans
from mrpumpkin.events
group by 1
order by 1 desc;
