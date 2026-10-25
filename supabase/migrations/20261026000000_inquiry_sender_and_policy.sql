-- Messages: record who sent each inquiry, and tighten who may insert one.
--
-- 1. sender_id: the thread page needs it to tell your messages from the other person's. It defaults to
--    auth.uid(), so clients don't send it. Old rows can't be attributed except the first message of each
--    thread, which the Contact seller form always sends as the buyer; the rest stay null and the UI
--    shows them neutrally.
-- 2. inquiries_insert_participants compared l.seller_id to itself (always true), so a signed-in user
--    could name any user as seller_id. The new policy requires:
--      - you are the sender and a participant,
--      - seller_id is the listing's actual seller and differs from buyer_id,
--      - a seller can only reply to a buyer who has already written about that listing.

begin;

alter table carmarket.inquiries
  add column if not exists sender_id uuid default auth.uid() references auth.users (id) on delete set null;

-- Backfill: the first message of every (listing, buyer) thread came from the buyer.
update carmarket.inquiries i
set sender_id = i.buyer_id
from (
  select distinct on (listing_id, buyer_id) id
  from carmarket.inquiries
  order by listing_id, buyer_id, created_at asc
) first_msg
where i.id = first_msg.id and i.sender_id is null;

drop policy if exists inquiries_insert_participants on carmarket.inquiries;
create policy inquiries_insert_participants on carmarket.inquiries
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (auth.uid() = buyer_id or auth.uid() = seller_id)
    and buyer_id <> seller_id
    and exists (
      select 1 from carmarket.listings l
      where l.id = inquiries.listing_id and l.seller_id = inquiries.seller_id
    )
    and (
      auth.uid() = buyer_id
      or exists (
        select 1 from carmarket.inquiries prior
        where prior.listing_id = inquiries.listing_id
          and prior.buyer_id = inquiries.buyer_id
          and prior.sender_id = inquiries.buyer_id
      )
    )
  );

commit;
