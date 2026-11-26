-- Tighten table privileges and policies left over from the baseline import.
--
-- 1. Privileges. The baseline did `grant all ... to anon, authenticated` on every table, so anon held
--    INSERT/UPDATE/DELETE/TRUNCATE everywhere and RLS was the only guard (TRUNCATE isn't covered by RLS at all).
--    What the app actually does, from src/ and functions/:
--      anon (signed-out visitors, Pages Functions with the anon key):
--        SELECT listings, listing_images (embedded in listing queries), brands, models (make/model fallback),
--        listing_reports (feature probe; already granted SELECT only by 20261025000000).
--        SELECT profiles is kept: carmarket.is_admin() is SECURITY INVOKER and reads profiles inside the listings /
--        listing_images / listing_reports policies, so revoking it would break every signed-out listing query.
--        RLS shows anon no profile rows.
--      authenticated: SELECT/INSERT/UPDATE/DELETE listings and listing_images; SELECT/INSERT/DELETE favorites;
--        SELECT/INSERT inquiries; SELECT brands/models; profiles keeps SELECT plus the column grants from the
--        baseline; listing_reports SELECT/INSERT (unchanged).
--    Every privilege revoked below had no policy that could ever let the role use it (anon has auth.uid() = null,
--    and no policy grants writes on brands/models, updates/deletes on inquiries, updates on favorites or deletes on
--    profiles), so the only visible change is "permission denied" instead of "0 rows". TRUNCATE, REFERENCES and
--    TRIGGER are never used by the app.
--
-- 2. Duplicate policies. Each *_owner policy below is a strict subset of an *_owner_or_admin policy on the same
--    table and command (same role or narrower, same predicate minus "or is_admin()"), and permissive policies are
--    OR-ed, so dropping them changes nothing.
--
-- 3. listing_images were readable by anyone (li_select_all USING (true)), so photos of pending / rejected listings
--    leaked through PostgREST. They now follow the listing, like listings_select_approved_own_or_admin in
--    20261027000000_listing_review.sql.
--    The car-images storage bucket is still public: anyone who knows an object path can fetch the file. Paths are
--    listings/<listing uuid>/..., so they aren't guessable, but making the bucket private needs signed URLs in the app.
--
-- No app change is needed first. Part 3 needs listings.status (20261027000000_listing_review.sql) and is skipped
-- until that migration is applied; run this file again afterwards.
-- Idempotent: safe to run again.

begin;

-- 1. Privileges ------------------------------------------------------------------

revoke truncate, references, trigger on carmarket.brands, carmarket.models, carmarket.listings, carmarket.listing_images,
  carmarket.favorites, carmarket.inquiries, carmarket.profiles, carmarket.listing_reports from anon, authenticated;

-- anon: read-only on the public catalog, nothing on per-user tables.
revoke insert, update, delete on carmarket.brands, carmarket.models, carmarket.listings, carmarket.listing_images,
  carmarket.favorites, carmarket.inquiries, carmarket.profiles, carmarket.listing_reports from anon;
revoke select on carmarket.favorites, carmarket.inquiries from anon;
grant select on carmarket.brands, carmarket.models, carmarket.listings, carmarket.listing_images,
  carmarket.profiles, carmarket.listing_reports to anon;

-- authenticated: only what a policy can allow.
revoke insert, update, delete on carmarket.brands, carmarket.models from authenticated;
revoke update on carmarket.favorites from authenticated;
revoke update, delete on carmarket.inquiries from authenticated;
revoke delete on carmarket.profiles from authenticated;
grant select on carmarket.brands, carmarket.models to authenticated;
grant select, insert, update, delete on carmarket.listings, carmarket.listing_images to authenticated;
grant select, insert, delete on carmarket.favorites to authenticated;
grant select, insert on carmarket.inquiries to authenticated;
grant select on carmarket.profiles to authenticated;

-- 2. Duplicate policies ----------------------------------------------------------

-- listings: covered by listings_insert_owner / listings_update_owner_or_admin / listings_delete_owner_or_admin.
drop policy if exists "Users can create their own listings" on carmarket.listings;
drop policy if exists "Sellers can update their own listings" on carmarket.listings;
drop policy if exists "Users can update own listings" on carmarket.listings;
drop policy if exists "Sellers can delete their own listings" on carmarket.listings;

-- listing_images: covered by li_insert/update/delete_owner_or_admin.
drop policy if exists li_insert_owner on carmarket.listing_images;
drop policy if exists li_update_owner on carmarket.listing_images;
drop policy if exists li_delete_owner on carmarket.listing_images;

-- car-images objects: covered by car_images_insert/delete_owner_or_admin.
drop policy if exists car_images_insert_owner on storage.objects;
drop policy if exists car_images_delete_owner on storage.objects;

-- 3. Who can see listing photos --------------------------------------------------

-- Only once the review migration (20261027000000) has added listings.status: until then every listing is public, so
-- every photo is too, and li_select_all stays. (Run this file again after applying that migration.)
do $do$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'carmarket' and table_name = 'listings' and column_name = 'status') then
    drop policy if exists li_select_all on carmarket.listing_images;
    drop policy if exists li_select_approved_own_or_admin on carmarket.listing_images;
    create policy li_select_approved_own_or_admin on carmarket.listing_images
      for select using (
        exists (
          select 1 from carmarket.listings l
          where l.id = listing_images.listing_id
            and (l.status = 'approved' or l.seller_id = auth.uid() or carmarket.is_admin())
        )
      );
  else
    raise notice 'listings.status is missing: photo visibility left as it was (apply 20261027000000_listing_review.sql, then run this file again)';
  end if;
end
$do$;

commit;
