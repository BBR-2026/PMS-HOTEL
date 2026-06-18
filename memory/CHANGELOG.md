# BBR Revenue Engine — CHANGELOG

## 2026-06-18 (3) — UI Refresh : Logo XL, Logo doré au scroll, Optima partout

### Changements visuels
- **Logo +100%** : passé de `h-20/h-28` à `h-36/h-52` (de ~80px à ~208px). Header agrandi en conséquence (`h-40 md:h-56`).
- **Logo doré au scroll** : nouvelle classe CSS `.logo-gold` (filter sepia + invert + hue-rotate calibré pour matcher `#B8922A`). En haut de page sur la landing, le logo reste blanc (sur fond image). Dès qu'on scroll, le header devient blanc et le logo passe en doré BBR. **Le logo noir n'est plus utilisé.**
- **Bouton RÉSERVER doré** : couleur de fond passée du noir au doré BBR `#B8922A`, hover `#D4AF37`. Le lien SHOP passe également en doré au scroll.
- **Police Optima partout** : `body`, `font-serif`, `font-display-serif` et `font-body` pointent désormais tous sur la stack Optima (les fichiers locaux `.woff2` existent déjà dans `/src/assets/fonts/`). Plus de Poppins ni de Playfair sur la vitrine.

### Contenu
- **Hero accueil** :
  - Titre : `LIDE IS HERE`
  - Sous-titre : « Une île privée, à quelques minutes d'Abidjan. Un autre rythme. Une autre énergie. Des expériences premium inoubliables. »
- **Descriptions des 5 univers** : remplacées par les taglines longues issues du workflow de réservation (`OFFER_TYPES.tagline_fr` côté backend) pour cohérence éditoriale entre la Vitrine et le tunnel de réservation.

### Fichiers modifiés
- `/app/frontend/src/components/vitrine/VitrineNav.jsx`
- `/app/frontend/src/components/vitrine/VitrineLayout.jsx` (padding top ajusté à `pt-40 md:pt-56`)
- `/app/frontend/src/pages/vitrine/VitrineLanding.jsx`
- `/app/frontend/src/index.css`

---

## 2026-06-18 (2) — Phase B (continued) — CRM 360° + Memberships + Événementiel + Upsell

(Voir l'entrée précédente du changelog pour les détails complets — `iteration_33.json`)

---

## 2026-06-18 (1) — Phase B — Marketing Dashboard + Inbox + Vitrine pages

(`iteration_32.json` — 100% green)

### Validation
- **23/23 backend pytest passing** (`/app/backend/tests/test_iteration33_phaseB_modules.py`).
- **100% frontend** — 4 new pages render cleanly with zero console errors.
- Iteration report : `/app/test_reports/iteration_33.json`.

### Module 1 — CRM 360°
- **Backend** : `routers/crm.py` — `GET /api/staff/crm/segments`, `GET /api/staff/crm/customers?segment=&q=`, `GET /api/staff/crm/customers/{email}` (joint bookings + marketing_events + contact_messages + newsletter + event_requests → KPIs (LTV, panier moyen, last visit) + first/last UTM attribution + timeline unifiée).
- **Frontend** : `/staff/crm` (master/detail, segment chips VIP/Récent/Lead/Dormant/Client/Prospect, recherche, fiche 360°, timeline avec 5 types).

### Module 2 — Memberships (BBR Cards)
- **Backend** : `routers/memberships.py` — 3 plans seedés (Sunset Card 350k, Beach Card 750k, Royal Card 1.8M). `POST /api/memberships/subscribe` (public, idempotent, attribution UTM, mirror marketing_event). Workflow staff : `requested → confirmed → active → expired/cancelled`. `POST /api/staff/memberships/{id}/issue` génère un numéro BBR-XXXX-XXXX-XXXX unique + expires_at à 365 j.
- **Frontend public** : `/memberships` (page éditoriale 3 cartes, badge "Le choix BBR" sur Beach, formulaire de souscription).
- **Frontend staff** : `/staff/memberships` (KPIs, filtres status+plan, recherche, panneau de détail avec actions "Confirmer / Émettre carte / Annuler").

### Module 3 — Événementiel pipeline
- **Frontend** : `/staff/events-pipeline` — kanban 5 colonnes (Nouvelles / Contactées / Confirmées / Réalisées / Déclinées) sur le endpoint existant `/api/staff/loisirs/events`. Drawer client avec infos contact, budget, paiements, et actions `Marquer X / Décliner` (PATCH workflow). 5 KPIs par colonne.

### Module 4 — Upsell / Cross-sell
- **Backend** : `routers/upsells.py` — 7 offres seedées (transat VIP, baliné, Champagne, table Le Kaai, soin spa, charter privé, croisière sunset) sur 5 catégories. CRUD complet pour le staff + endpoint stats (revenue captured, top offres, by_category).
- **Frontend public** : `/booking-extras/:ref` — catalogue par catégorie, ajout au séjour (POST `/api/upsells/bookings/{ref}`), historique des extras déjà ajoutés.
- **Frontend staff** : `/staff/upsells` — CRUD complet avec modal, toggle visibilité, KPIs revenue + top offres.

### Mongo collections introduites
- `membership_plans` (auto-seedée, 3 docs)
- `memberships` (souscriptions clients + card_number unique)
- `upsell_offers` (catalogue, 7 docs seedés)
- `upsell_selections` (sélections par booking_ref)

### Sidebar (manager+)
4 nouvelles entrées sous Administration :
- 🪙 CRM 360°
- 💎 Memberships — BBR Cards
- 📋 Pipeline événementiel
- 🛍️ Upsells & Cross-sell

### Vitrine publique
Menu hamburger inclut désormais : Boutique · Memberships · Contact.

---

## 2026-06-18 — Phase B — Marketing Dashboard + Inbox + Vitrine pages

(Voir l'entrée précédente du changelog pour les détails complets)

### Livré
- `/boutique` + `/contact` pages publiques avec capture de leads.
- `routers/leads.py` (contact + newsletter, idempotent, mirror marketing_event).
- `routers/marketing_analytics.py` (dashboard KPIs, trend, funnel, campagnes, sources).
- `/staff/marketing` cockpit Revenue Engine.
- `/staff/leads` inbox + newsletter avec export CSV.
- Iteration report : `/app/test_reports/iteration_32.json` (100% green).

---

## Ce qui reste à livrer

### Option C — Booking Engine Phase 2 (P1)
- Multi-gateway de paiement (Stripe + PayPal en plus de FineoPay) — nécessite les clés API du client.
- Disponibilité unifiée (chambres + day-pass + activités sur un même endpoint).
- Injection optionnelle de l'étape Upsell dans le BookingTunnel (actuellement décorrelé via `/booking-extras/:ref`).

### Phase C — Automation
- Meta Custom Audiences + CAPI server-side
- Emails automatisés (welcome, abandon panier, anniversaire) via SendGrid/Resend
- Retargeting basé sur les segments CRM (lead, dormant)

### Refactor technique
- `server.py` toujours à 11 680+ lignes — extraire bookings/customers/traversees vers `/backend/routers/`.
