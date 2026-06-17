"""Generate the BBR Revenue Engine architecture PDF (~35-40 pages).

Outputs:  /app/frontend/public/BBR_Revenue_Engine_Architecture.pdf
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
    PageBreak, ListFlowable, ListItem, KeepTogether, Preformatted,
    PageTemplate, Frame,
)
from reportlab.platypus.flowables import HRFlowable
from reportlab.platypus.doctemplate import NextPageTemplate
from reportlab.pdfgen import canvas as rl_canvas

# ── Palette ──────────────────────────────────────────────────────────
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

DIAG = "/app/manual_assets/revenue_engine"
OUTPUT = "/app/frontend/public/BBR_Revenue_Engine_Architecture.pdf"


def fetch_logo_bytes():
    try:
        req = urllib.request.Request(BBR_LOGO_URL,
                                     headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.read()
    except Exception:
        return None


# ── Page templates ──────────────────────────────────────────────────
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
                      "Boulay Beach Resort  ·  Revenue Engine — Document d'Architecture")
    canvas.drawRightString(w - 2 * cm, 1.2 * cm,
                           f"Page {doc.page}")
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(GOLD)
    canvas.drawString(w - 2 * cm - 7.5 * cm, h - 1.5 * cm,
                      "CONFIDENTIEL — DIRECTION TECHNIQUE")
    canvas.restoreState()


# ── Styles ──────────────────────────────────────────────────────────
def make_styles():
    base = getSampleStyleSheet()
    return {
        "cover_brand": ParagraphStyle(
            "cover_brand", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=10, leading=14, textColor=GOLD_SOFT,
            alignment=1, spaceAfter=18),
        "cover_title": ParagraphStyle(
            "cover_title", parent=base["Title"], fontName="Helvetica-Bold",
            fontSize=36, leading=42, textColor=colors.white,
            alignment=1, spaceAfter=10),
        "cover_engine": ParagraphStyle(
            "cover_engine", parent=base["Title"], fontName="Helvetica-Bold",
            fontSize=46, leading=52, textColor=GOLD,
            alignment=1, spaceAfter=14),
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
            fontSize=14, leading=18, textColor=INK,
            spaceBefore=14, spaceAfter=6),
        "h3": ParagraphStyle(
            "h3", parent=base["Heading3"], fontName="Helvetica-Bold",
            fontSize=11, leading=14, textColor=GOLD,
            spaceBefore=10, spaceAfter=4),
        "body": ParagraphStyle(
            "body", parent=base["BodyText"], fontName="Helvetica",
            fontSize=10, leading=14.5, textColor=INK, spaceAfter=6,
            alignment=4),  # justify
        "lead": ParagraphStyle(
            "lead", parent=base["BodyText"], fontName="Helvetica",
            fontSize=11, leading=16, textColor=INK, spaceAfter=10,
            alignment=4),
        "caption": ParagraphStyle(
            "caption", parent=base["Normal"], fontName="Helvetica-Oblique",
            fontSize=8.5, leading=11, textColor=SUB, alignment=1, spaceAfter=12,
            spaceBefore=4),
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


# ── Reusable components ────────────────────────────────────────────
def hero_image(path, max_width_cm=16, max_height_cm=20, bordered=True):
    img = Image(path)
    iw, ih = img.imageWidth, img.imageHeight
    max_w = max_width_cm * cm
    max_h = max_height_cm * cm
    ratio = min(max_w / iw, max_h / ih)
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


def code_block(text: str, styles):
    return Preformatted(text, styles["code"])


def table_grid(rows, col_widths=None, header=True):
    """Standard 2D table with gold header and zebra rows."""
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
            ("ROWBACKGROUNDS", (0, 1), (-1, -1),
             [colors.white, GOLD_PALE]),
        ])
    t = Table(rows, colWidths=col_widths, repeatRows=1 if header else 0)
    t.setStyle(TableStyle(style))
    return t


# ── COVER ───────────────────────────────────────────────────────────
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
    el.append(Paragraph("Revenue Engine", styles["cover_engine"]))
    el.append(Spacer(1, 0.4 * cm))
    el.append(HRFlowable(width=4 * cm, thickness=1, color=GOLD,
                         hAlign="CENTER", spaceBefore=0, spaceAfter=18))
    el.append(Paragraph("Document d'Architecture Technique",
                        styles["cover_sub"]))
    el.append(Paragraph("Plateforme Unifiée de Revenue Management",
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
    el.append(Paragraph("Document confidentiel — Direction Technique",
                        styles["cover_meta"]))
    return el


# ── TABLE OF CONTENTS ───────────────────────────────────────────────
def build_toc(styles):
    el = [
        Paragraph("SOMMAIRE", styles["h1_kicker"]),
        Paragraph("Table des matières", styles["h1"]),
        Spacer(1, 0.6 * cm),
    ]
    entries = [
        ("Résumé exécutif", "5"),
        ("§1 — Architecture globale du projet", "7"),
        ("§2 — Arborescence complète des dossiers", "10"),
        ("§3 — Schéma UML des modules", "13"),
        ("§4 — Schéma UML de la base de données", "15"),
        ("§5 — Modèle relationnel PostgreSQL (DDL)", "17"),
        ("§6 — Tables détaillées", "22"),
        ("§7 — Relations entre tables", "28"),
        ("§8 — Politique de sécurité", "30"),
        ("§9 — Stratégie de scalabilité", "33"),
        ("§10 — Roadmap de développement des modules", "35"),
        ("Annexes — Conventions, glossaire", "38"),
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


# ── EXECUTIVE SUMMARY ────────────────────────────────────────────────
def build_exec_summary(styles):
    return [
        Paragraph("RÉSUMÉ EXÉCUTIF", styles["h1_kicker"]),
        Paragraph("Une machine de vente automatique", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Le <b>BBR Revenue Engine</b> est une plateforme propriétaire conçue "
            "pour centraliser et automatiser l'ensemble des opérations "
            "commerciales, marketing et de pilotage de Boulay Beach Resort. "
            "Sa vocation est claire&nbsp;: <b>transformer chaque visiteur en "
            "client</b> et <b>chaque client en ambassadeur</b>, sans rupture "
            "entre les canaux d'acquisition, les modules de vente et "
            "l'opération sur site.",
            styles["lead"],
        ),
        Paragraph("Positionnement stratégique", styles["h2"]),
        Paragraph(
            "Le Revenue Engine ne remplace pas l'application opérationnelle "
            "existante (BBR Operations), il s'y <b>superpose</b> en tant que "
            "couche commerciale et analytique. Les deux systèmes communiquent "
            "par événements et webhooks. Cette cohabitation permet de "
            "préserver l'investissement existant tout en accélérant le "
            "développement commercial.",
            styles["body"],
        ),
        Paragraph("Modules couverts", styles["h2"]),
        Paragraph(
            "Hôtel, Beach Club, Activités, Corporate, Événementiel, Membership, "
            "CRM, Marketing et Analytics — 9 modules fonctionnels coordonnés "
            "autour d'un référentiel unique <b>client / produit / réservation / "
            "paiement</b>.",
            styles["body"],
        ),
        Paragraph("Stack technique", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Frontend</b> — React 18 + Vite + TypeScript + Tailwind + "
                "shadcn/ui + React Query + Zustand. Sous-application servie "
                "sur <code>/revenue/*</code>, cohérente avec l'app opérationnelle.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Backend</b> — FastAPI (Python 3.12) avec un nouveau "
                "namespace <code>/api/revenue/*</code>, SQLAlchemy 2 + Alembic "
                "pour PostgreSQL, partage des middlewares d'auth.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Données</b> — <b>MongoDB</b> conservé pour l'opérationnel "
                "(bookings live, planning, cantine) ; <b>PostgreSQL 16</b> "
                "ajouté pour le Revenue Engine (CRM, OTA, campagnes, "
                "analytics) — la richesse relationnelle où elle est utile.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Infrastructure</b> — Cloudflare en frontal (CDN + WAF), "
                "Redis pour le cache + les jobs asynchrones (Celery / RQ), "
                "stockage objet S3-compatible pour les exports.",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        info_box(
            "Note sur le stack",
            "Le prompt initial évoquait Next.js + Supabase + Prisma + Vercel. "
            "Nous adoptons un <b>stack équivalent fonctionnellement</b> mais "
            "<b>cohérent avec l'existant React + FastAPI</b>&nbsp;: l'ajout de "
            "PostgreSQL apporte la richesse relationnelle visée, sans "
            "doubler la facture d'infrastructure ni dupliquer 8 mois de "
            "travail déjà engagés.",
            styles,
        ),
        Paragraph("Promesse fonctionnelle", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Acquisition</b> — Pixel Meta + Google Ads + UTM unifié, "
                "attribution multi-touch, deduplication des conversions via "
                "Conversion API.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Conversion</b> — moteur de pricing dynamique, yield "
                "management par segment, paniers multi-produits avec "
                "code promo intelligent.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Rétention</b> — segmentation RFM automatique, programme "
                "Membership tiers, campagnes triggered (anniversaire, "
                "anniversaire de séjour, panier abandonné).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Distribution</b> — synchronisation OTA via Channel Manager "
                "intégré (Booking.com, Airbnb, Expedia), parité tarifaire "
                "garantie, fenêtres de blocage.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Pilotage</b> — KPIs temps réel, funnels de conversion par "
                "module, ROAS et CPA par campagne, pacing budgétaire, "
                "alertes proactives.",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
    ]


# ── §1 — ARCHITECTURE GLOBALE ────────────────────────────────────────
def build_section_1(styles):
    return [
        Paragraph("§1", styles["h1_kicker"]),
        Paragraph("Architecture globale du projet", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "La plateforme s'articule autour de <b>5 couches</b> hiérarchisées, "
            "chacune ayant une responsabilité claire et des interfaces "
            "explicites avec ses voisines. Le diagramme ci-dessous illustre "
            "la séparation des préoccupations et les flux principaux.",
            styles["body"],
        ),
        Spacer(1, 0.2 * cm),
        hero_image(f"{DIAG}/01_system_architecture.png",
                   max_width_cm=16, max_height_cm=14.5),
        Paragraph("Schéma 1 — Vue d'ensemble du système BBR Revenue Engine.",
                  styles["caption"]),
        Paragraph("Couches détaillées", styles["h2"]),
        Paragraph("Couche ① — Clients", styles["h3"]),
        Paragraph(
            "Trois points d'entrée&nbsp;: le <b>site vitrine</b> (Next.js ou "
            "React statique, hyper-rapide, SEO-friendly), la <b>web app de "
            "réservation</b> (l'app actuelle, /reservations), et les "
            "<b>QR codes</b> envoyés par WhatsApp ou Email après paiement. "
            "Aucun client mobile natif au lancement.",
            styles["body"],
        ),
        Paragraph("Couche ② — Edge (Cloudflare)", styles["h3"]),
        Paragraph(
            "Cloudflare en frontal pour&nbsp;: CDN global (assets statiques, "
            "images, vidéos hero), WAF (protection OWASP Top-10), DDoS, "
            "TLS automatique, rate limiting par IP, bot management. "
            "Coût&nbsp;: gratuit ou Pro 20$/mois.",
            styles["body"],
        ),
        Paragraph("Couche ③ — Opérations (existant, à préserver)", styles["h3"]),
        Paragraph(
            "L'application actuelle <b>React + FastAPI + MongoDB</b> continue "
            "de porter les flux opérationnels temps réel&nbsp;: prise de "
            "réservation, paiement, génération QR + boarding pass, scanner, "
            "cantine, planning RH, dashboard staff. Elle reste la source "
            "de vérité pour <i>l'état live</i> des réservations.",
            styles["body"],
        ),
        Paragraph("Couche ④ — Revenue Engine (nouveau)", styles["h3"]),
        Paragraph(
            "Sous-application React montée sur <code>/revenue/*</code>, "
            "alimentée par un nouveau namespace FastAPI <code>/api/revenue/*</code> "
            "qui consulte <b>PostgreSQL 16</b>. C'est ici que vivent CRM, "
            "Channel Manager OTA, gestion de campagnes, segmentation, "
            "analytics avancés, revenue management.",
            styles["body"],
        ),
        Paragraph("Couche ⑤ — Intégrations externes", styles["h3"]),
        Paragraph(
            "Channel manager OTA (Booking · Airbnb · Expedia · TravelOka), "
            "Meta CAPI (Conversions API serveur-à-serveur), Google Ads + "
            "GA4, FineoPay et Stripe pour le paiement, Twilio et SendGrid "
            "pour la messagerie. Chaque intégration est <b>circuit-breakée</b> "
            "et son indisponibilité ne bloque jamais le booking.",
            styles["body"],
        ),
        Paragraph("Pont entre Opérations et Revenue Engine", styles["h2"]),
        Paragraph(
            "C'est le point névralgique. Deux mécanismes complémentaires&nbsp;:",
            styles["body"],
        ),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Events sortants (Ops → Revenue)</b> — FastAPI émet un "
                "événement à chaque changement d'état important (booking "
                "créé, payé, annulé ; QR scanné ; checkin réalisé). Le "
                "Revenue Engine consomme ces événements pour mettre à jour "
                "ses agrégats analytics et CRM.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>API de lecture (Revenue → Ops)</b> — le Revenue Engine "
                "lit l'inventory live (disponibilités, prix dynamiques) "
                "via API REST, et pousse vers Ops les ajustements de prix "
                "et les blocages calculés par les règles de yield management.",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        info_box(
            "Principe de séparation",
            "<b>Ops = état actuel · Revenue Engine = histoire + futur</b>. "
            "L'application opérationnelle reste rapide et simple. Le Revenue "
            "Engine porte toute la complexité analytique et la logique "
            "commerciale. Cette séparation évite la dégradation des "
            "performances temps réel quand les requêtes analytics se "
            "multiplient.",
            styles,
        ),
    ]


# ── §2 — ARBORESCENCE DES DOSSIERS ───────────────────────────────────
def build_section_2(styles):
    el = [
        Paragraph("§2", styles["h1_kicker"]),
        Paragraph("Arborescence complète des dossiers", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "L'arborescence ci-dessous reflète le monorepo final, avec les "
            "deux applications (Ops existante et Revenue Engine) coexistant "
            "sous <code>/app/</code>. Les dossiers <i>en gras</i> sont "
            "<b>nouveaux</b>.",
            styles["body"],
        ),
    ]
    tree = """/app/
├── backend/                         # FastAPI (existant + extensions)
│   ├── server.py                    # Routes opérationnelles (legacy)
│   ├── routers/
│   │   ├── cantine.py               # ↺ existant
│   │   ├── planning.py              # ↺ existant
│   │   ├── registrations.py         # ↺ existant
│   │   ├── revenue/                 # ★ NOUVEAU
│   │   │   ├── __init__.py
│   │   │   ├── crm.py               # /api/revenue/crm/*
│   │   │   ├── memberships.py       # /api/revenue/memberships/*
│   │   │   ├── campaigns.py         # /api/revenue/campaigns/*
│   │   │   ├── ota.py               # /api/revenue/ota/*
│   │   │   ├── analytics.py         # /api/revenue/analytics/*
│   │   │   ├── yield_mgmt.py        # /api/revenue/yield/*
│   │   │   └── attribution.py       # /api/revenue/attribution/*
│   │   └── ...
│   ├── models/                      # ★ NOUVEAU — modèles SQLAlchemy
│   │   ├── __init__.py
│   │   ├── base.py                  # Base déclarative + mixins
│   │   ├── user.py
│   │   ├── customer.py
│   │   ├── product.py
│   │   ├── reservation.py
│   │   ├── payment.py
│   │   ├── qr_code.py
│   │   ├── channel.py
│   │   ├── campaign.py
│   │   ├── membership.py
│   │   ├── analytics_event.py
│   │   └── audit_log.py
│   ├── schemas/                     # ★ NOUVEAU — Pydantic v2 DTOs
│   ├── services/
│   │   ├── ops_sync.py              # ★ Pont Ops ↔ Revenue (events)
│   │   ├── yield_engine.py          # ★ Calcul de prix dynamiques
│   │   ├── attribution.py           # ★ Multi-touch attribution
│   │   ├── ota_channel_mgr.py       # ★ Sync OTA
│   │   └── ...
│   ├── workers/                     # ★ NOUVEAU — jobs Celery / RQ
│   │   ├── celery_app.py
│   │   ├── sync_ota.py              # toutes les 5min
│   │   ├── recalc_lifetime_value.py # quotidien
│   │   ├── compute_rfm_segments.py  # hebdomadaire
│   │   └── meta_conversion_api.py   # temps réel
│   ├── alembic/                     # ★ NOUVEAU — migrations PG
│   │   ├── env.py
│   │   └── versions/
│   ├── tests/
│   │   ├── test_iteration29_scanner_fix.py
│   │   ├── test_qr_audit_boarding.py
│   │   └── revenue/                 # ★ NOUVEAU
│   │       ├── test_crm.py
│   │       ├── test_yield.py
│   │       └── test_attribution.py
│   ├── core/                        # ★ config, security, db, deps
│   │   ├── config.py
│   │   ├── security.py
│   │   ├── db_mongo.py
│   │   ├── db_postgres.py
│   │   └── dependencies.py
│   ├── requirements.txt
│   └── .env
├── frontend/                        # React (existant + extension)
│   ├── public/
│   │   ├── Manuel_Planning_BBr.pdf
│   │   ├── Manuel_Cantine_BBr.pdf
│   │   └── BBR_Revenue_Engine_Architecture.pdf
│   └── src/
│       ├── pages/                   # ↺ existant
│       │   ├── reservations/
│       │   ├── cantine/
│       │   ├── staff/
│       │   └── revenue/             # ★ NOUVEAU — pages du Revenue Engine
│       │       ├── DashboardKpis.jsx
│       │       ├── CrmCustomers.jsx
│       │       ├── CrmSegments.jsx
│       │       ├── CampaignsList.jsx
│       │       ├── CampaignDetail.jsx
│       │       ├── OtaChannels.jsx
│       │       ├── OtaCalendar.jsx
│       │       ├── MembershipsList.jsx
│       │       ├── YieldRules.jsx
│       │       ├── Attribution.jsx
│       │       └── Reports.jsx
│       ├── components/
│       │   ├── ui/                  # shadcn/ui (existant)
│       │   ├── charts/              # ★ NOUVEAU — Recharts/Tremor
│       │   └── revenue/             # ★ Composants Revenue Engine
│       ├── stores/                  # ★ NOUVEAU — Zustand
│       │   ├── authStore.ts
│       │   ├── revenueStore.ts
│       │   └── filtersStore.ts
│       ├── hooks/
│       │   └── revenue/             # ★ React Query hooks
│       │       ├── useCustomers.ts
│       │       ├── useCampaigns.ts
│       │       └── useKpis.ts
│       ├── lib/
│       │   ├── api.ts               # client axios
│       │   └── tracking.ts          # ★ pixel + UTM
│       ├── App.jsx
│       └── ...
├── infra/                           # ★ NOUVEAU
│   ├── docker-compose.yml
│   ├── postgres/
│   │   └── init.sql
│   ├── redis/
│   └── cloudflare/
│       └── wrangler.toml
├── docs/                            # ★ NOUVEAU
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── INTEGRATIONS.md
│   └── RUNBOOK.md
├── scripts/                         # ↺ existant
│   ├── generate_planning_manual.py
│   ├── generate_cantine_manual.py
│   ├── generate_revenue_engine_pdf.py
│   └── revenue_engine_diagrams.py
└── memory/
    └── PRD.md"""
    el.append(code_block(tree, styles))
    el.append(Spacer(1, 0.3 * cm))
    el.append(info_box(
        "Convention de nommage",
        "<b>↺ existant</b> = code de l'app actuelle, conservé tel quel. "
        "<b>★ NOUVEAU</b> = code à créer dans la phase Revenue Engine. "
        "Aucun fichier existant n'est supprimé. Toutes les nouvelles routes "
        "sont préfixées <code>/api/revenue/*</code> pour faciliter le "
        "monitoring, le rate-limiting et le déploiement progressif.",
        styles,
    ))
    return el


# ── §3 — UML MODULES ────────────────────────────────────────────────
def build_section_3(styles):
    return [
        Paragraph("§3", styles["h1_kicker"]),
        Paragraph("Schéma UML des modules", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Le Revenue Engine est structuré en 9 modules fonctionnels. Le "
            "module <b>CRM</b> est central — toutes les autres briques le "
            "référencent. Le module <b>Marketing</b> alimente le CRM en "
            "leads et conversions. Le module <b>Analytics</b> consomme "
            "l'ensemble des autres modules pour produire des indicateurs.",
            styles["body"],
        ),
        Spacer(1, 0.2 * cm),
        hero_image(f"{DIAG}/02_modules_uml.png",
                   max_width_cm=16, max_height_cm=15),
        Paragraph("Schéma 2 — Modules fonctionnels et leurs dépendances.",
                  styles["caption"]),
        Paragraph("Modules métier — produits réservables", styles["h2"]),
        Paragraph(
            "Cinq modules incarnent l'offre commerciale de BBr&nbsp;: "
            "<b>Hôtel</b>, <b>Beach Club</b>, <b>Activités</b>, <b>Corporate</b> "
            "et <b>Événementiel</b>. Tous partagent un référentiel commun "
            "<i>Product / Inventory / Reservation</i>, mais chacun apporte "
            "ses règles spécifiques (slots horaires pour les activités, "
            "devis pour le corporate, packagings pour l'événementiel, etc.).",
            styles["body"],
        ),
        Paragraph("Modules transversaux", styles["h2"]),
        Paragraph(
            "Quatre modules orchestrent l'expérience client&nbsp;: <b>CRM</b> "
            "(référentiel client + segmentation), <b>Membership</b> (programme "
            "de fidélité), <b>Marketing</b> (acquisition + retargeting), "
            "<b>Analytics</b> (pilotage + attribution).",
            styles["body"],
        ),
    ]


# ── §4 — UML BDD ────────────────────────────────────────────────────
def build_section_4(styles):
    return [
        Paragraph("§4", styles["h1_kicker"]),
        Paragraph("Schéma UML de la base de données", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Le schéma relationnel ci-dessous présente les 13 entités "
            "principales du Revenue Engine PostgreSQL avec leurs attributs "
            "clés et leurs relations.",
            styles["body"],
        ),
        Spacer(1, 0.2 * cm),
        hero_image(f"{DIAG}/03_erd.png",
                   max_width_cm=16, max_height_cm=22),
        Paragraph(
            "Schéma 3 — ERD complet du schéma PostgreSQL <code>revenue_engine</code>.",
            styles["caption"]),
    ]


# ── §5 — DDL PostgreSQL ─────────────────────────────────────────────
def build_section_5(styles):
    sql_enums = """-- Types énumérés (revenue_engine.<type>)
CREATE TYPE user_role AS ENUM (
    'super_admin', 'direction', 'marketing', 'reception',
    'comptabilite', 'commercial', 'controle_embarquement'
);
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE customer_type AS ENUM ('individual', 'company');
CREATE TYPE module_type AS ENUM (
    'hotel', 'beach_club', 'activities',
    'corporate', 'events', 'membership'
);
CREATE TYPE product_category AS ENUM (
    'room', 'suite_lagoon', 'suite_garden',
    'day_pass', 'sunset', 'brunch',
    'jet_ski', 'paddle', 'canoe', 'quad', 'buggy',
    'padel', 'mtb', 'multisport',
    'seminar', 'conference', 'team_building',
    'wedding', 'birthday', 'concert', 'private_event'
);
CREATE TYPE product_status AS ENUM ('active', 'paused', 'archived');
CREATE TYPE reservation_status AS ENUM (
    'pending', 'confirmed', 'paid', 'checked_in',
    'completed', 'cancelled', 'no_show', 'refunded'
);
CREATE TYPE payment_type AS ENUM ('deposit', 'final', 'refund', 'tip');
CREATE TYPE payment_method AS ENUM (
    'card', 'mobile_money', 'cash', 'transfer', 'voucher'
);
CREATE TYPE payment_status AS ENUM (
    'pending', 'authorized', 'captured', 'failed', 'refunded'
);
CREATE TYPE membership_tier AS ENUM ('bronze', 'gold', 'platinum');
CREATE TYPE membership_status AS ENUM (
    'active', 'expired', 'suspended', 'cancelled'
);
CREATE TYPE campaign_status AS ENUM (
    'draft', 'scheduled', 'active', 'paused', 'completed', 'archived'
);
CREATE TYPE qr_code_type AS ENUM ('ticket', 'wallet', 'registration');"""
    sql_main = """-- Schéma principal
CREATE SCHEMA IF NOT EXISTS revenue_engine;
SET search_path TO revenue_engine, public;

-- 1. UTILISATEURS BACK-OFFICE
CREATE TABLE users (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email             CITEXT UNIQUE NOT NULL,
    password_hash     TEXT NOT NULL,
    role              user_role NOT NULL,
    first_name        TEXT NOT NULL,
    last_name         TEXT NOT NULL,
    phone             TEXT,
    status            user_status NOT NULL DEFAULT 'active',
    mfa_enabled       BOOLEAN NOT NULL DEFAULT false,
    mfa_secret_enc    BYTEA,
    last_login_at     TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_role ON users(role) WHERE status = 'active';

-- 2. CLIENTS / ENTREPRISES (CRM)
CREATE TABLE customers (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type                  customer_type NOT NULL,
    email                 CITEXT,
    phone                 TEXT,
    first_name            TEXT,
    last_name             TEXT,
    company_name          TEXT,
    vat_id                TEXT,
    nationality           CHAR(2),
    language              CHAR(2) DEFAULT 'fr',
    date_of_birth         DATE,
    preferences           JSONB NOT NULL DEFAULT '{}',
    loyalty_score         INTEGER NOT NULL DEFAULT 0,
    lifetime_value        NUMERIC(12,2) NOT NULL DEFAULT 0,
    rfm_segment           TEXT,
    acquisition_source_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    consent_marketing     BOOLEAN NOT NULL DEFAULT false,
    consent_marketing_at  TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
        (type = 'individual' AND first_name IS NOT NULL)
        OR (type = 'company' AND company_name IS NOT NULL)
    )
);
CREATE INDEX idx_customers_email ON customers(email) WHERE email IS NOT NULL;
CREATE INDEX idx_customers_phone ON customers(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_customers_rfm ON customers(rfm_segment);

-- 3. PRODUITS
CREATE TABLE products (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module       module_type NOT NULL,
    category     product_category NOT NULL,
    code         TEXT UNIQUE NOT NULL,
    name_fr      TEXT NOT NULL,
    name_en      TEXT,
    description  TEXT,
    base_price   NUMERIC(10,2) NOT NULL,
    currency     CHAR(3) NOT NULL DEFAULT 'XOF',
    capacity     INTEGER,
    duration_min INTEGER,
    attributes   JSONB NOT NULL DEFAULT '{}',
    status       product_status NOT NULL DEFAULT 'active',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. INVENTAIRE (capacité par produit/date/slot)
CREATE TABLE inventory (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    slot            TEXT,                       -- '10H', '16H', null = all-day
    capacity_total  INTEGER NOT NULL,
    capacity_sold   INTEGER NOT NULL DEFAULT 0,
    price_override  NUMERIC(10,2),
    UNIQUE (product_id, date, slot)
);
CREATE INDEX idx_inventory_date ON inventory(date);
CREATE INDEX idx_inventory_avail ON inventory(product_id, date)
    WHERE capacity_sold < capacity_total;

-- 5. CANAUX DE DISTRIBUTION
CREATE TABLE channels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    commission_pct  NUMERIC(5,2) NOT NULL DEFAULT 0,
    api_endpoint    TEXT,
    api_creds_ref   TEXT,                       -- ref to secrets vault
    sync_strategy   TEXT NOT NULL,              -- 'push', 'ical', 'poll'
    is_active       BOOLEAN NOT NULL DEFAULT true
);

-- 6. MAPPING PRODUITS ↔ CANAUX
CREATE TABLE channel_product_map (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id        UUID NOT NULL REFERENCES channels(id),
    product_id        UUID NOT NULL REFERENCES products(id),
    external_id       TEXT NOT NULL,
    price_uplift_pct  NUMERIC(5,2) NOT NULL DEFAULT 0,
    availability_pct  NUMERIC(5,2) NOT NULL DEFAULT 100,
    last_sync_at      TIMESTAMPTZ,
    UNIQUE (channel_id, product_id)
);

-- 7. CAMPAGNES MARKETING
CREATE TABLE campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform        TEXT NOT NULL,              -- 'meta', 'gads', 'email', 'whatsapp'
    name            TEXT NOT NULL,
    objective       TEXT,
    target_module   module_type,
    budget          NUMERIC(10,2),
    spent           NUMERIC(10,2) NOT NULL DEFAULT 0,
    starts_at       TIMESTAMPTZ,
    ends_at         TIMESTAMPTZ,
    utm_source      TEXT,
    utm_medium      TEXT,
    utm_campaign    TEXT,
    external_id     TEXT,                       -- ad set / campaign id côté plateforme
    status          campaign_status NOT NULL DEFAULT 'draft',
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaigns_utm ON campaigns(utm_source, utm_medium, utm_campaign);
CREATE INDEX idx_campaigns_active ON campaigns(status) WHERE status = 'active';

-- 8. MEMBERSHIPS
CREATE TABLE memberships (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    card_no      TEXT UNIQUE NOT NULL,
    tier         membership_tier NOT NULL,
    starts_at    DATE NOT NULL,
    expires_at   DATE NOT NULL,
    benefits     JSONB NOT NULL DEFAULT '{}',
    auto_renew   BOOLEAN NOT NULL DEFAULT true,
    status       membership_status NOT NULL DEFAULT 'active',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_memberships_customer ON memberships(customer_id);
CREATE INDEX idx_memberships_active ON memberships(status, expires_at)
    WHERE status = 'active';

-- 9. RÉSERVATIONS
CREATE TABLE reservations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference       TEXT UNIQUE NOT NULL,
    customer_id     UUID NOT NULL REFERENCES customers(id),
    product_id      UUID NOT NULL REFERENCES products(id),
    date_in         DATE NOT NULL,
    date_out        DATE,
    slot            TEXT,
    adults          INTEGER NOT NULL DEFAULT 1,
    children        INTEGER NOT NULL DEFAULT 0,
    amount_total    NUMERIC(12,2) NOT NULL,
    amount_paid     NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency        CHAR(3) NOT NULL DEFAULT 'XOF',
    status          reservation_status NOT NULL DEFAULT 'pending',
    channel_id      UUID REFERENCES channels(id),
    campaign_id     UUID REFERENCES campaigns(id),
    membership_id   UUID REFERENCES memberships(id),
    notes           TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}',
    -- Link back to Operations Mongo document
    ops_booking_id  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_res_customer ON reservations(customer_id);
CREATE INDEX idx_res_product_date ON reservations(product_id, date_in);
CREATE INDEX idx_res_status ON reservations(status);
CREATE INDEX idx_res_channel ON reservations(channel_id);
CREATE INDEX idx_res_campaign ON reservations(campaign_id);

-- 10. PAIEMENTS
CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id  UUID NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT,
    type            payment_type NOT NULL,
    method          payment_method NOT NULL,
    provider        TEXT,                       -- 'fineopay', 'stripe', 'cash'
    provider_ref    TEXT,
    amount          NUMERIC(12,2) NOT NULL,
    currency        CHAR(3) NOT NULL DEFAULT 'XOF',
    status          payment_status NOT NULL DEFAULT 'pending',
    failure_reason  TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pay_res ON payments(reservation_id);
CREATE INDEX idx_pay_status ON payments(status);

-- 11. QR CODES
CREATE TABLE qr_codes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id   UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    type             qr_code_type NOT NULL,
    token            TEXT UNIQUE NOT NULL,
    payload_compact  TEXT NOT NULL,             -- the JSON encoded in the QR
    scan_count       INTEGER NOT NULL DEFAULT 0,
    last_scan_at     TIMESTAMPTZ,
    last_scan_by     UUID REFERENCES users(id),
    revoked          BOOLEAN NOT NULL DEFAULT false,
    revoked_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_qr_token ON qr_codes(token) WHERE NOT revoked;

-- 12. ÉVÉNEMENTS ANALYTICS (table volumineuse — partitionnée par mois)
CREATE TABLE analytics_events (
    id            UUID NOT NULL DEFAULT gen_random_uuid(),
    session_id    UUID,
    visitor_id    UUID,
    customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
    event_type    TEXT NOT NULL,                -- 'page_view', 'add_to_cart', 'purchase', ...
    page          TEXT,
    referrer      TEXT,
    utm_source    TEXT,
    utm_medium    TEXT,
    utm_campaign  TEXT,
    value         NUMERIC(12,2),
    currency      CHAR(3),
    props         JSONB NOT NULL DEFAULT '{}',
    occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);
-- Partitions mensuelles créées via pg_partman.

-- 13. JOURNAL D'AUDIT (write-once, append-only)
CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    UUID REFERENCES users(id),
    entity_type TEXT NOT NULL,
    entity_id   UUID NOT NULL,
    action      TEXT NOT NULL,                  -- 'create', 'update', 'delete'
    diff        JSONB NOT NULL,
    ip          INET,
    user_agent  TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_actor ON audit_log(actor_id, occurred_at DESC);"""

    return [
        Paragraph("§5", styles["h1_kicker"]),
        Paragraph("Modèle relationnel PostgreSQL (DDL)", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Le DDL complet est livré ci-dessous, regroupé en deux blocs&nbsp;: "
            "<b>types énumérés</b> puis <b>tables</b>. Tous les objets vivent "
            "dans le schéma <code>revenue_engine</code> pour isolation et "
            "facilité de backup. Les UUID sont la clé primaire universelle "
            "(via <code>gen_random_uuid()</code>) pour préparer un éventuel "
            "sharding ultérieur.",
            styles["body"],
        ),
        Paragraph("5.1 — Types énumérés", styles["h2"]),
        code_block(sql_enums, styles),
        PageBreak(),
        Paragraph("5.2 — Tables principales", styles["h2"]),
        code_block(sql_main, styles),
        info_box(
            "Extensions PostgreSQL requises",
            "<code>uuid-ossp</code> (UUID v4) · <code>citext</code> "
            "(emails case-insensitive) · <code>pg_trgm</code> (recherche "
            "approximative pour le CRM) · <code>pg_partman</code> (partitions "
            "analytics_events) · <code>pgcrypto</code> (chiffrement champs "
            "sensibles) · <code>btree_gist</code> (exclusion constraints sur "
            "inventory).",
            styles,
        ),
    ]


# ── §6 — TABLES DÉTAILLÉES ──────────────────────────────────────────
def build_section_6(styles):
    def t_intro(name, purpose, vol):
        return [
            Paragraph(f"<b>{name}</b>", styles["h3"]),
            Paragraph(f"<i>{purpose}</i>", styles["body"]),
            Paragraph(f"<b>Volumétrie attendue&nbsp;:</b> {vol}",
                      styles["body"]),
        ]

    def t_cols(rows):
        header = ["Colonne", "Type", "Description"]
        return table_grid([header] + rows,
                          col_widths=[4.2 * cm, 3.5 * cm, 8.7 * cm])

    el = [
        Paragraph("§6", styles["h1_kicker"]),
        Paragraph("Tables détaillées", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Description fonctionnelle des 13 tables principales. Chaque "
            "fiche précise la <b>finalité</b>, la <b>volumétrie attendue</b> "
            "et le <b>détail des colonnes</b>.",
            styles["body"],
        ),
    ]

    el.extend(t_intro(
        "users",
        "Utilisateurs back-office du Revenue Engine (et du staff opérationnel).",
        "≤ 100 lignes — table à très faible cardinalité, mais lue à "
        "chaque requête (authentification JWT)."))
    el.append(t_cols([
        ["id", "UUID", "Identifiant universel (PK)."],
        ["email", "CITEXT", "Email unique, case-insensitive."],
        ["password_hash", "TEXT", "Bcrypt (cost 12) ou Argon2id."],
        ["role", "user_role", "Rôle parmi les 7 rôles définis."],
        ["status", "user_status", "active · suspended · deleted."],
        ["mfa_enabled / mfa_secret_enc", "BOOL/BYTEA", "TOTP optionnel, secret chiffré."],
        ["last_login_at", "TIMESTAMPTZ", "Pour détecter les comptes dormants."],
    ]))

    el.extend(t_intro(
        "customers",
        "Référentiel central CRM — individus et entreprises. "
        "Dédupliqué sur (email, phone).",
        "≈ 500 → 50 000 lignes sur 3 ans. Croissance ~3 000/mois "
        "en régime stabilisé."))
    el.append(t_cols([
        ["type", "customer_type", "individual ou company."],
        ["email/phone", "CITEXT/TEXT", "Clés de déduplication."],
        ["company_name/vat_id", "TEXT", "Pour les comptes B2B."],
        ["preferences", "JSONB", "Allergies, exigences, préférences chambre."],
        ["loyalty_score", "INT", "0–1000, calculé hebdo."],
        ["lifetime_value", "NUMERIC", "Cumul payé sur la vie du client."],
        ["rfm_segment", "TEXT", "Champion · Loyal · Risk · Lost · …"],
        ["acquisition_source_id", "FK campaigns", "Première campagne ayant converti."],
        ["consent_marketing", "BOOL", "Conformité RGPD/UE."],
    ]))

    el.extend(t_intro(
        "products",
        "Catalogue des produits réservables, tous modules confondus.",
        "≈ 100–200 lignes. Croissance lente."))
    el.append(t_cols([
        ["module", "module_type", "hotel, beach_club, activities, …"],
        ["category", "product_category", "room, day_pass, jet_ski, wedding, …"],
        ["code", "TEXT", "Code court unique (ex. DAYPASS_ADULT)."],
        ["base_price/currency", "NUMERIC/CHAR(3)", "Prix de référence."],
        ["capacity", "INT", "Quantité max par slot (nullable)."],
        ["duration_min", "INT", "Durée du service (jet ski 30 min, etc.)."],
        ["attributes", "JSONB", "Spécifs libres : age min, équipement fourni."],
    ]))

    el.extend(t_intro(
        "inventory",
        "Capacité disponible par <b>produit × date × slot</b>. "
        "Table clé du yield management.",
        "≈ 365 × 100 produits × 3 slots = ~100 000 lignes/an."))
    el.append(t_cols([
        ["product_id + date + slot", "UNIQUE", "Triplet métier."],
        ["capacity_total", "INT", "Capacité brute du créneau."],
        ["capacity_sold", "INT", "Compteur mis à jour à chaque booking."],
        ["price_override", "NUMERIC", "Surcharge prix (yield ou promo)."],
    ]))

    el.extend(t_intro(
        "channels & channel_product_map",
        "Canaux de distribution OTA + mapping fin par produit "
        "(prix uplift, % d'allotement, ID externe).",
        "channels ≤ 20 · mapping ≈ 20 × 100 = 2 000 lignes."))
    el.append(t_cols([
        ["code", "TEXT", "direct · booking · airbnb · expedia · …"],
        ["commission_pct", "NUMERIC", "0 pour direct, 18% Booking, …"],
        ["sync_strategy", "TEXT", "push API · ical · poll."],
        ["external_id", "TEXT", "ID hôtel/listing sur la plateforme."],
        ["price_uplift_pct", "NUMERIC", "Marge OTA appliquée."],
        ["availability_pct", "NUMERIC", "% du stock alloué au canal."],
    ]))

    el.extend(t_intro(
        "campaigns",
        "Campagnes Marketing (Meta, Google Ads, Email, WhatsApp). "
        "UTM unifié.",
        "≈ 50–200 campagnes actives à tout moment."))
    el.append(t_cols([
        ["platform", "TEXT", "meta · gads · email · whatsapp · referral."],
        ["target_module", "module_type", "Module ciblé."],
        ["budget/spent", "NUMERIC", "Budget alloué vs consommé (pacing)."],
        ["utm_source/medium/campaign", "TEXT", "Pour l'attribution."],
        ["external_id", "TEXT", "ID côté plateforme."],
        ["status", "campaign_status", "draft · scheduled · active · paused · …"],
    ]))

    el.extend(t_intro(
        "memberships",
        "Cartes de fidélité — Bronze / Or / Platine. Auto-renouvellement annuel.",
        "≈ 1 000 → 10 000 cartes actives."))
    el.append(t_cols([
        ["card_no", "TEXT UNIQUE", "Numéro lisible (ex. BBR-2026-0042)."],
        ["tier", "membership_tier", "bronze · gold · platinum."],
        ["starts_at / expires_at", "DATE", "Validité de 1 an."],
        ["benefits", "JSONB", "% réduc, accès, surclassement, plages, …"],
        ["auto_renew", "BOOL", "Renouvellement automatique."],
    ]))

    el.extend(t_intro(
        "reservations",
        "Cœur transactionnel — toute vente est une réservation, quel que "
        "soit le module. Référence visible <code>BBR-AB12-XY34</code>.",
        "≈ 10 000 / mois en régime de croisière. Plus de 1 M sur 5 ans."))
    el.append(t_cols([
        ["reference", "TEXT UNIQUE", "Ref humaine pour l'agent et le client."],
        ["customer_id / product_id", "FK", "Qui a réservé quoi."],
        ["date_in / date_out / slot", "DATE/TEXT", "Quand."],
        ["amount_total / amount_paid", "NUMERIC", "Encaissé vs total dû."],
        ["status", "reservation_status", "8 états du tunnel (pending → completed)."],
        ["channel_id / campaign_id / membership_id", "FK", "Attribution complète."],
        ["ops_booking_id", "TEXT", "Pont vers le document MongoDB Ops."],
        ["metadata", "JSONB", "Champs libres (notes, options, source)."],
    ]))

    el.extend(t_intro(
        "payments",
        "Mouvements financiers (acomptes, soldes, remboursements). "
        "Une réservation peut avoir 1..N paiements.",
        "≈ 1,2 × reservations ≈ 12 000/mois."))
    el.append(t_cols([
        ["reservation_id", "FK", "Réservation rattachée."],
        ["type", "payment_type", "deposit · final · refund · tip."],
        ["method", "payment_method", "card · mobile_money · cash · transfer."],
        ["provider/provider_ref", "TEXT", "Référence du PSP (FineoPay, Stripe)."],
        ["amount/currency", "NUMERIC/CHAR(3)", "Montant + devise."],
        ["status", "payment_status", "pending · authorized · captured · failed · refunded."],
    ]))

    el.extend(t_intro(
        "qr_codes",
        "Tickets et passes (boarding pass, wallet, registration). "
        "Chaque réservation génère 1..N QR.",
        "≈ 1,5 × reservations ≈ 15 000/mois."))
    el.append(t_cols([
        ["token", "TEXT UNIQUE", "32-hex random (cryptographiquement sûr)."],
        ["type", "qr_code_type", "ticket · wallet · registration."],
        ["payload_compact", "TEXT", "JSON ~75 chars stocké dans le QR."],
        ["scan_count / last_scan_at / last_scan_by", "—", "Audit du scan."],
        ["revoked", "BOOL", "Désactivation manuelle (perte, fraude)."],
    ]))

    el.extend(t_intro(
        "analytics_events",
        "Flux temps réel d'événements (page views, clics, conversions). "
        "Partitionné mensuellement pour des purges efficaces.",
        "≈ 1 M lignes / mois. Conservation 13 mois en hot, archive S3 au-delà."))
    el.append(t_cols([
        ["session_id / visitor_id", "UUID", "Anonyme avant login."],
        ["customer_id", "FK (nullable)", "Une fois identifié."],
        ["event_type", "TEXT", "page_view · add_to_cart · purchase · …"],
        ["utm_source/medium/campaign", "TEXT", "Capture l'origine."],
        ["value", "NUMERIC", "Montant si conversion."],
        ["props", "JSONB", "Données contextuelles (device, page, etc.)."],
        ["occurred_at", "TIMESTAMPTZ", "Clé de partitionnement."],
    ]))

    el.extend(t_intro(
        "audit_log",
        "Journal append-only des actions critiques (write tables). "
        "Pour la conformité, la traçabilité et le forensic.",
        "≈ 50 000 lignes/mois. Rotation S3 trimestrielle."))
    el.append(t_cols([
        ["actor_id", "FK users", "Qui a fait l'action."],
        ["entity_type / entity_id", "TEXT/UUID", "Sur quoi."],
        ["action", "TEXT", "create · update · delete · login · …"],
        ["diff", "JSONB", "Avant/après pour les updates."],
        ["ip / user_agent", "INET/TEXT", "Forensic réseau."],
    ]))

    return el


# ── §7 — RELATIONS ENTRE TABLES ─────────────────────────────────────
def build_section_7(styles):
    rels = [
        ["Table parente", "Table enfant", "FK", "Cardinalité",
         "Suppression"],
        ["customers", "reservations", "customer_id", "1..N", "RESTRICT"],
        ["customers", "memberships", "customer_id", "1..N", "CASCADE"],
        ["customers", "analytics_events", "customer_id", "1..N", "SET NULL"],
        ["products", "inventory", "product_id", "1..N", "CASCADE"],
        ["products", "reservations", "product_id", "1..N", "RESTRICT"],
        ["products", "channel_product_map", "product_id", "1..N", "CASCADE"],
        ["reservations", "payments", "reservation_id", "1..N", "RESTRICT"],
        ["reservations", "qr_codes", "reservation_id", "1..N", "CASCADE"],
        ["channels", "channel_product_map", "channel_id", "1..N", "CASCADE"],
        ["channels", "reservations", "channel_id", "1..N", "SET NULL"],
        ["campaigns", "reservations", "campaign_id", "1..N", "SET NULL"],
        ["campaigns", "customers", "acquisition_source_id", "1..N", "SET NULL"],
        ["campaigns", "analytics_events", "(via utm_*)", "1..N", "n/a"],
        ["memberships", "reservations", "membership_id", "1..N", "SET NULL"],
        ["users", "qr_codes", "last_scan_by", "1..N", "SET NULL"],
        ["users", "audit_log", "actor_id", "1..N", "SET NULL"],
        ["users", "campaigns", "created_by", "1..N", "SET NULL"],
    ]
    return [
        Paragraph("§7", styles["h1_kicker"]),
        Paragraph("Relations entre tables", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Toutes les relations utilisent les clés étrangères UUID "
            "avec règle de suppression explicite. <b>RESTRICT</b> empêche "
            "la suppression d'une entité parente liée à des enfants. "
            "<b>CASCADE</b> supprime les enfants en cascade. <b>SET NULL</b> "
            "préserve l'historique tout en libérant la référence.",
            styles["body"],
        ),
        Spacer(1, 0.2 * cm),
        table_grid(rels, col_widths=[3.5 * cm, 3.5 * cm, 3.5 * cm, 2.5 * cm, 3.4 * cm]),
        Spacer(1, 0.4 * cm),
        info_box(
            "Pourquoi RESTRICT sur customers ↔ reservations ?",
            "Un client avec un historique de réservations ne doit jamais "
            "être supprimé physiquement — il est <b>anonymisé</b> (RGPD) "
            "via une procédure dédiée qui efface les PII tout en conservant "
            "l'historique commercial pour l'analyse.",
            styles,
        ),
        Paragraph("Contraintes complémentaires", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Exclusion constraint</b> sur <code>inventory(product_id, "
                "date, slot)</code> via <code>btree_gist</code> — empêche "
                "deux lignes pour le même triplet.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Check constraint</b> <code>amount_paid &lt;= "
                "amount_total + tolerance</code> sur reservations — sécurité "
                "comptable.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Check constraint</b> sur customers : individu OU "
                "entreprise (jamais les deux, jamais aucun).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Trigger d'audit</b> sur les tables sensibles "
                "(users, customers, reservations, payments) — chaque UPDATE "
                "écrit automatiquement dans <code>audit_log</code>.",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
    ]


# ── §8 — POLITIQUE DE SÉCURITÉ ──────────────────────────────────────
def build_section_8(styles):
    el = [
        Paragraph("§8", styles["h1_kicker"]),
        Paragraph("Politique de sécurité", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "La sécurité du Revenue Engine s'appuie sur une approche "
            "<b>défense en profondeur</b> à 6 niveaux. Chaque niveau "
            "indépendant garantit que la compromission d'un seul ne suffit "
            "pas à mettre l'ensemble en péril.",
            styles["body"],
        ),
        Paragraph("8.1 — Matrice de rôles (RBAC)", styles["h2"]),
        Paragraph(
            "Sept rôles fonctionnels, chacun avec un périmètre de droits "
            "explicite. Le principe est <b>moindre privilège</b> systématique.",
            styles["body"],
        ),
        Spacer(1, 0.1 * cm),
        hero_image(f"{DIAG}/05_role_matrix.png",
                   max_width_cm=16, max_height_cm=8),
        Paragraph("Schéma 4 — Vue d'ensemble des 7 rôles utilisateurs.",
                  styles["caption"]),
    ]
    rbac_matrix = [
        ["Module", "Super Admin", "Direction", "Marketing", "Réception", "Compta", "Commercial", "Embarq."],
        ["Hôtel",         "R/W", "R", "R", "R/W", "R", "R", "—"],
        ["Beach Club",    "R/W", "R", "R", "R/W", "R", "R", "—"],
        ["Activités",     "R/W", "R", "R", "R/W", "R", "R", "—"],
        ["Corporate",     "R/W", "R", "R", "R", "R", "R/W", "—"],
        ["Événementiel",  "R/W", "R", "R", "R", "R", "R/W", "—"],
        ["Membership",    "R/W", "R", "R/W", "R", "R", "R/W", "—"],
        ["CRM",           "R/W", "R", "R/W", "R", "R", "R/W", "—"],
        ["Marketing",     "R/W", "R", "R/W", "—", "—", "R", "—"],
        ["Analytics",     "R/W", "R", "R", "R", "R", "R", "—"],
        ["Paiements",     "R/W", "R", "—", "R", "R/W", "R", "—"],
        ["QR Scan",       "R/W", "—", "—", "R/W", "—", "—", "R/W"],
        ["Utilisateurs",  "R/W", "R", "—", "—", "—", "—", "—"],
        ["Config système","R/W", "—", "—", "—", "—", "—", "—"],
    ]
    el.append(table_grid(
        rbac_matrix,
        col_widths=[2.4 * cm] + [2 * cm] * 7,
    ))
    el.append(Spacer(1, 0.3 * cm))

    el.extend([
        Paragraph("8.2 — Row-Level Security (équivalent PostgreSQL)", styles["h2"]),
        Paragraph(
            "Approche analogue au RLS Supabase, native dans PostgreSQL "
            "depuis 9.5. Chaque table sensible expose une <code>policy</code> "
            "qui filtre les lignes en fonction du rôle de la session "
            "(<code>current_setting('app.user_role')</code>) et de "
            "l'identité (<code>current_setting('app.user_id')</code>) "
            "positionnées par le middleware FastAPI au début de chaque "
            "requête.",
            styles["body"],
        ),
        code_block("""-- Exemple sur la table reservations
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY reservations_read ON reservations
    FOR SELECT USING (
        current_setting('app.user_role')::text IN
            ('super_admin', 'direction', 'reception',
             'comptabilite', 'marketing')
        OR (
            current_setting('app.user_role') = 'commercial'
            AND EXISTS (SELECT 1 FROM products p
                        WHERE p.id = product_id
                          AND p.module IN ('corporate', 'events'))
        )
    );

CREATE POLICY reservations_write ON reservations
    FOR ALL USING (
        current_setting('app.user_role') IN ('super_admin', 'reception')
    );""", styles),
        Paragraph("8.3 — Journal d'activité (audit_log)", styles["h2"]),
        Paragraph(
            "Toutes les opérations <i>write</i> sensibles laissent une trace "
            "dans <code>audit_log</code> via des triggers PG. Le journal est "
            "append-only (CREATE/DELETE révoqués au rôle applicatif). Les "
            "données sont déversées trimestriellement vers S3 Glacier pour "
            "archive 7 ans (norme comptable).",
            styles["body"],
        ),
        Paragraph("8.4 — Historique des modifications", styles["h2"]),
        Paragraph(
            "Le champ <code>diff</code> JSONB de <code>audit_log</code> "
            "stocke un patch <i>before/after</i> de chaque mise à jour. "
            "L'interface admin permet de rejouer une entité ligne par "
            "ligne (forensic et conformité).",
            styles["body"],
        ),
        Paragraph("8.5 — Protections applicatives", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>CSRF</b> — token double-submit cookie sur tous les POST/"
                "PUT/DELETE.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>XSS</b> — Content Security Policy stricte "
                "(<code>default-src 'self'</code>), sanitisation systématique "
                "des inputs côté FastAPI (Pydantic + bleach).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Rate limiting</b> — Redis-backed (slowapi côté FastAPI + "
                "Cloudflare Rate Limiting rules). Limites par IP, par "
                "session et par endpoint sensible.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>JWT</b> — courte durée (15 min access + 7j refresh "
                "rotatif), signés ES256, stockés en HTTP-only Secure "
                "SameSite=strict cookies.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>MFA</b> — TOTP optionnel pour les rôles sensibles (Super "
                "Admin, Direction, Comptabilité), via Authy/Google Authenticator.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Chiffrement au repos</b> — colonnes sensibles "
                "(mfa_secret, identifiants API canaux) chiffrées avec "
                "<code>pgcrypto</code> + clé en HashiCorp Vault.",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        Paragraph("8.6 — Sauvegardes automatiques", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>WAL streaming</b> en continu vers un standby PG "
                "(RPO &lt; 1 min, RTO &lt; 5 min).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Snapshot quotidien</b> chiffré (AES-256) vers S3, "
                "rétention 30 jours hot + 1 an warm + 7 ans glacier.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Drill mensuel</b> de restauration sur environnement "
                "isolé — toute sauvegarde non testée est une sauvegarde "
                "morte.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>MongoDB Ops</b> — mongodump quotidien + Atlas backup "
                "continu (déjà en place).",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
    ])
    return el


# ── §9 — STRATÉGIE DE SCALABILITÉ ────────────────────────────────────
def build_section_9(styles):
    return [
        Paragraph("§9", styles["h1_kicker"]),
        Paragraph("Stratégie de scalabilité", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "La plateforme est conçue pour absorber une croissance ×10 "
            "sur 24 mois <b>sans refonte architecturale</b>. Les leviers "
            "sont activés progressivement, par paliers de trafic.",
            styles["body"],
        ),
        Paragraph("9.1 — Palier 1 (lancement → 50 k réservations/an)", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "Architecture mono-instance suffit. PG + Mongo + Redis sur "
                "1 VPS dédié 8 vCPU / 16 GB.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "FastAPI servi par uvicorn + gunicorn, 4 workers.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "Frontend statique sur Cloudflare Pages (CDN gratuit).",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        Paragraph("9.2 — Palier 2 (50 k → 200 k réservations/an)", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Read replica PostgreSQL</b> — toutes les requêtes "
                "analytics et BI vont sur le réplica, l'écriture reste "
                "sur le master.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Pgbouncer</b> en pool de connexions devant PG.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Cache Redis</b> agressif sur les routes catalogue + "
                "inventory (TTL 30-60s, invalidation event-driven).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Workers asynchrones</b> (Celery) pour les jobs "
                "longs&nbsp;: sync OTA, Meta CAPI, recalcul LTV, export "
                "PDF/Excel.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Auto-scaling</b> horizontal des workers FastAPI via "
                "Docker Swarm ou Kubernetes léger (k3s).",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        Paragraph("9.3 — Palier 3 (200 k → 1 M réservations/an)", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Partitionnement</b> de <code>reservations</code> et "
                "<code>payments</code> par année (déjà partitionné pour "
                "<code>analytics_events</code>).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>ClickHouse</b> ou <b>DuckDB</b> pour les rapports "
                "analytics lourds (cubes OLAP), alimenté par CDC depuis PG.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Multi-région</b> — réplique PG en France + Côte "
                "d'Ivoire pour réduire la latence d'écriture des bookings "
                "OTA internationaux.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Sharding</b> potentiel sur la table "
                "<code>analytics_events</code> par <code>visitor_id</code> "
                "si volume &gt; 100 M lignes/mois.",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        Paragraph("9.4 — Observabilité", styles["h2"]),
        Paragraph(
            "Pas de scalabilité sans observabilité&nbsp;:",
            styles["body"],
        ),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Metrics</b> — Prometheus + Grafana (CPU, RAM, query "
                "latency, p95 API).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Traces</b> — OpenTelemetry, ingest vers Jaeger ou "
                "Honeycomb (route → service → DB).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Logs</b> — agrégation Loki ou Vector, alerting sur "
                "patterns critiques.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Uptime monitoring</b> — Better Uptime / "
                "Uptime Kuma, checks toutes les 30s sur les endpoints "
                "critiques (booking, paiement, scan QR).",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        Paragraph("9.5 — Séquence de booking — point critique", styles["h2"]),
        Paragraph(
            "Le diagramme ci-dessous illustre le flux complet d'une "
            "réservation, du clic sur une pub Meta jusqu'au check-in&nbsp;: "
            "14 étapes orchestrées entre 3 systèmes (front, Ops, Revenue "
            "Engine) et 4 services externes (paiement, OTA, Meta, "
            "messaging).",
            styles["body"],
        ),
        hero_image(f"{DIAG}/04_booking_sequence.png",
                   max_width_cm=16, max_height_cm=17),
        Paragraph(
            "Schéma 5 — Parcours complet d'une réservation, de l'ad au check-in.",
            styles["caption"]),
    ]


# ── §10 — ROADMAP ───────────────────────────────────────────────────
def build_section_10(styles):
    roadmap = [
        ["Phase", "Durée", "Modules livrés", "Sprint clés"],
        ["P0 — Fondations",
         "4 semaines",
         "PG schéma · Auth · Audit · RBAC · Pont Ops↔Revenue",
         "DDL · Alembic · Auth JWT + MFA · Trigger audit · Webhook sync"],
        ["P1 — CRM + Memberships",
         "4 semaines",
         "CRM 360 · Segmentation RFM · Cartes Bronze/Or/Platine",
         "Dédup customers · Score loyalty · Vue 360 · Workflow renouvellement"],
        ["P2 — Marketing + Analytics",
         "6 semaines",
         "Campagnes Meta + Gads · Pixels · Funnels · KPIs temps réel",
         "Pixel JS · CAPI server · UTM unifié · Dashboard Tremor · Pacing"],
        ["P3 — OTA Channel Manager",
         "6 semaines",
         "Booking · Airbnb · Expedia · iCal · Parité tarifaire",
         "Connecteurs API · Sync inventory · Mapping produits · Tests"],
        ["P4 — Yield Management",
         "4 semaines",
         "Pricing dynamique · Règles métier · Forecast",
         "Engine de règles · ML prévision occupation · A/B testing prix"],
        ["P5 — Corporate + Events",
         "5 semaines",
         "Pipeline commercial · Devis · Contrats · Espaces",
         "Stages pipeline · Templates devis · DocuSign-like · Calendrier salles"],
        ["P6 — Attribution avancée",
         "3 semaines",
         "Multi-touch attribution · Markov chain · ROAS exact",
         "Modèle MTA · Reports investisseurs · Forecast revenu IA"],
    ]
    backlog = [
        ["Backlog (post-MVP)", "Description"],
        ["App mobile native", "iOS + Android (React Native) pour les concierges et la réception."],
        ["IA Concierge", "Chatbot WhatsApp pour la réservation conversationnelle."],
        ["Loyalty crypto-tokens", "Tokenisation des points fidélité sur blockchain (optionnel)."],
        ["B2B Marketplace", "Plateforme de revente aux tour-opérateurs."],
        ["Voice search", "Réservation par commande vocale sur le site vitrine."],
        ["Dynamic content", "Personnalisation du site selon le segment du visiteur."],
    ]
    return [
        Paragraph("§10", styles["h1_kicker"]),
        Paragraph("Roadmap de développement des modules", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Découpage en 7 phases successives livrables tous les 4 à 6 "
            "semaines. Chaque phase est <b>autonome</b> et <b>livrable en "
            "production</b> sans dépendance bloquante avec la suivante. "
            "Durée totale&nbsp;: <b>32 semaines</b> (~8 mois) à partir du "
            "kickoff.",
            styles["body"],
        ),
        Spacer(1, 0.2 * cm),
        table_grid(roadmap,
                   col_widths=[3.3 * cm, 1.8 * cm, 5.5 * cm, 5.8 * cm]),
        Spacer(1, 0.3 * cm),
        info_box(
            "Stratégie de livraison",
            "Chaque phase comprend&nbsp;: <b>conception → développement → "
            "tests automatisés → recette utilisateurs → mise en production "
            "→ monitoring 1 semaine</b>. Aucune phase n'est démarrée tant "
            "que la précédente n'est pas stable en production (KPI "
            "d'incidents &lt; 1/semaine).",
            styles,
        ),
        Paragraph("Backlog post-MVP", styles["h2"]),
        table_grid(backlog, col_widths=[4 * cm, 12.4 * cm]),
        Paragraph("Jalons stratégiques", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Semaine 4</b> — Schema PG en production, premier "
                "événement écrit dans audit_log.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Semaine 12</b> — Premier campaign tracking end-to-end "
                "(Meta ad → conversion → CRM enrichi).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Semaine 18</b> — Première vente via OTA synchronisée "
                "automatiquement.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Semaine 24</b> — Prix dynamiques actifs en production "
                "sur les modules Hôtel et Day Pass.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Semaine 32</b> — Plateforme complète, attribution "
                "multi-touch active, dashboard Direction prêt pour le board.",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
    ]


# ── ANNEXES ─────────────────────────────────────────────────────────
def build_annexes(styles):
    glossary = [
        ["Terme", "Définition"],
        ["RFM", "Recency · Frequency · Monetary — segmentation client."],
        ["LTV", "Lifetime Value — somme attendue d'un client sur sa vie."],
        ["ROAS", "Return on Ad Spend — CA / dépense publicitaire."],
        ["CPA", "Cost Per Acquisition — coût d'acquisition client."],
        ["Yield", "Optimisation des prix selon la demande prévue."],
        ["OTA", "Online Travel Agency — Booking, Airbnb, Expedia, etc."],
        ["CAPI", "Conversion API — endpoint server-to-server de Meta."],
        ["MTA", "Multi-Touch Attribution — modèle d'attribution multi-canaux."],
        ["RLS", "Row-Level Security — filtrage des lignes par utilisateur."],
        ["WAL", "Write-Ahead Log — journal de transactions PG."],
        ["CDC", "Change Data Capture — propagation de changements en flux."],
        ["RPO", "Recovery Point Objective — perte de données max tolérée."],
        ["RTO", "Recovery Time Objective — temps de remise en service."],
    ]
    return [
        Paragraph("ANNEXES", styles["h1_kicker"]),
        Paragraph("Conventions et glossaire", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph("Conventions de code", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Python</b> — PEP 8, type hints obligatoires, "
                "<code>ruff</code> + <code>mypy</code>, docstrings Google style.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>TypeScript</b> — strict mode, ESLint Airbnb + "
                "Prettier, pas de <code>any</code> en production.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>SQL</b> — snake_case, indexes nommés "
                "<code>idx_table_columns</code>, FK <code>fk_table_column</code>.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Git</b> — Conventional Commits, branches "
                "<code>feature/*</code>, <code>fix/*</code>, "
                "<code>chore/*</code>, PRs obligatoires (pas de push direct main).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Tests</b> — pytest pour le backend, Vitest pour le "
                "frontend, Playwright pour l'E2E. Coverage minimum 70%.",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        Paragraph("Conventions API", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "Toutes les routes Revenue Engine sont préfixées "
                "<code>/api/revenue/{module}</code>.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "Verbes REST stricts (GET / POST / PATCH / DELETE), "
                "PATCH pour les updates partiels.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "Pagination cursor-based (pas d'offset/limit sur les tables "
                "volumineuses).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "Errors RFC 7807 (Problem Details for HTTP APIs).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "Idempotency keys obligatoires sur les POST de réservation "
                "et de paiement (header <code>Idempotency-Key</code>).",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        Paragraph("Glossaire", styles["h2"]),
        table_grid(glossary, col_widths=[2.5 * cm, 13.9 * cm]),
        Spacer(1, 0.6 * cm),
        info_box(
            "Fin du document",
            "Ce document est <b>vivant</b>. Il sera versionné dans "
            "<code>/app/docs/ARCHITECTURE.md</code> et republié à chaque "
            "phase majeure du projet. Les diagrammes sont générés via "
            "<code>scripts/revenue_engine_diagrams.py</code> et le PDF "
            "via <code>scripts/generate_revenue_engine_pdf.py</code>.",
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
        title="BBR Revenue Engine — Architecture Technique",
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
        ("s1", build_section_1(styles)),
        ("s2", build_section_2(styles)),
        ("s3", build_section_3(styles)),
        ("s4", build_section_4(styles)),
        ("s5", build_section_5(styles)),
        ("s6", build_section_6(styles)),
        ("s7", build_section_7(styles)),
        ("s8", build_section_8(styles)),
        ("s9", build_section_9(styles)),
        ("s10", build_section_10(styles)),
        ("annex", build_annexes(styles)),
    ]
    story = []
    for i, (key, content) in enumerate(sections):
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
