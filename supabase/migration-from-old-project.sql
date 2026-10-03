-- Car Market -> Full Stack Portfolio Supabase project migration.
-- Run once in the PORTFOLIO project's SQL editor. Idempotent: safe to re-run.
-- Source: db_cluster backup of the old Car Market project (2026-09-09).
-- Everything lives in its own schema "carmarket"; nothing in "public" or in the
-- portfolio's tables/triggers is touched. Data is owned by auth user 434cb48b-39bf-41c5-b15b-19fab142bc6b.

begin;

-- SQL-language functions are defined before the tables they reference.
set local check_function_bodies = off;

create schema if not exists carmarket;
grant usage on schema carmarket to anon, authenticated, service_role;

-- Car Market's own profiles table (admin flag). No trigger on auth.users: a row
-- exists only for users who need one (the admin), so portfolio sign-ins are unaffected.
create table if not exists carmarket.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  updated_at timestamptz default now(),
  is_admin boolean not null default false
);
alter table carmarket.profiles enable row level security;

-- functions

CREATE OR REPLACE FUNCTION carmarket.is_admin() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select coalesce(
    (select p.is_admin from carmarket.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- NOTE: fixed an operator-precedence bug in the original OFFSET (was "page - 1 * size").
CREATE OR REPLACE FUNCTION carmarket.search_listing_ids_within_radius(p_lat double precision, p_lng double precision, p_radius_miles double precision, p_search text, p_make text, p_max_price numeric, p_sort text, p_page integer, p_page_size integer) RETURNS TABLE(listing_id uuid, total_count bigint)
    LANGUAGE sql STABLE
    AS $$
  with filtered as (
    select
      l.id,
      l.created_at,
      l.price,
      (
        3958.7613 * acos(
          cos(radians(p_lat)) * cos(radians(l.lat)) *
          cos(radians(l.lng) - radians(p_lng)) +
          sin(radians(p_lat)) * sin(radians(l.lat))
        )
      ) as dist_miles
    from carmarket.listings l
    where
      l.is_active = true
      and l.lat is not null
      and l.lng is not null
      and (
        p_search is null
        or l.make ilike ('%' || p_search || '%')
        or l.model ilike ('%' || p_search || '%')
      )
      and (p_make is null or l.make = p_make)
      and (p_max_price is null or l.price <= p_max_price)
  )
  select
    id as listing_id,
    count(*) over() as total_count
  from filtered
  where dist_miles <= p_radius_miles
  order by
    case when p_sort = 'newest' then created_at end desc nulls last,
    case when p_sort = 'price_asc' then price end asc nulls last,
    case when p_sort = 'price_desc' then price end desc nulls last,
    id
  limit p_page_size
  offset (greatest(p_page, 1) - 1) * p_page_size;
$$;


-- tables

CREATE TABLE IF NOT EXISTS carmarket.brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL
);

CREATE TABLE IF NOT EXISTS carmarket.models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_id uuid NOT NULL,
    name text NOT NULL
);

CREATE TABLE IF NOT EXISTS carmarket.listings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    make text NOT NULL,
    model text NOT NULL,
    year integer NOT NULL,
    price numeric NOT NULL,
    mileage integer NOT NULL,
    fuel_type text NOT NULL,
    transmission text NOT NULL,
    description text,
    image_ids text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    is_featured boolean DEFAULT false NOT NULL,
    zip_code text,
    lat double precision,
    lng double precision
);

CREATE TABLE IF NOT EXISTS carmarket.listing_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    bucket text DEFAULT 'car-images'::text NOT NULL,
    path text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS carmarket.favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    listing_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS carmarket.inquiries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    buyer_id uuid NOT NULL,
    seller_id uuid NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- primary keys, foreign keys, indexes (skipped if the constraint already exists)

do $$ begin if not exists (select 1 from pg_constraint where conname='brands_name_key' and conrelid='carmarket.brands'::regclass) then
  ALTER TABLE ONLY carmarket.brands
    ADD CONSTRAINT brands_name_key UNIQUE (name);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='brands_pkey' and conrelid='carmarket.brands'::regclass) then
  ALTER TABLE ONLY carmarket.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='favorites_pkey' and conrelid='carmarket.favorites'::regclass) then
  ALTER TABLE ONLY carmarket.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='favorites_user_id_listing_id_key' and conrelid='carmarket.favorites'::regclass) then
  ALTER TABLE ONLY carmarket.favorites
    ADD CONSTRAINT favorites_user_id_listing_id_key UNIQUE (user_id, listing_id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='inquiries_pkey' and conrelid='carmarket.inquiries'::regclass) then
  ALTER TABLE ONLY carmarket.inquiries
    ADD CONSTRAINT inquiries_pkey PRIMARY KEY (id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='listing_images_bucket_path_key' and conrelid='carmarket.listing_images'::regclass) then
  ALTER TABLE ONLY carmarket.listing_images
    ADD CONSTRAINT listing_images_bucket_path_key UNIQUE (bucket, path);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='listing_images_listing_id_position_key' and conrelid='carmarket.listing_images'::regclass) then
  ALTER TABLE ONLY carmarket.listing_images
    ADD CONSTRAINT listing_images_listing_id_position_key UNIQUE (listing_id, "position");
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='listing_images_pkey' and conrelid='carmarket.listing_images'::regclass) then
  ALTER TABLE ONLY carmarket.listing_images
    ADD CONSTRAINT listing_images_pkey PRIMARY KEY (id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='listings_pkey' and conrelid='carmarket.listings'::regclass) then
  ALTER TABLE ONLY carmarket.listings
    ADD CONSTRAINT listings_pkey PRIMARY KEY (id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='models_brand_id_name_key' and conrelid='carmarket.models'::regclass) then
  ALTER TABLE ONLY carmarket.models
    ADD CONSTRAINT models_brand_id_name_key UNIQUE (brand_id, name);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='models_pkey' and conrelid='carmarket.models'::regclass) then
  ALTER TABLE ONLY carmarket.models
    ADD CONSTRAINT models_pkey PRIMARY KEY (id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='favorites_listing_id_fkey' and conrelid='carmarket.favorites'::regclass) then
  ALTER TABLE ONLY carmarket.favorites
    ADD CONSTRAINT favorites_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES carmarket.listings(id) ON DELETE CASCADE;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='favorites_user_id_fkey' and conrelid='carmarket.favorites'::regclass) then
  ALTER TABLE ONLY carmarket.favorites
    ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='inquiries_buyer_id_fkey' and conrelid='carmarket.inquiries'::regclass) then
  ALTER TABLE ONLY carmarket.inquiries
    ADD CONSTRAINT inquiries_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='inquiries_listing_id_fkey' and conrelid='carmarket.inquiries'::regclass) then
  ALTER TABLE ONLY carmarket.inquiries
    ADD CONSTRAINT inquiries_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES carmarket.listings(id) ON DELETE CASCADE;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='inquiries_seller_id_fkey' and conrelid='carmarket.inquiries'::regclass) then
  ALTER TABLE ONLY carmarket.inquiries
    ADD CONSTRAINT inquiries_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='listing_images_listing_id_fkey' and conrelid='carmarket.listing_images'::regclass) then
  ALTER TABLE ONLY carmarket.listing_images
    ADD CONSTRAINT listing_images_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES carmarket.listings(id) ON DELETE CASCADE;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='listings_seller_id_fkey' and conrelid='carmarket.listings'::regclass) then
  ALTER TABLE ONLY carmarket.listings
    ADD CONSTRAINT listings_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname='models_brand_id_fkey' and conrelid='carmarket.models'::regclass) then
  ALTER TABLE ONLY carmarket.models
    ADD CONSTRAINT models_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES carmarket.brands(id) ON DELETE CASCADE;
end if; end $$;

CREATE INDEX IF NOT EXISTS inquiries_buyer_id_idx ON carmarket.inquiries USING btree (buyer_id);
CREATE INDEX IF NOT EXISTS inquiries_created_at_idx ON carmarket.inquiries USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS inquiries_listing_id_idx ON carmarket.inquiries USING btree (listing_id);
CREATE INDEX IF NOT EXISTS inquiries_seller_id_idx ON carmarket.inquiries USING btree (seller_id);
CREATE INDEX IF NOT EXISTS listing_images_listing_id_idx ON carmarket.listing_images USING btree (listing_id);
CREATE INDEX IF NOT EXISTS listings_is_featured_idx ON carmarket.listings USING btree (is_featured);
CREATE INDEX IF NOT EXISTS listings_lat_lng_idx ON carmarket.listings USING btree (lat, lng);

-- 4. RLS + grants
alter table carmarket.brands enable row level security;
grant all on table carmarket.brands to anon, authenticated, service_role;
alter table carmarket.models enable row level security;
grant all on table carmarket.models to anon, authenticated, service_role;
alter table carmarket.listings enable row level security;
grant all on table carmarket.listings to anon, authenticated, service_role;
alter table carmarket.listing_images enable row level security;
grant all on table carmarket.listing_images to anon, authenticated, service_role;
alter table carmarket.favorites enable row level security;
grant all on table carmarket.favorites to anon, authenticated, service_role;
alter table carmarket.inquiries enable row level security;
grant all on table carmarket.inquiries to anon, authenticated, service_role;
grant all on table carmarket.profiles to anon, authenticated, service_role;
-- Hardening vs the original: users must not be able to grant themselves is_admin.
revoke insert, update on carmarket.profiles from anon, authenticated;
grant insert (id, full_name, avatar_url) on carmarket.profiles to authenticated;
grant update (full_name, avatar_url, updated_at) on carmarket.profiles to authenticated;
grant execute on function carmarket.is_admin() to anon, authenticated, service_role;
grant execute on function carmarket.search_listing_ids_within_radius(double precision, double precision, double precision, text, text, numeric, text, integer, integer) to anon, authenticated, service_role;

-- 5. policies (created only if a policy with that name does not already exist)
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='listings' and policyname='Public can read active listings') then
  execute $q$CREATE POLICY "Public can read active listings" ON carmarket.listings FOR SELECT USING ((is_active = true))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='listings' and policyname='Public listings are viewable by everyone') then
  execute $q$CREATE POLICY "Public listings are viewable by everyone" ON carmarket.listings FOR SELECT USING ((is_active = true))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='listings' and policyname='Sellers can delete their own listings') then
  execute $q$CREATE POLICY "Sellers can delete their own listings" ON carmarket.listings FOR DELETE USING ((seller_id = auth.uid()))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='listings' and policyname='Sellers can update their own listings') then
  execute $q$CREATE POLICY "Sellers can update their own listings" ON carmarket.listings FOR UPDATE USING ((seller_id = auth.uid())) WITH CHECK ((seller_id = auth.uid()))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='listings' and policyname='Users can create their own listings') then
  execute $q$CREATE POLICY "Users can create their own listings" ON carmarket.listings FOR INSERT WITH CHECK ((seller_id = auth.uid()))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='listings' and policyname='Users can update own listings') then
  execute $q$CREATE POLICY "Users can update own listings" ON carmarket.listings FOR UPDATE USING ((auth.uid() = seller_id))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='brands' and policyname='brands_select_all') then
  execute $q$CREATE POLICY brands_select_all ON carmarket.brands FOR SELECT USING (true)$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='favorites' and policyname='favorites_delete_own') then
  execute $q$CREATE POLICY favorites_delete_own ON carmarket.favorites FOR DELETE USING ((auth.uid() = user_id))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='favorites' and policyname='favorites_insert_own') then
  execute $q$CREATE POLICY favorites_insert_own ON carmarket.favorites FOR INSERT WITH CHECK ((auth.uid() = user_id))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='favorites' and policyname='favorites_select_own') then
  execute $q$CREATE POLICY favorites_select_own ON carmarket.favorites FOR SELECT USING ((auth.uid() = user_id))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='inquiries' and policyname='inquiries_insert_participants') then
  execute $q$CREATE POLICY inquiries_insert_participants ON carmarket.inquiries FOR INSERT WITH CHECK ((((auth.uid() = buyer_id) OR (auth.uid() = seller_id)) AND (EXISTS ( SELECT 1
   FROM carmarket.listings l
  WHERE ((l.id = inquiries.listing_id) AND (l.seller_id = l.seller_id))))))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='inquiries' and policyname='inquiries_select_participants') then
  execute $q$CREATE POLICY inquiries_select_participants ON carmarket.inquiries FOR SELECT USING (((auth.uid() = buyer_id) OR (auth.uid() = seller_id)))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='listing_images' and policyname='li_delete_owner') then
  execute $q$CREATE POLICY li_delete_owner ON carmarket.listing_images FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM carmarket.listings l
  WHERE ((l.id = listing_images.listing_id) AND (l.seller_id = auth.uid())))))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='listing_images' and policyname='li_delete_owner_or_admin') then
  execute $q$CREATE POLICY li_delete_owner_or_admin ON carmarket.listing_images FOR DELETE TO authenticated USING ((carmarket.is_admin() OR (EXISTS ( SELECT 1
   FROM carmarket.listings l
  WHERE ((l.id = listing_images.listing_id) AND (l.seller_id = auth.uid()))))))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='listing_images' and policyname='li_insert_owner') then
  execute $q$CREATE POLICY li_insert_owner ON carmarket.listing_images FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM carmarket.listings l
  WHERE ((l.id = listing_images.listing_id) AND (l.seller_id = auth.uid())))))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='listing_images' and policyname='li_insert_owner_or_admin') then
  execute $q$CREATE POLICY li_insert_owner_or_admin ON carmarket.listing_images FOR INSERT TO authenticated WITH CHECK ((carmarket.is_admin() OR (EXISTS ( SELECT 1
   FROM carmarket.listings l
  WHERE ((l.id = listing_images.listing_id) AND (l.seller_id = auth.uid()))))))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='listing_images' and policyname='li_select_all') then
  execute $q$CREATE POLICY li_select_all ON carmarket.listing_images FOR SELECT USING (true)$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='listing_images' and policyname='li_update_owner') then
  execute $q$CREATE POLICY li_update_owner ON carmarket.listing_images FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM carmarket.listings l
  WHERE ((l.id = listing_images.listing_id) AND (l.seller_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM carmarket.listings l
  WHERE ((l.id = listing_images.listing_id) AND (l.seller_id = auth.uid())))))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='listing_images' and policyname='li_update_owner_or_admin') then
  execute $q$CREATE POLICY li_update_owner_or_admin ON carmarket.listing_images FOR UPDATE TO authenticated USING ((carmarket.is_admin() OR (EXISTS ( SELECT 1
   FROM carmarket.listings l
  WHERE ((l.id = listing_images.listing_id) AND (l.seller_id = auth.uid())))))) WITH CHECK ((carmarket.is_admin() OR (EXISTS ( SELECT 1
   FROM carmarket.listings l
  WHERE ((l.id = listing_images.listing_id) AND (l.seller_id = auth.uid()))))))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='listings' and policyname='listings_delete_owner_or_admin') then
  execute $q$CREATE POLICY listings_delete_owner_or_admin ON carmarket.listings FOR DELETE TO authenticated USING (((seller_id = auth.uid()) OR carmarket.is_admin()))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='listings' and policyname='listings_insert_owner') then
  execute $q$CREATE POLICY listings_insert_owner ON carmarket.listings FOR INSERT TO authenticated WITH CHECK (((seller_id = auth.uid()) OR carmarket.is_admin()))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='listings' and policyname='listings_select_all') then
  execute $q$CREATE POLICY listings_select_all ON carmarket.listings FOR SELECT USING (true)$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='listings' and policyname='listings_select_owner') then
  execute $q$CREATE POLICY listings_select_owner ON carmarket.listings FOR SELECT TO authenticated USING ((seller_id = auth.uid()))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='listings' and policyname='listings_update_owner_or_admin') then
  execute $q$CREATE POLICY listings_update_owner_or_admin ON carmarket.listings FOR UPDATE TO authenticated USING (((seller_id = auth.uid()) OR carmarket.is_admin())) WITH CHECK (((seller_id = auth.uid()) OR carmarket.is_admin()))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='models' and policyname='models_select_all') then
  execute $q$CREATE POLICY models_select_all ON carmarket.models FOR SELECT USING (true)$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='profiles' and policyname='profiles_insert_own') then
  execute $q$CREATE POLICY profiles_insert_own ON carmarket.profiles FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='profiles' and policyname='profiles_select_own') then
  execute $q$CREATE POLICY profiles_select_own ON carmarket.profiles FOR SELECT TO authenticated USING ((id = auth.uid()))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='carmarket' and tablename='profiles' and policyname='profiles_update_own') then
  execute $q$CREATE POLICY profiles_update_own ON carmarket.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='car_images_delete_owner') then
  execute $q$CREATE POLICY car_images_delete_owner ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'car-images'::text) AND (regexp_match(name, '^listings/([^/]+)/'::text) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM carmarket.listings l
  WHERE ((l.id = ((regexp_match(objects.name, '^listings/([^/]+)/'::text))[1])::uuid) AND (l.seller_id = auth.uid()))))))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='car_images_delete_owner_or_admin') then
  execute $q$CREATE POLICY car_images_delete_owner_or_admin ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'car-images'::text) AND (regexp_match(name, '^listings/([^/]+)/'::text) IS NOT NULL) AND (carmarket.is_admin() OR (EXISTS ( SELECT 1
   FROM carmarket.listings l
  WHERE ((l.id = ((regexp_match(objects.name, '^listings/([^/]+)/'::text))[1])::uuid) AND (l.seller_id = auth.uid())))))))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='car_images_insert_owner') then
  execute $q$CREATE POLICY car_images_insert_owner ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'car-images'::text) AND (regexp_match(name, '^listings/([^/]+)/'::text) IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM carmarket.listings l
  WHERE ((l.id = ((regexp_match(objects.name, '^listings/([^/]+)/'::text))[1])::uuid) AND (l.seller_id = auth.uid()))))))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='car_images_insert_owner_or_admin') then
  execute $q$CREATE POLICY car_images_insert_owner_or_admin ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'car-images'::text) AND (regexp_match(name, '^listings/([^/]+)/'::text) IS NOT NULL) AND (carmarket.is_admin() OR (EXISTS ( SELECT 1
   FROM carmarket.listings l
  WHERE ((l.id = ((regexp_match(objects.name, '^listings/([^/]+)/'::text))[1])::uuid) AND (l.seller_id = auth.uid())))))))$q$;
end if; end $p$;
do $p$ begin if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='car_images_read') then
  execute $q$CREATE POLICY car_images_read ON storage.objects FOR SELECT USING ((bucket_id = 'car-images'::text))$q$;
end if; end $p$;

-- 6. storage bucket (public read, as before)
insert into storage.buckets (id, name, public) values ('car-images', 'car-images', true)
on conflict (id) do nothing;

-- 7. data (listings/favorites re-owned by the portfolio admin; seed "Test User" and its self-test inquiry dropped)
insert into carmarket.profiles (id, is_admin) values ('434cb48b-39bf-41c5-b15b-19fab142bc6b', true) on conflict (id) do nothing;

insert into carmarket.listings (id, seller_id, make, model, year, price, mileage, fuel_type, transmission, description, image_ids, is_active, created_at, is_featured, zip_code, lat, lng) values
  ('38d2761f-d883-4165-8e9f-49ac50e01f36', '434cb48b-39bf-41c5-b15b-19fab142bc6b', 'Toyota', 'Land Cruiser', '2021', '78000', '45000', 'Gasoline', 'Automatic', 'The last of the V8s.', '{"2021 Land Cruiser.jpeg"}', 't', '2025-12-31 20:35:21.473385+00', 'f', NULL, NULL, NULL),
  ('4f8c1c0d-7179-4942-b273-66798bb5cb43', '434cb48b-39bf-41c5-b15b-19fab142bc6b', 'Toyota', 'Camry', '2020', '18500', '65000', 'Gasoline', 'Automatic', NULL, '{}', 't', '2026-01-03 18:19:54.452031+00', 'f', NULL, NULL, NULL),
  ('1d630148-7068-45b6-8645-7c3a000e84c8', '434cb48b-39bf-41c5-b15b-19fab142bc6b', 'Rivian', 'R1S', '2024', '84000', '500', 'Electric', 'Automatic', 'Launch Edition, Adventure Package.', '{"Rivian R1S.png"}', 't', '2025-12-31 20:35:21.473385+00', 't', NULL, NULL, NULL),
  ('f6bb5d0b-4e31-479e-b9b6-b3b723c9588b', '434cb48b-39bf-41c5-b15b-19fab142bc6b', 'Porsche', '911 Carrera', '2023', '125000', '1200', 'Gasoline', 'PDK', 'Mint condition 911 in Chalk Grey.', '{"911 Carrera.png"}', 't', '2025-12-31 20:35:21.473385+00', 't', NULL, NULL, NULL)
on conflict (id) do nothing;

insert into carmarket.listing_images (id, listing_id, bucket, path, "position", created_at) values
  ('0578ed0f-84ac-4395-95ef-5f4bb30321c4', 'f6bb5d0b-4e31-479e-b9b6-b3b723c9588b', 'car-images', 'listings/f6bb5d0b-4e31-479e-b9b6-b3b723c9588b/d2b166a4-45a1-4ea2-8175-8f04efb77af2.jpg', '0', '2026-01-03 20:08:22.259113+00'),
  ('3cd5eaa3-8484-4cdf-ab74-98494a6ab006', '1d630148-7068-45b6-8645-7c3a000e84c8', 'car-images', 'listings/1d630148-7068-45b6-8645-7c3a000e84c8/1f5b87b8-a7b6-4158-ab36-f793f6c75f15.png', '0', '2026-01-03 20:09:21.240559+00'),
  ('58f85e9c-6828-45e0-9b86-0cdab3f54ed0', '38d2761f-d883-4165-8e9f-49ac50e01f36', 'car-images', 'listings/38d2761f-d883-4165-8e9f-49ac50e01f36/4f8f9fc6-a29b-4553-a8db-96d1746a41d1.jpeg', '0', '2026-01-03 20:11:25.238425+00'),
  ('f4532e13-bd8f-47c4-85c5-ef845e989ea9', '4f8c1c0d-7179-4942-b273-66798bb5cb43', 'car-images', 'listings/4f8c1c0d-7179-4942-b273-66798bb5cb43/789a7b6e-7eee-459f-9400-262e3398696f.png', '0', '2026-01-03 19:37:06.091546+00')
on conflict (id) do nothing;

insert into carmarket.favorites (id, user_id, listing_id, created_at) values
  ('68984b7c-53f4-461c-bf43-e4943a8f725e', '434cb48b-39bf-41c5-b15b-19fab142bc6b', '4f8c1c0d-7179-4942-b273-66798bb5cb43', '2026-01-04 11:31:21.195747+00')
on conflict (id) do nothing;

commit;
