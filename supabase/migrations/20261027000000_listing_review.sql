-- Listing review: new and edited listings wait for an admin's approval before they appear on the marketplace,
-- and the admin gets an email for every submission (functions/api/listings/notify.ts → claim_review_notification).
--
--   * Every insert starts as "pending". An update that changes what buyers see (specs, price, description, ZIP)
--     or adds photos sends the listing back to "pending" and re-arms the email. Hiding / unhiding a listing,
--     reordering or deleting photos, and an admin's approve / reject leave it alone. An admin's edit of someone
--     else's listing doesn't need review; an admin's own listings go through it like everyone else's.
--   * Only admins can change status / review_note / reviewed_at.
--   * Pending and rejected listings are visible only to their seller and to admins.
--
-- Run after 20261026000000_inquiry_sender_and_policy.sql. Idempotent: safe to run again.
-- Listings that already exist are approved and marked as notified.

begin;

-- 1. Columns ---------------------------------------------------------------------

alter table carmarket.listings
  add column if not exists status text not null default 'approved',
  add column if not exists review_note text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists submitted_at timestamptz,
  add column if not exists notified boolean not null default true;

update carmarket.listings set submitted_at = coalesce(created_at, now()) where submitted_at is null;

-- Existing rows got the "approved / notified" defaults above; new rows start pending and un-notified.
alter table carmarket.listings
  alter column status set default 'pending',
  alter column notified set default false,
  alter column submitted_at set default now();

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'listings_status_check' and conrelid = 'carmarket.listings'::regclass) then
    alter table carmarket.listings
      add constraint listings_status_check check (status in ('pending', 'approved', 'rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'listings_review_note_length' and conrelid = 'carmarket.listings'::regclass) then
    alter table carmarket.listings
      add constraint listings_review_note_length check (review_note is null or char_length(review_note) <= 1000);
  end if;
end $$;

create index if not exists listings_status_submitted_idx on carmarket.listings (status, submitted_at);

-- 2. Triggers --------------------------------------------------------------------

-- claim_review_notification and listing_images_review set the review fields themselves; they turn this
-- transaction-local flag on so listings_review lets their update through.
create or replace function carmarket.listings_review() returns trigger
language plpgsql security definer set search_path = carmarket, public as $$
declare
  admin boolean;
  edited boolean;
begin
  if auth.role() = 'service_role' or coalesce(current_setting('carmarket.review_internal', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.review_note := null;
    new.reviewed_at := null;
    new.notified := false;
    new.submitted_at := now();
    return new;
  end if;

  admin := carmarket.is_admin();
  edited := (new.make, new.model, new.year, new.price, new.mileage, new.fuel_type, new.transmission, new.description,
             new.zip_code, new.vin, new.trim, new.body_type, new.drivetrain, new.exterior_color, new.title_status)
    is distinct from
            (old.make, old.model, old.year, old.price, old.mileage, old.fuel_type, old.transmission, old.description,
             old.zip_code, old.vin, old.trim, old.body_type, old.drivetrain, old.exterior_color, old.title_status);

  if not admin then
    new.status := old.status;
    new.review_note := old.review_note;
    new.reviewed_at := old.reviewed_at;
    new.notified := old.notified;
    new.submitted_at := old.submitted_at;
  end if;

  if edited and (not admin or new.seller_id = auth.uid()) then
    new.status := 'pending';
    new.review_note := null;
    new.reviewed_at := null;
    new.notified := false;
    new.submitted_at := now();
  end if;
  return new;
end $$;

drop trigger if exists listings_review on carmarket.listings;
create trigger listings_review before insert or update on carmarket.listings
  for each row execute function carmarket.listings_review();

-- New photos on an already-reviewed (or already-emailed) listing send it back for review.
create or replace function carmarket.listing_images_review() returns trigger
language plpgsql security definer set search_path = carmarket, public as $$
begin
  if auth.role() = 'service_role' then return null; end if;
  perform set_config('carmarket.review_internal', 'on', true);
  update carmarket.listings l
     set status = 'pending', review_note = null, reviewed_at = null, notified = false, submitted_at = now()
   where l.id = new.listing_id
     and (l.seller_id = auth.uid() or not carmarket.is_admin())
     and (l.status <> 'pending' or l.notified);
  perform set_config('carmarket.review_internal', '', true);
  return null;
end $$;

drop trigger if exists listing_images_review on carmarket.listing_images;
create trigger listing_images_review after insert on carmarket.listing_images
  for each row execute function carmarket.listing_images_review();

-- 3. "Waiting for approval" email ------------------------------------------------

-- Marks the seller's pending listing as "admin notified" and returns it, once per submission, so the
-- notify endpoint can't be replayed to send more mail.
create or replace function carmarket.claim_review_notification(p_listing_id uuid) returns setof carmarket.listings
language plpgsql security definer set search_path = carmarket, public as $$
declare
  r carmarket.listings;
begin
  perform set_config('carmarket.review_internal', 'on', true);
  for r in
    update carmarket.listings l set notified = true
     where l.id = p_listing_id and l.seller_id = auth.uid() and l.status = 'pending' and not l.notified
    returning l.*
  loop
    return next r;
  end loop;
  perform set_config('carmarket.review_internal', '', true);
end $$;

revoke execute on function carmarket.claim_review_notification(uuid) from public, anon;
grant execute on function carmarket.claim_review_notification(uuid) to authenticated, service_role;
revoke execute on function carmarket.listings_review() from public, anon, authenticated;
revoke execute on function carmarket.listing_images_review() from public, anon, authenticated;

-- 4. Who can see what ------------------------------------------------------------

-- The old policies let anyone read every listing (listings_select_all) or every active one. Approved
-- listings stay public, hidden or not (the page says it's no longer available); the rest only for the
-- seller and admins.
drop policy if exists listings_select_all on carmarket.listings;
drop policy if exists listings_select_owner on carmarket.listings;
drop policy if exists "Public can read active listings" on carmarket.listings;
drop policy if exists "Public listings are viewable by everyone" on carmarket.listings;
drop policy if exists listings_select_approved_own_or_admin on carmarket.listings;
create policy listings_select_approved_own_or_admin on carmarket.listings
  for select using (status = 'approved' or seller_id = auth.uid() or carmarket.is_admin());

commit;
