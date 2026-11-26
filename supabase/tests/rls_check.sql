-- Permission checks for the carmarket schema. Run in the Supabase SQL editor (as the default postgres role).
-- It changes things while it checks (a listing is made pending) and then raises an exception on purpose, so
-- EVERYTHING is rolled back. Success is the error text "CAR-MARKET RLS CHECKS PASSED (n)"; any other error is a
-- failed check ("FAIL ...") or an unexpected problem.
do $t$
declare
  n int := 0;
  lid uuid;
  l_total int; i_total int; l_after int; i_after int; i_of_lid int;
  l_after_auth int;
begin
  -- 1. A signed-out visitor (role anon) cannot read or write what it shouldn't.
  set local role anon;
  begin perform 1 from carmarket.favorites limit 1; raise exception 'FAIL: anon can read favorites';
  exception when insufficient_privilege then n := n + 1; end;
  begin perform 1 from carmarket.inquiries limit 1; raise exception 'FAIL: anon can read inquiries';
  exception when insufficient_privilege then n := n + 1; end;
  begin insert into carmarket.brands default values; raise exception 'FAIL: anon can insert brands';
  exception when insufficient_privilege then n := n + 1; end;
  begin update carmarket.listings set price = price; raise exception 'FAIL: anon can update listings';
  exception when insufficient_privilege then n := n + 1; end;
  begin delete from carmarket.listings; raise exception 'FAIL: anon can delete listings';
  exception when insufficient_privilege then n := n + 1; end;
  begin truncate carmarket.listings; raise exception 'FAIL: anon can truncate listings';
  exception when insufficient_privilege then n := n + 1; end;
  perform 1 from carmarket.brands limit 1;  -- the public catalog stays readable
  perform 1 from carmarket.models limit 1;
  n := n + 1;
  reset role;

  -- 2. Pending listings and their photos are hidden from everyone except the seller and admins.
  select l.id into lid from carmarket.listings l join carmarket.listing_images i on i.listing_id = l.id
   where l.status = 'approved' limit 1;
  if lid is null then raise exception 'SKIP: no approved listing with a photo to test with'; end if;
  select count(*) into i_of_lid from carmarket.listing_images where listing_id = lid;

  set local role anon;
  select count(*) into l_total from carmarket.listings;
  select count(*) into i_total from carmarket.listing_images;
  reset role;

  perform set_config('carmarket.review_internal', 'on', true);   -- lets this update through the review trigger
  update carmarket.listings set status = 'pending' where id = lid;
  perform set_config('carmarket.review_internal', '', true);

  set local role anon;
  select count(*) into l_after from carmarket.listings;
  select count(*) into i_after from carmarket.listing_images;
  reset role;
  if l_after <> l_total - 1 then raise exception 'FAIL: a pending listing is still visible to anon (% -> %)', l_total, l_after; end if;
  if i_after <> i_total - i_of_lid then raise exception 'FAIL: photos of a pending listing are still visible to anon (% -> %)', i_total, i_after; end if;
  n := n + 2;

  set local role authenticated;   -- signed in, but not the seller and not an admin (auth.uid() is null here)
  select count(*) into l_after_auth from carmarket.listings;
  reset role;
  if l_after_auth <> l_total - 1 then raise exception 'FAIL: a pending listing is visible to a signed-in non-owner'; end if;
  n := n + 1;

  raise exception 'CAR-MARKET RLS CHECKS PASSED (%)', n;
end
$t$;
