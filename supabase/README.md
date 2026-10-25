# Supabase schema

Car Market lives in its own `carmarket` schema inside a shared Supabase project.
Run these files **in order** in the project's SQL editor (Dashboard → SQL Editor). Every file is idempotent.

| File | What it does |
| --- | --- |
| `migrations/20260909000000_baseline_from_old_project.sql` | Creates the schema, tables, RLS policies, grants and the radius-search function; loads the original data. |
| `migrations/20261025000000_listing_specs_reports_limits.sql` | Adds VIN/trim/body/drivetrain/colour/title/city/state columns, a unique active VIN index, search indexes, the `listing_reports` table, and per-user rate limits for new listings (10/day) and messages (20/hour). |

The front end probes for the optional columns and table, so it keeps working before the second file is applied; the extra form fields, filters and the report button appear once it is.

## Dashboard settings

- **Authentication → Providers**: Google and GitHub are used for sign-in. Same-email identities are linked.
- **Authentication → Multi-Factor**: enable TOTP so users can add an authenticator app from *Account*.
- **Authentication → URL Configuration**: add every site URL you serve from (production domain, `*.pages.dev`, `http://localhost:5173`) to the redirect allow-list.
- **Email sign-in (optional)**: configure custom SMTP (Authentication → SMTP), then set `VITE_ENABLE_EMAIL_LOGIN=true` at build time. Supabase's built-in sender is heavily rate-limited.
- **Exposed schemas** (Settings → API): `carmarket` must be listed.
