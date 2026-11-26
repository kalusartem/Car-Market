import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../functions/_lib";
import { notifyListingReview } from "../../functions/_notify";
import { ASSETS, fakeSmtp, SMTP_ENV, subjectOf } from "./fakes";

const SUPABASE = "https://db.example.test";
const env: Env = { ASSETS, ...SMTP_ENV, SUPABASE_URL: SUPABASE, SUPABASE_ANON_KEY: "anon" };
const ID = "6f1c2a7e-0b7d-4c55-9d8a-3e2f1a0b9c11";

const listing = {
  id: ID,
  seller_id: "seller-1",
  make: "Honda",
  model: "Civic",
  trim: "EX",
  year: 2019,
  price: 18500,
  mileage: 42000,
  fuel_type: "Gasoline",
  transmission: "Automatic",
  description: null,
  is_active: true,
  vin: "1HGBH41JXMN109186",
  city: "Austin",
  state: "TX",
  zip_code: "78701",
  created_at: "2026-11-01T10:00:00Z",
  submitted_at: "2026-11-01T10:00:05Z",
};

const post = (body: unknown, token: string | null = "seller-jwt") =>
  new Request("https://cars.example.test/api/listings/notify", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
  });

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

function mockSupabase({ claim = [listing] as unknown[] | null } = {}) {
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url.endsWith("/rest/v1/rpc/claim_review_notification")) {
      return claim ? ok(claim) : new Response("denied", { status: 401 });
    }
    if (url.endsWith("/auth/v1/user")) return ok({ email: "seller@example.test" });
    if (url.includes("/rest/v1/listing_images")) return ok([{ id: "a" }, { id: "b" }]);
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/listings/notify", () => {
  it("emails the admin about a claimed listing", async () => {
    const fetchMock = mockSupabase();
    const smtp = fakeSmtp();
    const res = await notifyListingReview(post({ id: ID }), env, smtp.connect);
    expect(await res.json()).toEqual({ ok: true, sent: true });

    // every Supabase call runs as the seller
    for (const [, init] of fetchMock.mock.calls) {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer seller-jwt");
    }
    const claimBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(claimBody).toEqual({ p_listing_id: ID });

    expect(smtp.writes).toContain("RCPT TO:<owner@example.test>\r\n");
    const msg = smtp.message()!;
    expect(subjectOf(msg)).toBe("Car Market: listing waiting for approval — 2019 Honda Civic EX");
    expect(msg).toContain("2 photo(s)");
    expect(msg).toContain("Submitted by: seller@example.test");
    expect(msg).toContain(`Preview: https://cars.example.test/listings/${ID}`);
  });

  it("uses a different subject for a resubmitted listing", async () => {
    mockSupabase({ claim: [{ ...listing, submitted_at: "2026-11-03T09:00:00Z" }] });
    const smtp = fakeSmtp();
    await notifyListingReview(post({ id: ID }), env, smtp.connect);
    expect(subjectOf(smtp.message()!)).toMatch(/^Car Market: updated listing waiting/);
  });

  it("rejects a call without a token", async () => {
    const fetchMock = mockSupabase();
    const res = await notifyListingReview(post({ id: ID }, null), env, fakeSmtp().connect);
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an id that isn't a UUID", async () => {
    const fetchMock = mockSupabase();
    const res = await notifyListingReview(post({ id: "1; drop table" }), env, fakeSmtp().connect);
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 503 without Supabase settings", async () => {
    mockSupabase();
    const res = await notifyListingReview(post({ id: ID }), { ASSETS, ...SMTP_ENV }, fakeSmtp().connect);
    expect(res.status).toBe(503);
  });

  it("returns 403 when the claim is refused (bad or foreign token)", async () => {
    mockSupabase({ claim: null });
    const smtp = fakeSmtp();
    const res = await notifyListingReview(post({ id: ID }), env, smtp.connect);
    expect(res.status).toBe(403);
    expect(smtp.hosts).toHaveLength(0);
  });

  it("sends nothing when the listing was already claimed (replay)", async () => {
    mockSupabase({ claim: [] });
    const smtp = fakeSmtp();
    const res = await notifyListingReview(post({ id: ID }), env, smtp.connect);
    expect(await res.json()).toEqual({ ok: true, sent: false });
    expect(smtp.hosts).toHaveLength(0);
  });

  it("only logs without SMTP settings", async () => {
    mockSupabase();
    const smtp = fakeSmtp();
    const noSmtp: Env = { ASSETS, SUPABASE_URL: SUPABASE, SUPABASE_ANON_KEY: "anon" };
    const res = await notifyListingReview(post({ id: ID }), noSmtp, smtp.connect);
    expect(await res.json()).toEqual({ ok: true, sent: false });
    expect(smtp.hosts).toHaveLength(0);
  });

  it("keeps listing text with CR/LF out of the mail headers", async () => {
    mockSupabase({ claim: [{ ...listing, trim: "EX\r\nBcc: victim@example.test" }] });
    const smtp = fakeSmtp();
    await notifyListingReview(post({ id: ID }), env, smtp.connect);
    const msg = smtp.message()!;
    expect(msg.slice(0, msg.indexOf("\r\n\r\n"))).not.toMatch(/^Bcc:/im);
    expect(subjectOf(msg)).not.toMatch(/[\r\n]/);
  });

  it("reports sent:false when the mail server refuses", async () => {
    mockSupabase();
    const res = await notifyListingReview(post({ id: ID }), env, fakeSmtp({ failOn: "MAIL" }).connect);
    expect(await res.json()).toEqual({ ok: true, sent: false });
  });
});
