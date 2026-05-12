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

## Phase 2 — Staff Back-Office (✅ COMPLETE)
3 roles: receptionist · manager · admin.

### ✅ Delivered modules
- **Module 1 — Tableau de bord**: 4 KPIs + planning du jour + alertes.
- **Module 2 — Réservations**: vue Liste / Calendrier, sous-onglets par offre, filtres, drawer détail avec actions, RoleGuard côté frontend.
- **Module 3 — Embarquement & Traversée**: CRUD bateaux, programmation traversées avec auto-retour, embarquement 1 clic.
- **Module 4 — Scanner QR**: input plein écran, fiche client + bouton "Marquer comme arrivé".
- **Module 5 — Clients** (CRM): liste agrégée des clients, recherche, fiche détaillée avec historique complet, export CSV.
- **Module 6 — Le Kaai**: 36 tables seedées par zone (Salle/Terrasse/Bord de mer), CRUD tables, vue jour avec sélecteur date, assignation table par clic, libération.
- **Module 7 — Chiffre d'affaires**: KPIs revenus + panier moyen, filtres période (jour/semaine/mois/année/total), graphique d'évolution journalière (LineChart), répartition par offre (BarChart) et par méthode de paiement (PieChart), top 10 clients.
- **Module Hébergement** (staff): calendrier mensuel d'occupation par tier (couleurs Or/Vert/Bleu), navigation mois précédent/suivant, panneau Arrivées + Départs du jour basé sur boat_time et return_boat_time.
- **Module Loisirs**: liste des `event_requests`, filtres statut, drawer détail avec changement de statut (new→contacted→confirmed→completed/declined) et notes internes.
- **Configuration Admin** (admin only): onglet Utilisateurs (CRUD complet, refuse self-delete), onglet Offres & Tarifs (édition prix adulte/enfant, capacité, tarifs de chambres, persistance via collection `offer_overrides`, prise en compte immédiate côté public).
- **Auth + RBAC**: JWT staff, sidebar role-aware (Réservations / Opérations / Administration), endpoints `_require_role`.

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
- 2026-02-06: Hébergement — ajout sélecteur "Bateau retour" en plus du "Bateau aller", horaires dynamiques selon le jour de check-in et de check-out (semaine 2h / week-end horaire). Champ `return_boat_time` persisté côté backend + inclus dans payload QR.
- 2026-02-06: **Phase 2 Back-Office Complete** — Modules 5 (Clients CRM + export CSV), 6 (Le Kaai 36 tables CRUD + assignation), 7 (Chiffre d'affaires + graphiques recharts), Hébergement (calendrier mensuel + arrivées/départs), Loisirs (event_requests), Configuration Admin (CRUD staff + édition tarifs via offer_overrides). 35/35 tests backend pytest passent. RoleGuard validé.
- 2026-02-06: **Back-office mobile responsive** — Sidebar transformée en hamburger + drawer slide-in sur < lg. Auto-fermeture sur navigation. Padding ajusté (p-4 md:p-8 lg:p-10) sur toutes les pages staff. Tables Clients/Loisirs en cartes empilées sur mobile, Top clients Revenue en scroll horizontal.
- 2026-02-06: **Garde d'overbooking Hébergement** — Inventaires par tier (superieure=18, suite_jardin=6, suite_mer=6) dans OFFERS, validation par nuit dans `POST /api/bookings`, calendrier `/staff/hebergement/calendar` exposant `is_overbooked` + `total_inventory` + `by_tier[].inventory`. Bandeau d'alerte + cellules rouges sur l'UI.
- 2026-02-06: **Stats avancées** — Nouveau endpoint `GET /api/staff/stats/advanced` (year-over-year, funnel, lead time moyen, top 10 nationalités, taille moyenne par offre, distribution par jour de la semaine, taux d'occupation hôtel). Section repliable dans la page Revenue avec graphiques recharts.
- 2026-02-06: **Polissage UI Config** — Remplacement des `<select>` natifs par shadcn Select (rôle utilisateur), ajout du champ "Inventaire" éditable par tier de chambre, mobile-friendly. 85/85 tests backend (77 régression + 8 nouveaux) passent.
- 2026-02-06: **Historique des traversées + Rapport PDF** — Nouvelle page `/staff/traversees/historique` (accessible aux 3 rôles staff). Sélecteur Jour/Semaine/Mois + filtre statut + navigation date. KPIs (total, programmées, en cours, terminées, passagers), graphique évolution journalière (bar chart total + terminé), répartition par bateau. Endpoint `GET /api/staff/traversees/history/report.pdf` génère un rapport PDF stylisé (reportlab) avec KPI block, répartition par bateau, détail par jour, liste des traversées et footer corporate. 21/21 tests backend pytest. Bug latent corrigé : centralisation du token staff via `getStaffToken()` dans `lib/api.js` (auparavant raw `fetch()` lisait la mauvaise clé localStorage).
- 2026-02-06: **Exports PDF Clients & Chiffre d'affaires** — `GET /api/staff/clients/report.pdf` (avec filtre `search`) et `GET /api/staff/revenue/report.pdf?period=day|week|month|year|all`. Helpers PDF partagés (`_pdf_styles`, `_pdf_footer_factory`, `_format_xof`) extraits pour les 3 rapports. Boutons "Rapport PDF" ajoutés sur les pages Clients (avec CSV adjacent) et Chiffre d'affaires. 14/14 tests backend pytest validés via extraction pypdf du contenu textuel.
- 2026-02-06: **Acompte Hébergement** — Pour l'offre Hébergement uniquement, la carte de paiement en espèces est remplacée par "Payer un acompte" avec 3 boutons (10 %, 30 %, 70 %). Le booking persiste `paid_amount` + `balance_due` + `deposit_pct` ; status='confirmed' avec ticket QR gold style ; le solde est affiché sur le ticket de confirmation et dans le drawer staff. 11/11 tests pytest. Bug latent corrigé : `_paste_logo()` acceptait `max_w_ratio` non géré, désormais correctement supporté (cassait toutes les générations de tickets si le bug se réveillait).
- 2026-02-06: **QR Wallet — Paiement Activités sur place** — À chaque paiement, un 2e QR (style sable/crème distinct du ticket doré) est généré pour permettre au client de payer ses activités sur place. Catalogue seedé (Jet Ski 30/60 min, Quad, Paddle, Kayak, Ski Nautique, Massage, Spa, Excursion Bateau). Page staff `/staff/activites` avec scanner/recherche par token, ajout d'activité catalogue ou montant libre, annulation de ligne (manager+), solde de carte (manager+, restriction visuelle + serveur 403). Public `GET /api/activities` exposé. Admin CRUD activities. 13/13 tests pytest, 0 bug critique.
- 2026-05-12: **Scanner QR caméra mobile** — `/staff/scanner` intègre `html5-qrcode` (caméra arrière), basculement caméra/manuel, distinction QR ticket vs QR wallet (redirige vers `/staff/activites?token=...`), gestion gracieuse des permissions caméra refusées, unmount propre.
- 2026-05-12: **Tunnel public mobile-responsive** — `BookingTunnel.jsx` : paddings adaptatifs, calendrier en overflow-x-auto (plus d'inline-block qui débordait), tailles de police H1/H2 progressives, deposit buttons en flex-col sur mobile, SummaryRow en colonne sur mobile, calendrier hébergement avec wrappers `min-w-0`. Validé Playwright 390×844 (0 overflow horizontal).
- 2026-05-12: **Historique & statistiques Hébergement + PDF** — `GET /api/staff/hebergement/stats?period=day|week|month|year|all` retourne KPIs (séjours, nuitées vendues, taux d'occupation, revenu, séjour moyen, revenu/séjour, revenu/nuitée, solde dû), by_tier (séjours/nuitées/taux occ/revenu/part), daily_trend, top 10 clients par nuitées, historique des séjours. `GET /api/staff/hebergement/report.pdf?period=...` rapport PDF reportlab stylisé. Section ajoutée sur `/staff/hebergement` (graphiques recharts + tableaux + collapsible history). 20/20 tests pytest + Playwright PASS.
- 2026-05-12: **Création de réservation côté manager** — `POST /api/staff/bookings` (manager+) crée et paie immédiatement une réservation au nom d'un client (méthodes: card / mobile_money / cash / deposit pour Hébergement avec deposit_pct 10/30/70). Champs persistés `created_by_staff=true` + `created_by_email`. Nouvelle page `/staff/reservations/nouvelle` (`StaffNewBooking.jsx`) avec sélection d'offre, dates, catégorie de chambre, compteurs, horaires bateau, participants, paiement, footer sticky avec total + acompte calculé. CTA `+ Nouvelle réservation` ajouté sur la page Réservations et sur le Dashboard (manager+ uniquement).
- 2026-05-12: **Fix QR scan caméra** — Le payload encodé dans les QR billet passait de ~690 caractères de JSON exhaustif (`v`, `issuer`, infos invité…) à un payload compact `{"type":"ticket","token":"<32hex>","ref":"<8up>"}` (~90 caractères). Le détail logique reste persisté en DB (`qr_codes.qr_payload`) pour audit. Le QR est donc beaucoup moins dense (33×33 modules contre 89×89), parfaitement lisible avec ECC H + RoundedModuleDrawer + couleur or par n'importe quelle caméra mobile. Scanner staff rétro-compatible avec les anciens QR (gère `type=ticket`, `type=wallet`, `guest_token`, token brut). Validé pyzbar.

