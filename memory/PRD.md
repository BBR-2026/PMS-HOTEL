# Boulay Beach Resort (BBr) — Product Requirements Document

## Original Problem Statement
Build a luxury full-stack reservation web application for "Boulay Beach Resort" (BBr) — a 5-star
beach resort in Abidjan, Côte d'Ivoire. App manages **Day Visit reservations only** (no hotel rooms).

### Brand
- Primary: #0A0A0A (deep black) · Gold accent: #B8922A · Cream text: #F5F0E8
- Cormorant Garamond (headings) + Montserrat (body)
- Tone: Ultra-luxury, 5-star (Four Seasons / Nikki Beach reference)

### Three Day-Visit offers
| Offer    | Adult        | Child        |
|----------|--------------|--------------|
| Pass Day | 50 000 FCFA  | 25 000 FCFA  |
| Sunset   | 60 000 FCFA  | 30 000 FCFA  |
| Brunch   | 60 000 FCFA  | 30 000 FCFA  |

### Two Interfaces
- Client Portal (public, FR/EN)
- Staff Back-office (Receptionist, Manager, Admin) — JWT auth

## User Personas
- **Client** — Books Day Visit, manages bookings via QR code, may submit event privatization request.
- **Receptionist** — Sees today's arrivals, scans QR codes, marks check-in.
- **Manager** — Oversees bookings (calendar/list), payments, statuses, manual notifications.
- **Admin** — Manages offers/pricing, staff, availability, statistics, exports, automation.

## Architecture
- **Backend**: FastAPI + Motor (async MongoDB) + JWT (PyJWT) + bcrypt + qrcode (PIL).
- **Frontend**: React 19, React Router 7, Axios, framer-motion, sonner, Tailwind + Shadcn UI, react-day-picker calendar.
- **Storage**: MongoDB collections: `clients`, `staff`, `bookings`, `event_requests`.
- **Auth**: Two JWT realms (`type: "client"` vs `type: "staff"`).

## Phase 1 — Implemented (✅) — 2026-02-04
### Backend
- `GET /api/offers`, `GET /api/offers/{id}` — fixed catalog with capacity.
- `POST /api/auth/client/{register,login}` — JWT issued.
- `POST /api/auth/staff/login` — for admin/manager/reception (seeded on startup).
- `GET /api/auth/me` — current client.
- `GET /api/availability/{offer}/{date}` — capacity check.
- `POST /api/bookings`, `GET /api/bookings/me`, `GET /api/bookings/{id}`, `DELETE /api/bookings/{id}`.
- `POST /api/bookings/{id}/pay` — **FINEO PLACEHOLDER (MOCKED)** — flips to confirmed + generates QR PNG (base64 data URL).
- `POST /api/events/privatization` — collects event requests.
- Staff seed: admin@boulay.ci / Admin@2026, manager@boulay.ci / Manager@2026, reception@boulay.ci / Reception@2026.

### Frontend (Client Portal)
- Landing page: cinematic hero, 3 luxury offer cards with motion stagger.
- Multi-step Booking Tunnel: Date → Guests counter → Client info → Summary → FINEO payment → QR confirmation.
- Client Account: bookings list, QR modal, cancel booking, pay pending bookings.
- Login + Register flow (JWT in `bbr_token` localStorage).
- Event Privatization request form.
- FR/EN language toggle (`bbr_lang` localStorage), default FR.
- Header (sticky glassmorphism), Footer, fully responsive, framer-motion animations.

## Phase 2 — Backlog (P0 — Staff Back-Office UI)
- Staff login UI (`/staff/login`)
- **Receptionist dashboard**: today's arrivals list + QR scanner (camera) + check-in.
- **Manager dashboard**: calendar + list view of bookings, status pipeline (pending → confirmed → arrived → completed), manual notifications, cancellation management, payment tracking.
- **Admin panel**: configure offers/pricing, staff CRUD, availability calendar, statistics + CSV export, automated message templates.

## Phase 3 — Backlog (P1)
- Real FINEO integration (replace mocked `/pay`).
- WhatsApp + Email automation: confirmation (D-Day), D-3 (info+directions), D-1 (reminder), D+1 (Google review).
- Multi-currency display (EUR alongside FCFA).
- Stripe fallback for international cards.

## Phase 4 — Backlog (P2)
- Loyalty / repeat-guest tier.
- iCal export per booking.
- Public reviews integration.

## Mocked Integrations (must be replaced before production)
- **FINEO payment** — `POST /api/bookings/{id}/pay` is a placeholder.
- No external notifications yet (email/WhatsApp).

## Test Credentials
See `/app/memory/test_credentials.md`.

## Last Verified
- 2026-02-04: Backend 20/20 tests pass, frontend full booking flow verified end-to-end.
