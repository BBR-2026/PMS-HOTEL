"""Boulay Beach Resort — Visual presentation PDF with screenshots.

Generates a one-off PDF that showcases each functional area of the app with
a screenshot, a short title and bullet-point key features. Designed for
director-level review (board / investor / staff training).
"""
from __future__ import annotations
import os
from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image, KeepTogether,
    Table, TableStyle,
)

GOLD = colors.HexColor("#B8922A")
DARK = colors.HexColor("#0A0A0A")
CREAM = colors.HexColor("#FAFAF7")
GREY = colors.HexColor("#888888")
LIGHT_GREY = colors.HexColor("#D5D5D5")

SHOTS_DIR = "/tmp/bbr_shots"

# (file, section, title, blurb, bullets)
SECTIONS = [
    # ---- COVER + PUBLIC ----
    ("01_landing.jpg", "Portail public", "Page d'accueil",
     "Vitrine 5★ du resort avec accès direct au tunnel de réservation.",
     ["Identité visuelle luxe : or #B8922A, cream, Playfair Display",
      "Présentation des 5 offres et 5 pôles d'activité",
      "CTA principal vers le tunnel de réservation",
      "Toggle FR/EN sur l'ensemble du site"]),
    ("02_pole_beach_club.jpg", "Portail public", "Pôle Beach Club",
     "Page dédiée aux expériences journée : Day Pass, Sunset, Brunch.",
     ["Présentation des 3 expériences journée du resort",
      "Tarifs adultes / enfants visibles",
      "Bouton de réservation rapide par offre",
      "Galerie visuelle premium"]),
    ("03_pole_hebergement.jpg", "Portail public", "Pôle Hébergement",
     "Catalogue des chambres et suites avec inventaire temps réel.",
     ["3 catégories : Chambres Supérieures + Suites + Suite premium",
      "Tarifs par nuit affichés",
      "Inventaire en temps réel (visibilité par date)",
      "5 suites nommées : Villa Manioc, Akwaba, Iroko, Anyélé, Anaïs"]),
    ("04_pole_kaai.jpg", "Portail public", "Pôle Le Kaai",
     "Restaurant gastronomique — réservation sans paiement en ligne.",
     ["Carte du restaurant et ambiance",
      "Réservation gratuite, paiement sur place",
      "36 tables réparties en 3 zones (Salle, Terrasse, Bord de mer)"]),
    ("05_pole_corporate.jpg", "Portail public", "Pôle Corporate",
     "Séminaires, événements professionnels et team building.",
     ["Présentation de l'offre B2B",
      "Formulaire de privatisation",
      "Service sur-mesure pour les entreprises"]),
    ("06_pole_activites.jpg", "Portail public", "Pôle Activités & Événements",
     "Catalogue d'activités et événements spéciaux mis en avant.",
     ["Activités nautiques et bien-être",
      "Événements spéciaux (Sunset privé, Brunch événementiel)",
      "Demande de privatisation directe depuis la page"]),
    ("07_booking_step1.jpg", "Tunnel de réservation", "Étape 1 — Date & participants",
     "Premier écran du tunnel de réservation 5 étapes.",
     ["Sélection de la date avec contraintes par offre (Day Pass = Lun-Ven, etc.)",
      "Horaires de bateau dynamiques (Lun-Ven toutes les 2h, weekends à l'heure)",
      "Nombre d'adultes et d'enfants",
      "Pour Hébergement : date de check-out + nombre de chambres + catégorie"]),
    ("08_event_privatization.jpg", "Tunnel de réservation", "Demande de privatisation",
     "Formulaire de prise de contact pour les événements sur-mesure.",
     ["Capture des besoins événementiels (mariage, séminaire, anniversaire)",
      "Workflow staff : nouveau → contacté → confirmé → terminé",
      "Notes internes et historique côté staff",
      "Notification staff automatique"]),

    # ---- STAFF BACK-OFFICE ----
    ("10_dashboard.jpg", "Back-office staff", "Tableau de bord",
     "Vue d'ensemble en temps réel des opérations du jour.",
     ["4 KPIs principaux : réservations du jour, revenus, taux d'occupation, alertes",
      "Planning détaillé du jour (arrivées, embarquements, événements)",
      "Notifications opérationnelles prioritaires",
      "Sidebar role-aware : chaque rôle voit ses modules"]),
    ("11_reservations.jpg", "Back-office staff", "Réservations",
     "Pipeline complet de toutes les réservations avec filtres et actions.",
     ["Vue Liste / Calendrier interchangeable",
      "Sous-onglets par offre (Toutes, Beach Club, Hébergement, Corporate, Activités, Le Kaai)",
      "Filtres avancés (statut, paiement, période)",
      "Drawer détaillé avec actions : modifier statut, paiement, attribution chambre"]),
    ("12_embarquement.jpg", "Back-office staff", "Embarquement & Traversée",
     "Gestion de la flotte et programmation des traversées en bateau.",
     ["CRUD bateaux (5 bateaux pré-configurés : Lagon d'Or, Sunset Express, etc.)",
      "Programmation des traversées avec horaire aller + retour automatique",
      "Embarquement 1-clic d'une réservation sur une traversée",
      "Historique des traversées + rapport PDF par traversée"]),
    ("13_scanner.jpg", "Back-office staff", "Scanner QR",
     "Validation des billets clients via QR code (caméra ou saisie manuelle).",
     ["Scan caméra direct (html5-qrcode)",
      "Saisie manuelle du token en fallback",
      "Affichage de la fiche client + bouton « Marquer comme arrivé »",
      "Historique des check-ins dédié"]),
    ("14_clients.jpg", "Back-office staff", "Clients (CRM)",
     "Base CRM agrégée des clients du resort avec historique complet.",
     ["Liste agrégée par email avec recherche full-text",
      "Fiche détaillée : historique des séjours, montant total dépensé",
      "Export CSV et PDF de la base clients",
      "Données démographiques : nationalité, téléphone, fréquence"]),
    ("15_le_kaai.jpg", "Back-office staff", "Le Kaai (restaurant)",
     "Gestion des 36 tables du restaurant avec assignation visuelle.",
     ["36 tables réparties en 3 zones (Salle, Terrasse, Bord de mer)",
      "Vue jour avec sélecteur de date",
      "Assignation table par clic, libération sur départ",
      "CRUD tables et zones (admin)"]),
    ("16_revenue.jpg", "Back-office staff", "Chiffre d'affaires",
     "Analyse financière complète avec graphiques et exports.",
     ["KPIs revenus + panier moyen avec filtres période (jour/semaine/mois/an/total)",
      "LineChart évolution journalière, BarChart par offre, PieChart par méthode",
      "Top 10 clients par montant dépensé",
      "Export PDF du rapport de revenus"]),
    ("17_hebergement.jpg", "Back-office staff", "Hébergement",
     "Calendrier mensuel d'occupation + grille de chambres physiques.",
     ["Calendrier d'occupation par catégorie (or / vert / bleu)",
      "Grille des chambres physiques (20 Supérieures + 5 Suites)",
      "Check-in / check-out par chambre avec attribution manuelle",
      "Statistiques étendues + alertes surbooking"]),
    ("18_activities.jpg", "Back-office staff", "Activités & Consommation",
     "Wallet « consommation sur place » avec scanner caméra.",
     ["Wallet par réservation, alimenté par scan QR du client",
      "Catalogue d'activités payantes (kayak, paddle, spa, etc.)",
      "Validation de paiement à la sortie (espèces / FineoPay)",
      "Analytics dédiés : top activités, panier moyen wallet"]),
    ("19_receipts.jpg", "Back-office staff", "Reçus de paiement",
     "Audit trail des paiements catégorisé par Pôle.",
     ["Tri par Pôle (Beach Club, Hébergement, Corporate, Activités, Le Kaai)",
      "Filtres par statut de paiement et période",
      "Téléchargement PDF par reçu individuel",
      "Récapitulatif total par catégorie"]),
    ("20_notifications.jpg", "Back-office staff", "Notifications SMS & WhatsApp",
     "Envois transactionnels Twilio + cron jobs automatiques.",
     ["Envoi test manuel avec choix WhatsApp / SMS",
      "Historique complet avec statut final (delivered, failed, error_code)",
      "Déclencheurs manuels des jobs J-1 et J+1",
      "Mode trial-safe togglable pour la production"]),
    ("21_config_users.jpg", "Configuration admin", "Utilisateurs",
     "Gestion des comptes staff avec 9 rôles RBAC.",
     ["CRUD complet des comptes utilisateurs",
      "Sélection du rôle parmi 9 (Admin, Manager pôle, Hôtesse, Direction, etc.)",
      "Affectation à un pôle spécifique pour les Manager pôle",
      "Refus auto-suppression du compte courant"]),
    ("22_config_offers.jpg", "Configuration admin", "Offres & Tarifs",
     "Édition des prix et inventaires sans redéploiement.",
     ["Tarifs adultes/enfants éditables par offre",
      "Inventaire chambres ajustable en temps réel",
      "Tarifs par catégorie de chambre (Supérieure / Suites)",
      "Persistance via collection `offer_overrides`"]),
    ("23_config_integrations.jpg", "Configuration admin", "Intégrations",
     "État et test de connectivité des intégrations tierces.",
     ["Badge configuré / non-configuré par intégration",
      "Bouton « Tester la connexion FineoPay » avec rapport détaillé",
      "Affichage des paramètres masqués (clés API tronquées)",
      "Alerte automatique mode Sandbox WhatsApp"]),
    ("24_loisirs.jpg", "Back-office staff", "Loisirs (demandes)",
     "Suivi des demandes de privatisation et événements sur-mesure.",
     ["Liste des `event_requests` avec filtres par statut",
      "Workflow : new → contacted → confirmed → completed/declined",
      "Drawer détaillé avec notes internes",
      "Pôle Activités & Événements"]),
    ("25_special_events.jpg", "Back-office staff", "Événements spéciaux",
     "Gestion des événements spéciaux mis en avant sur le site public.",
     ["CRUD complet des événements spéciaux",
      "Toggle « featured » pour mettre en avant sur la home",
      "Duplication d'événement en 1 clic",
      "Suivi des inscriptions / paiements"]),
    ("26_paiements.jpg", "Back-office staff", "Paiements",
     "Vue financière consolidée avec validation des paiements partiels.",
     ["Récapitulatif des paiements à valider (espèces, wallet, acomptes)",
      "Filtres par méthode et période",
      "Workflow de validation par le staff",
      "Cohérent avec les Reçus pour le rapprochement comptable"]),
]


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("title", parent=base["Title"], fontName="Times-Bold",
                                fontSize=36, textColor=DARK, leading=42, alignment=TA_LEFT),
        "subtitle": ParagraphStyle("subtitle", parent=base["Normal"], fontName="Times-Italic",
                                   fontSize=15, textColor=GOLD, leading=20, spaceAfter=20),
        "section_tag": ParagraphStyle("section_tag", parent=base["Normal"], fontName="Helvetica-Bold",
                                      fontSize=8, textColor=GOLD, leading=11, spaceAfter=4),
        "h_page": ParagraphStyle("h_page", parent=base["Heading1"], fontName="Times-Bold",
                                 fontSize=22, textColor=DARK, leading=26, spaceAfter=4),
        "blurb": ParagraphStyle("blurb", parent=base["Normal"], fontName="Times-Italic",
                                fontSize=11, textColor=GREY, leading=15, spaceAfter=12),
        "bullet": ParagraphStyle("bullet", parent=base["BodyText"], fontName="Helvetica",
                                 fontSize=9.5, textColor=DARK, leading=14, leftIndent=14,
                                 bulletIndent=2, spaceAfter=3),
        "small": ParagraphStyle("small", parent=base["Normal"], fontName="Helvetica",
                                fontSize=8, textColor=GREY, leading=11),
        "section_break_title": ParagraphStyle("sbt", parent=base["Title"], fontName="Times-Bold",
                                              fontSize=28, textColor=DARK, leading=34,
                                              alignment=TA_LEFT, spaceAfter=8),
    }


def _header_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(0.5)
    canvas.line(2 * cm, A4[1] - 1.4 * cm, A4[0] - 2 * cm, A4[1] - 1.4 * cm)
    canvas.setFont("Times-Italic", 8)
    canvas.setFillColor(GREY)
    canvas.drawString(2 * cm, A4[1] - 1.1 * cm, "BBR · Boulay Beach Resort")
    canvas.drawRightString(A4[0] - 2 * cm, A4[1] - 1.1 * cm,
                           "Présentation visuelle des fonctionnalités")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(GREY)
    canvas.drawCentredString(A4[0] / 2, 1.2 * cm, f"— {doc.page} —")
    canvas.drawString(2 * cm, 1.2 * cm, datetime.now().strftime("%d %B %Y"))
    canvas.drawRightString(A4[0] - 2 * cm, 1.2 * cm, "Document interne — Confidentiel")
    canvas.restoreState()


def _feature_page(filename, section, title, blurb, bullets, s):
    """Build a single feature page : screenshot at the top, then text below."""
    flow = []
    flow.append(Paragraph(section.upper(), s["section_tag"]))
    flow.append(Paragraph(title, s["h_page"]))
    flow.append(Paragraph(blurb, s["blurb"]))
    img_path = os.path.join(SHOTS_DIR, filename)
    if os.path.exists(img_path) and os.path.getsize(img_path) > 12000:
        # Image fits page width with luxury border
        img = Image(img_path, width=17 * cm, height=17 * 9 / 16 * cm)
        bordered = Table([[img]], colWidths=[17 * cm], style=TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, LIGHT_GREY),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        flow.append(bordered)
    else:
        flow.append(Paragraph("<i>Capture indisponible</i>", s["small"]))
    flow.append(Spacer(1, 0.5 * cm))
    flow.append(Paragraph("Points clés", ParagraphStyle(
        "kk", fontName="Helvetica-Bold", fontSize=9, textColor=GOLD,
        leading=12, spaceAfter=4)))
    for b in bullets:
        flow.append(Paragraph(f"•&nbsp; {b}", s["bullet"]))
    flow.append(PageBreak())
    return flow


def _section_divider(label, subtitle, s):
    """Build a luxury full-page section divider."""
    flow = []
    flow.append(Spacer(1, 6 * cm))
    flow.append(Paragraph(label, s["section_break_title"]))
    flow.append(Paragraph(subtitle, s["subtitle"]))
    flow.append(Spacer(1, 0.5 * cm))
    flow.append(Paragraph("✦  ✦  ✦", ParagraphStyle(
        "c", fontName="Times-Bold", fontSize=18, textColor=GOLD, alignment=TA_LEFT,
        leading=24)))
    flow.append(PageBreak())
    return flow


def build_presentation_pdf() -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2.2 * cm, bottomMargin=2 * cm,
        title="BBR — Présentation visuelle des fonctionnalités",
        author="Boulay Beach Resort",
    )
    s = _styles()
    story = []

    # ============ COVER ============
    story.append(Spacer(1, 5 * cm))
    story.append(Paragraph("Boulay Beach Resort", s["title"]))
    story.append(Paragraph("Présentation visuelle des fonctionnalités", s["subtitle"]))
    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph(
        "Tour complet de la plateforme de réservation 5★ illustré par "
        "<b>25 captures d'écran</b> couvrant le portail public et "
        "le back-office staff.",
        ParagraphStyle("intro", fontName="Times-Roman", fontSize=12, textColor=DARK,
                       leading=18, spaceAfter=12)))
    story.append(Spacer(1, 2 * cm))
    meta_rows = [
        ["Édition", datetime.now().strftime("%d %B %Y")],
        ["Audience", "Direction · Équipe opérationnelle · Partenaires"],
        ["Pages", "~28"],
        ["Confidentialité", "Document interne — Ne pas diffuser"],
    ]
    t = Table(meta_rows, colWidths=[3.5 * cm, 12 * cm], style=TableStyle([
        ("FONT", (0, 0), (-1, -1), "Helvetica", 10),
        ("TEXTCOLOR", (0, 0), (0, -1), GOLD),
        ("FONT", (0, 0), (0, -1), "Helvetica-Bold", 9),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t)
    story.append(PageBreak())

    # Section: Public portal
    story += _section_divider(
        "Partie 1", "Le portail public — l'expérience client", s)
    public = [x for x in SECTIONS if x[1] in ("Portail public", "Tunnel de réservation")]
    for f, sec, t_, bl, bs in public:
        story += _feature_page(f, sec, t_, bl, bs, s)

    # Section: Staff back-office
    story += _section_divider(
        "Partie 2", "Le back-office staff — 14 modules opérationnels", s)
    staff = [x for x in SECTIONS if x[1] == "Back-office staff"]
    for f, sec, t_, bl, bs in staff:
        story += _feature_page(f, sec, t_, bl, bs, s)

    # Section: Configuration admin
    story += _section_divider(
        "Partie 3", "L'administration — configuration et intégrations", s)
    admin = [x for x in SECTIONS if x[1] == "Configuration admin"]
    for f, sec, t_, bl, bs in admin:
        story += _feature_page(f, sec, t_, bl, bs, s)

    # Closing
    story.append(Spacer(1, 5 * cm))
    story.append(Paragraph("Fin de la présentation",
                           ParagraphStyle("end_t", fontName="Times-Bold", fontSize=24,
                                          textColor=DARK, leading=30, alignment=TA_CENTER)))
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph(
        "Pour toute question technique ou demande d'évolution, contactez l'équipe produit. "
        "Boulay Beach Resort — l'art du voyage sur l'île.",
        ParagraphStyle("end_b", fontName="Times-Italic", fontSize=11, textColor=GOLD,
                       leading=16, alignment=TA_CENTER)))

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buf.getvalue()


if __name__ == "__main__":
    pdf = build_presentation_pdf()
    out = "/app/frontend/public/bbr-presentation.pdf"
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "wb") as f:
        f.write(pdf)
    print(f"Wrote {len(pdf):,} bytes to {out}")
