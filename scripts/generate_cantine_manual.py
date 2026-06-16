"""Generate the Cantine du Personnel training manual PDF.

Outputs:  /app/frontend/public/Manuel_Cantine_BBr.pdf
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
    PageBreak, ListFlowable, ListItem,
)
from reportlab.platypus.flowables import HRFlowable
from reportlab.pdfgen import canvas as rl_canvas

GOLD = colors.HexColor("#B8922A")
GOLD_SOFT = colors.HexColor("#D4B256")
INK = colors.HexColor("#0A0A0A")
SUB = colors.HexColor("#5F6670")
CREAM = colors.HexColor("#FAF7F2")

BBR_LOGO_URL = ("https://customer-assets.emergentagent.com/job_reserve-bbr/"
                "artifacts/2p8ulkeu_LOGO_BBr_VF_Plan_de_travail_1-"
                "removebg-preview.png")

ASSETS = "/app/manual_assets/cantine"
OUTPUT = "/app/frontend/public/Manuel_Cantine_BBr.pdf"


def fetch_logo_bytes():
    try:
        req = urllib.request.Request(BBR_LOGO_URL,
                                     headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.read()
    except Exception:
        return None


# ---------- Page templates ----------
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
                      "Boulay Beach Resort  ·  Manuel Cantine du Personnel")
    canvas.drawRightString(w - 2 * cm, 1.2 * cm, f"Page {doc.page}")
    canvas.restoreState()


# ---------- Styles ----------
def make_styles():
    base = getSampleStyleSheet()
    return {
        "cover_brand": ParagraphStyle(
            "cover_brand", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=11, leading=14, textColor=GOLD_SOFT,
            alignment=1, spaceAfter=18,
        ),
        "cover_title": ParagraphStyle(
            "cover_title", parent=base["Title"], fontName="Helvetica-Bold",
            fontSize=34, leading=40, textColor=colors.white,
            alignment=1, spaceAfter=14,
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub", parent=base["Normal"], fontName="Helvetica",
            fontSize=14, leading=18, textColor=colors.HexColor("#E5D9C0"),
            alignment=1, spaceAfter=8,
        ),
        "cover_date": ParagraphStyle(
            "cover_date", parent=base["Normal"], fontName="Helvetica",
            fontSize=10, leading=13, textColor=colors.HexColor("#9C9690"),
            alignment=1,
        ),
        "h1": ParagraphStyle(
            "h1", parent=base["Heading1"], fontName="Helvetica-Bold",
            fontSize=22, leading=28, textColor=INK, spaceAfter=4,
        ),
        "h1_kicker": ParagraphStyle(
            "h1_kicker", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=9, leading=12, textColor=GOLD, spaceAfter=2,
        ),
        "h2": ParagraphStyle(
            "h2", parent=base["Heading2"], fontName="Helvetica-Bold",
            fontSize=14, leading=18, textColor=INK,
            spaceBefore=14, spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "body", parent=base["BodyText"], fontName="Helvetica",
            fontSize=10.5, leading=15, textColor=INK, spaceAfter=6,
        ),
        "lead": ParagraphStyle(
            "lead", parent=base["BodyText"], fontName="Helvetica",
            fontSize=11.5, leading=17, textColor=INK, spaceAfter=10,
        ),
        "caption": ParagraphStyle(
            "caption", parent=base["Normal"], fontName="Helvetica-Oblique",
            fontSize=9, leading=12, textColor=SUB, alignment=1, spaceAfter=12,
            spaceBefore=4,
        ),
        "note_label": ParagraphStyle(
            "note_label", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=9, leading=12, textColor=GOLD, spaceAfter=2,
        ),
    }


# ---------- Reusable components ----------
def hero_image(path, max_width_cm=15.5, max_height_cm=12):
    img = Image(path)
    iw, ih = img.imageWidth, img.imageHeight
    max_w = max_width_cm * cm
    max_h = max_height_cm * cm
    ratio = min(max_w / iw, max_h / ih)
    img.drawWidth = iw * ratio
    img.drawHeight = ih * ratio
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
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


def build_cover(styles):
    elements = [Spacer(1, 4.5 * cm)]
    logo_bytes = fetch_logo_bytes()
    if logo_bytes:
        logo_img = Image(io.BytesIO(logo_bytes))
        iw, ih = logo_img.imageWidth, logo_img.imageHeight
        target_h = 3.2 * cm
        logo_img.drawHeight = target_h
        logo_img.drawWidth = iw * (target_h / ih)
        logo_img.hAlign = "CENTER"
        elements.append(logo_img)
    elements.append(Spacer(1, 1.4 * cm))
    elements.append(Paragraph("BOULAY  ·  BEACH  ·  RESORT",
                              styles["cover_brand"]))
    elements.append(Paragraph("Manuel d'Utilisation",
                              styles["cover_title"]))
    elements.append(Paragraph("Cantine du Personnel",
                              styles["cover_sub"]))
    elements.append(Spacer(1, 1.6 * cm))
    elements.append(HRFlowable(width=4 * cm, thickness=1, color=GOLD,
                               hAlign="CENTER", spaceBefore=0, spaceAfter=18))
    elements.append(Paragraph(
        "Comment créer son compte et réserver son repas",
        styles["cover_sub"]))
    elements.append(Spacer(1, 3.5 * cm))
    months_fr = ["janvier", "février", "mars", "avril", "mai", "juin",
                 "juillet", "août", "septembre", "octobre", "novembre",
                 "décembre"]
    now = datetime.now()
    edition = f"Édition {months_fr[now.month - 1]} {now.year}".capitalize()
    elements.append(Paragraph(edition, styles["cover_date"]))
    return elements


def build_intro(styles):
    return [
        Paragraph("BIENVENUE", styles["h1_kicker"]),
        Paragraph("Le service Cantine, simplifié", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Ce manuel s'adresse à <b>tous les collaborateurs et prestataires</b> "
            "de Boulay Beach Resort. Il explique comment&nbsp;:",
            styles["lead"],
        ),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Créer votre compte cantine</b> en moins d'une minute, "
                "depuis votre téléphone ou un ordinateur.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Récupérer votre code personnel</b> (6 caractères) que "
                "vous garderez à vie sur l'établissement.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Réserver votre repas du lendemain</b> en quelques clics.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Présenter votre code</b> à la cantine pour le pointage "
                "du jour.",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        Spacer(1, 0.5 * cm),
        Paragraph("LES RÈGLES À CONNAÎTRE", styles["h1_kicker"]),
        Spacer(1, 0.15 * cm),
        ListFlowable([
            ListItem(Paragraph(
                "Vous disposez d'un <b>crédit mensuel</b> de repas attribué "
                "par les RH (renouvelé automatiquement chaque mois).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "Les réservations sont ouvertes <b>chaque jour pendant une "
                "fenêtre horaire définie</b> par la Direction (visible en "
                "haut de la page).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "Le repas réservé concerne <b>le jour défini par la "
                "Direction</b> (jour même, lendemain ou J+2).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "Une seule réservation par personne et par jour. Pas de "
                "double-réservation possible.",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        Spacer(1, 0.6 * cm),
        info_box(
            "Adresse du portail",
            "Rendez-vous depuis n'importe quel navigateur sur&nbsp;: "
            "<b>workflow-boulaybeachresort.com/cantine</b><br/>"
            "Aucune installation. Aucun mot de passe. Juste votre code "
            "personnel.",
            styles,
        ),
    ]


def build_step1(styles):
    return [
        Paragraph("ÉTAPE 1", styles["h1_kicker"]),
        Paragraph("Créer mon compte cantine", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "À votre première utilisation, vous devez créer un compte. "
            "Cette opération <b>ne se fait qu'une seule fois</b>.",
            styles["body"],
        ),
        Paragraph(
            "Ouvrez le portail, l'onglet <b>« Créer mon compte »</b> est "
            "actif par défaut. Remplissez les informations demandées&nbsp;:",
            styles["body"],
        ),
        hero_image(f"{ASSETS}/01_landing_register.png",
                   max_width_cm=11, max_height_cm=10),
        Paragraph("Onglet « Créer mon compte ».", styles["caption"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Prénom</b> et <b>Nom</b> — tels qu'ils apparaissent "
                "sur votre badge.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Service / Département</b> — choisissez dans la liste "
                "(Hébergement, Cuisine, Sécurité, etc.).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Fonction / Poste</b> — votre intitulé exact "
                "(ex. Réceptionniste, Cuisinier, Agent de sécurité).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Type</b> — <i>Personnel</i> (salarié BBr) ou "
                "<i>Prestataire</i> (intervenant externe).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Téléphone</b> — facultatif, mais utile pour les "
                "communications RH.",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        Spacer(1, 0.2 * cm),
        Paragraph(
            "Cliquez ensuite sur <b>« Créer mon compte »</b>.",
            styles["body"],
        ),
        hero_image(f"{ASSETS}/02_register_filled.png",
                   max_width_cm=11, max_height_cm=10),
        Paragraph("Formulaire complété, prêt à être soumis.",
                  styles["caption"]),
    ]


def build_step2(styles):
    return [
        Paragraph("ÉTAPE 2", styles["h1_kicker"]),
        Paragraph("Récupérer mon code personnel", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Le système génère immédiatement un <b>code personnel</b> "
            "(format <i>AAA999</i> — trois lettres et trois chiffres). "
            "Ce code est <b>unique</b>, <b>permanent</b> et <b>vous "
            "appartient à vie</b>.",
            styles["body"],
        ),
        hero_image(f"{ASSETS}/03_register_success.png",
                   max_width_cm=11, max_height_cm=10),
        Paragraph("Écran de succès avec votre code généré.",
                  styles["caption"]),
        Paragraph("Que faire de ce code&nbsp;?", styles["h2"]),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Notez-le</b> dans votre téléphone (Notes, WhatsApp…).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "Utilisez le bouton <b>📋 Copier</b> pour le mettre dans "
                "votre presse-papier.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "Si vous l'oubliez, le service RH peut <b>vous le "
                "réafficher</b> à tout moment.",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        info_box(
            "Important",
            "Votre code est <b>strictement personnel</b>. Ne le partagez "
            "avec personne. Toute réservation faite avec votre code est "
            "déduite de votre crédit personnel.",
            styles,
        ),
    ]


def build_step3(styles):
    return [
        Paragraph("ÉTAPE 3", styles["h1_kicker"]),
        Paragraph("Réserver mon repas", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Pour chaque réservation, rendez-vous à nouveau sur le portail "
            "<b>workflow-boulaybeachresort.com/cantine</b> et cliquez sur "
            "l'onglet <b>« Réserver mon repas »</b>.",
            styles["body"],
        ),
        Paragraph(
            "Le bandeau supérieur indique en temps réel si les inscriptions "
            "sont <b>ouvertes</b> ou <b>fermées</b>, ainsi que la <b>date du "
            "repas concerné</b> et la <b>plage horaire</b> de réservation.",
            styles["body"],
        ),
        hero_image(f"{ASSETS}/04_reserve_landing.png",
                   max_width_cm=11, max_height_cm=10),
        Paragraph("Onglet « Réserver mon repas » — bandeau d'état.",
                  styles["caption"]),
        Paragraph("Saisir votre code", styles["h2"]),
        Paragraph(
            "Entrez votre <b>code personnel</b> (6 caractères) dans le "
            "champ prévu à cet effet, puis cliquez sur <b>Rechercher</b>. "
            "Le système affiche votre profil avec votre <b>crédit restant</b>.",
            styles["body"],
        ),
        hero_image(f"{ASSETS}/05_reserve_user_found.png",
                   max_width_cm=11, max_height_cm=10),
        Paragraph("Votre profil et le solde de crédits restants.",
                  styles["caption"]),
    ]


def build_step4(styles):
    return [
        Paragraph("ÉTAPE 4", styles["h1_kicker"]),
        Paragraph("Confirmer et valider", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Cochez la case <b>« Je confirme ma présence au repas »</b>, "
            "puis cliquez sur le bouton doré <b>« Valider ma réservation »</b>.",
            styles["body"],
        ),
        hero_image(f"{ASSETS}/06_reserve_confirmed.png",
                   max_width_cm=11, max_height_cm=10),
        Paragraph("Case cochée — prêt à valider.", styles["caption"]),
        Paragraph(
            "Un écran de confirmation apparaît instantanément avec votre "
            "<b>nouveau solde de crédits</b>. Votre nom est ajouté à la "
            "liste prévisionnelle de la cantine.",
            styles["body"],
        ),
        info_box(
            "Que se passe-t-il ensuite ?",
            "Le jour du repas, vous présentez votre <b>code personnel</b> "
            "à l'entrée de la cantine. L'agent saisit votre code sur la "
            "tablette de pointage&nbsp;: votre nom apparaît "
            "automatiquement, votre crédit est débité et l'opération est "
            "horodatée.",
            styles,
        ),
        Paragraph("Annuler une réservation ?", styles["h2"]),
        Paragraph(
            "En cas d'empêchement, prévenez le service RH dans les meilleurs "
            "délais (avant le repas concerné). Le RH peut <b>annuler "
            "manuellement</b> votre réservation et vous <b>recréditer</b>.",
            styles["body"],
        ),
    ]


def build_staff_overview(styles):
    return [
        Paragraph("CÔTÉ STAFF", styles["h1_kicker"]),
        Paragraph("Pour les Ressources Humaines et la Cuisine", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Les équipes RH, Direction et Cuisine disposent d'un tableau "
            "de bord dédié <b>/staff/cantine</b> pour piloter le service&nbsp;:",
            styles["body"],
        ),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Vue d'ensemble</b> — réservations du jour, totaux par "
                "service, prévisions cuisine.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Personnel</b> — gestion des comptes (modifier, "
                "désactiver, régénérer un code oublié).",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Pointage tablette</b> — interface ultra simple pour "
                "valider l'arrivée des collaborateurs à la cantine.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Paramètres</b> — fenêtre de réservation, jour cible, "
                "crédits par défaut, services officiels.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Exports Excel et PDF</b> pour archivage et reporting.",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        Spacer(1, 0.3 * cm),
        hero_image(f"{ASSETS}/07_staff_dashboard.png",
                   max_width_cm=15.5, max_height_cm=10),
        Paragraph("Tableau de bord RH/Direction de la cantine.",
                  styles["caption"]),
        Paragraph("Pointage à la cantine", styles["h2"]),
        Paragraph(
            "L'agent au point de service ouvre <b>/staff/cantine/pointage</b> "
            "sur une tablette. Il saisit (ou scanne) le code du "
            "collaborateur&nbsp;: la fiche s'ouvre avec photo, nom, service "
            "et crédit restant. Un seul bouton suffit pour valider l'arrivée.",
            styles["body"],
        ),
        hero_image(f"{ASSETS}/08_staff_pointage.png",
                   max_width_cm=14, max_height_cm=9),
        Paragraph("Interface de pointage tablette.", styles["caption"]),
    ]


def build_faq(styles):
    elements = [
        Paragraph("AIDE", styles["h1_kicker"]),
        Paragraph("Questions fréquentes", styles["h1"]),
        Spacer(1, 0.4 * cm),
    ]
    qas = [
        ("J'ai oublié mon code personnel.",
         "Adressez-vous au service Ressources Humaines. Ils peuvent "
         "retrouver votre code instantanément à partir de votre nom."),
        ("Mon code ne fonctionne plus, j'ai un message « Code inconnu ».",
         "Deux raisons possibles&nbsp;: (1) votre compte a été désactivé "
         "par les RH, (2) le code a été régénéré (par exemple suite à "
         "une fuite). Contactez les RH pour récupérer votre nouveau code."),
        ("Je veux changer de service ou de poste.",
         "Demandez aux RH&nbsp;: ils peuvent modifier votre fiche en "
         "quelques secondes. Votre code reste inchangé."),
        ("Combien de repas puis-je réserver par mois&nbsp;?",
         "Cela dépend du <b>crédit attribué par les RH</b>. Il est visible "
         "à chaque réservation, sur votre fiche. Le crédit se renouvelle "
         "automatiquement chaque mois."),
        ("Puis-je réserver pour aujourd'hui&nbsp;?",
         "Cela dépend du <b>paramétrage choisi par la Direction</b>&nbsp;: "
         "vous pouvez réserver pour aujourd'hui, pour demain ou pour J+2. "
         "Le bandeau supérieur de l'onglet « Réserver » indique le jour "
         "concerné."),
        ("Je suis prestataire externe, puis-je utiliser la cantine&nbsp;?",
         "Oui. Choisissez <b>« Prestataire »</b> à la création de compte. "
         "Le service RH validera et créditera votre compte selon les accords "
         "en vigueur avec votre société."),
        ("Le pointage à la cantine refuse mon code.",
         "Vérifiez auprès de l'agent que vous aviez bien réservé pour le "
         "jour concerné. Si oui, contactez immédiatement les RH&nbsp;: ils "
         "peuvent autoriser un repas exceptionnel."),
    ]
    for q, a in qas:
        elements.append(Paragraph(f"<b>{q}</b>", styles["body"]))
        elements.append(Paragraph(a, styles["body"]))
        elements.append(Spacer(1, 0.2 * cm))
    elements.append(Spacer(1, 0.3 * cm))
    elements.append(info_box(
        "Besoin d'aide ?",
        "Service Ressources Humaines<br/>"
        "<b>workflow-boulaybeachresort.com/cantine</b><br/>"
        "Pour toute question technique ou demande exceptionnelle, "
        "contactez votre responsable RH ou la Direction.",
        styles,
    ))
    return elements


def main():
    styles = make_styles()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2.2 * cm, rightMargin=2.2 * cm,
        topMargin=1.8 * cm, bottomMargin=2 * cm,
        title="Manuel Cantine du Personnel — Boulay Beach Resort",
        author="Boulay Beach Resort",
    )
    from reportlab.platypus import PageTemplate, Frame
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
    from reportlab.platypus.doctemplate import NextPageTemplate

    story = []
    story.extend(build_cover(styles))
    story.append(NextPageTemplate("interior"))
    story.append(PageBreak())
    story.extend(build_intro(styles))
    story.append(PageBreak())
    story.extend(build_step1(styles))
    story.append(PageBreak())
    story.extend(build_step2(styles))
    story.append(PageBreak())
    story.extend(build_step3(styles))
    story.append(PageBreak())
    story.extend(build_step4(styles))
    story.append(PageBreak())
    story.extend(build_staff_overview(styles))
    story.append(PageBreak())
    story.extend(build_faq(styles))

    doc.build(story)
    with open(OUTPUT, "wb") as f:
        f.write(buf.getvalue())
    print(f"✓ Generated {OUTPUT}  ({len(buf.getvalue())/1024:.1f} KB)")


if __name__ == "__main__":
    main()
