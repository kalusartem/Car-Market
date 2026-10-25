-- Car Market: richer listing specs, listing reports, and basic abuse limits.
-- Run in the Supabase SQL editor of the project that hosts the `carmarket` schema,
-- after 20260909000000_baseline_from_old_project.sql. Idempotent: safe to re-run.
-- The app keeps working without this file; it detects the new columns/table and
-- switches the related features on (VIN, trim, body type, drivetrain, colour, title
-- status, city/state, body/drivetrain filters, "Report listing").

begin;

-- 1. Listing specs ---------------------------------------------------------------

alter table carmarket.listings
  add column if not exists vin text,
  add column if not exists trim text,
  add column if not exists body_type text,
  add column if not exists drivetrain text,
  add column if not exists exterior_color text,
  add column if not exists title_status text,
  add column if not exists city text,
  add column if not exists state text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'listings_vin_format' and conrelid = 'carmarket.listings'::regclass) then
    alter table carmarket.listings
      add constraint listings_vin_format check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'listings_body_type_check' and conrelid = 'carmarket.listings'::regclass) then
    alter table carmarket.listings
      add constraint listings_body_type_check check (body_type is null or body_type in
        ('Sedan','SUV','Truck','Coupe','Hatchback','Wagon','Van','Convertible'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'listings_drivetrain_check' and conrelid = 'carmarket.listings'::regclass) then
    alter table carmarket.listings
      add constraint listings_drivetrain_check check (drivetrain is null or drivetrain in ('FWD','RWD','AWD','4WD'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'listings_title_status_check' and conrelid = 'carmarket.listings'::regclass) then
    alter table carmarket.listings
      add constraint listings_title_status_check check (title_status is null or title_status in ('Clean','Rebuilt','Salvage'));
  end if;
end $$;

-- One active listing per VIN (stops duplicate / scam re-posts).
create unique index if not exists listings_active_vin_uniq
  on carmarket.listings (vin) where vin is not null and is_active;

-- Indexes behind the browse page filters and sorts.
create index if not exists listings_make_model_idx on carmarket.listings (lower(make), lower(model));
create index if not exists listings_created_at_idx on carmarket.listings (created_at desc);
create index if not exists listings_price_idx on carmarket.listings (price);
create index if not exists listings_seller_id_idx on carmarket.listings (seller_id);

-- 2. Listing reports -------------------------------------------------------------

create table if not exists carmarket.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references carmarket.listings(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 100),
  details text check (details is null or char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  unique (listing_id, reporter_id)
);

alter table carmarket.listing_reports enable row level security;

-- anon gets SELECT only so the app can detect the table; RLS shows them no rows.
grant select on carmarket.listing_reports to anon;
grant select, insert on carmarket.listing_reports to authenticated;
grant all on carmarket.listing_reports to service_role;

do $p$ begin
  if not exists (select 1 from pg_policies where schemaname = 'carmarket' and tablename = 'listing_reports' and policyname = 'listing_reports_insert_own') then
    create policy listing_reports_insert_own on carmarket.listing_reports
      for insert to authenticated with check (reporter_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'carmarket' and tablename = 'listing_reports' and policyname = 'listing_reports_select_own_or_admin') then
    create policy listing_reports_select_own_or_admin on carmarket.listing_reports
      for select using (reporter_id = auth.uid() or carmarket.is_admin());
  end if;
end $p$;

-- 3. Abuse limits ----------------------------------------------------------------

create or replace function carmarket.enforce_listing_rate_limit() returns trigger
language plpgsql security definer set search_path = carmarket, public as $$
begin
  if auth.role() = 'service_role' then return new; end if;
  if (select count(*) from carmarket.listings
       where seller_id = new.seller_id and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'You can create at most 10 listings per day.';
  end if;
  return new;
end $$;

drop trigger if exists listings_rate_limit on carmarket.listings;
create trigger listings_rate_limit before insert on carmarket.listings
  for each row execute function carmarket.enforce_listing_rate_limit();

create or replace function carmarket.enforce_inquiry_rate_limit() returns trigger
language plpgsql security definer set search_path = carmarket, public as $$
begin
  if auth.role() = 'service_role' then return new; end if;
  if (select count(*) from carmarket.inquiries
       where buyer_id = new.buyer_id and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'You are sending messages too quickly. Please try again later.';
  end if;
  return new;
end $$;

drop trigger if exists inquiries_rate_limit on carmarket.inquiries;
create trigger inquiries_rate_limit before insert on carmarket.inquiries
  for each row execute function carmarket.enforce_inquiry_rate_limit();

commit;
