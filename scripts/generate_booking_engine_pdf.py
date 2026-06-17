"""Generate the BBR Booking Engine specification PDF.

Outputs:  /app/frontend/public/BBR_Booking_Engine.pdf
"""
import io
import urllib.request
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle,
    PageBreak, ListFlowable, ListItem, Preformatted,
    PageTemplate, Frame,
)
from reportlab.platypus.flowables import HRFlowable
from reportlab.platypus.doctemplate import NextPageTemplate
from reportlab.pdfgen import canvas as rl_canvas

GOLD = colors.HexColor("#B8922A")
GOLD_SOFT = colors.HexColor("#D4B256")
GOLD_PALE = colors.HexColor("#F4ECDA")
INK = colors.HexColor("#0A0A0A")
SUB = colors.HexColor("#5F6670")
CREAM = colors.HexColor("#FAF7F2")
CODE_BG = colors.HexColor("#F5F2EC")
CODE_BORDER = colors.HexColor("#D4B256")

BBR_LOGO_URL = ("https://customer-assets.emergentagent.com/job_reserve-bbr/"
                "artifacts/2p8ulkeu_LOGO_BBr_VF_Plan_de_travail_1-"
                "removebg-preview.png")

DIAG = "/app/manual_assets/booking_engine"
OUTPUT = "/app/frontend/public/BBR_Booking_Engine.pdf"


def fetch_logo_bytes():
    try:
        req = urllib.request.Request(BBR_LOGO_URL,
                                     headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.read()
    except Exception:
        return None


def cover_canvas(canvas: rl_canvas.Canvas, doc):
    w, h = A4
    canvas.saveState()
    canvas.setFillColor(INK)
    canvas.rect(0, 0, w, h, stroke=0, fill=1)
    canvas.setFillColor(GOLD)
    canvas.rect(0, h - 0.4 * cm, w, 0.4 * cm, stroke=0, fill=1)
    canvas.rect(0, 0, w, 0.4 * cm, stroke=0, fill=1)
    canvas.restoreState()


def interior_canvas(canvas: rl_canvas.Canvas, doc):
    w, h = A4
    canvas.saveState()
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(1.2)
    canvas.line(2 * cm, h - 1.2 * cm, w - 2 * cm, h - 1.2 * cm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(SUB)
    canvas.drawString(2 * cm, 1.2 * cm,
                      "Boulay Beach Resort  ·  Booking Engine — Spécifications fonctionnelles")
    canvas.drawRightString(w - 2 * cm, 1.2 * cm, f"Page {doc.page}")
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(GOLD)
    canvas.drawString(w - 2 * cm - 6.5 * cm, h - 1.5 * cm,
                      "CONFIDENTIEL — PRODUIT & TECHNIQUE")
    canvas.restoreState()


def make_styles():
    base = getSampleStyleSheet()
    return {
        "cover_brand": ParagraphStyle(
            "cover_brand", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=10, leading=14, textColor=GOLD_SOFT, alignment=1,
            spaceAfter=18),
        "cover_title": ParagraphStyle(
            "cover_title", parent=base["Title"], fontName="Helvetica-Bold",
            fontSize=36, leading=42, textColor=colors.white, alignment=1,
            spaceAfter=10),
        "cover_engine": ParagraphStyle(
            "cover_engine", parent=base["Title"], fontName="Helvetica-Bold",
            fontSize=46, leading=52, textColor=GOLD, alignment=1,
            spaceAfter=14),
        "cover_sub": ParagraphStyle(
            "cover_sub", parent=base["Normal"], fontName="Helvetica",
            fontSize=13, leading=18, textColor=colors.HexColor("#E5D9C0"),
            alignment=1, spaceAfter=8),
        "cover_meta": ParagraphStyle(
            "cover_meta", parent=base["Normal"], fontName="Helvetica",
            fontSize=9, leading=13, textColor=colors.HexColor("#9C9690"),
            alignment=1),
        "h1": ParagraphStyle(
            "h1", parent=base["Heading1"], fontName="Helvetica-Bold",
            fontSize=22, leading=28, textColor=INK, spaceAfter=6),
        "h1_kicker": ParagraphStyle(
            "h1_kicker", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=9, leading=12, textColor=GOLD, spaceAfter=2,
            letterSpacing=2),
        "h2": ParagraphStyle(
            "h2", parent=base["Heading2"], fontName="Helvetica-Bold",
            fontSize=14, leading=18, textColor=INK, spaceBefore=14,
            spaceAfter=6),
        "h3": ParagraphStyle(
            "h3", parent=base["Heading3"], fontName="Helvetica-Bold",
            fontSize=11, leading=14, textColor=GOLD, spaceBefore=10,
            spaceAfter=4),
        "body": ParagraphStyle(
            "body", parent=base["BodyText"], fontName="Helvetica",
            fontSize=10, leading=14.5, textColor=INK, spaceAfter=6,
            alignment=4),
        "lead": ParagraphStyle(
            "lead", parent=base["BodyText"], fontName="Helvetica",
            fontSize=11, leading=16, textColor=INK, spaceAfter=10,
            alignment=4),
        "caption": ParagraphStyle(
            "caption", parent=base["Normal"], fontName="Helvetica-Oblique",
            fontSize=8.5, leading=11, textColor=SUB, alignment=1,
            spaceAfter=12, spaceBefore=4),
        "note_label": ParagraphStyle(
            "note_label", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=8.5, leading=11, textColor=GOLD, spaceAfter=2),
        "code": ParagraphStyle(
            "code", parent=base["Code"], fontName="Courier",
            fontSize=8, leading=10, textColor=INK, leftIndent=10,
            rightIndent=10, spaceBefore=4, spaceAfter=4,
            backColor=CODE_BG, borderColor=CODE_BORDER, borderWidth=0.5,
            borderPadding=6),
        "toc": ParagraphStyle(
            "toc", parent=base["Normal"], fontName="Helvetica",
            fontSize=10.5, leading=20, textColor=INK, leftIndent=12),
    }


def hero_image(path, max_width_cm=16, max_height_cm=20, bordered=True):
    img = Image(path)
    iw, ih = img.imageWidth, img.imageHeight
    ratio = min(max_width_cm * cm / iw, max_height_cm * cm / ih)
    img.drawWidth = iw * ratio
    img.drawHeight = ih * ratio
    if not bordered:
        img.hAlign = "CENTER"
        return img
    t = Table([[img]], colWidths=[img.drawWidth], rowHeights=[img.drawHeight])
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.6, GOLD),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    t.hAlign = "CENTER"
    return t


def info_box(title, body, styles, bg=CREAM):
    inner = [
        Paragraph(f"<b>{title}</b>", styles["note_label"]),
        Paragraph(body, styles["body"]),
    ]
    t = Table([[inner]], colWidths=[16.4 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 0.5, GOLD),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def code_block(text, styles):
    return Preformatted(text, styles["code"])


def table_grid(rows, col_widths=None, header=True):
    n_cols = len(rows[0])
    if col_widths is None:
        col_widths = [16.4 * cm / n_cols] * n_cols
    style = [
        ("FONT", (0, 0), (-1, -1), "Helvetica", 8.5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#D4D4D4")),
        ("BOX", (0, 0), (-1, -1), 0.5, GOLD),
    ]
    if header:
        style.extend([
            ("BACKGROUND", (0, 0), (-1, 0), GOLD),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 8.5),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GOLD_PALE]),
        ])
    t = Table(rows, colWidths=col_widths, repeatRows=1 if header else 0)
    t.setStyle(TableStyle(style))
    return t


# ── COVER + TOC + EXEC SUMMARY ──────────────────────────────────────
def build_cover(styles):
    el = [Spacer(1, 3.5 * cm)]
    logo_bytes = fetch_logo_bytes()
    if logo_bytes:
        img = Image(io.BytesIO(logo_bytes))
        iw, ih = img.imageWidth, img.imageHeight
        target_h = 2.8 * cm
        img.drawHeight = target_h
        img.drawWidth = iw * (target_h / ih)
        img.hAlign = "CENTER"
        el.append(img)
    el.append(Spacer(1, 1.2 * cm))
    el.append(Paragraph("BOULAY  ·  BEACH  ·  RESORT", styles["cover_brand"]))
    el.append(Paragraph("BBR", styles["cover_title"]))
    el.append(Paragraph("Booking Engine", styles["cover_engine"]))
    el.append(Spacer(1, 0.4 * cm))
    el.append(HRFlowable(width=4 * cm, thickness=1, color=GOLD,
                         hAlign="CENTER", spaceBefore=0, spaceAfter=18))
    el.append(Paragraph("Spécifications fonctionnelles & techniques",
                        styles["cover_sub"]))
    el.append(Paragraph("Moteur de réservation unifié multi-produits",
                        styles["cover_sub"]))
    el.append(Spacer(1, 3 * cm))
    months_fr = ["janvier", "février", "mars", "avril", "mai", "juin",
                 "juillet", "août", "septembre", "octobre", "novembre",
                 "décembre"]
    now = datetime.now()
    el.append(Paragraph(
        f"Version 1.0 · Édition {months_fr[now.month - 1]} {now.year}",
        styles["cover_meta"]))
    el.append(Spacer(1, 0.3 * cm))
    el.append(Paragraph(
        "Document confidentiel — Produit & Technique",
        styles["cover_meta"]))
    return el


def build_toc(styles):
    el = [
        Paragraph("SOMMAIRE", styles["h1_kicker"]),
        Paragraph("Table des matières", styles["h1"]),
        Spacer(1, 0.6 * cm),
    ]
    entries = [
        ("Résumé exécutif", "4"),
        ("§1 — Architecture du Booking Engine", "6"),
        ("§2 — Flux fonctionnels (8 types de réservation)", "9"),
        ("§3 — Wireframes du tunnel de réservation", "13"),
        ("§4 — Modèle de données du Booking Engine", "16"),
        ("§5 — API REST détaillées (Swagger)", "20"),
        ("§6 — Règles métier (annulation, no-show, reprog.)", "26"),
        ("§7 — Gestion des disponibilités", "28"),
        ("§8 — Gestion des paiements", "30"),
        ("§9 — Gestion des QR Codes", "33"),
        ("§10 — Plan d'intégration PMS + OTA", "35"),
        ("Annexe A — Espace client", "38"),
        ("Annexe B — Dashboard interne", "39"),
        ("Annexe C — Contrôle d'accès (scanner)", "40"),
        ("Annexe D — KPIs et analytics", "41"),
    ]
    rows = [[Paragraph(f"<b>{n}</b>", styles["toc"]),
             Paragraph(f"<para alignment='right'>p. {p}</para>", styles["toc"])]
            for n, p in entries]
    t = Table(rows, colWidths=[13.5 * cm, 2.9 * cm])
    t.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#E0DCC8")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    el.append(t)
    return el


def build_exec_summary(styles):
    return [
        Paragraph("RÉSUMÉ EXÉCUTIF", styles["h1_kicker"]),
        Paragraph("Un seul moteur, toutes les ventes", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Le <b>Booking Engine BBR</b> est le cœur transactionnel de la "
            "plateforme Revenue Engine. C'est lui qui transforme un visiteur "
            "intéressé en client payant — pour <b>n'importe quel produit "
            "BBr</b>&nbsp;: hébergement, beach club, activités nautiques, "
            "événements privés, séminaires corporate ou cartes de fidélité.",
            styles["lead"],
        ),
        Paragraph("Objectifs mesurables", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Taux de conversion tunnel ≥ 32%</b> (vs ~12% en moyenne "
                "hôtelière). Atteint grâce à un tunnel optimisé en 7 étapes, "
                "upsell/cross-sell intelligent et zéro friction de paiement.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Panier moyen +18%</b> grâce aux options additionnelles "
                "automatiques (Sunset, Brunch, Jet Ski, transfert, massage).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Zéro double-réservation</b> via verrouillage atomique "
                "d'inventory et hold panier 5 min.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Délai de confirmation &lt; 4 sec</b> entre paiement validé "
                "et QR + ticket PDF + Email + WhatsApp reçus par le client.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Capacité ≥ 50 000 réservations/mois</b> sur architecture "
                "actuelle (palier 1 du plan de scalabilité).",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        Paragraph("Principes directeurs", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Une seule source de vérité</b> — toutes les ventes "
                "(directes, OTA, manuelles, corporate) transitent par le "
                "même moteur. Pas de silo.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Mobile-first</b> — 73% des bookings BBr se font sur "
                "smartphone. Le tunnel est conçu pour fonctionner parfaitement "
                "sur un écran de 5 pouces.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Paiement local-first</b> — Wave, Orange Money, MTN Money "
                "et Moov Money intégrés en priorité (90% des transactions "
                "en Côte d'Ivoire). Cartes en complément.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Idempotent et auditable</b> — chaque réservation possède "
                "une <code>Idempotency-Key</code>, un audit trail complet "
                "et une référence humaine immuable (<code>BBR-YYYYMMDD-XXXX</code>).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Multi-langue</b> dès le lancement : Français (par défaut), "
                "Anglais, Espagnol (touristes UE/US qui viennent en CI).",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        info_box(
            "Périmètre du document",
            "Ce document définit le module <b>Booking Engine</b> tel qu'il "
            "s'inscrit dans la plateforme Revenue Engine. Il s'appuie sur "
            "le modèle de données PostgreSQL livré dans le document "
            "d'architecture (§5). Les choix de stack et de scalabilité y "
            "sont déjà arbitrés.",
            styles,
        ),
    ]


# ── §1 ARCHITECTURE ─────────────────────────────────────────────────
def build_s1(styles):
    return [
        Paragraph("§1", styles["h1_kicker"]),
        Paragraph("Architecture du Booking Engine", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Le Booking Engine est organisé en <b>3 couches verticales</b> "
            "alimentées par 4 points d'entrée et déversant vers 4 services "
            "post-paiement. Le diagramme ci-dessous présente la vue "
            "d'ensemble.",
            styles["body"],
        ),
        hero_image(f"{DIAG}/01_booking_architecture.png",
                   max_width_cm=16, max_height_cm=16),
        Paragraph("Schéma 1 — Architecture du Booking Engine.",
                  styles["caption"]),
        Paragraph("Composants du cœur", styles["h2"]),
        Paragraph("Tunnel de conversion", styles["h3"]),
        Paragraph(
            "Composant frontend / API qui orchestre les 7 étapes du parcours. "
            "État stocké côté client (Zustand) <i>et</i> côté serveur "
            "(session Redis 30 min) pour garantir la reprise en cas de "
            "fermeture d'onglet.",
            styles["body"],
        ),
        Paragraph("Catalogue & Pricing Engine", styles["h3"]),
        Paragraph(
            "Le catalogue lit la table <code>products</code> + "
            "<code>inventory</code>. Le pricing engine applique en cascade : "
            "(1) prix de base, (2) overrides de saison, (3) règles de yield, "
            "(4) code promo, (5) tier membership. La fonction est <b>pure et "
            "déterministe</b> — même entrée = même prix, traçable.",
            styles["body"],
        ),
        Paragraph("Availability Engine", styles["h3"]),
        Paragraph(
            "Garant absolu du <i>no-double-booking</i>. Utilise une "
            "transaction PostgreSQL <code>SERIALIZABLE</code> avec verrouillage "
            "ligne sur <code>inventory</code> au moment du checkout. Un "
            "<b>hold de 5 minutes</b> est posé pendant l'étape de paiement. "
            "À l'expiration, l'inventory est automatiquement libéré.",
            styles["body"],
        ),
        Paragraph("Upsell / Cross-sell Engine", styles["h3"]),
        Paragraph(
            "Règles configurables côté admin&nbsp;: \"Si produit X dans le "
            "panier ALORS suggérer Y, Z avec discount D\". Algorithme "
            "complémentaire d'IA légère (XGBoost sur les co-achats des "
            "12 derniers mois) pour optimiser au fil de l'eau.",
            styles["body"],
        ),
        Paragraph("Business Rules Engine", styles["h3"]),
        Paragraph(
            "Règles d'annulation, no-show, reprogrammation, période de grâce. "
            "Définies en JSONB sur chaque produit pour flexibilité maximale "
            "(les chambres et le brunch n'ont pas les mêmes règles).",
            styles["body"],
        ),
        Paragraph("Payment Orchestrator", styles["h3"]),
        Paragraph(
            "Façade unifiée devant 8 PSPs (Wave, Orange Money, MTN, Moov, "
            "Stripe Visa/MC, PayPal). Implémente le pattern <b>circuit "
            "breaker</b> : si un PSP est en panne, le routeur bascule "
            "automatiquement sur un fallback compatible.",
            styles["body"],
        ),
    ]


# ── §2 FLUX FONCTIONNELS ────────────────────────────────────────────
def build_s2(styles):
    el = [
        Paragraph("§2", styles["h1_kicker"]),
        Paragraph("Flux fonctionnels par type de réservation", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Les 8 types de réservation partagent le même tunnel global, "
            "mais activent des règles spécifiques. Tableau récapitulatif&nbsp;:",
            styles["body"],
        ),
    ]
    flow_matrix = [
        ["Type", "Capacité", "Slots", "Paiement", "Annulation", "QR"],
        ["Chambre", "1 nuit/chambre", "checkin/out", "Acompte 50% ou 100%", "72h flexible", "1 par séjour"],
        ["Day Pass", "250 / jour", "all-day", "100% obligatoire", "24h avant", "1 par billet"],
        ["Sunset", "120 / soir", "16h-20h", "100% obligatoire", "24h avant", "1 par billet"],
        ["Brunch", "200 / dimanche", "11h-15h", "100% obligatoire", "24h avant", "1 par billet"],
        ["Activité", "varie", "créneaux 30-60 min", "100% obligatoire", "12h avant", "1 par activité"],
        ["Corporate", "1 salle", "demi-journée", "Acompte 30% + solde", "Sur devis", "1 par groupe"],
        ["Événement", "1 espace", "soirée", "Acompte 50% + solde", "Sur devis", "1 organisateur + invités"],
        ["Membership", "n/a", "carte annuelle", "100% obligatoire", "Non remboursable", "1 carte numérique"],
    ]
    el.append(table_grid(flow_matrix,
                         col_widths=[2.2 * cm, 2.6 * cm, 2.6 * cm, 3.2 * cm,
                                     3 * cm, 2.8 * cm]))
    el.append(Spacer(1, 0.4 * cm))

    el.extend([
        Paragraph("2.1 — Hébergement (Suites + Chambres)", styles["h2"]),
        Paragraph(
            "Trois catégories&nbsp;: <b>Chambre Exclusive</b>, <b>Suite "
            "Lagune</b>, <b>Suite Jardin</b>. Chaque produit possède une "
            "galerie photo, une description riche en markdown, un prix de "
            "référence par nuit, une capacité (adultes + enfants), une liste "
            "d'équipements, et une politique d'annulation spécifique. La "
            "disponibilité est calculée chambre par chambre (inventory "
            "atomique).",
            styles["body"],
        ),
        Paragraph("2.2 — Beach Club (Day Pass · Sunset · Brunch)", styles["h2"]),
        Paragraph(
            "Trois offres quotidiennes avec quota partagé. Day Pass = 250 "
            "personnes/jour, Sunset = 120, Brunch = 200 (dimanches). Les "
            "tarifs distinguent adulte / enfant (3-12 ans) / bébé. Inclusions "
            "détaillées (accès piscine, transat, serviette, etc.). Le QR est "
            "le boarding pass délivré actuellement.",
            styles["body"],
        ),
        Paragraph("2.3 — Activités", styles["h2"]),
        Paragraph(
            "7 activités&nbsp;: <b>Jet Ski</b>, <b>Paddle</b>, <b>Canoë</b>, "
            "<b>Padel</b>, <b>Quad</b>, <b>Buggy</b>, <b>Multisports</b>. "
            "Chacune avec son nombre d'équipements, ses créneaux horaires "
            "et sa durée. Réservation par <b>slot</b> de 30 ou 60 min. Si "
            "tous les jet skis sont pris à 10h, l'utilisateur voit "
            "automatiquement la prochaine plage disponible.",
            styles["body"],
        ),
        Paragraph("2.4 — Corporate", styles["h2"]),
        Paragraph(
            "Réservation de salle (séminaire, conférence, team building, "
            "journée d'étude). Champs spécifiques&nbsp;: nombre de "
            "participants, options restauration (cocktail, déjeuner, dîner), "
            "options techniques (vidéoprojecteur, sonorisation, traduction "
            "simultanée). <b>Paiement en deux temps</b>&nbsp;: acompte 30% à "
            "la signature du devis + solde 7 jours avant l'événement.",
            styles["body"],
        ),
        Paragraph("2.5 — Événementiel", styles["h2"]),
        Paragraph(
            "Mariages, anniversaires, soirées privées, concerts. <b>Demande "
            "de devis intégrée</b> au tunnel&nbsp;: le client renseigne ses "
            "besoins, un commercial reçoit la demande sur le dashboard et "
            "génère un devis. Une fois validé, conversion en réservation "
            "standard avec acompte 50%.",
            styles["body"],
        ),
        Paragraph("2.6 — Membership", styles["h2"]),
        Paragraph(
            "Trois tiers&nbsp;: <b>Bronze</b> (50k XOF/an, 10% de réduction), "
            "<b>Or</b> (150k XOF/an, 20% + accès prioritaire), <b>Platine</b> "
            "(400k XOF/an, 30% + chambre offerte/an + transferts inclus). "
            "Paiement intégral à la souscription, renouvellement automatique "
            "via le PSP enregistré.",
            styles["body"],
        ),
        Paragraph("Upsell & Cross-sell — règles initiales", styles["h2"]),
    ])
    upsell = [
        ["Produit dans le panier", "Suggestions automatiques", "Discount"],
        ["Chambre", "Sunset · Brunch · Transfert · Activité", "10% si bundle ≥ 2"],
        ["Day Pass", "Jet Ski · Paddle · Massage · Déjeuner", "15% sur l'activité"],
        ["Sunset", "Dîner Le Kaai · Transfert retour", "Cocktail offert"],
        ["Brunch", "Day Pass (le matin) · Spa après-midi", "Day Pass –30%"],
        ["Corporate", "Team building activités · Soirée gala", "Sur devis"],
        ["Événement", "Hébergement invités · Brunch lendemain", "Tarif groupe"],
    ]
    el.append(table_grid(upsell, col_widths=[5.5 * cm, 7 * cm, 3.9 * cm]))
    return el


# ── §3 WIREFRAMES ───────────────────────────────────────────────────
def build_s3(styles):
    return [
        Paragraph("§3", styles["h1_kicker"]),
        Paragraph("Wireframes du tunnel de réservation", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Le tunnel se compose de <b>7 étapes</b>. Objectif&nbsp;: chaque "
            "étape doit pouvoir être complétée en moins de <b>15 secondes</b> "
            "sur mobile. L'utilisateur peut <i>toujours revenir en arrière</i> "
            "sans perdre ses données (session Redis 30 min).",
            styles["body"],
        ),
        Paragraph("Vue d'ensemble — entonnoir de conversion", styles["h2"]),
        hero_image(f"{DIAG}/02_funnel_tunnel.png",
                   max_width_cm=16, max_height_cm=8),
        Paragraph(
            "Schéma 2 — Tunnel à 7 étapes avec objectifs de conversion par "
            "palier (objectif global ≥ 32% du visiteur au booking confirmé).",
            styles["caption"]),
        Paragraph("Wireframes des 7 étapes", styles["h2"]),
        Paragraph(
            "Maquette filaire de chaque écran. Le rendu final s'appuiera sur "
            "le design system existant (Tailwind + shadcn/ui) avec la charte "
            "BBr (noir + or + cream).",
            styles["body"],
        ),
        hero_image(f"{DIAG}/03_wireframes.png",
                   max_width_cm=16, max_height_cm=20),
        Paragraph(
            "Schéma 3 — Wireframes textuels des 7 écrans du tunnel.",
            styles["caption"]),
        Paragraph("Détails par étape", styles["h2"]),
        Paragraph("Étape 1 — Sélection produit", styles["h3"]),
        Paragraph(
            "Grille 6 tuiles (3×2 sur desktop, 2×3 sur mobile). Chaque tuile "
            "affiche une photo full-bleed, un titre, une accroche d'une "
            "ligne. Si l'utilisateur arrive avec un UTM "
            "<code>utm_content=day_pass</code>, la tuile correspondante est "
            "<b>présélectionnée</b> et le tunnel saute directement à l'étape 2.",
            styles["body"],
        ),
        Paragraph("Étape 2 — Date", styles["h3"]),
        Paragraph(
            "Datepicker double (arrivée + départ) avec calendrier couleur. "
            "Pour les offres mono-date (Day Pass, Sunset, Brunch, Activités), "
            "un seul champ. Les dates indisponibles sont grisées. Hover sur "
            "une date affiche le prix du jour.",
            styles["body"],
        ),
        Paragraph("Étape 3 — Participants", styles["h3"]),
        Paragraph(
            "Steppers ± pour adultes / enfants / bébés. Validation en temps "
            "réel selon la capacité du produit (impossible de dépasser). Le "
            "total estimé s'affiche en direct.",
            styles["body"],
        ),
        Paragraph("Étape 4 — Options (upsell + cross-sell)", styles["h3"]),
        Paragraph(
            "Liste de 4 à 8 propositions selon le produit. Format <b>opt-in "
            "explicite</b> (cases à cocher, jamais pré-cochées) pour "
            "conformité Dark Pattern. Chaque suggestion montre son prix et "
            "son économie si elle est en bundle.",
            styles["body"],
        ),
        Paragraph("Étape 5 — Client", styles["h3"]),
        Paragraph(
            "Formulaire minimaliste&nbsp;: nom, prénom, téléphone WhatsApp, "
            "email, nationalité. Auto-complétion si l'utilisateur est "
            "<i>logged-in</i>. Acceptation CGV obligatoire. Consentement "
            "marketing opt-in séparé.",
            styles["body"],
        ),
        Paragraph("Étape 6 — Paiement", styles["h3"]),
        Paragraph(
            "Choix du mode (acompte 50% / intégral / sur place si autorisé) "
            "puis du PSP. Les méthodes mobile money (Wave, OM, MTN, Moov) "
            "sont affichées <b>en premier</b> (90% du marché ivoirien). "
            "Stripe + PayPal en second.",
            styles["body"],
        ),
        Paragraph("Étape 7 — Confirmation", styles["h3"]),
        Paragraph(
            "Écran de succès avec référence visible, téléchargement du "
            "ticket PDF, ajout au calendrier (.ics), liens vers l'espace "
            "client. Envoi automatique simultané d'un email + d'un WhatsApp "
            "avec le ticket en pièce jointe.",
            styles["body"],
        ),
    ]


# ── §4 MODÈLE DE DONNÉES ────────────────────────────────────────────
def build_s4(styles):
    sql = """-- Extensions du schéma revenue_engine pour le Booking Engine

-- 14. Hold panier (5 min avant paiement)
CREATE TABLE booking_holds (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL,
    visitor_id      UUID,
    product_id      UUID NOT NULL REFERENCES products(id),
    date            DATE NOT NULL,
    slot            TEXT,
    quantity        INTEGER NOT NULL,
    options         JSONB NOT NULL DEFAULT '[]',
    quoted_amount   NUMERIC(12,2) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    converted_to    UUID REFERENCES reservations(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hold_session ON booking_holds(session_id, expires_at);
CREATE INDEX idx_hold_expiry ON booking_holds(expires_at)
    WHERE converted_to IS NULL;

-- 15. Options additionnelles d'une réservation (upsell / cross-sell)
CREATE TABLE reservation_options (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id  UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    option_code     TEXT NOT NULL,         -- 'transfer', 'sunset', 'massage', ...
    label_fr        TEXT NOT NULL,
    quantity        INTEGER NOT NULL DEFAULT 1,
    unit_price      NUMERIC(10,2) NOT NULL,
    total_price     NUMERIC(10,2) NOT NULL,
    is_upsell       BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_resopt_res ON reservation_options(reservation_id);

-- 16. Devis (Corporate / Événementiel)
CREATE TABLE quotes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_number    TEXT UNIQUE NOT NULL,  -- 'BBR-Q-2026-0042'
    customer_id     UUID NOT NULL REFERENCES customers(id),
    product_id      UUID REFERENCES products(id),
    target_date     DATE,
    participants    INTEGER,
    requested_options JSONB NOT NULL DEFAULT '{}',
    estimated_total NUMERIC(12,2),
    final_total     NUMERIC(12,2),
    status          TEXT NOT NULL DEFAULT 'draft',
                    -- draft, sent, accepted, rejected, expired, converted
    sent_at         TIMESTAMPTZ,
    accepted_at     TIMESTAMPTZ,
    converted_to    UUID REFERENCES reservations(id),
    commercial_id   UUID REFERENCES users(id),
    notes           TEXT,
    pdf_url         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ
);

-- 17. Codes promo / coupons
CREATE TABLE promo_codes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT UNIQUE NOT NULL,
    discount_type   TEXT NOT NULL,         -- 'percent' or 'amount'
    discount_value  NUMERIC(10,2) NOT NULL,
    min_amount      NUMERIC(10,2),
    applies_to      module_type[],         -- modules concernés (null = tous)
    starts_at       TIMESTAMPTZ,
    ends_at         TIMESTAMPTZ,
    max_uses        INTEGER,
    used_count      INTEGER NOT NULL DEFAULT 0,
    campaign_id     UUID REFERENCES campaigns(id),
    status          TEXT NOT NULL DEFAULT 'active'
);

-- 18. Refunds (note de crédit)
CREATE TABLE refunds (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id      UUID NOT NULL REFERENCES payments(id),
    reservation_id  UUID NOT NULL REFERENCES reservations(id),
    amount          NUMERIC(12,2) NOT NULL,
    reason          TEXT NOT NULL,         -- 'client_cancel', 'no_show_grace',
                                           -- 'overbooking', 'staff_error'
    requested_by    UUID REFERENCES users(id),
    approved_by     UUID REFERENCES users(id),
    provider_refund_ref TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
                    -- pending, processing, completed, failed
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

-- 19. Reprogrammations
CREATE TABLE reschedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id  UUID NOT NULL REFERENCES reservations(id),
    old_date        DATE NOT NULL,
    new_date        DATE NOT NULL,
    old_slot        TEXT,
    new_slot        TEXT,
    requested_by    UUID REFERENCES users(id),
    fee_applied     NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);"""
    return [
        Paragraph("§4", styles["h1_kicker"]),
        Paragraph("Modèle de données du Booking Engine", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Le Booking Engine s'appuie sur le modèle central défini dans le "
            "document d'architecture (tables <code>customers, products, "
            "inventory, reservations, payments, qr_codes</code>) et ajoute "
            "<b>6 tables spécifiques</b>&nbsp;: holds panier, options "
            "additionnelles, devis, codes promo, refunds, reschedules.",
            styles["body"],
        ),
        Paragraph("État (machine à états) d'une réservation", styles["h2"]),
        hero_image(f"{DIAG}/04_state_machine.png",
                   max_width_cm=16, max_height_cm=10),
        Paragraph("Schéma 4 — Machine à états d'une réservation.",
                  styles["caption"]),
        PageBreak(),
        Paragraph("DDL des 6 tables ajoutées", styles["h2"]),
        code_block(sql, styles),
        info_box(
            "Pourquoi une table booking_holds dédiée ?",
            "Le hold est <b>éphémère</b> (TTL 5 min). Le stocker dans une "
            "table dédiée plutôt que dans <code>reservations</code> évite "
            "de polluer la table principale et facilite le purge "
            "automatique. Une réservation n'existe officiellement qu'après "
            "validation du paiement.",
            styles,
        ),
    ]


# ── §5 API REST DÉTAILLÉES ──────────────────────────────────────────
def build_s5(styles):
    sample_post = '''POST /api/booking/reservations
Headers:
  Content-Type: application/json
  Idempotency-Key: 7c9a4f12-bf30-4b69-a1c2-09e4567a89bd
  Accept-Language: fr-FR

Body:
{
  "product_id": "5e8d3c1a-...",
  "date_in": "2026-07-12",
  "date_out": "2026-07-14",
  "slot": null,
  "adults": 2,
  "children": 0,
  "options": [
    {"code": "transfer", "quantity": 1},
    {"code": "sunset",   "quantity": 2}
  ],
  "customer": {
    "first_name": "Adama",
    "last_name":  "Sangaré",
    "email":      "adama@example.com",
    "phone":      "+2250707070707",
    "nationality": "CI",
    "language":   "fr"
  },
  "promo_code": "WELCOME10",
  "utm": {
    "source":   "meta",
    "medium":   "paid_social",
    "campaign": "summer_2026_daypass",
    "content":  "carousel_v3"
  },
  "consent_marketing": true,
  "session_id": "9a2b...-fd45"
}

Response 201 Created:
{
  "id": "f3e7-...",
  "reference": "BBR-20260712-A4F2",
  "status": "PENDING",
  "amount_total": 145000,
  "amount_due": 145000,
  "currency": "XOF",
  "hold_expires_at": "2026-06-17T18:55:00Z",
  "payment_intent": {
    "client_secret": "pi_3O1...",
    "providers": ["wave", "orange_money", "mtn", "moov",
                  "stripe", "paypal"]
  }
}'''
    sample_pay = '''POST /api/booking/reservations/{id}/pay
{
  "payment_method": "wave",
  "amount": 72500,
  "type": "deposit"
}

Response 200 OK:
{
  "payment_id": "8b1f-...",
  "redirect_url": "https://pay.wave.com/checkout/...",
  "expires_in": 300
}'''
    sample_scan = '''GET /api/staff/scan/{token}
Response 200 OK:
{
  "reservation": {
    "reference": "BBR-20260712-A4F2",
    "status": "PAID",
    "product": "Suite Lagune 2 nuits",
    "date_in": "2026-07-12",
    "date_out": "2026-07-14",
    "guest": {
      "name": "Adama Sangaré",
      "phone": "+2250707070707",
      "photo_url": null
    },
    "companions": [{"name": "Aïssatou Sangaré", "kind": "adult"}],
    "payment_status": "PAID",
    "options": [{"label_fr": "Transfert", "quantity": 1}]
  },
  "scan_action": "ALLOW",
  "warnings": []
}'''
    return [
        Paragraph("§5", styles["h1_kicker"]),
        Paragraph("API REST détaillées (Swagger / OpenAPI 3.1)", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Toutes les routes sont organisées en <b>4 namespaces</b>&nbsp;: "
            "publique (parcours de réservation), espace client (self-service "
            "authentifié), staff (back-office), webhooks (entrants PSP/OTA). "
            "Documentation Swagger générée automatiquement à "
            "<code>/api/docs</code>.",
            styles["body"],
        ),
        hero_image(f"{DIAG}/07_api_map.png",
                   max_width_cm=16, max_height_cm=18),
        Paragraph(
            "Schéma 5 — Cartographie des 4 namespaces d'API du Booking Engine.",
            styles["caption"]),
        Paragraph("5.1 — Endpoints publics (sans auth)", styles["h2"]),
    ] + [table_grid([
        ["Méthode", "URL", "Description"],
        ["GET", "/api/booking/catalog/products",
         "Liste catalogue (filtres : module, category, date)"],
        ["GET", "/api/booking/catalog/availability",
         "Dispo par produit × date × slot (cache 30s)"],
        ["POST", "/api/booking/quote",
         "Calcule le prix sans réserver (pour affichage panier)"],
        ["POST", "/api/booking/reservations",
         "Crée la réservation + le hold de 5 min"],
        ["POST", "/api/booking/reservations/{id}/pay",
         "Lance le paiement (retourne redirect_url ou OTP)"],
        ["GET", "/api/booking/reservations/{ref}",
         "Récupère via la référence humaine (lookup public)"],
        ["GET", "/api/booking/reservations/{id}/ticket.pdf",
         "Retourne le ticket PDF (token signé)"],
    ], col_widths=[2 * cm, 7 * cm, 7.4 * cm])] + [
        Paragraph("5.2 — Endpoints espace client (auth OTP)", styles["h2"]),
        table_grid([
            ["Méthode", "URL", "Description"],
            ["POST", "/api/account/auth/otp/send", "Envoie OTP par WhatsApp/SMS"],
            ["POST", "/api/account/auth/otp/verify", "Vérifie OTP → JWT 7 jours"],
            ["GET", "/api/account/me/reservations", "Toutes mes résa (pagination)"],
            ["GET", "/api/account/me/tickets", "Tickets téléchargeables"],
            ["POST", "/api/account/me/reservations/{id}/pay-balance",
             "Paiement du solde"],
            ["POST", "/api/account/me/reservations/{id}/reschedule",
             "Reprogrammation (selon règles)"],
            ["POST", "/api/account/me/reservations/{id}/cancel",
             "Annulation (selon règles)"],
        ], col_widths=[2 * cm, 7.5 * cm, 6.9 * cm]),
        Paragraph("5.3 — Endpoints staff", styles["h2"]),
        table_grid([
            ["Méthode", "URL", "Description"],
            ["GET", "/api/staff/booking/bookings",
             "Liste (filtres : statut, date, produit, canal)"],
            ["GET", "/api/staff/booking/bookings/today",
             "Vue du jour pour la réception"],
            ["POST", "/api/staff/booking/bookings/{id}/checkin",
             "Check-in manuel (sans QR)"],
            ["POST", "/api/staff/scan/{token}",
             "Scan QR + validation accès"],
            ["POST", "/api/staff/booking/bookings/manual",
             "Création manuelle (téléphone, comptoir)"],
            ["POST", "/api/staff/booking/bookings/{id}/refund",
             "Refund (validation hiérarchique)"],
            ["GET", "/api/staff/booking/kpis",
             "KPIs temps réel (CA, occupation, no-show)"],
        ], col_widths=[2 * cm, 7.8 * cm, 6.6 * cm]),
        Paragraph("5.4 — Webhooks entrants (PSP & OTA)", styles["h2"]),
        Paragraph(
            "Tous les webhooks sont <b>signés HMAC</b> (header "
            "<code>X-Signature-256</code>) et validés avant traitement. "
            "Idempotence par <code>event_id</code> stocké dans Redis 7 jours.",
            styles["body"],
        ),
        table_grid([
            ["URL", "Source", "Événements"],
            ["/api/booking/webhooks/wave", "Wave",
             "payment.completed · payment.failed"],
            ["/api/booking/webhooks/orange-money", "Orange Money", "same"],
            ["/api/booking/webhooks/mtn-money", "MTN Money", "same"],
            ["/api/booking/webhooks/moov-money", "Moov Money", "same"],
            ["/api/booking/webhooks/stripe", "Stripe",
             "payment_intent.succeeded · charge.refunded"],
            ["/api/booking/webhooks/paypal", "PayPal",
             "PAYMENT.CAPTURE.COMPLETED · REFUNDED"],
            ["/api/booking/webhooks/ota/booking-com", "Booking.com",
             "reservation.new · reservation.modified · canceled"],
            ["/api/booking/webhooks/ota/airbnb", "Airbnb", "same"],
        ], col_widths=[6 * cm, 3 * cm, 7.4 * cm]),
        PageBreak(),
        Paragraph("5.5 — Exemple : créer une réservation", styles["h2"]),
        code_block(sample_post, styles),
        Paragraph("5.6 — Exemple : lancer le paiement", styles["h2"]),
        code_block(sample_pay, styles),
        Paragraph("5.7 — Exemple : scan QR (staff)", styles["h2"]),
        code_block(sample_scan, styles),
        info_box(
            "Convention Idempotency-Key",
            "Tout POST de création (reservation, payment) est protégé par "
            "<code>Idempotency-Key</code> (UUID v4 fourni par le client). "
            "Le serveur stocke la réponse 24h dans Redis. Un POST avec la "
            "même clé renvoie exactement la même réponse — y compris en "
            "cas de double clic ou de retry réseau.",
            styles,
        ),
    ]


# ── §6 RÈGLES MÉTIER ────────────────────────────────────────────────
def build_s6(styles):
    cancel_matrix = [
        ["Type produit", "≥ 72h avant", "24h-72h avant", "< 24h", "No-show"],
        ["Chambre",       "100%", "50%", "0%", "0%"],
        ["Day Pass",      "100%", "100%", "0%", "0%"],
        ["Sunset",        "100%", "100%", "0%", "0%"],
        ["Brunch",        "100%", "100%", "0%", "0%"],
        ["Activité",      "100%", "100% (≥12h)", "0%", "0%"],
        ["Corporate",     "Sur devis", "Sur devis", "Sur devis", "0%"],
        ["Événement",     "100% (≥30j)", "50% (15-30j)", "0%", "0%"],
        ["Membership",    "—", "—", "—", "—"],
    ]
    return [
        Paragraph("§6", styles["h1_kicker"]),
        Paragraph("Règles métier", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Chaque produit porte ses propres règles, stockées en JSONB sur "
            "la colonne <code>products.attributes</code>. Les valeurs par "
            "défaut sont indiquées ci-dessous, mais peuvent être surchargées "
            "par produit.",
            styles["body"],
        ),
        Paragraph("6.1 — Matrice d'annulation et de remboursement", styles["h2"]),
        table_grid(cancel_matrix,
                   col_widths=[2.6 * cm, 2.8 * cm, 3.8 * cm, 2.5 * cm, 2.5 * cm]),
        Spacer(1, 0.3 * cm),
        Paragraph("6.2 — No-show", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "Un client est marqué <b>NO_SHOW</b> automatiquement à H+30 "
                "minutes après l'heure prévue d'arrivée (chambre) ou de slot "
                "(Day Pass, Sunset, activité).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Aucun remboursement</b> automatique. Possibilité pour la "
                "Direction d'accorder un <b>geste commercial</b> au cas par "
                "cas via le dashboard staff.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Statistiques dédiées</b>&nbsp;: taux de no-show par "
                "produit, par canal d'acquisition, par nationalité. Permet "
                "d'identifier les canaux à fort risque et d'ajuster les "
                "politiques d'acompte.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Score de risque client</b>&nbsp;: après 2 no-show, le "
                "client doit payer 100% à l'avance pour toute réservation "
                "future.",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        Paragraph("6.3 — Reprogrammation", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Gratuite</b> si demandée ≥ 72h avant la date prévue, "
                "sous réserve de disponibilité.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Frais 10%</b> si entre 24h et 72h avant.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Non autorisée</b> à moins de 24h — le client doit annuler "
                "et re-réserver selon les règles d'annulation standard.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>1 seule reprogrammation gratuite</b> par réservation. "
                "Les suivantes facturent 10% à chaque fois.",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        Paragraph("6.4 — Période de grâce de paiement", styles["h2"]),
        Paragraph(
            "Pour les réservations chambres avec acompte 50%&nbsp;: le solde "
            "doit être payé <b>48h avant l'arrivée</b>. À H-48h, un rappel "
            "automatique WhatsApp + Email est envoyé. À H-24h sans paiement, "
            "la réservation est <b>automatiquement annulée</b> et l'acompte "
            "n'est pas remboursé (sauf décision Direction).",
            styles["body"],
        ),
        Paragraph("6.5 — Overbooking volontaire (chambres)", styles["h2"]),
        Paragraph(
            "Pour absorber le no-show structurel (5-8% hôtellerie standard), "
            "le système autorise un <b>overbooking de 5%</b> sur les chambres "
            "(paramétrable). Si la situation se matérialise (toutes les "
            "chambres présentes), procédure de <b>relogging</b> dans un hôtel "
            "partenaire payé par BBr + bon d'achat de compensation.",
            styles["body"],
        ),
    ]


# ── §7 DISPONIBILITÉS ───────────────────────────────────────────────
def build_s7(styles):
    return [
        Paragraph("§7", styles["h1_kicker"]),
        Paragraph("Gestion des disponibilités", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "La gestion des dispos est le cœur névralgique de tout moteur de "
            "réservation. Une seule double-réservation suffit à détruire la "
            "confiance des clients. Le Booking Engine garantit l'unicité par "
            "<b>transactions PostgreSQL SERIALIZABLE</b> + <b>verrouillage "
            "ligne</b> + <b>contrainte d'exclusion</b>.",
            styles["body"],
        ),
        Paragraph("7.1 — Modèle de stock (rappel)", styles["h2"]),
        Paragraph(
            "La table <code>inventory</code> stocke <b>(product_id, date, "
            "slot, capacity_total, capacity_sold)</b>. Une réservation "
            "incrémente <code>capacity_sold</code> de <code>quantity</code>. "
            "L'invariant à maintenir est&nbsp;: "
            "<code>capacity_sold &lt;= capacity_total</code>.",
            styles["body"],
        ),
        Paragraph("7.2 — Algorithme atomique de réservation", styles["h2"]),
        code_block("""BEGIN ISOLATION LEVEL SERIALIZABLE;

-- 1. Verrouille la ligne d'inventory
SELECT capacity_total, capacity_sold
  FROM inventory
 WHERE product_id = $1 AND date = $2 AND slot IS NOT DISTINCT FROM $3
   FOR UPDATE;

-- 2. Vérifie en mémoire applicative
IF (capacity_sold + $quantity) > capacity_total THEN
    ROLLBACK; RAISE EXCEPTION 'SOLD_OUT';
END IF;

-- 3. Incrémente
UPDATE inventory
   SET capacity_sold = capacity_sold + $quantity
 WHERE product_id = $1 AND date = $2 AND slot IS NOT DISTINCT FROM $3;

-- 4. Crée la réservation (status='PENDING' tant que paiement non validé)
INSERT INTO reservations (...) VALUES (...);

-- 5. Crée le hold (TTL 5 min)
INSERT INTO booking_holds (...) VALUES (..., now() + INTERVAL '5 minutes');

COMMIT;""", styles),
        info_box(
            "Pourquoi SERIALIZABLE et pas READ COMMITTED ?",
            "Avec READ COMMITTED, deux transactions concurrentes peuvent "
            "lire <code>capacity_sold = 249</code>, écrire chacune "
            "<code>250</code>, et créer une double réservation. "
            "SERIALIZABLE force PostgreSQL à détecter le conflit et "
            "renvoyer une erreur que l'application retry automatiquement "
            "(jusqu'à 3 fois avant d'abandonner).",
            styles,
        ),
        Paragraph("7.3 — Cache lecture", styles["h2"]),
        Paragraph(
            "Les routes <code>/catalog/products</code> et "
            "<code>/catalog/availability</code> sont fortement cachées "
            "(Redis, TTL 30s). À chaque modification d'inventory, un "
            "invalidation event est publié et le cache est purgé "
            "instantanément pour le produit concerné.",
            styles["body"],
        ),
        Paragraph("7.4 — Gestion par type de produit", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Chambres</b> — 1 chambre = 1 inventory line. "
                "Capacité = 1 par nuit. Une réservation multi-nuits réserve "
                "N lignes (jointure date_in + date_out).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Day Pass</b> — 1 ligne par jour. Capacité = 250.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Sunset / Brunch</b> — 1 ligne par jour (Sunset = 120, "
                "Brunch = 200 le dimanche uniquement).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Activités</b> — 1 ligne par produit × date × slot "
                "(30/60 min). Le slot représente le créneau horaire.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Corporate / Événements</b> — 1 espace = 1 inventory line "
                "par jour. Capacité = 1 (un seul événement par espace/jour).",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
    ]


# ── §8 PAIEMENTS ────────────────────────────────────────────────────
def build_s8(styles):
    psp_table = [
        ["PSP", "Type", "Devise", "Commission", "Délai webhook", "Use case"],
        ["Wave",           "Mobile money", "XOF", "1.0%",  "&lt; 5s", "Marché CI principal"],
        ["Orange Money",   "Mobile money", "XOF", "1.5%",  "&lt; 10s", "Marché CI/sénégal"],
        ["MTN Money",      "Mobile money", "XOF", "1.5%",  "&lt; 10s", "CI / autres Afrique"],
        ["Moov Money",     "Mobile money", "XOF", "1.5%",  "&lt; 10s", "CI / Bénin / Togo"],
        ["Stripe",         "Carte",        "EUR/USD/XOF", "2.9% + 0.30€", "&lt; 2s", "Visa / Mastercard internationaux"],
        ["PayPal",         "Wallet",       "EUR/USD", "3.4% + 0.35€", "&lt; 5s", "Touristes US / EU"],
    ]
    return [
        Paragraph("§8", styles["h1_kicker"]),
        Paragraph("Gestion des paiements", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Le Booking Engine intègre <b>6 PSPs</b> dès le lancement, avec "
            "une architecture <b>extensible</b> permettant d'ajouter un "
            "nouveau PSP en moins de 2 jours.",
            styles["body"],
        ),
        Paragraph("8.1 — Matrice des PSPs supportés", styles["h2"]),
        table_grid(psp_table,
                   col_widths=[2.3 * cm, 2.2 * cm, 2 * cm, 2.5 * cm,
                               2 * cm, 5.4 * cm]),
        Paragraph("8.2 — Modes de paiement", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Paiement intégral (100%)</b> — option par défaut, "
                "fortement incitée par un <b>petit avantage</b> "
                "(annulation flexible jusqu'à 72h vs 48h).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Acompte (50%)</b> — disponible pour les chambres et les "
                "événements. Solde dû J-48h.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Acompte 30%</b> — réservé au Corporate (devis).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Paiement sur place</b> — uniquement avec validation "
                "Direction au cas par cas (clients VIP, partenaires de "
                "longue date). Statut <code>pending_onsite_payment</code> "
                "spécifique pour traçabilité.",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        Paragraph("8.3 — Séquence détaillée d'un paiement", styles["h2"]),
        hero_image(f"{DIAG}/05_payment_sequence.png",
                   max_width_cm=16, max_height_cm=14),
        Paragraph("Schéma 6 — Flux complet d'un paiement (avec branche d'échec).",
                  styles["caption"]),
        Paragraph("8.4 — Sécurité paiement", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Webhook signature HMAC-SHA256</b> obligatoire — "
                "tout webhook non signé est rejeté en 401.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Idempotence stricte</b> par event_id Redis (TTL 7 jours).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>3D-Secure 2</b> activé par défaut sur Stripe (cartes).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Tokenisation</b> — aucune donnée PAN stockée. Les "
                "références internes sont opaques (Stripe customer_id, "
                "Wave merchant_ref, etc.).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Réconciliation quotidienne</b> automatique entre "
                "<code>payments</code> et les exports des PSPs (rapport "
                "comptable matinal).",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
    ]


# ── §9 QR CODES ─────────────────────────────────────────────────────
def build_s9(styles):
    return [
        Paragraph("§9", styles["h1_kicker"]),
        Paragraph("Gestion des QR Codes", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Chaque réservation génère 1 à N QR codes selon le type de "
            "produit. Le QR est l'identifiant physique qui permet l'accès "
            "le jour J — sa génération, sa sécurité et sa scanabilité sont "
            "critiques.",
            styles["body"],
        ),
        hero_image(f"{DIAG}/06_qr_lifecycle.png",
                   max_width_cm=16, max_height_cm=10),
        Paragraph("Schéma 7 — Cycle de vie complet d'un QR code.",
                  styles["caption"]),
        Paragraph("9.1 — Génération", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Token cryptographique</b>&nbsp;: 32 caractères hex "
                "(128 bits) générés par <code>secrets.token_hex(16)</code> "
                "— impossible à deviner ou à dupliquer.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Référence courte</b>&nbsp;: 8 caractères majuscules "
                "(<code>BBR-YYYYMMDD-XXXX</code>) — humainement lisible "
                "pour saisie manuelle en cas de scan impossible.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Payload compact</b>&nbsp;: JSON ~75 chars "
                "<code>{type:'ticket',token,ref}</code> — bien en dessous "
                "de la limite caméra mobile.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>QR taille 440px, ECC=M, noir/blanc</b>&nbsp;: décodable "
                "à 50 cm de distance sur un écran de téléphone même dégradé. "
                "Validé par audit pyzbar (10/10 tests passent — voir "
                "rapport iter-48).",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        Paragraph("9.2 — Ticket PDF Premium", styles["h2"]),
        Paragraph(
            "Le Boarding Pass délivré actuellement est <b>conservé tel "
            "quel</b> (généré via Pillow + Tickets esthétiques branded BBr). "
            "Format A4 portrait, 1080×1920 pixels, contient&nbsp;: logo "
            "BBR, nom du client, référence visible, produit + date + slot, "
            "QR code 440px, montant payé, conditions d'utilisation, hotline "
            "WhatsApp.",
            styles["body"],
        ),
        Paragraph("9.3 — Distribution", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Email</b>&nbsp;: PDF en pièce jointe + miniature inline.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>WhatsApp</b>&nbsp;: image JPG du QR + lien de "
                "téléchargement du PDF + message texte avec les détails.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Wallet Apple / Google</b>&nbsp;: passe wallet généré "
                "automatiquement (phase 2 du Booking Engine) avec mise à "
                "jour push si reprogrammation.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Espace client</b>&nbsp;: téléchargeable à tout moment.",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        Paragraph("9.4 — Scan et résolution", styles["h2"]),
        Paragraph(
            "Le résolveur <code>_resolve_qr_token</code> accepte <b>5 "
            "formats</b>&nbsp;: token exact, lowercase, prefix ≥ 8 hex, "
            "JSON brut, référence courte BBR-* — déjà éprouvé dans l'app "
            "actuelle (audit complet iter-48, 0 bug trouvé).",
            styles["body"],
        ),
        Paragraph("9.5 — Révocation", styles["h2"]),
        Paragraph(
            "Un QR peut être <b>révoqué</b> manuellement par la Direction "
            "(perte signalée par le client, suspicion de fraude, "
            "remboursement total). Le flag <code>revoked=true</code> "
            "déclenche un refus immédiat au scan avec message explicatif.",
            styles["body"],
        ),
    ]


# ── §10 PMS + OTA ───────────────────────────────────────────────────
def build_s10(styles):
    return [
        Paragraph("§10", styles["h1_kicker"]),
        Paragraph("Plan d'intégration PMS + OTA", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Le Booking Engine s'intègre avec deux familles de systèmes&nbsp;: "
            "le <b>PMS Front Desk / Housekeeping</b> (interne) en aval, et "
            "les <b>OTA</b> (Booking.com, Airbnb, Expedia, TravelOka) en "
            "amont/aval pour la distribution.",
            styles["body"],
        ),
        hero_image(f"{DIAG}/08_pms_ota_topology.png",
                   max_width_cm=16, max_height_cm=14),
        Paragraph(
            "Schéma 8 — Topologie d'intégration. Le Booking Engine est la "
            "source de vérité ; le Channel Manager pousse vers les OTA et "
            "ingère les réservations entrantes.",
            styles["caption"]),
        Paragraph("10.1 — Channel Manager (sortants)", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Push toutes les 5 minutes</b> — un worker Celery "
                "synchronise prix et disponibilités vers chaque OTA. "
                "Optimisation&nbsp;: ne push que les deltas (calcul du "
                "diff avec le dernier état envoyé).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Mapping par produit</b>&nbsp;: chaque OTA reçoit une "
                "fraction du stock total (paramétrable, ex. Booking.com = "
                "70% des chambres, 30% gardé en direct).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Uplift de prix</b>&nbsp;: les commissions OTA "
                "(15-25%) sont compensées par un uplift sur le prix "
                "affiché&nbsp;: parité tarifaire perçue par le client mais "
                "marge préservée pour BBr.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Blocage exceptionnel</b>&nbsp;: bouton \"stop sale\" "
                "dans le dashboard staff pour fermer la vente sur tous "
                "les canaux en 30 secondes (urgence, panne, événement "
                "imprévu).",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        Paragraph("10.2 — Ingestion OTA (entrants)", styles["h2"]),
        Paragraph(
            "Chaque OTA pousse les nouvelles réservations vers un webhook "
            "dédié (<code>/api/booking/webhooks/ota/{platform}</code>). Le "
            "Booking Engine&nbsp;: (1) crée la réservation côté PG avec "
            "<code>channel_id = {ota}</code>, (2) décrémente l'inventory, "
            "(3) déclenche immédiatement un re-sync vers les <b>autres</b> "
            "OTA pour fermer la dispo. Cycle complet&nbsp;: &lt; 30 secondes.",
            styles["body"],
        ),
        Paragraph("10.3 — Intégration PMS (post-paiement)", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Chambres</b>&nbsp;: à J-2 (après confirmation paiement "
                "intégral), pré-attribution automatique d'une chambre par "
                "le module Front Desk (selon préférences client + règles "
                "yield). Confirmation manuelle possible par la Réception.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Housekeeping</b>&nbsp;: à J+1 du check-out, "
                "déclenchement automatique du \"to clean\" → mobile staff.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>F&amp;B Restaurant Le Kaai</b>&nbsp;: si une option "
                "restaurant est incluse, le créneau est pré-réservé "
                "automatiquement.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Comptabilité</b>&nbsp;: facture émise automatiquement "
                "au check-in avec TVA (18% en CI), envoyée par email PDF.",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        Paragraph("10.4 — Connecteurs OTA — détail technique", styles["h2"]),
        table_grid([
            ["OTA", "Protocole", "Fréquence", "Endpoint"],
            ["Booking.com", "XML API v2 + webhooks", "Push 5 min",
             "supply.booking.com"],
            ["Airbnb", "GraphQL + webhooks", "Push 5 min",
             "api.airbnb.com/v2"],
            ["Expedia", "EQC REST + webhooks", "Push 5 min",
             "api.expediapartnersolutions.com"],
            ["TravelOka", "REST + polling", "Push 5 min / Pull 10 min",
             "ipi.traveloka.com"],
            ["Hostelworld", "iCal export", "Pull horaire",
             "hostelworld.com/ical"],
        ], col_widths=[3 * cm, 5 * cm, 3.5 * cm, 4.9 * cm]),
    ]


# ── ANNEXES ─────────────────────────────────────────────────────────
def build_annexes(styles):
    return [
        Paragraph("ANNEXE A", styles["h1_kicker"]),
        Paragraph("Espace client", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Portail self-service disponible à "
            "<code>workflow-boulaybeachresort.com/account</code>.",
            styles["body"],
        ),
        Paragraph("Authentification", styles["h3"]),
        Paragraph(
            "<b>OTP via WhatsApp</b> en priorité (Twilio Verify), email en "
            "fallback. Pas de mot de passe à mémoriser. Session JWT 7 jours.",
            styles["body"],
        ),
        Paragraph("Fonctionnalités", styles["h3"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Mes réservations</b>&nbsp;: à venir / passées, filtres "
                "par produit.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Mes tickets</b>&nbsp;: téléchargement PDF, ajout au "
                "Wallet.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Payer le solde</b>&nbsp;: un clic, choix du PSP.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Modifier mes informations</b>&nbsp;: téléphone, email, "
                "nationalité (lecture seule sur nom + prénom une fois "
                "vérifiés).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Mon historique</b>&nbsp;: chiffrement RGPD, "
                "anonymisation possible sur demande.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Mes points fidélité</b>&nbsp;: solde, historique, "
                "récompenses débloquées.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Reprogrammer / annuler</b>&nbsp;: self-service "
                "respectant les règles métier (§6).",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        PageBreak(),
        Paragraph("ANNEXE B", styles["h1_kicker"]),
        Paragraph("Dashboard interne", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Dashboard staff disponible à <code>/staff/booking</code>. "
            "Réservé aux rôles Réception, Comptabilité, Direction, Marketing.",
            styles["body"],
        ),
        Paragraph("Widgets principaux", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Réservations</b>&nbsp;: vues aujourd'hui / semaine / "
                "mois / personnalisée, avec filtres canal, produit, "
                "statut. Drill-down 1-clic sur chaque ligne.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Chiffre d'affaires</b>&nbsp;: total + ventilation par "
                "produit, catégorie, canal, campagne. Comparatif "
                "année-1 / mois-1.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Occupation</b>&nbsp;: chambres (tape chart), activités "
                "(grille slots), événements (calendrier des espaces).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Paiements</b>&nbsp;: encaissés / en attente / remboursés. "
                "Réconciliation en un clic avec les exports PSPs.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Alertes</b>&nbsp;: solde dû à 24h, no-show probable, "
                "double-booking détecté, panne PSP, OTA en retard de sync.",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        PageBreak(),
        Paragraph("ANNEXE C", styles["h1_kicker"]),
        Paragraph("Contrôle d'accès — scanner QR", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Le module Contrôle d'accès (déjà en place dans l'app actuelle) "
            "est conservé. Accessible à <code>/staff/scan</code> pour les "
            "rôles Réception et Contrôle Embarquement.",
            styles["body"],
        ),
        Paragraph("Affichage après scan", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Photo du client</b> (si disponible — sinon initiales).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Statut paiement</b>&nbsp;: PAID / PARTIAL / PENDING.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Produit réservé</b> avec date et slot.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Nombre d'accompagnants</b> + leurs noms.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Options additionnelles</b>&nbsp;: transfer, sunset, etc.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Warnings éventuels</b>&nbsp;: première visite, "
                "membre Platinum (à accueillir avec attention), allergie "
                "déclarée.",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        Paragraph("Actions disponibles", styles["h2"]),
        Paragraph(
            "<b>✓ Valider accès</b> (par défaut, incrémente scan_count) — "
            "<b>✕ Refuser accès</b> (avec motif requis, génère un incident) "
            "— <b>📜 Historique des scans</b> (qui a scanné quoi, quand).",
            styles["body"],
        ),
        PageBreak(),
        Paragraph("ANNEXE D", styles["h1_kicker"]),
        Paragraph("KPIs et analytics par réservation", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Chaque réservation enrichit les agrégats analytics avec ces "
            "champs (capturés au moment de la création)&nbsp;:",
            styles["body"],
        ),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Source d'acquisition</b>&nbsp;: direct, organic, paid, "
                "OTA-{platform}, referral, email, whatsapp.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Campagne publicitaire</b> (FK campaigns) si attribuée "
                "via cookie UTM ou Conversion API Meta.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>UTM source / medium / campaign / term / content</b>.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Device</b>&nbsp;: mobile / tablet / desktop. <b>OS</b> "
                "et <b>navigateur</b>.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Géolocalisation</b>&nbsp;: ville et pays via lookup IP "
                "(MaxMind ou Cloudflare GeoIP).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Canal de réservation</b>&nbsp;: direct site, web app, "
                "espace client, staff manuel, OTA.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Temps de session avant booking</b>&nbsp;: indicateur "
                "du temps d'hésitation (mesure d'efficacité du tunnel).",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        Paragraph("KPIs hebdomadaires automatiques", styles["h2"]),
        table_grid([
            ["KPI", "Formule", "Objectif"],
            ["Taux de conversion tunnel", "bookings / sessions", "≥ 32%"],
            ["Panier moyen", "Σ amount_total / N bookings", "+18% vs 2025"],
            ["RevPAR (chambres)", "CA chambres / nuits dispo", "75 000 XOF"],
            ["Taux de no-show", "no_show / paid", "&lt; 5%"],
            ["ROAS Meta", "CA Meta / dépense Meta", "≥ 6x"],
            ["ROAS Google Ads", "CA Gads / dépense Gads", "≥ 8x"],
            ["Coût d'acquisition (CAC)", "Σ dépenses ads / N nouveaux", "&lt; 8 000 XOF"],
            ["LTV / CAC", "LTV moyen / CAC", "≥ 5x"],
            ["Délai de confirmation", "p95 (paid → ticket reçu)", "&lt; 4s"],
            ["Délai de réponse PSP", "p95 webhook", "&lt; 10s"],
        ], col_widths=[5 * cm, 6 * cm, 5.4 * cm]),
        Spacer(1, 0.4 * cm),
        info_box(
            "Fin du document",
            "Ce document est <b>vivant</b> et sera mis à jour à chaque "
            "phase majeure. La prochaine étape est la <b>conception "
            "détaillée des wireframes</b> (vrais mockups Figma) et la "
            "<b>spécification du Channel Manager OTA</b>. À venir dans le "
            "PROMPT 3.",
            styles,
        ),
    ]


def main():
    styles = make_styles()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2.2 * cm, rightMargin=2.2 * cm,
        topMargin=1.8 * cm, bottomMargin=2 * cm,
        title="BBR Booking Engine — Spécifications fonctionnelles",
        author="Boulay Beach Resort",
    )
    cover_frame = Frame(0, 0, A4[0], A4[1],
                        leftPadding=2 * cm, rightPadding=2 * cm,
                        topPadding=2 * cm, bottomPadding=2 * cm,
                        id="cover")
    interior_frame = Frame(
        2.2 * cm, 2 * cm, A4[0] - 4.4 * cm, A4[1] - 3.8 * cm,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        id="interior")
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=cover_frame, onPage=cover_canvas),
        PageTemplate(id="interior", frames=interior_frame,
                     onPage=interior_canvas),
    ])

    sections = [
        ("cover", build_cover(styles)),
        ("toc", build_toc(styles)),
        ("summary", build_exec_summary(styles)),
        ("s1", build_s1(styles)),
        ("s2", build_s2(styles)),
        ("s3", build_s3(styles)),
        ("s4", build_s4(styles)),
        ("s5", build_s5(styles)),
        ("s6", build_s6(styles)),
        ("s7", build_s7(styles)),
        ("s8", build_s8(styles)),
        ("s9", build_s9(styles)),
        ("s10", build_s10(styles)),
        ("annex", build_annexes(styles)),
    ]
    story = []
    for i, (_, content) in enumerate(sections):
        if i == 0:
            story.extend(content)
            story.append(NextPageTemplate("interior"))
            story.append(PageBreak())
        else:
            story.extend(content)
            if i < len(sections) - 1:
                story.append(PageBreak())

    doc.build(story)
    with open(OUTPUT, "wb") as f:
        f.write(buf.getvalue())
    print(f"✓ Generated {OUTPUT}  ({len(buf.getvalue()) / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
