# Boulay Beach Resort (BBr) — Product Requirements Document

## Original Problem Statement
Build a luxury full-stack reservation web application for "Boulay Beach Resort" (BBr) — a 5-star
beach resort in Abidjan, Côte d'Ivoire. App manages **Day Visit reservations only** (no hotel rooms).

### Brand
- Background white · Gold accent `#B8922A` · Deep text `#0A0A0A` · Soft cream sections `#FAFAF7`
- Playfair Display (`font-display-serif`) for headings + Poppins (body)
- Tone: Ultra-luxury, 5-star (Four Seasons / Nikki Beach reference)

### Four Day-Visit offers
| Offer    | Adult        | Child        | Days                | Notes                        |
|----------|--------------|--------------|---------------------|------------------------------|
| Day Pass | 50 000 FCFA  | 25 000 FCFA  | Mon–Fri             | Signature beach day          |
| Sunset   | 60 000 FCFA  | 30 000 FCFA  | Sat                 | Golden hour                  |
| Brunch   | 60 000 FCFA  | 30 000 FCFA  | Sun                 | Sunday gastronomy            |
| Le Kaai  | **Free / Sur réservation** | **Free** | Every day | Reservation-only restaurant, pay on-site |

### Boat times (dynamic)
- Weekdays (Mon-Fri): every 2h → 10H, 12H, 14H, 16H, 18H, 20H
- Weekend (Sat-Sun): hourly 10H..20H
- `le_kaai` switches automatically based on selected date.

### Two Interfaces
- **Client Portal (Phase 1, IMPLEMENTED)** — guest-only (no auth), FR/EN, 5-step booking tunnel.
- **Staff Back-office (Phase 2, backlog)** — Receptionist, Manager, Admin with JWT auth.

## User Personas
- **Client (guest)** — Books Day Visit without any account, receives QR codes via email/download.
- **Receptionist** — Scans QR codes, marks arrivals (Phase 2).
- **Manager** — Calendar/list view, payments, notifications (Phase 2).
- **Admin** — Offers/pricing, staff, statistics, automation (Phase 2).

## Architecture
- **Backend**: FastAPI + Motor (async MongoDB) + JWT (staff only) + bcrypt + `qrcode` (PIL).
- **Frontend**: React 19, React Router 7, Axios, framer-motion, sonner, Tailwind + Shadcn UI, react-day-picker.
- **Storage**: MongoDB collections — `bookings`, `event_requests`, `staff`.
- **Participant schema**: `{name, surname, nationality, kind: "adult"|"child"}` — first adult is the primary contact (phone + email).

## Phase 1 — Client Portal (✅ COMPLETE) — Last verified 2026-02-04

### Backend
- `GET /api/offers`, `GET /api/offers/{id}` — 4-offer catalog with dynamic weekday/weekend boat times for `le_kaai`.
- `GET /api/availability/{offer}/{date}` — capacity check (250/day per offer) + allowed_weekdays gate.
- `POST /api/bookings` — guest checkout, validates participant count (= adults+children), kind distribution, day-of-week per offer, and fields (name/surname/nationality per person + phone/email on primary).
- `POST /api/bookings/{id}/pay` — **FINEO placeholder (MOCKED 1.4s frontend delay)**; accepts `total_amount=0` path for Le Kaai. On success, generates one PNG QR per participant encoding full JSON payload (booking_id, offer, date, boat_time, guest identity + token).
- `POST /api/events/privatization` — collects privatization requests (UI teaser).
- Staff seed on startup: admin@boulay.ci / Admin@2026 · manager@boulay.ci / Manager@2026 · reception@boulay.ci / Reception@2026.

### Frontend (Client Portal)
- Landing page: cinematic hero + 4 luxury offer cards (user-uploaded images for DAY PASS, THE SUNSET, B BRUNCH, LE KAAI).
- 5-step Booking Tunnel: Date (calendar with disabled non-eligible days) → Guests counters → Participant forms (dynamic per-person Name/Surname/Nationality) + primary contact + boat time + special requests → Summary → Payment.
- **Le Kaai branch**: summary shows "Sur réservation" instead of FCFA total; payment step shows a single "Confirmer ma réservation" button (no FINEO/Cash).
- Paid offers branch: FINEO (mocked) or Cash side-by-side.
- Confirmation view: one QR card per participant with download, + link to download LIVRET_BBR.pdf.
- FR/EN toggle (`bbr_lang` localStorage), default FR.
- All interactive elements have `data-testid`.

## Phase 2 — Backlog (P0 — Staff Back-Office UI)
- Staff login UI (`/staff/login`).
- **Receptionist dashboard**: today's arrivals list + QR scanner (camera) + check-in.
- **Manager dashboard**: calendar + list view of bookings, status pipeline (pending → confirmed → arrived → completed), manual notifications, cancellation management, payment tracking.
- **Admin panel**: configure offers/pricing, staff CRUD, availability calendar, statistics + CSV export, automated message templates.

## Phase 3 — Backlog (P1)
- Real FINEO integration (replace mocked `/pay`).
- WhatsApp + Email automation: confirmation (D-Day), D-3 (info+directions), D-1 (reminder), D+1 (Google review).
- Multi-currency display (EUR alongside FCFA).
- Stripe fallback for international cards.

## Phase 4 — Backlog (P2)
- Real backend for Event Privatization request management (currently UI+save only).
- Loyalty / repeat-guest tier.
- iCal export per booking.
- Public reviews integration.

## Refactoring Backlog
- Split `BookingTunnel.jsx` (~720 lines) into per-step subcomponents (StepDate, StepGuests, StepParticipants, StepSummary, StepPayment).
- Move offers from hardcoded constants in `server.py` to a MongoDB `offers` collection to prepare admin editing.

## Mocked Integrations (must be replaced before production)
- **FINEO payment** — `POST /api/bookings/{id}/pay` is a placeholder with 1.4s frontend simulation.
- No external notifications (email/WhatsApp) yet.

## Test Credentials
See `/app/memory/test_credentials.md`.

## Changelog
- **2026-02-04**: Phase 1 MVP complete — 3 offers, guest booking tunnel, QR generation, FR/EN.
- **2026-02-04**: Added 4th offer `le_kaai` (reservation-only, free), dynamic weekday/weekend boat times, participant nationality field, LIVRET_BBR PDF download, capacity reset to 250/day.
- **2026-02-05**: Fixed P0 regression — Step 3 participant forms now render dynamically (useEffect syncs `participants[]` with adults+children counters). Added Le Kaai free-payment branch: summary displays "Sur réservation", payment step shows single `confirm-free-btn`. Tested end-to-end (backend 18/18 pytest pass, frontend full tunnel for pass_day + le_kaai).
