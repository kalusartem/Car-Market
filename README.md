# Car Market — Full-Stack Marketplace

A production-style car marketplace built with **React, Supabase, and PostgreSQL**, focused on real-world data modeling, UX patterns, and full-stack ownership.

This project intentionally goes beyond CRUD to demonstrate **senior-level decision making** around architecture, performance, and user experience.

https://car-market-1fq.pages.dev/

---

## ✨ Key Features

**Buying**
- Browse with a filter sidebar: make → model (live from NHTSA), price, year, mileage, fuel, transmission, body type, drivetrain, and ZIP + radius with distance on every card
- Filters, sort and page live in the URL (shareable); removable filter chips; crawlable landing pages like `/cars/toyota/camry`
- Details page with photo gallery + lightbox, full specs, **price check** badge, **NHTSA recall** notice, similar cars, share, report listing
- Favorites with optimistic updates

**Selling**
- **VIN-first listing form**: decode the VIN via NHTSA vPIC to fill year, make, model, trim, body, drivetrain, fuel and transmission
- Live "what similar cars cost" hint while entering the price
- Multi-image upload, reorder, cover photo; one active listing per VIN

**Accounts**
- Google / GitHub sign-in (same-email identities linked), optional passwordless email link
- Optional **TOTP two-step verification** (authenticator app) with a sign-in challenge

**Product**
- Light / dark / system theme, no flash on load (semantic tokens, `data-theme`)
- Standalone **Price check** page
- Per-route SEO: titles, canonical, Open Graph, JSON-LD (`Car` + `Offer`), generated `sitemap.xml` and `robots.txt`
- Accessible: skip link, labelled controls, focus management in dialogs, reduced-motion support

---

## 🧱 Architecture Overview

```
┌──────────────┐
│   Frontend   │
│  (React +    │
│ React Query) │
└──────┬───────┘
       │
       │ REST / PostgREST
       │
┌──────▼──────────┐
│   Supabase API  │
│  (PostgreSQL)  │
└──────┬──────────┘
       │
       │ File refs (bucket + path)
       │
┌──────▼──────────┐
│ Supabase Storage│
│  (Images only)  │
└─────────────────┘
```

---

## 🗄️ Database Schema (Simplified)

### `listings`
Core marketplace entity.

```sql
listings (
  id uuid PK,
  seller_id uuid,
  make text,
  model text,
  year int,
  price numeric,
  mileage int,
  description text,
  is_active boolean,
  created_at timestamptz
)
```

---

### `listing_images`
Normalized image storage with explicit ordering.

```sql
listing_images (
  id uuid PK,
  listing_id uuid FK → listings.id,
  bucket text,
  path text,
  position int,
  created_at timestamptz,
  UNIQUE (listing_id, position)
)
```

---

### `favorites`
User → listing relationship.

```sql
favorites (
  id uuid PK,
  user_id uuid,
  listing_id uuid,
  created_at timestamptz,
  UNIQUE (user_id, listing_id)
)
```

---

## 🧪 Develop

```bash
npm install
cp .env.example .env     # or create .env with the two values below
npm run dev              # http://localhost:5173
npm run lint && npm run typecheck && npm test && npm run build
```

`.env`

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_ENABLE_EMAIL_LOGIN=false   # true only after configuring custom SMTP in Supabase
```

Database setup and dashboard settings: see [`supabase/README.md`](supabase/README.md).

## 🌐 Deploy (Cloudflare Pages)

Build command `npm run build`, output `dist`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Pages variables:
the `functions/` folder reads the same variables at runtime.

The app is a client-rendered SPA, so `functions/` returns the same `index.html` with real head tags and a plain-HTML summary for:

| Route | Function |
| --- | --- |
| `/listings/:id` | title, description, canonical, Open Graph, `Car` JSON-LD, 404 for unknown ids |
| `/cars/:make`, `/cars/:make/:model` | landing page with a list of crawlable links |
| `/sitemap.xml` | static pages, make/model pages and every active listing |
| `/robots.txt` | disallows private routes, points at the sitemap |

Test them locally with `npm run build && npx wrangler pages dev dist --binding VITE_SUPABASE_URL=... --binding VITE_SUPABASE_ANON_KEY=...`.

After deploying: add the production URL to Supabase's redirect allow-list, submit `/sitemap.xml` in Google Search Console, and add the `SUPABASE_URL` / `SUPABASE_ANON_KEY` repository secrets for the keep-alive workflow.

### Self-hosting instead

`npm run build:all && npm start` serves the same app and SEO routes from one Node process
(`server/index.ts`). Caddyfile, systemd unit and a step-by-step guide are in [`deploy/`](deploy/README.md).

## 🚗 Vehicle data

Makes, models, VIN decoding and recalls come from NHTSA's free public APIs (vPIC and Recalls; no key, CORS enabled).
Responses are cached in `localStorage`, calls time out after 10 s, and if vPIC is unreachable the app falls back to the `brands`/`models` tables and then to free-text inputs.
Recall results are per make/model/year, not per VIN, and the UI says so and links to NHTSA's VIN lookup.

**Price check** compares an asking price with similar *active listings on this site* (same make and model, model year ±2, similar mileage when there are enough). It needs at least three comparables and shows nothing otherwise. These are asking prices, not sale prices; for real market valuation you would license a data source.

---

## ⚖️ Trade-offs & Design Decisions

### Why a separate `listing_images` table?
- Enables reordering and cover selection
- Avoids rewriting arrays
- Scales like real marketplaces

### Why `position` instead of `is_cover`?
- Single source of truth
- No conflicting flags
- Reorder = cover change

### Why semantic color tokens?
- One set of CSS variables per theme; components say `bg-surface`, not `bg-slate-900`
- Light/dark/system is a `data-theme` switch with an inline pre-paint script

### Why optional database features?
- The app probes for the newer columns/table and keeps working on the original schema
- Migrations are plain idempotent SQL in `supabase/migrations`

### Why compute radius search on the client?
- Filters are PostgREST queries; the radius step uses a lat/lng bounding box (capped at 500 candidates) and ranks by exact distance in the browser
- Keeps every filter combinable with distance; move it to a Postgres function if inventory grows

### Why Optimistic UI?
- Instant UX
- Matches modern apps
- Shows async state mastery

### Why not store image URLs?
- URLs can change
- Paths are stable identifiers
- Storage concerns stay out of DB

---

## 🚀 What This Project Demonstrates

- Full-stack ownership
- Production-grade data modeling
- Thoughtful trade-offs
- Senior-level UX patterns

---

## 🛠️ Tech Stack

- React 19, TypeScript, Vite
- React Query, React Router
- Supabase (Postgres + RLS, Auth with TOTP MFA, Storage)
- Tailwind CSS v4
- Cloudflare Pages + Pages Functions
- Vitest, ESLint, GitHub Actions

---

## 👤 Author

Built by **Artem Kalus**
