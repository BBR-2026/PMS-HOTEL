# BBR Revenue Engine — CHANGELOG

## 2026-06-18 (5) — UI polish : Logo XL centered, no italic, 2-col Univers, Instagram, Blog on landing, /reserver = Vitrine

### Changements appliqués
1. **Logo +100%** : de `h-10/12/14` à `h-20/24/28` (~ 80px / 96px / 112px).
2. **Logo centré sur mobile** : positionnement absolu `left-1/2 -translate-x-1/2` < lg ; alignement gauche sur desktop.
3. **Page d'accueil du workflow remplacée** : route `/reserver` pointe désormais sur `VitrineLanding`. Chaque carte univers expose 2 CTA : « Découvrir » (page univers détaillée) et « Réserver » qui pointe directement sur le tunnel `/booking/<offerId>` pré-rempli (`pass_day`, `hebergement`, `le_kaai`, `seminaire`, `offres_loisirs`). Le calendrier de réservation s'ouvre directement.
4. **Plus aucun italique** sur la Vitrine publique (10 fichiers nettoyés : Landing, Nav, Footer, Layout, Boutique, Contact, Memberships, Blog, BlogArticle, BookingExtras + Univers pages).
5. **Section Instagram** : nouvelle section sur la landing — 6 visuels @boulaybeachresort en grille 2/3/6 colonnes, overlay Instagram au hover, lien « Suivez-nous » vers le compte officiel. Tracking `click_instagram` émis.
6. **Section Journal** : 3 derniers articles publiés affichés sur la landing (fetch `/api/blog/articles?limit=3`) + lien « Tous les articles ».
7. **UNIVERS réorganisé** : grille 2 colonnes desktop, rectangles verticaux 4:5, titre + description + 2 CTA (Découvrir / Réserver) sous l'image. Plus de 5e ligne déséquilibrée.

### Fichiers modifiés
- `components/vitrine/VitrineNav.jsx` — logo XL + centrage mobile.
- `components/vitrine/VitrineLayout.jsx` — padding-top ajusté.
- `pages/vitrine/VitrineLanding.jsx` — refonte sections + Instagram + Blog preview + UNIVERS 2-col + suppression italics.
- `pages/vitrine/VitrineBlogArticle.jsx`, `VitrineMemberships.jsx` — suppression `italic`.
- `App.js` — route `/reserver` → VitrineLanding.

---

## Entrées précédentes
- 2026-06-18 (4) — Header horizontal desktop + Blog module + UI luxury.
- 2026-06-18 (3) — Logo XL doré + Optima partout.
- 2026-06-18 (2) — CRM 360° + Memberships + Événementiel + Upsell (`iteration_33.json`).
- 2026-06-18 (1) — Marketing Dashboard + Inbox + Vitrine pages (`iteration_32.json`).

### Header (refonte luxury hotel)
- **Logo -75%** : de `h-36 md:h-52` à `h-10 md:h-12 lg:h-14` (compact luxury hotel).
- **Header desktop** : barre horizontale `h-16 md:h-20`. **Logo à gauche**, nav inline centrée (Hôtel · Beach Club · Le Kaai · Corporate · Activités · Memberships · Boutique · Journal · Contact), **bouton RÉSERVER doré** à droite. Active link souligné en doré.
- **Header mobile** : hamburger gauche + logo centré + RÉSERVER doré droite. Le menu fullscreen reste accessible.
- Logo doré au scroll conservé (filtre `.logo-gold`).

### Hero accueil
- ✅ Typo corrigé : **`LIFE IS HERE`** (au lieu de `LIDE`).
- ✅ Titre +50% (de `lg:text-[6rem]` à `lg:text-[9rem] xl:text-[10.5rem]`).
- ✅ Sous-titre +75% (de `text-base/lg/xl` à `text-xl sm:text-2xl md:text-3xl`).

### Section UNIVERS (redesign luxury)
- Plus de horizontal scroll grand format. Nouvelle grille raffinée 5 cartes (3 sur la 1ère ligne, 2 centrées sur la 2ème ligne).
- Cartes en format portrait 3:4 avec hover zoom subtil, titre en serif italique **sous** l'image, description 3 lignes (`line-clamp-3`), lien "Découvrir" hairline doré.
- Headers : tag `· Nos univers ·` en doré + filet doré sous le titre.

### Module Blog / Journal (nouveau)
- **Backend** : `routers/blog.py` — collection `blog_articles` avec slugs auto-générés uniques (`_slugify`), CRUD complet, workflow draft/published, endpoint public listant + lecture par slug + 3 articles "À lire aussi".
- **Frontend public** :
  - `/blog` — page liste avec featured article (premier) + grille des suivants en 3 colonnes.
  - `/blog/:slug` — article complet (hero image + corps HTML stylé via `prose` Tailwind + 3 articles related).
- **Frontend staff** : `/staff/blog` — tableau CRUD (titre, catégorie, slug, status), bouton "Publier/Dépublier" rapide, modal d'édition complète (titre/excerpt/cover/auteur/catégorie/tags/temps lecture/body HTML), preview lien externe pour articles publiés.
- **Seed** : 2 articles éditoriaux pré-créés (« L'Île Boulay, secret le mieux gardé d'Abidjan » et « Le Kaai — Carnet de cuisine d'inspiration africaine »).
- Nav publique : entrée **Journal** ajoutée entre Boutique et Contact.
- Sidebar staff : entrée **Journal — Blog** ajoutée sous Administration.

### Fichiers modifiés / créés
- `VitrineNav.jsx` — refonte complète layout horizontal desktop.
- `VitrineLayout.jsx` — padding réduit (`pt-16 md:pt-20`).
- `VitrineLanding.jsx` — hero + section UNIVERS + UniversCard refonte.
- `routers/blog.py` (nouveau).
- `pages/vitrine/VitrineBlog.jsx`, `VitrineBlogArticle.jsx` (nouveaux).
- `pages/staff/StaffBlog.jsx` (nouveau).
- `App.js` + `StaffLayout.jsx` — routes et sidebar wiring.

### Mongo collections ajoutées
- `blog_articles` — `{_id, slug (unique), title, excerpt, body, cover_image_url, author_name, category, tags[], read_minutes, status: draft|published, published_at, created_at, updated_at, created_by, updated_by}`.

---

## Entrées précédentes (résumées)

- 2026-06-18 (3) — Logo XL doré au scroll + Optima partout (iteration 54 — désormais remplacée par la refonte luxury).
- 2026-06-18 (2) — CRM 360° + Memberships + Événementiel + Upsell (`iteration_33.json` — 23/23).
- 2026-06-18 (1) — Marketing Dashboard + Inbox + Vitrine pages (`iteration_32.json`).


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
