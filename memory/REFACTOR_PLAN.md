# REFACTOR PLAN — `backend/server.py` modularization

**Status**: in progress (iter 24 started).
**Goal**: bring `server.py` from ~10 700 lines down to ~500 lines (init + wiring),
distributing routes/models across focused router modules.

## Pattern proven in iter 24 (Stats)

1. Identify a self-contained group of endpoints in `server.py`
2. Create `/app/backend/routers/<module>.py` with a `build_router(db, get_current_staff, require_role, **injected)` factory
3. Move the endpoint code into the factory (replace `@api.get` → `@r.get`, replace `_require_role` → injected `require_role`, replace direct references to `db` / `OFFERS` with injected ones)
4. Delete the original code in `server.py`
5. Wire at the bottom of `server.py`:
   ```python
   from routers import <module> as _<module>_mod  # noqa: E402
   app.include_router(_<module>_mod.build_router(db=db, ...), prefix="/api")
   ```
6. Restart backend, smoke-test the moved endpoints
7. Commit progress; move to next module

## Modules already extracted ✅

- `routers/site_config.py` — `/site-config` (iter 17)
- `routers/vip_spaces.py` — `/vip-spaces` (iter 17)
- `routers/media.py` — `/staff/uploads/image`, `/media/{id}` (pre-iter-20)
- `routers/gallery.py` — `/gallery/*` (pre-iter-20)
- `routers/corporate.py` — legacy corporate enquiries (pre-iter-20)
- `routers/registrations.py` — public guest registrations
- `routers/loisirs.py` — `/staff/loisirs-activities/*` (iter 21)
- `routers/corporate_requests.py` — `/staff/corporate-requests/*` + public form (iter 21-23)
- `routers/visitor_registrations.py` — `/staff/visitor-registrations/*` (iter 21)
- `routers/stats.py` — `/staff/stats/advanced` (iter 24)
- `routers/scanner_history.py` — `/staff/checkins/history` (iter 25 — première slice du module scanner)

## Modules still to extract (priority order)

### P0 — High ROI (touched frequently, easy to isolate)

1. **`routers/scanner.py`** (~300 lines remaining)
   - **PARTIALLY DONE** : `/staff/checkins/history` already extracted into `scanner_history.py` (iter 25)
   - **Remaining** : `/staff/scan/{token}`, `/staff/scan/{token}/checkin`, `/staff/scan/{token}/charge`, `/staff/scan/override`
   - Dependencies: `_resolve_qr_token`, `make_qr`, `OFFERS`, wallet logic — inject as helpers
   - When done, merge `scanner_history.py` into the consolidated `scanner.py`

2. **`routers/traversees.py`** (~600 lines)
   - `/staff/bateaux/*`, `/staff/skippers/*`
   - `/staff/traversees/*`, `/staff/traversees/{tid}/board`, `/staff/traversees/{tid}/passengers.pdf`
   - Highly cohesive, single business domain

3. **`routers/special_events.py`** (~500 lines)
   - `/special-events/*` (public + staff CRUD)
   - Models: `SpecialEvent`, `EventPackage`, `EventMatch`

### P1 — Medium ROI

4. **`routers/auth.py`** (~150 lines)
   - `/auth/staff/login`, JWT issuance, password reset
   - Models: `StaffLogin`, `TokenResponse`, `StaffUser`
   - Helpers: `_hash_password`, `_verify_password`, `get_current_staff`

5. **`routers/bookings.py`** (~1500 lines, the BIG one)
   - `/bookings` POST/GET/PATCH, `/staff/bookings/*`
   - The hardest extraction — touches everything (offers, payments, tickets, scanning)
   - **Strategy**: do this LAST after other modules are out

6. **`routers/payments.py`** (~400 lines)
   - `/fineo/*`, `/staff/bookings/{id}/confirm-cash-payment`
   - FineoPay sweeper job lives here

7. **`routers/notifications.py`** (~300 lines)
   - `/staff/notifications/outbound`, `/staff/notifications/emails`
   - `/staff/notifications/new-bookings` (badge polling)
   - `/staff/notifications/staff-alert`

### P2 — Smaller but worth doing

8. **`routers/dashboard.py`** (~200 lines) — `/staff/dashboard`, `/staff/dashboard/today`
9. **`routers/exports.py`** (~250 lines) — Excel/PDF reports
10. **`routers/wallet.py`** (~200 lines) — `/wallet/*` consommation sur place
11. **`routers/rbac.py`** (~150 lines) — `/staff/users/*` (admin only)

## Shared modules to create

- **`models/`** : move all Pydantic models out of `server.py`
  - `models/booking.py` (Booking, BookingCreate, Participant)
  - `models/offer.py` (OfferType, RoomTier, OFFERS dict)
  - `models/boat.py` (Bateau, Skipper, Traversee)
  - `models/event.py` (SpecialEvent, EventPackage, EventMatch)
  - `models/staff.py` (StaffUser, StaffLogin, TokenResponse)
- **`services/`** :
  - `services/ticket_renderer.py` — `make_ticket_image`, `make_cash_receipt_image`, `make_qr`, `_format_date_long`, `_format_dates_list`, `_load_font`
  - `services/email_service.py` ✅ (already extracted)
  - `services/pdf_service.py` — extracted PDF utilities
  - `services/fineo_service.py` — FineoPay wrapper
  - `services/wallet_service.py` — wallet credit/debit logic

## After full extraction — target shape of `server.py`

```python
# Imports
# Env / db init
# OFFERS dict, POLES dict (or moved to models)
# Helpers: get_current_staff, _require_role (also extractable later)
# Startup hooks (overrides + seeds + backfills)
# Router includes (all of them)
# Static / health endpoints (~50 lines)
# Shutdown hook
```

Target: **~500-700 lines total in `server.py`**.

## Testing strategy after each extraction

1. Run all `pytest /app/backend/tests/test_iteration*.py` — must still pass
2. Smoke-curl the extracted endpoints — must return the same shape
3. UI smoke screenshot — pages depending on extracted endpoints must render

## Why not refactor all at once

- Each extraction is ~30 min of focused work + 10 min of testing
- A failed extraction crashes the whole backend → can't test other features
- Multiple smaller PRs >> one giant PR (easier to bisect bugs)
- Context budget per session: ~2 extractions of P0 + plan update

## Recommended cadence

- 1 extraction per coding session (~30-45 min)
- Test thoroughly between each
- Update this file with progress
