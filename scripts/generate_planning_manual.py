"""Generate the Team Planning training manual PDF.

Outputs:  /app/frontend/public/Manuel_Planning_BBr.pdf
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
    PageBreak, KeepTogether, ListFlowable, ListItem,
)
from reportlab.platypus.flowables import HRFlowable
from reportlab.pdfgen import canvas as rl_canvas

GOLD = colors.HexColor("#B8922A")
GOLD_SOFT = colors.HexColor("#D4B256")
INK = colors.HexColor("#0A0A0A")
SUB = colors.HexColor("#5F6670")
CREAM = colors.HexColor("#FAF7F2")
DIVIDER = colors.HexColor("#DCDEE2")

BBR_LOGO_URL = ("https://customer-assets.emergentagent.com/job_reserve-bbr/"
                "artifacts/2p8ulkeu_LOGO_BBr_VF_Plan_de_travail_1-"
                "removebg-preview.png")

ASSETS = "/app/manual_assets"
OUTPUT = "/app/frontend/public/Manuel_Planning_BBr.pdf"


def fetch_logo_bytes():
    try:
        req = urllib.request.Request(BBR_LOGO_URL,
                                     headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.read()
    except Exception as e:
        print(f"WARN logo fetch failed: {e}")
        return None


# ---------- Custom page templates ----------
def cover_canvas(canvas: rl_canvas.Canvas, doc):
    """Cover page background: black with subtle gold."""
    w, h = A4
    canvas.saveState()
    # Solid black background
    canvas.setFillColor(INK)
    canvas.rect(0, 0, w, h, stroke=0, fill=1)
    # Gold accent bars
    canvas.setFillColor(GOLD)
    canvas.rect(0, h - 0.4 * cm, w, 0.4 * cm, stroke=0, fill=1)
    canvas.rect(0, 0, w, 0.4 * cm, stroke=0, fill=1)
    canvas.restoreState()


def interior_canvas(canvas: rl_canvas.Canvas, doc):
    """Interior page: cream margin band + footer."""
    w, h = A4
    canvas.saveState()
    # Top gold hairline
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(1.2)
    canvas.line(2 * cm, h - 1.2 * cm, w - 2 * cm, h - 1.2 * cm)
    # Footer
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(SUB)
    canvas.drawString(2 * cm, 1.2 * cm,
                      "Boulay Beach Resort  ·  Manuel Planning des Équipes")
    canvas.drawRightString(w - 2 * cm, 1.2 * cm,
                           f"Page {doc.page}")
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
        "step_num": ParagraphStyle(
            "step_num", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=18, leading=22, textColor=GOLD, alignment=1,
        ),
    }


# ---------- Reusable components ----------
def hero_image(path, max_width_cm=15.5, max_height_cm=11):
    """Wrap a screenshot in a soft gold-bordered frame."""
    img = Image(path)
    iw, ih = img.imageWidth, img.imageHeight
    max_w = max_width_cm * cm
    max_h = max_height_cm * cm
    ratio = min(max_w / iw, max_h / ih)
    img.drawWidth = iw * ratio
    img.drawHeight = ih * ratio
    # Frame the image in a single-cell table to add a border
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
    """Cream box with gold border."""
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


def step_header(num, title, styles):
    """Numbered step header: gold circle + title."""
    num_p = Paragraph(f"<font color='#B8922A'>{num}</font>", styles["step_num"])
    title_p = Paragraph(f"<b>{title}</b>", styles["h2"])
    t = Table([[num_p, title_p]], colWidths=[1.5 * cm, 14.9 * cm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, GOLD),
    ]))
    return t


def build_cover(styles):
    elements = []
    elements.append(Spacer(1, 4.5 * cm))
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
    elements.append(Paragraph(
        "BOULAY  ·  BEACH  ·  RESORT", styles["cover_brand"]))
    elements.append(Paragraph(
        "Manuel de Formation", styles["cover_title"]))
    elements.append(Paragraph(
        "Planning des Équipes", styles["cover_sub"]))
    elements.append(Spacer(1, 1.6 * cm))
    elements.append(HRFlowable(
        width=4 * cm, thickness=1, color=GOLD,
        hAlign="CENTER", spaceBefore=0, spaceAfter=18,
    ))
    elements.append(Paragraph(
        "Guide à l'attention des Chefs de Département",
        styles["cover_sub"]))
    elements.append(Spacer(1, 3.5 * cm))
    months_fr = ["janvier", "février", "mars", "avril", "mai", "juin",
                 "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
    now = datetime.now()
    edition = f"Édition {months_fr[now.month - 1]} {now.year}".capitalize()
    elements.append(Paragraph(edition, styles["cover_date"]))
    return elements


def build_page_intro(styles):
    elements = [
        Paragraph("BIENVENUE", styles["h1_kicker"]),
        Paragraph("Votre nouvel outil de gestion d'équipe",
                  styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Ce manuel vous guide à travers le module <b>Planning des Équipes</b> "
            "du back-office Boulay Beach Resort. En quelques clics, vous "
            "pourrez recenser vos collaborateurs, organiser leur semaine de "
            "travail et transmettre votre planning aux Ressources Humaines.",
            styles["lead"],
        ),
        Spacer(1, 0.3 * cm),
        Paragraph(
            "L'outil est conçu pour être simple : aucune formation technique "
            "n'est nécessaire. Si vous savez utiliser un navigateur web, "
            "vous saurez utiliser le Planning.",
            styles["body"],
        ),
        Spacer(1, 0.5 * cm),
        Paragraph("CE QUE VOUS POURREZ FAIRE", styles["h1_kicker"]),
        Spacer(1, 0.15 * cm),
    ]
    bullets = [
        "<b>Constituer votre équipe</b> en ajoutant chaque collaborateur "
        "(nom, prénom, poste).",
        "<b>Planifier la semaine</b> en deux états : Travail ou Repos, "
        "en un clic sur chaque cellule.",
        "<b>Valider</b> votre planning hebdomadaire pour le rendre officiel "
        "côté RH.",
        "<b>Exporter</b> le planning au format Excel ou PDF pour affichage "
        "ou archivage.",
        "<b>Naviguer</b> librement entre les semaines (passée, en cours, "
        "future) pour anticiper.",
    ]
    elements.append(ListFlowable(
        [ListItem(Paragraph(b, styles["body"]), leftIndent=10) for b in bullets],
        bulletType="bullet", start="•", bulletColor=GOLD,
        leftIndent=12,
    ))
    elements.append(Spacer(1, 0.6 * cm))
    elements.append(info_box(
        "Important",
        "Votre identifiant et votre mot de passe vous sont remis par le "
        "service des Ressources Humaines. Conservez-les soigneusement&nbsp;: "
        "ils sont strictement personnels.",
        styles,
    ))
    return elements


def build_step_connect(styles):
    elements = [
        Paragraph("ÉTAPE 1", styles["h1_kicker"]),
        Paragraph("Se connecter au back-office", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Ouvrez votre navigateur web (Chrome, Safari, Edge ou Firefox) "
            "et rendez-vous à l'adresse suivante&nbsp;:",
            styles["body"],
        ),
        Spacer(1, 0.15 * cm),
    ]
    url_box = Table([[Paragraph(
        '<font face="Helvetica-Bold" color="#0A0A0A" size="11">'
        "workflow-boulaybeachresort.com/staff/login</font>",
        styles["body"])]], colWidths=[16.4 * cm])
    url_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), INK),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (-1, -1), GOLD_SOFT),
    ]))
    elements.append(url_box)
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph(
        "Saisissez votre <b>adresse email</b> (de la forme "
        "<i>chef.votre-departement@boulay.ci</i>) et le <b>mot de passe</b> "
        "communiqué par les RH, puis cliquez sur <b>Se connecter</b>.",
        styles["body"],
    ))
    elements.append(Spacer(1, 0.3 * cm))
    elements.append(hero_image(f"{ASSETS}/01_login.png",
                               max_width_cm=14, max_height_cm=9))
    elements.append(Paragraph(
        "Écran de connexion — saisissez vos identifiants Chef de Département.",
        styles["caption"]))
    elements.append(info_box(
        "Mot de passe oublié ?",
        "Contactez le service Ressources Humaines. Un nouveau mot de passe "
        "vous sera généré et communiqué de manière sécurisée. L'ancien "
        "deviendra immédiatement inactif.",
        styles,
    ))
    return elements


def build_step_team(styles):
    elements = [
        Paragraph("ÉTAPE 2", styles["h1_kicker"]),
        Paragraph("Constituer votre équipe", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Une fois connecté(e), vous accédez directement à votre <b>Planning "
            "hebdomadaire</b>. Pour commencer, ajoutez les membres de votre "
            "département en cliquant sur <b>+ Ajouter un employé</b> en haut à "
            "droite de la grille.",
            styles["body"],
        ),
        Spacer(1, 0.3 * cm),
        hero_image(f"{ASSETS}/03_add_employee_modal.png",
                   max_width_cm=14, max_height_cm=9),
        Paragraph("Formulaire d'ajout d'un collaborateur.",
                  styles["caption"]),
        Paragraph(
            "Renseignez les trois champs&nbsp;:", styles["body"],
        ),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Nom</b> — nom de famille du collaborateur.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Prénom</b> — prénom usuel.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Poste</b> — intitulé de fonction (ex. <i>Réceptionniste, "
                "Cuisinier, Gouvernante</i>).",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        Spacer(1, 0.25 * cm),
        Paragraph(
            "Cliquez ensuite sur <b>Ajouter</b>. Le collaborateur apparaît "
            "immédiatement dans la grille. Recommencez l'opération pour "
            "chaque membre de l'équipe.",
            styles["body"],
        ),
        info_box(
            "Astuce",
            "Vous pouvez modifier ou supprimer un collaborateur à tout moment "
            "via les icônes <b>✎</b> (modifier) et <b>🗑</b> (supprimer) en bout de "
            "ligne. Les modifications n'affectent pas les plannings déjà "
            "validés des semaines passées.",
            styles,
        ),
    ]
    return elements


def build_step_grid(styles):
    elements = [
        Paragraph("ÉTAPE 3", styles["h1_kicker"]),
        Paragraph("Créer le planning de la semaine", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "La grille affiche les <b>7 jours de la semaine</b> (Lundi → "
            "Dimanche) avec, pour chaque collaborateur, une cellule par jour. "
            "Par défaut, chaque cellule est en mode <b>Travail (T)</b>.",
            styles["body"],
        ),
        Paragraph(
            "Pour indiquer un jour de <b>Repos</b>, il suffit de "
            "<b>cliquer sur la cellule</b>&nbsp;: elle passe en vert avec la "
            "mention <i>REPOS</i>. Un nouveau clic la repasse en Travail.",
            styles["body"],
        ),
        Spacer(1, 0.25 * cm),
        hero_image(f"{ASSETS}/02_planning_chef.png",
                   max_width_cm=15.5, max_height_cm=10),
        Paragraph("Grille hebdomadaire — vue Chef de Département.",
                  styles["caption"]),
        Paragraph("Naviguer entre les semaines", styles["h2"]),
        Paragraph(
            "Utilisez les flèches <b>‹</b> et <b>›</b> à gauche et à droite du "
            "libellé <i>2026-Wxx</i> pour passer à la semaine précédente ou "
            "suivante. La mention <b>Semaine en cours</b> indique la semaine "
            "présente.",
            styles["body"],
        ),
        info_box(
            "Bonne pratique",
            "Préparez votre planning au minimum <b>une semaine à l'avance</b>. "
            "Cela permet aux RH d'anticiper les remplacements et aux "
            "collaborateurs de s'organiser.",
            styles,
        ),
    ]
    return elements


def build_step_validate(styles):
    elements = [
        Paragraph("ÉTAPE 4", styles["h1_kicker"]),
        Paragraph("Valider et partager le planning", styles["h1"]),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "Une fois votre grille complétée, cliquez sur le bouton vert "
            "<b>Valider le planning</b> situé en haut à droite. Le planning "
            "est alors marqué comme <b>validé</b>, horodaté avec votre nom, "
            "et automatiquement transmis aux Ressources Humaines.",
            styles["body"],
        ),
        info_box(
            "Vous pouvez encore modifier après validation",
            "La validation ne verrouille pas la grille&nbsp;: vous restez "
            "libre d'ajuster les jours en cas de changement de dernière "
            "minute. Une nouvelle validation rafraîchira simplement la date "
            "et l'auteur.",
            styles,
        ),
        Paragraph("Exporter le planning", styles["h2"]),
        Paragraph(
            "Trois boutons d'export sont disponibles en haut de la page&nbsp;:",
            styles["body"],
        ),
        ListFlowable([
            ListItem(Paragraph(
                "<b>Excel</b> — fichier <i>.xlsx</i> à ouvrir dans Microsoft "
                "Excel, Numbers ou Google Sheets. Utile pour archiver ou "
                "retravailler les données.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>PDF</b> — version paysage prête à imprimer, avec en-tête "
                "BBr et la mention de validation.",
                styles["body"]), leftIndent=10),
            ListItem(Paragraph(
                "<b>Imprimer</b> — impression directe depuis le navigateur.",
                styles["body"]), leftIndent=10),
        ], bulletType="bullet", start="•", bulletColor=GOLD, leftIndent=12),
        Spacer(1, 0.4 * cm),
        Paragraph("La vue Ressources Humaines", styles["h2"]),
        Paragraph(
            "Les RH disposent d'une vue de synthèse avec le total de "
            "départements, de collaborateurs, de plannings <b>validés</b> "
            "et de plannings <b>en attente</b> pour la semaine en cours.",
            styles["body"],
        ),
        hero_image(f"{ASSETS}/04_admin_planning.png",
                   max_width_cm=15.5, max_height_cm=10),
        Paragraph(
            "Vue Ressources Humaines — synthèse hebdomadaire des départements.",
            styles["caption"]),
    ]
    return elements


def build_faq(styles):
    elements = [
        Paragraph("AIDE", styles["h1_kicker"]),
        Paragraph("Questions fréquentes", styles["h1"]),
        Spacer(1, 0.4 * cm),
    ]
    qas = [
        ("Combien de temps avant la semaine cible dois-je établir mon "
         "planning&nbsp;?",
         "Au plus tard le <b>vendredi qui précède</b> la semaine concernée. "
         "Idéalement, anticipez de deux semaines."),
        ("Puis-je modifier le planning d'une semaine déjà passée&nbsp;?",
         "Oui. Le système conserve l'historique complet. Les modifications "
         "rétroactives sont horodatées."),
        ("Que se passe-t-il si je ne valide pas avant la fin de la semaine&nbsp;?",
         "Le planning reste visible mais apparaît <b>En attente</b> côté RH. "
         "Cela peut générer une relance — pensez à valider même tardivement."),
        ("Comment partager mon planning avec mon équipe&nbsp;?",
         "Utilisez le bouton <b>PDF</b> et envoyez le fichier par email ou "
         "WhatsApp. Vous pouvez aussi l'imprimer et l'afficher en zone de "
         "service."),
        ("J'ai oublié mon mot de passe.",
         "Contactez le service RH. Un nouveau mot de passe vous sera "
         "généré&nbsp;; l'ancien sera immédiatement désactivé."),
        ("Qui peut voir mon planning&nbsp;?",
         "Vous-même, les Ressources Humaines, la Direction et les "
         "administrateurs. Les autres chefs de département voient uniquement "
         "leur propre service."),
    ]
    for q, a in qas:
        elements.append(Paragraph(f"<b>{q}</b>", styles["body"]))
        elements.append(Paragraph(a, styles["body"]))
        elements.append(Spacer(1, 0.2 * cm))
    elements.append(Spacer(1, 0.4 * cm))
    elements.append(info_box(
        "Besoin d'aide ?",
        "Service Ressources Humaines<br/>"
        "<b>workflow-boulaybeachresort.com</b><br/>"
        "Pour toute question fonctionnelle ou technique, contactez votre "
        "responsable RH ou la Direction Générale.",
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
        title="Manuel Planning des Équipes — Boulay Beach Resort",
        author="Boulay Beach Resort",
    )

    # Multi-template support: cover with black bg, then interior pages.
    from reportlab.platypus import PageTemplate, Frame
    cover_frame = Frame(0, 0, A4[0], A4[1], leftPadding=2 * cm,
                        rightPadding=2 * cm, topPadding=2 * cm,
                        bottomPadding=2 * cm, id="cover")
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
    story.extend(build_page_intro(styles))
    story.append(PageBreak())
    story.extend(build_step_connect(styles))
    story.append(PageBreak())
    story.extend(build_step_team(styles))
    story.append(PageBreak())
    story.extend(build_step_grid(styles))
    story.append(PageBreak())
    story.extend(build_step_validate(styles))
    story.append(PageBreak())
    story.extend(build_faq(styles))

    doc.build(story)
    with open(OUTPUT, "wb") as f:
        f.write(buf.getvalue())
    print(f"✓ Generated {OUTPUT}  ({len(buf.getvalue())/1024:.1f} KB)")


if __name__ == "__main__":
    main()
