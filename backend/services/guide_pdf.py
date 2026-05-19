"""Boulay Beach Resort — Generator of the full app guide as PDF.

Single function ``build_guide_pdf()`` returns the PDF bytes. Uses ReportLab
SimpleDocTemplate with a luxury palette (gold #B8922A on cream #FAFAF7) and
Playfair Display-like style achieved with serif font fallback.
"""
from __future__ import annotations

from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether,
)

GOLD = colors.HexColor("#B8922A")
DARK = colors.HexColor("#0A0A0A")
CREAM = colors.HexColor("#FAFAF7")
GREY = colors.HexColor("#888888")
LIGHT_GREY = colors.HexColor("#E5E5E5")
EMERALD = colors.HexColor("#16A34A")
AMBER = colors.HexColor("#D97706")
ROSE = colors.HexColor("#C0392B")


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("title", parent=base["Title"], fontName="Times-Bold",
                                fontSize=32, textColor=DARK, leading=38, alignment=TA_LEFT,
                                spaceAfter=6),
        "subtitle": ParagraphStyle("subtitle", parent=base["Normal"], fontName="Times-Italic",
                                   fontSize=14, textColor=GOLD, leading=18, spaceAfter=20),
        "h1": ParagraphStyle("h1", parent=base["Heading1"], fontName="Times-Bold",
                             fontSize=22, textColor=DARK, leading=26, spaceBefore=18, spaceAfter=8,
                             borderPadding=0),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontName="Times-Bold",
                             fontSize=15, textColor=DARK, leading=19, spaceBefore=14, spaceAfter=6),
        "h3": ParagraphStyle("h3", parent=base["Heading3"], fontName="Helvetica-Bold",
                             fontSize=11, textColor=GOLD, leading=14, spaceBefore=10, spaceAfter=4),
        "body": ParagraphStyle("body", parent=base["BodyText"], fontName="Helvetica",
                               fontSize=9.5, textColor=DARK, leading=14, spaceAfter=4),
        "bullet": ParagraphStyle("bullet", parent=base["BodyText"], fontName="Helvetica",
                                 fontSize=9.5, textColor=DARK, leading=14, leftIndent=14,
                                 bulletIndent=2, spaceAfter=2),
        "tag": ParagraphStyle("tag", parent=base["Normal"], fontName="Helvetica-Bold",
                              fontSize=7, textColor=GOLD, leading=10, spaceAfter=2),
        "small": ParagraphStyle("small", parent=base["Normal"], fontName="Helvetica",
                                fontSize=8, textColor=GREY, leading=11, spaceAfter=2),
        "code": ParagraphStyle("code", parent=base["Normal"], fontName="Courier",
                               fontSize=8.5, textColor=DARK, leading=11, leftIndent=10,
                               backColor=CREAM, borderPadding=4),
    }


def _header_footer(canvas, doc):
    canvas.saveState()
    # Top gold rule
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(0.5)
    canvas.line(2 * cm, A4[1] - 1.4 * cm, A4[0] - 2 * cm, A4[1] - 1.4 * cm)
    # Header: BBR | Guide
    canvas.setFont("Times-Italic", 8)
    canvas.setFillColor(GREY)
    canvas.drawString(2 * cm, A4[1] - 1.1 * cm, "BBR · Boulay Beach Resort")
    canvas.drawRightString(A4[0] - 2 * cm, A4[1] - 1.1 * cm,
                           "Guide complet de l'application — réservé direction")
    # Footer page number
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(GREY)
    canvas.drawCentredString(A4[0] / 2, 1.2 * cm, f"— {doc.page} —")
    canvas.drawString(2 * cm, 1.2 * cm,
                      f"Édition du {datetime.now().strftime('%d %B %Y')}")
    canvas.drawRightString(A4[0] - 2 * cm, 1.2 * cm, "Document interne — Confidentiel")
    canvas.restoreState()


def _kv_table(rows, col_widths=None, head=True):
    if col_widths is None:
        col_widths = [4.5 * cm, 11 * cm]
    style_rows = [
        ("FONT", (0, 0), (-1, -1), "Helvetica", 9),
        ("TEXTCOLOR", (0, 0), (0, -1), DARK),
        ("TEXTCOLOR", (1, 0), (1, -1), DARK),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -2), 0.25, LIGHT_GREY),
        ("BACKGROUND", (0, 0), (0, -1), CREAM),
    ]
    if head:
        style_rows.insert(0, ("BACKGROUND", (0, 0), (-1, 0), DARK))
        style_rows.insert(1, ("TEXTCOLOR", (0, 0), (-1, 0), CREAM))
        style_rows.insert(2, ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 9))
    t = Table(rows, colWidths=col_widths, hAlign="LEFT")
    t.setStyle(TableStyle(style_rows))
    return t


def _badge(text, color):
    return Table([[text]], colWidths=[2.5 * cm], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
        ("FONT", (0, 0), (-1, -1), "Helvetica-Bold", 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))


# ============================================================
# DATA
# ============================================================

FEATURES_BY_PHASE = [
    ("Phase 1 — Portail client public", [
        "Tunnel de réservation en 5 étapes (date → convives → coordonnées par participant → récapitulatif → paiement)",
        "5 offres : Day Pass (Lun-Ven), Sunset (Sam), Brunch (Dim), Le Kaai (resto sur réservation), Hébergement (3 catégories de chambres)",
        "Champs par participant : Nom, Prénom, Email, Téléphone, Nationalité (autocomplétion 195 pays)",
        "Horaires de bateau dynamiques : Lun-Ven toutes les 2h, weekends à l'heure",
        "Sélection des chambres : Supérieures (1001-1020) + Suites (Villa Manioc, Akwaba, Iroko, Anyélé, Anaïs)",
        "Inventaire en temps réel : la sélection s'adapte au stock disponible par date",
        "3 méthodes de paiement : carte bancaire (FineoPay), Mobile Money, Espèces (paiement sur place)",
        "Billet PNG premium généré côté serveur (corps brun + QR doré stylisé pour carte/mobile, reçu crème pour espèces)",
        "Page de confirmation : téléchargement du PNG, partage Email/WhatsApp, Livret BBR PDF",
        "Toggle FR/EN sur l'ensemble du tunnel",
    ]),
    ("Phase 2 — Back-office staff (14 modules)", [
        "Module 1 — Tableau de bord : 4 KPIs + planning du jour + alertes opérationnelles",
        "Module 2 — Réservations : vue Liste / Calendrier, sous-onglets par offre, filtres avancés, drawer détaillé avec actions",
        "Module 3 — Embarquement & Traversée : CRUD bateaux, programmation des traversées avec retour automatique, embarquement en 1 clic",
        "Module 4 — Scanner QR : scan caméra (html5-qrcode) + saisie manuelle, fiche client, bouton « Marquer comme arrivé »",
        "Module 5 — Clients (CRM) : liste agrégée, recherche, fiche détaillée avec historique complet, export CSV + PDF",
        "Module 6 — Le Kaai : 36 tables seedées par zone (Salle/Terrasse/Bord de mer), assignation par clic, libération",
        "Module 7 — Chiffre d'affaires : KPIs revenus + panier moyen, filtres période, LineChart évolution, BarChart par offre, PieChart méthodes, top 10 clients",
        "Module Hébergement : calendrier mensuel d'occupation par catégorie (couleurs Or/Vert/Bleu), arrivées + départs du jour, grille de chambres physiques avec check-in/out, statistiques étendues",
        "Module Activités & Événements : catalogue d'activités, événements spéciaux (Sunset, Brunch privatisés), CRUD complet, demandes de privatisation",
        "Module Consommation sur place : wallet par réservation, scanner QR caméra, validation de paiement à la sortie, analytics dédiés",
        "Module Reçus de paiement : tri par Pôle (Beach Club, Hébergement, Corporate, Activités, Le Kaai), filtres, export PDF par reçu",
        "Module Pôles : vue dédiée par pôle d'activité avec KPIs et rapports",
        "Module Notifications SMS & WhatsApp : envoi test, historique des envois, déclencheurs manuels des jobs J-1 / J+1",
        "Module Configuration (admin) : utilisateurs (CRUD), offres & tarifs (édition prix/inventaire), intégrations (test connexion FineoPay/Twilio)",
    ]),
    ("Phase 3 — Automatisations et paiements", [
        "Intégration FineoPay (hosted-checkout) — sandbox + production prêt — paiements carte bancaire & Mobile Money",
        "Webhook FineoPay avec vérification de signature (secret) et idempotency par sync_ref",
        "Page de retour `/payment/fineo/result` qui affiche le statut final au client",
        "Notifications transactionnelles Twilio (WhatsApp + fallback SMS) : confirmation paiement (J), rappel J-1 (17h UTC), demande d'avis J+1 (10h UTC), alertes staff manuelles",
        "QR du billet attaché en image au message WhatsApp",
        "APScheduler intégré pour les cron jobs quotidiens (J-1, J+1)",
        "Log MongoDB de tous les envois Twilio avec statut, code d'erreur et message",
    ]),
]

ROLES = [
    ("admin", "Administrateur",
     "Accès complet : tous les modules, configuration utilisateurs, offres & tarifs, intégrations, tests de connexion. C'est le seul rôle pouvant créer/supprimer des comptes staff."),
    ("management_general", "Management général",
     "LECTURE SEULE sur l'ensemble du back-office. Toutes les requêtes d'écriture (POST/PATCH/PUT/DELETE) sont bloquées par un middleware HTTP qui renvoie 403. Idéal pour la direction qui consulte sans risque de modifier."),
    ("manager", "Manager (legacy)",
     "Rôle historique conservé pour compatibilité. Accès aux modules d'opération et de gestion mais pas à la Configuration admin."),
    ("manager_pole", "Manager pôle",
     "Voit uniquement les données et les actions du pôle qui lui est attribué (beach_club, hebergement, corporate, activites_events, le_kaai). La sidebar est filtrée automatiquement."),
    ("hotesse", "Hôtesse",
     "Accès Tableau de bord, Scanner QR, Toutes les réservations. Profil polyvalent pour le front-desk / accueil."),
    ("serveur_caisse", "Serveur & caisse",
     "Module Consommation sur place uniquement (wallet, scanner, charges, validation paiement)."),
    ("logistique", "Logistique",
     "Modules Embarquement, Traversées, Scanner QR (opérations de transport)."),
    ("verification", "Vérification",
     "Scanner QR uniquement. Pas d'accès aux données financières ou clients en détail."),
    ("receptionist", "Réception (legacy)",
     "Rôle historique conservé pour compatibilité. Accès aux réservations et aux clients."),
]

POLES = [
    ("beach_club", "Beach Club", "Day Pass / Sunset / Brunch — toutes les expériences journée"),
    ("hebergement", "Hébergement", "Chambres et suites avec calendrier d'occupation et grille physique"),
    ("corporate", "Corporate", "Séminaires, team building, événements privatisés"),
    ("activites_events", "Activités & Événements", "Catalogue d'activités payantes + événements spéciaux (privatisations)"),
    ("le_kaai", "Le Kaai", "Restaurant — réservation gratuite avec assignation de table"),
]

SECURITY = [
    ("Authentification staff", "JWT (HS256) avec expiration 7 jours, mot de passe bcrypt (cost 12), endpoint dédié `/api/auth/staff/login`."),
    ("RBAC", "9 rôles distincts (voir tableau). Chaque endpoint protégé par `_require_role([\"role1\", \"role2\", …])` avec inclusion de rôles via `ROLE_INCLUDES`."),
    ("Middleware lecture seule", "`readonly_role_middleware` bloque toutes les requêtes d'écriture pour les comptes `management_general` (HTTP 403)."),
    ("FineoPay", "Headers d'authentification `businessCode` + `apiKey` (jamais en query string). Webhook callback protégé par un secret partagé en query string + vérification de signature future possible. Idempotency par `sync_ref` unique pour éviter les double-paiements en cas de re-soumission."),
    ("Twilio", "Account SID + Auth Token en variables d'environnement. Mode `TWILIO_TRIAL_SAFE` désactivable pour éviter le rerouting en production. Log MongoDB de chaque envoi (audit trail complet)."),
    ("CORS", "Origines configurables via `CORS_ORIGINS` (séparées par virgules)."),
    ("Variables d'environnement", "Toutes les clés et URLs (`MONGO_URL`, `JWT_SECRET`, `FINEO_*`, `TWILIO_*`) sont dans `/app/backend/.env` — jamais hardcodées."),
    ("Tokens QR", "Token aléatoire de 32 caractères (`secrets.token_hex(16)`) par participant, stocké dans la réservation. Les billets PNG sont signés à la volée."),
]

DATA_MODELS = [
    ("bookings", "Réservations principales", "id, reference_token, offer_type, pole, date, status, total_amount, paid_amount, participants[], qr_codes[], room_id, room_tier"),
    ("staff", "Comptes utilisateurs back-office", "id, name, email, password_hash (bcrypt), role, pole_id, created_at"),
    ("wallets", "Consommation sur place", "token, booking_id, transactions[], total_charged, status (open/closed)"),
    ("traversees", "Traversées de bateau programmées", "id, bateau_id, departure_at, return_at, capacity, status"),
    ("traversee_passengers", "Passagers embarqués par traversée", "traversee_id, booking_id, embarked_at"),
    ("bateaux", "Flotte de bateaux", "id, name, capacity, skipper"),
    ("kaai_zones / kaai_tables", "Restaurant Le Kaai", "id, name, zone_id, capacity"),
    ("activities / event_requests", "Activités et événements", "id, name, description, price, demandes de privatisation"),
    ("special_events", "Événements spéciaux mis en avant", "id, title, date, banner_url, featured (bool)"),
    ("receipts", "Reçus de paiement (audit)", "id, booking_id, pole, amount, payment_method, created_at"),
    ("fineo_payments", "Transactions FineoPay", "sync_ref (unique), booking_id, intent, amount, checkout_url, status, fineo_reference, created_at, updated_at"),
    ("twilio_messages", "Audit des envois SMS/WhatsApp", "sid, channel, to, from, status, error_code, error_message, purpose, booking_id, created_at"),
    ("offer_overrides", "Personnalisation prix/inventaire", "offer_id, adult_price, child_price, room_tiers[]"),
    ("counters", "Compteurs séquentiels", "_id (ex: booking_ref), seq"),
    ("app_state", "État applicatif & migrations", "key, value, applied_at"),
]


def build_guide_pdf() -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2.2 * cm, bottomMargin=2 * cm,
        title="BBR — Guide complet de l'application",
        author="Boulay Beach Resort",
    )
    s = _styles()
    story = []

    # ============ COVER ============
    story.append(Spacer(1, 4.5 * cm))
    story.append(Paragraph("Boulay Beach Resort", s["title"]))
    story.append(Paragraph("Guide complet de l'application", s["subtitle"]))
    story.append(Spacer(1, 0.6 * cm))
    story.append(Paragraph(
        "Document interne réservé à la direction et aux équipes opérationnelles. "
        "Présente l'architecture, les fonctionnalités, la sécurité et la feuille de route "
        "de la plateforme de réservation 5★ du resort.", s["body"]))
    story.append(Spacer(1, 1.4 * cm))
    cover_meta = [
        ["Édition", datetime.now().strftime("%d %B %Y")],
        ["Audience", "Direction · Manager pôle · Administrateur système"],
        ["Confidentialité", "Document interne — Ne pas diffuser à l'extérieur"],
        ["Versioning", "Version courante : production preview · Phase 3 en cours"],
    ]
    story.append(_kv_table(cover_meta, col_widths=[3.5 * cm, 12 * cm], head=False))
    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph("✦  ✦  ✦", ParagraphStyle("c", parent=s["body"], alignment=TA_CENTER,
                                                      textColor=GOLD, fontSize=14)))
    story.append(PageBreak())

    # ============ EXECUTIVE SUMMARY ============
    story.append(Paragraph("Résumé exécutif", s["h1"]))
    story.append(Paragraph(
        "L'application BBR est une plateforme full-stack qui gère l'intégralité du parcours "
        "client (de la prise de réservation au billet QR délivré sur WhatsApp) ainsi que les "
        "opérations internes du resort. Elle est structurée autour de <b>5 pôles d'activité</b>, "
        "<b>9 rôles utilisateurs</b>, et <b>14 modules back-office</b>.",
        s["body"]))
    story.append(Spacer(1, 0.3 * cm))

    kpis = [
        ["Indicateur", "Valeur"],
        ["Endpoints API exposés", "103 routes (`/api/...`)"],
        ["Modules back-office", "14 + Configuration admin"],
        ["Pôles d'activité", "5 (Beach Club, Hébergement, Corporate, Activités, Le Kaai)"],
        ["Rôles RBAC", "9 (admin, management_general, manager, manager_pole, hotesse, serveur_caisse, logistique, verification, receptionist)"],
        ["Collections MongoDB", "17"],
        ["Offres au catalogue", "5 (Day Pass, Sunset, Brunch, Le Kaai, Hébergement)"],
        ["Chambres physiques", "20 Supérieures + 5 Suites nommées"],
        ["Intégrations 3rd-party", "FineoPay (paiement) · Twilio (notifications)"],
        ["Code base", "~19 200 lignes (Python + JSX)"],
    ]
    story.append(_kv_table(kpis))
    story.append(Spacer(1, 0.4 * cm))

    story.append(Paragraph("Stack technique", s["h2"]))
    stack = [
        ["Couche", "Technologies"],
        ["Frontend", "React 19, React Router 7, TailwindCSS, Shadcn/UI, framer-motion, sonner, recharts, html5-qrcode"],
        ["Backend", "FastAPI 0.110, Motor (MongoDB async), Pydantic v2, PyJWT, bcrypt, Pillow (PNG dynamiques), qrcode (QR dorés stylisés), ReportLab (PDFs), APScheduler (cron J-1/J+1)"],
        ["Base de données", "MongoDB 6+"],
        ["Paiement", "FineoPay (hosted-checkout REST API)"],
        ["Notifications", "Twilio SMS + WhatsApp (SDK Python)"],
        ["Hébergement actuel", "Kubernetes managed (Emergent), supervisord pour orchestration locale"],
    ]
    story.append(_kv_table(stack, col_widths=[3 * cm, 12.5 * cm]))
    story.append(PageBreak())

    # ============ FEATURES ============
    story.append(Paragraph("Fonctionnalités par phase", s["h1"]))
    for phase_title, items in FEATURES_BY_PHASE:
        story.append(Paragraph(phase_title, s["h2"]))
        for it in items:
            story.append(Paragraph(f"•&nbsp;&nbsp;{it}", s["bullet"]))
        story.append(Spacer(1, 0.25 * cm))
    story.append(PageBreak())

    # ============ POLES ============
    story.append(Paragraph("Les 5 pôles d'activité", s["h1"]))
    story.append(Paragraph(
        "L'application est structurée autour de 5 pôles. Chaque manager pôle ne voit que les "
        "données et les opérations de son pôle (filtrage automatique de la sidebar et des "
        "réponses API).", s["body"]))
    story.append(Spacer(1, 0.2 * cm))
    pole_rows = [["Code", "Nom", "Périmètre"]]
    for code, name, desc in POLES:
        pole_rows.append([code, name, desc])
    story.append(_kv_table(pole_rows, col_widths=[3 * cm, 4 * cm, 8.5 * cm]))
    story.append(PageBreak())

    # ============ ROLES (RBAC) ============
    story.append(Paragraph("Contrôle d'accès basé sur les rôles (RBAC)", s["h1"]))
    story.append(Paragraph(
        "Chaque utilisateur staff possède un rôle unique. Les permissions sont vérifiées côté "
        "backend (middleware + décorateur `_require_role`) ET côté frontend (sidebar role-aware). "
        "Le compte <b>management_general</b> est intégralement en lecture seule grâce à un "
        "middleware HTTP dédié qui intercepte les méthodes POST/PATCH/PUT/DELETE.",
        s["body"]))
    story.append(Spacer(1, 0.3 * cm))
    for code, label, desc in ROLES:
        story.append(Paragraph(f"<font color='#B8922A'>●</font> &nbsp;<b>{label}</b> "
                               f"<font color='#888888' size='8'>(<i>{code}</i>)</font>", s["h3"]))
        story.append(Paragraph(desc, s["body"]))
        story.append(Spacer(1, 0.15 * cm))
    story.append(PageBreak())

    # ============ DATA MODEL ============
    story.append(Paragraph("Modèle de données", s["h1"]))
    story.append(Paragraph(
        "17 collections MongoDB. Aucune relation foncière entre collections n'est imposée par "
        "la base — les jointures se font côté applicatif via `booking_id`, `email`, "
        "`reference_token` ou `sync_ref` selon le contexte.", s["body"]))
    story.append(Spacer(1, 0.2 * cm))
    coll_rows = [["Collection", "Rôle", "Champs principaux"]]
    for name, role, fields in DATA_MODELS:
        coll_rows.append([name, role, fields])
    t = _kv_table(coll_rows, col_widths=[3.2 * cm, 4 * cm, 8.3 * cm])
    story.append(t)
    story.append(PageBreak())

    # ============ SECURITY ============
    story.append(Paragraph("Sécurité", s["h1"]))
    story.append(Paragraph(
        "L'application a été conçue avec une approche <b>defense in depth</b> : authentification "
        "forte, séparation des rôles, secrets en variables d'environnement, audit trail des "
        "actions sensibles, et idempotency sur les flux de paiement.", s["body"]))
    story.append(Spacer(1, 0.3 * cm))
    for title, detail in SECURITY:
        story.append(Paragraph(f"<font color='#B8922A'>▶</font>&nbsp; {title}", s["h3"]))
        story.append(Paragraph(detail, s["body"]))
        story.append(Spacer(1, 0.1 * cm))
    story.append(PageBreak())

    # ============ INTEGRATIONS ============
    story.append(Paragraph("Intégrations tierces", s["h1"]))

    story.append(Paragraph("FineoPay — Paiement en ligne", s["h2"]))
    story.append(Paragraph(
        "Passerelle de paiement (carte bancaire + Mobile Money) en hosted-checkout. "
        "Notre backend appelle <font color='#0A0A0A' face='Courier'>POST /checkout-link</font> "
        "et redirige le client sur l'URL retournée. À la fin du paiement, FineoPay rappelle "
        "notre webhook qui marque la réservation comme payée et déclenche l'envoi du billet.",
        s["body"]))
    fineo_rows = [
        ["Élément", "Valeur"],
        ["Sandbox", "https://dev.fineopay.com/api/v1/business/dev/ (businessCode `bbr`)"],
        ["Production", "https://api.fineopay.com/api/v1/business/dev/ (businessCode `boulay_beach_resort`)"],
        ["Headers", "businessCode + apiKey (jamais en query string)"],
        ["Webhook callback", "POST /api/webhooks/fineo?secret=<bbr_fineo_cb_secret>"],
        ["Page de retour", "/payment/fineo/result?booking_id=…&intent=…"],
        ["Idempotency", "sync_ref = `BBR-{intent}-{booking_id}` (booking|wallet|deposit)"],
        ["Test admin", "Bouton « Tester la connexion FineoPay » dans Configuration → Intégrations"],
    ]
    story.append(_kv_table(fineo_rows, col_widths=[4.2 * cm, 11.3 * cm]))
    story.append(Spacer(1, 0.4 * cm))

    story.append(Paragraph("Twilio — Notifications SMS & WhatsApp", s["h2"]))
    story.append(Paragraph(
        "WhatsApp en priorité (avec QR du billet en pièce jointe), SMS en fallback automatique. "
        "Jobs cron via APScheduler pour les rappels J-1 (17h UTC) et demandes d'avis J+1 (10h UTC). "
        "Mode <b>trial-safe</b> désactivable pour la production.", s["body"]))
    twilio_rows = [
        ["Élément", "Valeur"],
        ["Configuration", "Account SID + Auth Token + Messaging Service SID"],
        ["WhatsApp From actuel", "whatsapp:+14155238886 (Sandbox — opt-in requis par destinataire)"],
        ["Production recommandée", "WhatsApp Business Sender approuvé Meta (~3 jours d'instruction)"],
        ["SMS From", "À configurer (achat numéro Twilio nécessaire)"],
        ["Templates", "Confirmation paiement, Rappel J-1, Avis J+1, Alertes staff"],
        ["Audit", "Collection `twilio_messages` (SID, statut, error_code, body_preview)"],
    ]
    story.append(_kv_table(twilio_rows, col_widths=[4.2 * cm, 11.3 * cm]))
    story.append(PageBreak())

    # ============ FLUX METIER ============
    story.append(Paragraph("Flux métier clés", s["h1"]))

    flows = [
        ("Réservation Day Pass + paiement carte",
         "Tunnel public → POST /api/bookings (status=pending) → POST /api/payments/fineo/checkout → "
         "redirection FineoPay → paiement → webhook /api/webhooks/fineo → POST /api/bookings/{id}/pay "
         "(status=paid) → génération PNG + QR + envoi Twilio WhatsApp avec QR en pièce jointe."),
        ("Réservation Hébergement",
         "Tunnel public → choix catégorie + nombre de chambres + checkout_date → validation "
         "inventaire en temps réel → paiement → arrivée le jour J → check-in via Hébergement "
         "(attribution chambre physique) → check-out à la date prévue."),
        ("Consommation sur place",
         "Wallet ouvert automatiquement à la création de réservation → serveur scanne le QR du "
         "client à chaque consommation (page Activités) → wallet.transactions[] alimenté → "
         "validation paiement à la sortie (espèces / FineoPay) → wallet status=closed → reçu PDF généré."),
        ("Embarquement & Traversée",
         "Manager programme une traversée (POST /staff/traversees) → embarquement 1-clic d'un "
         "booking sur une traversée → retour auto programmé en fonction du return_boat_time → "
         "rapport PDF de la traversée disponible (passagers, manifest)."),
        ("Demande de privatisation",
         "Page publique EventPrivatization → POST /api/events/privatization → entrée dans "
         "`event_requests` (status=new) → drawer staff dans Module Loisirs → workflow "
         "new → contacted → confirmed → completed/declined avec notes internes."),
    ]
    for title, detail in flows:
        story.append(Paragraph(f"<font color='#B8922A'>▸</font>&nbsp; {title}", s["h3"]))
        story.append(Paragraph(detail, s["body"]))
        story.append(Spacer(1, 0.2 * cm))
    story.append(PageBreak())

    # ============ TESTING & QUALITY ============
    story.append(Paragraph("Tests et qualité", s["h1"]))
    story.append(Paragraph(
        "Stratégie de test combinant validation manuelle ciblée (curl + screenshots Playwright) "
        "et capacité à lancer une suite complète via l'agent de test automatique.", s["body"]))
    qa_rows = [
        ["Aspect", "Statut actuel"],
        ["Tests unitaires backend", "Embryon dans /app/backend/tests (à compléter)"],
        ["Tests end-to-end", "Couvert par scripts Playwright lancés à la demande"],
        ["Linter Python", "Ruff + Flake8 + Black (déjà installés)"],
        ["Linter JS", "ESLint (CRA defaults)"],
        ["Monitoring", "Logs Twilio + Fineo persistés en MongoDB pour audit"],
        ["Comptes de test", "Documentés dans `/app/memory/test_credentials.md` (7 rôles)"],
    ]
    story.append(_kv_table(qa_rows, col_widths=[4 * cm, 11.5 * cm]))
    story.append(PageBreak())

    # ============ ROADMAP / IMPROVEMENTS ============
    story.append(Paragraph("Points d'amélioration & feuille de route", s["h1"]))

    p0 = [
        "Refactoring `server.py` (>7000 lignes) — découpage en routers modulaires "
        "(`routers/auth.py`, `routers/public.py`, `routers/staff.py`, `routers/payments.py`, "
        "`services/pdf.py`) pour la maintenabilité.",
        "Acquisition d'un numéro SMS Twilio + demande d'un WhatsApp Business Sender approuvé "
        "Meta pour quitter le Sandbox (opt-in obligatoire actuel inacceptable en production).",
        "Validation E2E du webhook FineoPay sur un paiement réel test (vérification de la "
        "signature, idempotency en cas de doublon).",
    ]
    p1 = [
        "Bouton « Renvoyer le billet » dans le drawer Réservations (re-notification Twilio en 1 clic).",
        "Upsell Alerts : notification automatique au manager quand une catégorie de chambres "
        "atteint 90 % d'occupation à 30 jours.",
        "Bundles / Packs activités : permettre au staff de créer des packages groupés "
        "(ex. Pack Sportif = kayak + paddle + déjeuner).",
        "Webhook Twilio status callback : recevoir les `delivered` / `read` / `failed` en "
        "temps réel pour suivre la santé du canal.",
        "Migration `@app.on_event` → FastAPI lifespan handlers (déprécation FastAPI).",
    ]
    p2 = [
        "Multi-devise : affichage EUR à côté du FCFA (taux configurable côté admin).",
        "Système de fidélité Silver / Gold / Platinum basé sur le total dépensé.",
        "Module Avis clients (rating + commentaires post-séjour, collectés via le lien J+1).",
        "Intégration Orchestra PMS/POS (en attente de la documentation API du resort).",
        "Application mobile native (React Native) pour les agents terrain.",
        "Mode hors-ligne pour le scanner QR (cache local + sync différée).",
        "Tableau de bord exécutif consolidé avec exports automatiques mensuels par email.",
    ]
    risks = [
        "Dépendance forte au Sandbox WhatsApp Twilio : tout client non opt-in ne reçoit rien — "
        "MUST migrer vers WhatsApp Business Sender pour la production.",
        "Tests automatisés insuffisants sur les flux financiers (paiements partiels, "
        "remboursements, wallets multiples) : un test pytest dédié à ces cas est recommandé "
        "avant la mise en production.",
        "`server.py` monolithique : risque de régressions sur les nouvelles features et "
        "difficulté d'onboarding pour un nouveau développeur.",
        "Pas encore de système de sauvegarde / restauration MongoDB automatisé documenté.",
    ]

    def _prio_block(title, badge_color, items):
        story.append(Paragraph(title, s["h2"]))
        hexval = badge_color.hexval()
        # ReportLab hexval format = '0xRRGGBB'; strip prefix to get RRGGBB
        rrggbb = hexval[2:] if hexval.startswith("0x") else hexval[1:]
        for it in items:
            story.append(Paragraph(f"<font color='#{rrggbb}'>■</font>&nbsp; {it}",
                                   s["bullet"]))
        story.append(Spacer(1, 0.2 * cm))

    _prio_block("Priorité P0 — Critiques pour la mise en production", ROSE, p0)
    _prio_block("Priorité P1 — Améliorations business à fort impact", AMBER, p1)
    _prio_block("Priorité P2 — Évolutions long terme", EMERALD, p2)
    story.append(Spacer(1, 0.1 * cm))
    story.append(Paragraph("Risques identifiés", s["h2"]))
    for r in risks:
        story.append(Paragraph(f"⚠ &nbsp; {r}", s["bullet"]))
    story.append(PageBreak())

    # ============ APPENDIX ============
    story.append(Paragraph("Annexes", s["h1"]))
    story.append(Paragraph("Variables d'environnement requises", s["h2"]))
    env_rows = [
        ["Variable", "Description"],
        ["MONGO_URL", "URL de connexion MongoDB (jamais hardcodée)"],
        ["DB_NAME", "Nom de la base (jamais à modifier en runtime)"],
        ["JWT_SECRET", "Clé HS256 pour signer les JWT staff"],
        ["CORS_ORIGINS", "Origines CORS autorisées (séparées par virgules)"],
        ["FINEO_BUSINESS_CODE", "Identifiant marchand FineoPay (en minuscules)"],
        ["FINEO_API_KEY", "Clé secrète FineoPay (64 caractères)"],
        ["FINEO_BASE_URL", "URL de l'API FineoPay (sandbox ou production)"],
        ["FINEO_CALLBACK_SECRET", "Secret partagé pour authentifier le webhook FineoPay"],
        ["FINEO_PUBLIC_BASE_URL", "URL publique de l'app (pour les callbacks et returnUrl)"],
        ["TWILIO_ACCOUNT_SID", "Account SID Twilio"],
        ["TWILIO_AUTH_TOKEN", "Token secret Twilio"],
        ["TWILIO_MESSAGING_SERVICE_SID", "SID du Messaging Service (pour SMS)"],
        ["TWILIO_WHATSAPP_FROM", "Numéro WhatsApp émetteur (whatsapp:+…)"],
        ["TWILIO_SMS_FROM", "Numéro SMS émetteur (+…)"],
        ["TWILIO_TRIAL_SAFE", "Toggle rerouting test (`false` en production)"],
    ]
    story.append(_kv_table(env_rows, col_widths=[5 * cm, 10.5 * cm]))
    story.append(Spacer(1, 0.5 * cm))

    story.append(Paragraph("Conventions et bonnes pratiques", s["h2"]))
    bp = [
        "Toutes les routes backend sont préfixées par `/api/` (routing Kubernetes ingress).",
        "Le frontend utilise EXCLUSIVEMENT `process.env.REACT_APP_BACKEND_URL` (jamais d'URL hardcodée).",
        "Les variables sensibles ne sont JAMAIS commit-ées (cf. `.env`, `test_credentials.md`).",
        "Les chaînes UTC sont toujours stockées en ISO 8601 avec timezone aware (`datetime.now(timezone.utc)`).",
        "Tous les `_id` MongoDB sont exclus des réponses API (`{\"_id\": 0}` en projection).",
        "Idempotency systématique sur les opérations financières (sync_ref unique par flux).",
        "Tests staff via les comptes documentés dans `/app/memory/test_credentials.md`.",
    ]
    for b in bp:
        story.append(Paragraph(f"•&nbsp; {b}", s["bullet"]))

    story.append(Spacer(1, 0.6 * cm))
    story.append(Paragraph("Fin du document. — Boulay Beach Resort", ParagraphStyle(
        "end", parent=s["small"], alignment=TA_CENTER, fontName="Times-Italic",
        fontSize=10, textColor=GOLD)))

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buf.getvalue()
