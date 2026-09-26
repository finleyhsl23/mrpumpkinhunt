-- Returning visitors: progress kept against an email so somebody can carry on
-- from another phone, or on another day.
--
-- Only ever populated for people who chose to give an address at the start.
-- Anyone who skips stays entirely on their own phone, exactly as before.

create table if not exists mrpumpkin.saved_hunts (
  email        text primary key,
  found_slugs  text[]      not null default '{}',
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now()
);

create index if not exists saved_hunts_last_seen_idx on mrpumpkin.saved_hunts (last_seen desc);

alter table mrpumpkin.saved_hunts enable row level security;
revoke all on mrpumpkin.saved_hunts from anon, authenticated;

comment on table mrpumpkin.saved_hunts is
  'Progress keyed by email for returning visitors. Written only via the Pages function with the service role key; the browser never touches Supabase directly. Emails are stored lowercased and trimmed so a lookup matches regardless of how it was typed.';

-- One row per progress lookup, used only to cap how often a single phone can
-- ask "does this email have a hunt?". Without it the endpoint is an oracle
-- for whether an address has ever visited.
create table if not exists mrpumpkin.lookups (
  id         bigint generated always as identity primary key,
  ip_hash    text        not null,
  created_at timestamptz not null default now()
);

create index if not exists lookups_ip_idx on mrpumpkin.lookups (ip_hash, created_at desc);

alter table mrpumpkin.lookups enable row level security;
revoke all on mrpumpkin.lookups from anon, authenticated;

comment on table mrpumpkin.lookups is
  'Rate-limit ledger for progress lookups. ip_hash is salted, never a raw address. Safe to truncate at any time.';

-- How many visitors come back, and how far they got.
create or replace view mrpumpkin.v_returning as
select count(*)                                                        as saved_hunts,
       count(*) filter (where cardinality(found_slugs) = 10)            as completed,
       count(*) filter (where last_seen > first_seen + interval '1 hour') as came_back_later,
       round(avg(cardinality(found_slugs)), 1)                          as avg_found
from mrpumpkin.saved_hunts;
