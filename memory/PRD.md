# Boulay Beach Resort (BBr) — Product Requirements Document

## Original Problem Statement
Luxury full-stack reservation web application for "Boulay Beach Resort" (BBr) — 5★ beach resort
in Abidjan, Côte d'Ivoire, accessible **only by boat**. Manages **Day Visit reservations + Hôtel
stays**, plus a **Staff Back-office** for internal operations.

## Brand
- White background, gold `#B8922A`, deep `#0A0A0A`, cream `#FAFAF7`
- Playfair Display + Poppins / Allura cursive for ticket titles
- 5★ luxury aesthetic (Six Senses / Aman / Nikki Beach references)

## Five offers
| Offer | Adult | Child | Days | Notes |
|-------|-------|-------|------|-------|
| Day Pass | 50 000 | 25 000 | Mon-Fri | — |
| Sunset | 60 000 | 30 000 | Sat | — |
| Brunch | 60 000 | 30 000 | Sun | — |
| Le Kaai | Reservation-only | — | Every day | Restaurant, pay on-site |
| Hébergement | Suites 200k/420k/470k FCFA/nuit | — | Every day | 3 room tiers + rooms counter |

## Architecture
- Backend: FastAPI + Motor + JWT + bcrypt + Pillow (ticket PNG) + qrcode (styled gold QR)
- Frontend: React 19 + Router 7 + Tailwind + Shadcn + framer-motion + sonner
- DB: MongoDB collections — `bookings`, `event_requests`, `staff`, `bateaux`, `traversees`, `traversee_passengers`

## Phase 1 — Client Portal (✅ COMPLETE)
- 5-step guest tunnel (Date → Convives → Coordonnées par participant → Récap → Paiement)
- 5 offers including overnight Hébergement with 3 room tiers + rooms counter
- Per-participant fields: Nom, Prénom, Email, Téléphone, Nationalité (autocomplete 195 nationalités)
- Dynamic boat times (Mon-Fri 2h, weekend hourly)
- Payment options: Carte bancaire / Mobile Money / Espèces (FINEO + Orange/MTN/Moov **MOCKED**)
- Premium printable **ticket PNG** generated server-side per participant:
  - Carte/Mobile → brown body + styled gold QR + reference code
  - Espèces → cream "reçu temporaire" without QR
- Confirmation page: download PNGs, share via Email (`mailto:`) / WhatsApp (`wa.me`), Livret BBR PDF
- FR/EN toggle

## Phase 2 — Staff Back-Office (🔄 IN PROGRESS)
3 roles: receptionist · manager · admin.

### ✅ Delivered modules
- **Module 1 — Tableau de bord**: 4 KPIs (réservations / revenus / clients attendus / traversées),
  planning du jour avec code couleur par offre + badges statut, panneau alertes (arrivées
  imminentes ≤2h, impayés en attente).
- **Module 3 — Embarquement & Traversée**: gestion CRUD bateaux (3 bateaux seedés), programmation
  de traversées avec auto-création du retour à +5h, embarquement passager en 1 clic depuis les
  réservations du jour, vérification capacité, marquage statut (programmé/en_cours/terminé).
- **Module 4 — Scanner QR**: input plein écran, lookup par `qr_token`, affichage instantané fiche
  client (offre, date, bateau, paiement, demandes spéciales) + bouton vert "Marquer comme arrivé".
- **Auth + RBAC**: JWT staff, sidebar role-aware, endpoints `_require_role` (receptionist limité à
  scan/embarquement, manager CRUD sans delete bateau, admin tout).

### 🟡 Backlog modules (placeholders en navigation)
- **Module 2 — Réservations** (P0) : vue liste + calendrier, pipeline statuts, filtres, fiches.
- **Module 5 — Clients** (P1) : DB clients, fiche détaillée, export CSV, avis.
- **Module 6 — Le Kaai** (P1) : plan de salle, calendrier tables (`tables_kaai`, `réservations_kaai`).
- **Module 7 — Chiffre d'affaires** (P1) : courbes par offre/période, top clients, comparatifs.
- **Hébergement** (P2) : calendrier chambres, statistiques.
- **Loisirs** (P2) : activités aquatiques/sportives/spa/privatisation.

## Phase 3 — Backlog
- Real FINEO integration (replace mocked `/pay`).
- WhatsApp + Email automation (D-3 info, D-1 rappel, D+1 review).
- Auto-send each guest their own ticket PNG via Resend/SendGrid + Twilio WhatsApp.
- Multi-currency display (EUR alongside FCFA).
- Loyalty tier system.

## Refactoring Backlog
- **Backend**: `server.py` ≈ 1400 lignes — split into `/routers/staff_*`, `/routers/public_*`.
- **Frontend**: `BookingTunnel.jsx` ≈ 1000 lignes — split into StepDate/Guests/Participants/Summary/Payment.
- Move OFFERS from constants to a `offers` collection (admin-editable).
- Migrate `@app.on_event` to FastAPI lifespan handlers.

## Test Credentials
See `/app/memory/test_credentials.md`.

## Changelog
- 2026-02-04: Phase 1 MVP — 3 offers, QR generation, FR/EN.
- 2026-02-04: Added Le Kaai (free), dynamic boat times, participant nationality, Livret BBR.
- 2026-02-05: Fixed P0 — Step 3 participant form rendering (useEffect sync).
- 2026-02-05: 4th offer Le Kaai with reservation-only branch.
- 2026-02-05: Email + phone moved to per-participant; nationality autocomplete (195).
- 2026-02-05: Share recap via Email/WhatsApp from confirmation page.
- 2026-02-05: 5th offer Hébergement with checkout date + 3 room tiers + rooms counter.
- 2026-05-10: Card / Mobile Money / Cash payment options with proper "Carte bancaire" labels.
- 2026-05-10: Premium server-side PNG tickets (brown + gold QR for card/mobile, cream receipt for cash).
- 2026-05-11: Fixed white-band issue on offer hero images by trimming 6% bottom + objectPosition shift.
- **2026-05-11: Staff Back-Office Phase 2 — Modules 1 (Dashboard) + 3 (Embarquement & Traversée)
  + 4 (Scanner QR) delivered. JWT staff auth, role-based sidebar (receptionist/manager/admin),
  bateaux CRUD, traversées avec auto-retour, scan QR → mark arrived. 22/22 tests backend, 5/5
  flux frontend validés par testing agent. Placeholders en place pour Modules 2/5/6/7.**
