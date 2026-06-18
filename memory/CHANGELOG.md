# BBR Revenue Engine — CHANGELOG

## 2026-06-18 — Phase B Revenue Engine (Marketing Dashboard + Inbox + Vitrine completion)

### Public Vitrine — pages newly completed
- **`/boutique`** (`VitrineBoutique.jsx`) — editorial "Coming soon" with hero, manifesto, 4-product preview lineup ("Le sac de plage BBR", "Huile sèche solaire", "Caftan blanc Île Boulay", "Bougie brise marine") and **waitlist signup form** that posts to `/api/newsletter-subscribers` (data-testid `boutique-waitlist-*`).
- **`/contact`** (`VitrineContact.jsx`) — two-column layout : info column (phone, WhatsApp, email, address) + **working contact form** with subject dropdown, persisted to `contact_messages` (data-testid `contact-form`, `contact-input-*`).
- Both forms emit a `submit_lead` marketing event (channel `newsletter` / `contact_form`) for funnel attribution and inject UTM attribution from `lib/tracking.getAttribution()`.

### Backend — new routers
- **`/app/backend/routers/leads.py`** (new) :
  - `POST /api/contact-messages` (public) — anti-spam capped at 4000 chars, mirrors a `submit_lead` event.
  - `POST /api/newsletter-subscribers` (public) — idempotent (re-submit → `already_subscribed=true`, increments `signup_count`).
  - `GET /api/staff/contact-messages` (manager+) — filter by status + search.
  - `PATCH /api/staff/contact-messages/{id}` (manager+) — status workflow (new → in_progress → replied → archived) + internal notes.
  - `GET /api/staff/newsletter-subscribers` (manager+) — filter by status/source + search + `by_source` breakdown.
  - `GET /api/staff/newsletter-subscribers/export.csv` (manager+) — CSV stream with UTM columns.
- **`/app/backend/routers/marketing_analytics.py`** (new) — `GET /api/staff/marketing/dashboard?period={7d|30d|90d|365d}` returns :
  - 8 KPIs (unique visitors, page views, booking intents, leads, purchases, conversion %, lead %, total events)
  - Daily trend (5 series : page_view / view_offer / start_booking / submit_lead / purchase)
  - Top campaigns UTM (events + unique visitors)
  - Sources de trafic (top 10 by visitors)
  - Top pages (top 15 by views)
  - Conversion funnel (5 steps with drop-off %)
  - Leads pipeline (contact + newsletter totals)
- Both routers mounted in `server.py` via `build_router(db, get_current_staff, require_role)` factory pattern (Iteration 53).

### Back-office Staff — new pages
- **`/staff/marketing`** (`StaffMarketing.jsx`) — Revenue Engine cockpit (8 KPI tiles, period selector, trend `LineChart`, conversion funnel bars, traffic sources `BarChart`, top campaigns table, top pages list, leads pipeline card).
- **`/staff/leads`** (`StaffLeads.jsx`) — two tabs :
  - **Messages** — list + detail pane with status workflow (Marquer en cours / Marquer répondu / Archiver), "Répondre par email" mailto button, UTM attribution display.
  - **Newsletter** — KPI tiles, source filter chips, search, list with UTM source/campaign + **CSV export**.
- Both pages added to `Administration` sidebar section (manager+ visible) with `BarChart3` and `Inbox` icons.

### Mongo collections introduced
- `contact_messages` — `{_id, name, email, phone, subject, message, company, attribution, visitor_id, page, ip, user_agent, status: new|in_progress|replied|archived, created_at, updated_at, updated_by, internal_notes?}`
- `newsletter_subscribers` — `{_id, email, first_name, source, last_source, interests, attribution, last_attribution, visitor_id, ip, user_agent, status: active|unsubscribed|bounced, signup_count, created_at, last_seen_at}`

### Testing
- `/app/backend/tests/test_iteration_phaseB_revenue.py` — **19/19 pytest passing**.
- Iteration report : `/app/test_reports/iteration_32.json` — 100% backend, 100% frontend. No regressions.

### What's still pending (Options A/B/C balance)
- **Option A — Phase B continuation** : CRM 360° (link `marketing_events.visitor_id` to `customers`), Memberships module, Événementiel pipeline.
- **Option C — Booking Engine Phase 2** : Upsell/Cross-sell step in tunnel, multi-gateway payment, unified availability (rooms / day-pass / activities).
