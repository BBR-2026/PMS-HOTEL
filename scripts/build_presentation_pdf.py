"""Build the BBR feature-presentation PDF.

Branded ReportLab document : gold (#B8922A) accents, Playfair-style serif
fall-back, BBr logo, table of contents, then one section per module with
the matching screenshot from /tmp/bbr_screens.

Output : /app/frontend/public/bbr-presentation.pdf  (served at root by CRA).
"""
from datetime import date
from pathlib import Path
from io import BytesIO

import requests

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak, KeepTogether, Table, TableStyle,
)
from reportlab.platypus.flowables import HRFlowable
from reportlab.pdfgen import canvas
from PIL import Image as PILImage

SCREENS = Path("/tmp/bbr_screens")
OUTPUT = Path("/app/frontend/public/bbr-presentation.pdf")
GOLD = colors.HexColor("#B8922A")
INK = colors.HexColor("#0A0A0A")
CREAM = colors.HexColor("#FAFAF7")
LIGHT = colors.HexColor("#F5F0E8")
LOGO_URL = "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/oysgny6q_LogoBBR-1.png"


# ----------------------------- Styles -----------------------------
styles = getSampleStyleSheet()

s_h1 = ParagraphStyle("h1", parent=styles["Title"], fontName="Times-Roman",
                     fontSize=32, leading=38, textColor=INK, alignment=0, spaceAfter=10)
s_h2 = ParagraphStyle("h2", parent=styles["Heading1"], fontName="Times-Roman",
                     fontSize=22, leading=28, textColor=INK, spaceBefore=18, spaceAfter=8)
s_h3 = ParagraphStyle("h3", parent=styles["Heading2"], fontName="Helvetica-Bold",
                     fontSize=13, leading=17, textColor=GOLD, spaceBefore=14, spaceAfter=5,
                     letterSpacing=1.5)
s_lead = ParagraphStyle("lead", parent=styles["BodyText"], fontName="Helvetica",
                       fontSize=11, leading=17, textColor=INK, spaceAfter=8)
s_body = ParagraphStyle("body", parent=styles["BodyText"], fontName="Helvetica",
                       fontSize=9.5, leading=14, textColor=INK, spaceAfter=4)
s_caption = ParagraphStyle("caption", parent=styles["BodyText"], fontName="Helvetica-Oblique",
                          fontSize=8, leading=11, textColor=colors.HexColor("#666"), alignment=1,
                          spaceAfter=10)
s_tag = ParagraphStyle("tag", parent=styles["BodyText"], fontName="Helvetica-Bold",
                      fontSize=7.5, leading=10, textColor=GOLD, spaceAfter=4)


# ----------------------------- Helpers -----------------------------
def gold_divider():
    """Slim gold horizontal rule using HRFlowable (avoids zero-row Table bug)."""
    return HRFlowable(width=2.4 * cm, thickness=1.5, color=GOLD,
                      spaceBefore=2, spaceAfter=4, hAlign="LEFT")


def _fit_image(path, max_w=15.5 * cm, max_h=9.5 * cm):
    """Return a reportlab Image scaled to fit `max_w` x `max_h` keeping ratio."""
    if not Path(path).exists():
        return None
    with PILImage.open(path) as im:
        w, h = im.size
    ratio = min(max_w / w, max_h / h, 1.0)
    img = Image(path, width=w * ratio, height=h * ratio)
    img.hAlign = "CENTER"
    return img


def section(title, tag, paragraphs, screenshot=None, screenshot_caption=None, features=None):
    """Build a module section (header + description + bullets + screenshot)."""
    flow = []
    flow.append(Paragraph(tag, s_tag))
    flow.append(Paragraph(title, s_h2))
    flow.append(gold_divider())
    flow.append(Spacer(1, 6))
    for p in paragraphs:
        flow.append(Paragraph(p, s_body))
    if features:
        flow.append(Spacer(1, 4))
        for f in features:
            flow.append(Paragraph(
                f"<font color='#B8922A'><b>·</b></font>&nbsp;&nbsp;{f}",
                ParagraphStyle("bull", parent=s_body, fontSize=9.5, leading=14,
                               leftIndent=10, spaceAfter=2)))
        flow.append(Spacer(1, 4))
    if screenshot:
        img = _fit_image(SCREENS / screenshot)
        if img is not None:
            flow.append(Spacer(1, 6))
            flow.append(img)
            if screenshot_caption:
                flow.append(Paragraph(screenshot_caption, s_caption))
    flow.append(Spacer(1, 8))
    return flow


def page_footer(canv, doc):
    canv.saveState()
    canv.setFillColor(colors.HexColor("#999"))
    canv.setFont("Helvetica", 8)
    canv.drawString(2 * cm, 1.2 * cm,
                   "Boulay Beach Resort — Plateforme de réservation & Back-Office")
    canv.drawRightString(19 * cm, 1.2 * cm, f"page {doc.page}")
    # Gold rule above footer
    canv.setStrokeColor(GOLD)
    canv.setLineWidth(0.3)
    canv.line(2 * cm, 1.6 * cm, 19 * cm, 1.6 * cm)
    canv.restoreState()


# ----------------------------- Cover -----------------------------
def fetch_logo():
    try:
        r = requests.get(LOGO_URL, timeout=10)
        r.raise_for_status()
        return BytesIO(r.content)
    except Exception:
        return None


def build_cover():
    flow = []
    flow.append(Spacer(1, 2 * cm))
    logo_buf = fetch_logo()
    if logo_buf:
        try:
            img = Image(logo_buf, width=4.5 * cm, height=4.5 * cm, kind="proportional")
            t = Table([[img]], colWidths=[16 * cm])
            t.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER")]))
            flow.append(t)
        except Exception:
            pass
    flow.append(Spacer(1, 1.2 * cm))
    title_style = ParagraphStyle("cover_title", parent=s_h1, fontSize=36, alignment=1,
                                 leading=42)
    sub_style = ParagraphStyle("cover_sub", parent=s_lead, fontSize=13, alignment=1,
                               textColor=GOLD, leading=18, spaceAfter=18)
    deck_style = ParagraphStyle("cover_deck", parent=s_body, fontSize=10, alignment=1,
                                textColor=colors.HexColor("#444"), leading=15)
    flow.append(Paragraph("Boulay Beach Resort", title_style))
    flow.append(Paragraph("Plateforme de réservation & Back-Office", sub_style))
    flow.append(HRFlowable(width=6 * cm, thickness=1.5, color=GOLD, hAlign="CENTER",
                           spaceBefore=4, spaceAfter=4))
    flow.append(Spacer(1, 1.5 * cm))
    flow.append(Paragraph(
        "Présentation détaillée de la solution full-stack développée pour BBr — "
        "5 pôles clients (Beach Club, Hébergement, Corporate, Activités &amp; Événements, "
        "Le Kaai), back-office staff avec contrôle d'accès par rôle, "
        "intégrations FineoPay (paiement), Twilio (SMS &amp; WhatsApp) et SendGrid (email).",
        deck_style))
    flow.append(Spacer(1, 4 * cm))
    flow.append(Paragraph(f"Édition du {date.today().strftime('%d %B %Y')}",
                         ParagraphStyle("date", parent=s_body, fontSize=9, alignment=1,
                                        textColor=colors.HexColor("#888"))))
    flow.append(Paragraph("Version Preview · Production : workflow-boulaybeachresort.com",
                         ParagraphStyle("ver", parent=s_body, fontSize=8, alignment=1,
                                        textColor=colors.HexColor("#aaa"))))
    flow.append(PageBreak())
    return flow


# ----------------------------- TOC -----------------------------
def build_toc():
    flow = []
    flow.append(Paragraph("Sommaire", s_h2))
    flow.append(gold_divider())
    flow.append(Spacer(1, 12))

    sections = [
        ("Introduction", [
            "Vue d'ensemble — architecture, parcours, intégrations",
        ]),
        ("Portail public — clients", [
            "Page d'accueil &amp; navigation par pôles",
            "Pôle Beach Club (Day Pass, Sunset, Brunch)",
            "Pôle Hébergement (3 catégories de chambres)",
            "Pôle Corporate (séminaires &amp; demandes)",
            "Pôle Activités &amp; Événements",
            "Pôle Le Kaai (restaurant)",
            "Tunnel de réservation 5 étapes",
            "Événements spéciaux multi-jours &amp; forfaits",
            "Espaces VIP Beach Club (transats, balinés)",
            "Galerie photo publique",
            "Formulaire Corporate",
            "Pré-enregistrement &amp; Pass d'embarquement",
            "Wi-Fi invité",
        ]),
        ("Back-office staff — 7 rôles", [
            "Authentification &amp; matrice RBAC",
            "Tableau de bord (KPIs &amp; activité par pôle)",
            "Réservations (filtres, calendrier, drawer)",
            "Paiements &amp; FineoPay",
            "CRM Clients",
            "Hébergement (occupation des chambres)",
            "Le Kaai (gestion des tables)",
            "Embarquement &amp; Traversées",
            "Scanner QR",
            "Consommation sur place (wallet)",
            "Chiffre d'affaires &amp; analytics",
            "Reçus fiscaux",
            "Événements spéciaux (CRUD)",
            "Demandes Corporate",
            "Pré-enregistrements",
            "Galerie photo (gestion)",
            "Notifications Twilio &amp; SMS",
            "Configuration utilisateurs &amp; rôles",
            "Feedback clients",
        ]),
        ("Intégrations tierces", [
            "FineoPay — paiement en ligne",
            "Twilio — SMS et WhatsApp transactionnels",
            "SendGrid — emails brandés (billets, reçus, PDF)",
        ]),
        ("Profil technique", [
            "Stack, métriques, RBAC, perspectives",
        ]),
    ]

    for sec_title, items in sections:
        flow.append(Paragraph(sec_title, ParagraphStyle("toc_s", parent=s_h3,
                                                       fontSize=11, textColor=INK,
                                                       spaceBefore=8, spaceAfter=3)))
        for it in items:
            flow.append(Paragraph(f"&nbsp;&nbsp;&nbsp;<font color='#B8922A'>·</font>&nbsp;&nbsp;{it}",
                                 ParagraphStyle("toc_i", parent=s_body, fontSize=9.2,
                                                leading=14, leftIndent=8,
                                                textColor=colors.HexColor("#333"))))
    flow.append(PageBreak())
    return flow


# ----------------------------- Build doc -----------------------------
def build():
    doc = SimpleDocTemplate(
        str(OUTPUT), pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2.4 * cm,
        title="Boulay Beach Resort — Présentation fonctionnelle",
        author="Boulay Beach Resort",
    )
    story = []

    # 1) Cover
    story += build_cover()

    # 2) TOC
    story += build_toc()

    # 3) Intro
    story.append(Paragraph("À propos de l'application", s_h1))
    story.append(gold_divider())
    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "Cette plateforme est une solution <b>full-stack moderne</b> conçue spécifiquement "
        "pour Boulay Beach Resort, resort 5★ d'Abidjan accessible uniquement par bateau. Elle "
        "réunit en un seul système les expériences <b>clients</b> (site public de réservation) "
        "et <b>personnel</b> (back-office d'exploitation), avec une cohérence visuelle 5★ "
        "(typographie Playfair, accents or #B8922A, photos haute définition) du début à la fin.",
        s_lead))
    story.append(Paragraph(
        "Côté technique : React 19, FastAPI, MongoDB. Trois intégrations en production : "
        "<b>FineoPay</b> pour les paiements en ligne, <b>Twilio</b> pour les notifications "
        "SMS &amp; WhatsApp, <b>SendGrid</b> pour les emails transactionnels. "
        "Tickets PNG + reçus PDF brandés sont générés à la volée, avec QR codes uniques "
        "scannables sur place.", s_lead))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Chiffres clés", s_h3))
    kpi_data = [
        ["~13 200", "lignes de code", "backend Python (FastAPI)"],
        ["~26 000", "lignes de code", "frontend React + JSX"],
        ["+ de 200", "endpoints API", "REST sous /api/*"],
        ["7", "rôles RBAC", "admin · manager · manager_pole · hôtesse · …"],
        ["5", "pôles métier", "Beach Club · Hébergement · Corporate · Activités · Kaai"],
    ]
    kpi_rows = []
    for k, v, sub in kpi_data:
        kpi_rows.append([
            Paragraph(f"<font color='#B8922A' size='15'><b>{k}</b></font>",
                     ParagraphStyle("kpi_n", parent=s_body, alignment=0)),
            Paragraph(f"<b>{v}</b><br/><font color='#666' size='8'>{sub}</font>",
                     ParagraphStyle("kpi_l", parent=s_body, fontSize=9.5)),
        ])
    kpi_table = Table(kpi_rows, colWidths=[3.5 * cm, 12.5 * cm])
    kpi_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 0), (-1, -1), CREAM),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, LIGHT),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
    ]))
    story.append(kpi_table)
    story.append(PageBreak())

    # ============================================================
    # PUBLIC PORTAL
    # ============================================================
    story.append(Paragraph("Section A", ParagraphStyle("sect", parent=s_tag, alignment=1,
                                                     fontSize=9, textColor=GOLD)))
    story.append(Paragraph("Portail public", ParagraphStyle("sect_t", parent=s_h1,
                                                           alignment=1, fontSize=30)))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "L'expérience client web — du landing à la confirmation de paiement.",
        ParagraphStyle("sect_d", parent=s_lead, alignment=1, fontSize=12,
                       textColor=colors.HexColor("#555"))))
    story.append(Spacer(1, 1.5 * cm))
    story.append(PageBreak())

    story += section(
        "Page d'accueil",
        "A.1 — LANDING",
        ["La porte d'entrée du resort. Une vidéo hero immersive, un menu de pôles cliquables, et un encart « En exclusivité » configurable depuis le back-office pour mettre en avant un événement ou une offre spéciale du moment."],
        features=[
            "Vidéo hero plein écran + slogan « Life Is Here »",
            "Pôles cliquables (Beach Club, Hébergement, Corporate, Activités, Le Kaai)",
            "Encart « En exclusivité » dynamique pointant vers un événement, une offre, une activité ou une URL personnalisée",
            "Bandeau d'événements spéciaux mis en avant",
            "Bascule FR / EN dans le header",
        ],
        screenshot="01_landing.png",
        screenshot_caption="Capture : LandingPage avec les 5 pôles et l'encart En exclusivité.",
    )

    for tag, title, name, desc, feats in [
        ("A.2 — POLE", "Pôle Beach Club", "02_pole_beachclub.png",
         "Le pôle plage du resort : Day Pass (Lun-Ven), Sunset Experience (Sam) et Brunch Boulay (Dim). Chaque sous-offre a sa propre page de détail et son tunnel de réservation.",
         ["3 sous-offres avec photos hero", "Tarification adulte/enfant", "Horaires de bateaux automatiques", "Accès direct au tunnel de réservation"]),
        ("A.3 — POLE", "Pôle Hébergement", "03_pole_hebergement.png",
         "Suites premium accessibles uniquement par bateau. Sélection des dates, du nombre de chambres et du type de suite (3 tiers : Supérieure, Suite Jardin, Suite Lagune).",
         ["3 tiers de chambres avec inventaire géré", "Calendrier dates arrivée/départ", "Bateau aller + bateau retour", "Acompte 10 % / 30 % / 70 % ou paiement total"]),
        ("A.4 — POLE", "Pôle Corporate", "04_pole_corporate.png",
         "Pour les entreprises et événements professionnels. Pas de réservation directe : un formulaire de demande commerciale est envoyé à l'équipe BBr qui rappelle le prospect.",
         ["5 sous-offres : Séminaire, Journée d'étude, Team Building, Déjeuner/Dîner entreprise, Formule personnalisée", "Email de notification commerciale automatique avec template branded", "Pipeline de suivi staff (new → in_progress → won/lost)"]),
        ("A.5 — POLE", "Pôle Activités & Événements", "05_pole_activites.png",
         "Le pôle « Wow » du resort : événements thématiques, activités à la carte, expériences sur mesure. Inclut les événements spéciaux multi-jours (voir A.8).",
         ["Sous-offres : Spa & Wellness, Activités nautiques, Événements maison, Privatisation", "Lien direct vers le catalogue d'événements publiés"]),
        ("A.6 — POLE", "Pôle Le Kaai", "06_pole_kaai.png",
         "Le restaurant gastronomique du resort. Réservation de table sans paiement en ligne — le règlement se fait sur place.",
         ["Réservation de table 7j/7", "Choix du nombre de couverts", "Horaires de service midi & soir"]),
        ("A.7 — TUNNEL", "Tunnel de réservation 5 étapes", "07_booking_pass_day.png",
         "Le cœur de l'expérience client. 5 étapes guidées (date, convives, coordonnées, récap, paiement) avec progression visuelle gold, validations en temps réel et confirmation immédiate par email.",
         ["Étape 1 : sélection de la/des date(s), capacité en temps réel", "Étape 2 : compteurs adultes / enfants ou type de chambre", "Étape 3 : un billet par adulte, espaces VIP (transats/balinés), privatisation bateau", "Étape 4 : récap chiffré avec breakdown ligne par ligne", "Étape 5 : paiement carte (FineoPay), Mobile Money, ou espèces à confirmer sur place"]),
        ("A.8 — EVENT", "Événements spéciaux & forfaits", "08_event_detail.png",
         "Événements monothématiques ou multi-jours (ex. World Cup Opening) avec forfaits premium (Standard Premium, Premium Experience) à prix fixe par capacité (1 à 7 pers.). Refonte récente : un clic sur le forfait l'active automatiquement.",
         ["Programme jour par jour avec descriptions personnalisées", "Forfaits cliquables à prix fixe (non multiplié par tête)", "Compteur « Nombre de personnes » + répartition adultes/enfants", "Cumul de plusieurs forfaits et dates dans un seul panier", "Modal « Voir le contenu » pour le détail du forfait"]),
        ("A.9 — VIP", "Espaces VIP Beach Club", "07_booking_pass_day.png",
         "Sur les offres Beach Club uniquement, le client peut réserver un transat numéroté (T01-T12 à 10 000 FCFA) ou un baliné privatif (B01-B04 à 50 000 FCFA). Chaque espace est unique par date — la grille affiche en direct ceux déjà réservés.",
         ["12 transats numérotés + 4 balinés", "Unicité garantie par date (HTTP 409 sur double-réservation)", "UI tactile avec badges 'Réservé' en line-through", "Sous-total dynamique en or"]),
        ("A.10 — GALERIE", "Galerie photo publique", "09_gallery.png",
         "Vitrine 100 % gérée par le staff. Albums créés à la main, photos uploadées explicitement. Lightbox plein écran avec téléchargement libre des originaux.",
         ["Albums manuels créés par le staff", "Lightbox plein écran avec navigation clavier", "Téléchargement libre des originaux", "Pagination « Charger plus »"]),
        ("A.11 — CORPO", "Formulaire Corporate", "10_corporate_form.png",
         "Pour les leads B2B. 8 champs (entreprise, secteur, description, date souhaitée, head-count, correspondant, téléphone, email). Notification email instantanée à l'équipe commerciale.",
         ["8 champs cohérents avec le pipeline staff", "Email branded vers contact@boulaybeachresort.com", "Reply-to = email du contact pour réponse directe"]),
        ("A.12 — REG", "Pré-enregistrement (Pass d'embarquement)", "11_enregistrement.png",
         "Auto-check-in côté client : remplir nom, nationalité, photo, expérience attendue, et recevoir un QR-Pass à présenter à l'embarcadère. Scannable directement par le staff (intègre l'embarquement à un bateau du jour).",
         ["Formulaire enrichi (préférences, expérience attendue)", "QR-Pass envoyé par email + WhatsApp", "Scanner staff reconnaît le QR Pass et propose l'embarquement"]),
        ("A.13 — WIFI", "Page Wi-Fi invité", "12_wifi.png",
         "Page d'accueil servie sur le réseau Wi-Fi du resort. SSID + mot de passe à un clic.",
         ["SSID copiable", "Bouton 'Connect' avec QR Wi-Fi"]),
    ]:
        story += section(title, tag,
                         [desc],
                         features=feats,
                         screenshot=name,
                         screenshot_caption=f"Capture : {title}.")
        story.append(PageBreak())

    # ============================================================
    # STAFF
    # ============================================================
    story.append(Paragraph("Section B", ParagraphStyle("sect", parent=s_tag, alignment=1,
                                                     fontSize=9, textColor=GOLD)))
    story.append(Paragraph("Back-office staff", ParagraphStyle("sect_t", parent=s_h1,
                                                              alignment=1, fontSize=30)))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "L'application opérationnelle utilisée par les équipes de BBR au quotidien.",
        ParagraphStyle("sect_d", parent=s_lead, alignment=1, fontSize=12,
                       textColor=colors.HexColor("#555"))))
    story.append(Spacer(1, 0.8 * cm))
    story.append(Paragraph(
        "<b>7 rôles RBAC :</b> admin · manager · manager_pole (limité à un pôle) · "
        "hôtesse · serveur/caisse · logistique · management_general (lecture seule). "
        "Chaque utilisateur peut être restreint à un sous-ensemble de sections par admin.",
        ParagraphStyle("sect_d", parent=s_lead, alignment=1, fontSize=10,
                       textColor=colors.HexColor("#666"))))
    story.append(PageBreak())

    for tag, title, name, desc, feats in [
        ("B.1 — TDB", "Tableau de bord", "20_staff_dashboard.png",
         "Vue d'ensemble en temps réel : réservations du jour, embarquements à venir, KPIs financiers, alertes opérationnelles, satisfaction client (note moyenne + NPS).",
         ["4 KPIs principaux (réservations, convives, CA, taux d'occupation)", "Planning de la journée + alertes", "Activité 30 derniers jours par pôle (5 tuiles cliquables)", "Note moyenne + NPS sur 90 j roulants"]),
        ("B.2 — RES", "Réservations", "21_staff_reservations.png",
         "Toutes les réservations classées par pôle. Onglets pour basculer (Beach Club / Hébergement / etc.), filtres période + recherche, vue Liste ou Calendrier, drawer détail avec actions.",
         ["Tabs par pôle avec badge", "Vue Liste ou Calendrier", "Drawer détail (paiement, embarquement, contact, notes)", "Action 'Renvoyer le billet' via email", "Filtres date précise + période"]),
        ("B.3 — PAY", "Paiements & FineoPay", "22_staff_payments.png",
         "Gestion des paiements impayés, encaissement espèces, génération de liens FineoPay à envoyer par WhatsApp/email. Statut 'Espèces à encaisser' avec confirmation explicite par le staff.",
         ["Liste des bookings en attente d'encaissement", "Bouton 'Générer lien FineoPay' (copie clipboard + nouvel onglet)", "Bouton 'Confirmer l'encaissement' qui valide et envoie le ticket gold définitif", "Statut 'pending_cash_payment' avec badge ambré"]),
        ("B.4 — CRM", "Clients (CRM)", "23_staff_clients.png",
         "Vue agrégée de tous les clients ayant réservé. Fiche détaillée avec historique complet (réservations, paiements, embarquements, feedback).",
         ["Recherche full-text (nom, téléphone, email)", "Fiche client avec timeline complète", "Export CSV"]),
        ("B.5 — HEB", "Hébergement (occupation)", "24_staff_hebergement.png",
         "Vue calendrier mensuel coloré (Or = Suite Lagune, Vert = Suite Jardin, Bleu = Supérieure). 26 chambres physiques nommées. Panneau Arrivées + Départs du jour basé sur les horaires de bateau.",
         ["Calendrier mensuel avec navigation", "Code couleur par tier", "Panneau Arrivées (boat_time aller) + Départs (boat_time retour)", "Assignation explicite d'une chambre physique à un booking", "Inventaire : 20 chambres Supérieures + 6 Suites"]),
        ("B.6 — KAAI", "Le Kaai (tables)", "25_staff_kaai.png",
         "Gestion des 36 tables du restaurant : zones (Salle, Terrasse, Bord de mer), CRUD, vue jour avec sélecteur date, assignation d'une table à un booking en un clic.",
         ["36 tables seedées par zone", "Vue jour avec sélecteur de date", "Glisser-déposer pour réassigner", "Libération automatique en fin de service"]),
        ("B.7 — EMB", "Embarquement & Traversées", "26_staff_embarquement.png",
         "Gestion des bateaux et de leurs traversées : CRUD bateaux (capacité, prix de privatisation), programmation des traversées (aller-retour automatique), embarquement 1 clic.",
         ["CRUD bateaux + statut maintenance", "Programmation traversée avec retour auto", "Embarquement 1-clic depuis le scanner", "Suivi du skipper en charge"]),
        ("B.8 — SCAN", "Scanner QR", "27_staff_scanner.png",
         "Scan caméra plein écran (html5-qrcode) + saisie manuelle. Reconnaît 3 types de QR : billet, pass d'embarquement, wallet de consommation. Anti-rebond, override de bateau si nécessaire, traçabilité skipper.",
         ["Scan caméra + saisie manuelle", "Reconnaît billet / pass d'enregistrement / wallet", "Override possible du bateau si client embarque sur le suivant", "Champ skipper avec auto-complétion"]),
        ("B.9 — CONS", "Consommation sur place (wallet)", "28_staff_activites.png",
         "Carte de consommation digitale : le client scanne son QR à chaque commande. Le staff ajoute les items du catalogue (boissons, restauration, espaces privatifs, activités). Solde affiché en direct. Validation du paiement à la clôture obligatoire (espèces / carte / Mobile Money).",
         ["Catalogue d'items configurables (135+ par défaut)", "Ajout en quelques tap, solde live", "Clôture avec choix méthode de paiement obligatoire", "Reçu fiscal consolidé émis automatiquement"]),
        ("B.10 — REV", "Chiffre d'affaires", "29_staff_revenue.png",
         "Analytics financières complètes : KPIs revenus + panier moyen, graphique d'évolution journalière, répartition par offre / pôle / méthode de paiement, top 10 clients. Filtres jour/semaine/mois/année.",
         ["Graphique LineChart évolution quotidienne", "BarChart répartition par offre", "PieChart par méthode de paiement", "Top 10 clients par CA", "Section 'Répartition par pôle' avec barres horizontales triées"]),
        ("B.11 — REC", "Reçus fiscaux", "30_staff_receipts.png",
         "Liste des reçus fiscaux émis (sources : booking, activity, wallet_settlement, event). Filtres par pôle (5 tuiles cliquables), période, source. Téléchargement PDF avec logo BBr intégré.",
         ["Liste paginée + filtres", "Répartition par pôle avec tuiles couleurs", "Téléchargement PDF avec logo BBr", "Export CSV"]),
        ("B.12 — EVT", "Événements spéciaux (CRUD)", "31_staff_events.png",
         "Création/édition complète des événements : titre, sous-titre, description, image (upload base64 + URL), dates, capacité, horaires de bateaux, statut, fenêtre d'activation, mise en avant. Builder de programme jour par jour + sous-builder de forfaits.",
         ["Grille de cartes événements", "Upload image direct (drag & drop)", "Programme multi-jour avec dates + titre + description par jour", "Sous-builder de forfaits (prix flat + max_persons)", "Actions Publier / Mettre en avant / Dupliquer / Supprimer"]),
        ("B.13 — CORPO", "Demandes Corporate", "32_staff_corporate.png",
         "Pipeline des leads B2B avec recherche, filtres période/statut/offre. Transitions de statut en un clic (new → in_progress → won/lost), notes, suppression admin.",
         ["Recherche full-text", "Filtres pole / statut / période", "Cards avec accordéons", "Workflow new → in_progress → won/lost"]),
        ("B.14 — REG", "Pré-enregistrements", "33_staff_registrations.png",
         "Vue de tous les pré-enregistrements clients (pass d'embarquement). Filtres date précise + période, exports CSV / Excel / PDF.",
         ["Filtres date + période + recherche", "Exports CSV, Excel, PDF brandés", "Liens vers scan staff"]),
        ("B.15 — GAL", "Galerie photo (gestion)", "34_staff_gallery.png",
         "Création et gestion des albums photos. Drag & drop multi-fichiers, déduplication SHA-256, thumbnails JPEG auto.",
         ["Albums manuels", "Drag & drop multi-fichiers (max 15 Mo)", "Thumbnails 1200 px auto", "Suppression admin/manager", "Lien rapide 'Voir page publique'"]),
        ("B.16 — NOTIF", "Notifications Twilio", "35_staff_notifications.png",
         "Centre de notifications transactionnelles. Envoi de test, lancement manuel des jobs J-1 (rappel veille) et J+1 (feedback lendemain), historique des envois avec statut.",
         ["Test d'envoi vers un numéro", "Trigger manuel J-1 (cron 17:00 UTC) et J+1 (cron 10:00 UTC)", "Historique avec canal (SMS/WhatsApp), statut coloré", "Mode trial_safe pour le sandbox Twilio"]),
        ("B.17 — CONFIG", "Configuration utilisateurs & rôles", "36_staff_config.png",
         "Gestion CRUD des utilisateurs staff avec leur rôle et pôle d'affectation. Modale 'Sections' par utilisateur pour restreindre la sidebar à un sous-ensemble de 25 modules.",
         ["CRUD utilisateurs avec 7 rôles + 2 legacy", "Pôle d'affectation pour manager_pole", "Override granulaire des sections visibles par utilisateur", "Panneau 'En exclusivité' (configurer l'encart landing)"]),
        ("B.18 — FB", "Feedback clients", "37_staff_feedback.png",
         "Tableau de bord de la satisfaction : 6 critères notés (accueil, service, restauration, ambiance, propreté, expérience globale), score NPS, tendance dans le temps, ventilation par type d'offre.",
         ["6 critères de notation", "NPS automatique calculé sur la distribution", "Tendance trimestrielle", "Filtres période + offre"]),
    ]:
        story += section(title, tag,
                         [desc],
                         features=feats,
                         screenshot=name,
                         screenshot_caption=f"Capture : {title}.")
        story.append(PageBreak())

    # ============================================================
    # INTEGRATIONS
    # ============================================================
    story.append(Paragraph("Section C", ParagraphStyle("sect", parent=s_tag, alignment=1,
                                                     fontSize=9, textColor=GOLD)))
    story.append(Paragraph("Intégrations tierces", ParagraphStyle("sect_t", parent=s_h1,
                                                                 alignment=1, fontSize=30)))
    story.append(Spacer(1, 1.5 * cm))

    story += section(
        "FineoPay — paiement en ligne",
        "C.1 — PAIEMENT",
        ["Passerelle de paiement marchande pour la Côte d'Ivoire. Le client est redirigé vers une page hostée FineoPay (carte bancaire, Mobile Money), puis revient sur une page de résultat qui poll le statut toutes les 2,5 s. Webhook S2S sécurisé par secret en query string."],
        features=[
            "3 endpoints : checkout (booking / wallet / deposit), status, webhook",
            "Idempotence via syncRef = BBR-{intent}-{booking_id}",
            "Collection fineo_payments pour la traçabilité complète",
            "Émission automatique du reçu fiscal après confirmation",
            "Helper _settle_payment commun aux 3 intents",
        ])
    story.append(Spacer(1, 0.5 * cm))

    story += section(
        "Twilio — SMS & WhatsApp",
        "C.2 — NOTIFICATIONS",
        ["Notifications transactionnelles : confirmation de paiement, rappel J-1, feedback J+1. WhatsApp prioritaire avec fallback SMS automatique. Templates FR avec ton resort luxe."],
        features=[
            "WhatsApp prioritaire, SMS en fallback",
            "Normalisation E.164 (default +225)",
            "APScheduler async pour les jobs J-1 (17:00 UTC) et J+1 (10:00 UTC)",
            "Collection twilio_messages pour l'audit",
            "Mode trial_safe pour le sandbox",
        ])
    story.append(Spacer(1, 0.5 * cm))

    story += section(
        "SendGrid — Emails transactionnels",
        "C.3 — EMAILS",
        ["Tous les emails du parcours client : confirmation de réservation, ticket QR en pièce jointe, reçu fiscal PDF, demande Corporate, mot de passe oublié, etc. Templates HTML brandés BBR."],
        features=[
            "Templates HTML branded gold/cream + logo SVG",
            "Pièces jointes PNG (ticket) et PDF (reçu fiscal + livret BBR)",
            "Reply-to dynamique pour les leads commerciaux",
            "Best-effort : échec d'envoi n'interrompt jamais la transaction",
        ])
    story.append(PageBreak())

    # ============================================================
    # TECHNICAL PROFILE
    # ============================================================
    story.append(Paragraph("Section D", ParagraphStyle("sect", parent=s_tag, alignment=1,
                                                     fontSize=9, textColor=GOLD)))
    story.append(Paragraph("Profil technique", ParagraphStyle("sect_t", parent=s_h1,
                                                             alignment=1, fontSize=30)))
    story.append(Spacer(1, 1.5 * cm))

    story.append(Paragraph("Stack & architecture", s_h3))
    tech = [
        ("Frontend", "React 19, React Router 7, TailwindCSS 3.4, shadcn/ui, framer-motion, sonner, lucide-react, html5-qrcode, date-fns"),
        ("Backend", "FastAPI 0.110, Motor (Mongo async), Pydantic 2, APScheduler, Pillow, qrcode, ReportLab, httpx, bcrypt, PyJWT"),
        ("Base de données", "MongoDB (collections : bookings, staff, special_events, gallery_albums, vip_spaces, traversees, wallets, receipts, registrations, …)"),
        ("Notifications", "APScheduler (jobs J-1 17:00 UTC, J+1 10:00 UTC, FineoPay sweeper 30s)"),
        ("Sécurité", "JWT bcrypt staff auth, RBAC granulaire 7 rôles, middleware HTTP lecture-seule pour management_general, idempotence webhooks"),
        ("PDF & images", "ReportLab pour reçus/billets/exports, Pillow pour la composition du ticket gold avec QR, logo CDN cached"),
    ]
    rows = []
    for k, v in tech:
        rows.append([
            Paragraph(f"<b>{k}</b>", s_body),
            Paragraph(v, s_body),
        ])
    t = Table(rows, colWidths=[3.5 * cm, 12.5 * cm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, -1), CREAM),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, LIGHT),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.8 * cm))

    story.append(Paragraph("Roadmap future", s_h3))
    roadmap = [
        "Application mobile native (Capacitor / TWA) — accessibilité Apple Store & Play Store",
        "Carte de fidélité BBR (Silver / Gold / Platinum) avec points cumulés et récompenses configurables",
        "Multi-devise FCFA / EUR pour les clients internationaux",
        "Alertes d'upsell automatiques à 90 % d'occupation",
        "Bundles / packs d'activités groupées dans le catalogue",
        "Intégration Orchestra PMS / POS pour synchronisation comptable",
    ]
    for r in roadmap:
        story.append(Paragraph(f"<font color='#B8922A'>•</font>&nbsp;&nbsp;{r}",
                             ParagraphStyle("rdm", parent=s_body, fontSize=10, leading=15)))
    story.append(Spacer(1, 1.5 * cm))
    story.append(gold_divider())
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph(
        "<i>Document généré automatiquement à partir de la base de code et des captures "
        f"d'écran en direct depuis l'environnement Preview, le {date.today().strftime('%d %B %Y')}.</i>",
        ParagraphStyle("foot", parent=s_caption, alignment=1)))

    doc.build(story, onFirstPage=page_footer, onLaterPages=page_footer)
    print(f"PDF written: {OUTPUT}  ({OUTPUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    build()
