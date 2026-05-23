"""Boulay Beach Resort — SendGrid email service (v2 luxury template).

Sends transactional emails matching the new BBr luxury identity:
- Cream/white top with centered BBr logo
- Hero image (dynamic per offer)
- Title + personalized paragraphs (uses customer first name + booking info)
- Inline CTA button (dark brown)
- Secondary hero image
- Dark CTA bar
- Dark footer: "Life Is Here", clickable phones, Instagram, website,
  "Télécharger notre livret" button (links to /bbr-presentation.pdf) and
  "Embarquement dès 11H · Départ toutes les heures" with boat icon.

Every send is logged in MongoDB collection ``email_messages``.
"""
from __future__ import annotations

import base64
import logging
import os
import re
from datetime import datetime, timezone
from typing import Optional, List

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import (
    Mail, Attachment, FileContent, FileName, FileType, Disposition,
    Email, To, Bcc,
)

log = logging.getLogger("bbr.email")

SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
SENDGRID_FROM_EMAIL = os.environ.get("SENDGRID_FROM_EMAIL", "")
SENDGRID_FROM_NAME = os.environ.get("SENDGRID_FROM_NAME", "Boulay Beach Resort")
SENDGRID_BCC = os.environ.get("SENDGRID_BCC", "")  # optional internal copy

SENDGRID_ENABLED = bool(SENDGRID_API_KEY and SENDGRID_FROM_EMAIL)

# Brand colors (matches the template artwork)
DARK = "#2A1A0E"        # dark espresso brown (footer + buttons)
GOLD = "#B8922A"
CREAM = "#F8EFE7"        # warm cream (content panels only)
WHITE = "#FFFFFF"        # outer background — pure white
PAGE_BG = "#E6E1DC"      # light grey/beige for hero placeholders
TEXT = "#2A1A0E"
TEXT_MUTED = "#6B5B4F"

PUBLIC_BASE_URL = (
    os.environ.get("FINEO_PUBLIC_BASE_URL")
    or os.environ.get("PUBLIC_BASE_URL")
    or "https://workflow-boulaybeachresort.com"
).rstrip("/")

# BBr official contact information (used in the email footer).
BBR_PHONE_1 = "+225 07 17 400 400"
BBR_PHONE_2 = "+225 07 04 600 600"
BBR_PHONE_1_E164 = "+22507174000400".replace(" ", "")  # actually 10 nat digits + 225
BBR_INSTAGRAM_HANDLE = "@BoulayBeachResort"
BBR_INSTAGRAM_URL = "https://instagram.com/boulaybeachresort"
BBR_WEBSITE_LABEL = "boulaybeachresort.com"
BBR_WEBSITE_URL = "https://workflow-boulaybeachresort.com"
BBR_BOOKLET_URL = f"{PUBLIC_BASE_URL}/livret-bbr.pdf"


def _boat_icon_b64() -> str:
    """Return base64-encoded boat PNG (inlined in emails so it doesn't depend
    on the production deployment being live). Falls back to an empty string
    if the file is missing."""
    import base64 as _b64
    path = "/app/frontend/public/email-assets/boat.png"
    try:
        with open(path, "rb") as f:
            return _b64.b64encode(f.read()).decode("ascii")
    except Exception:
        return ""


_BOAT_DATA_URI = "data:image/png;base64," + _boat_icon_b64() if _boat_icon_b64() else ""
BBR_LOGO_URL = (
    "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/"
    "6stkzr3f_LOGO%20BBr%20VF_Plan%20de%20travail%201.png"
)

# Hero image per offer (mirrors the public site SUB_OFFER_IMAGES).
OFFER_HERO_IMAGES = {
    "pass_day":   "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/4kr4z5g1_DAY%20PASS.jpeg",
    "sunset":     "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/3g3onmkg_THE%20SUNSET.jpeg",
    "brunch":     "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/1txrnqdp_B%20BRUNCH.jpeg",
    "le_kaai":    "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/v2f73qqm_KAAI.png",
    "hebergement":"https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/7bgj0mje_HEBERGEMENT%202.png",
    "spa_wellness":"https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/rhjncq2g_SPA.png",
    "lounge":     "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/rg0ibzao_LOUNGE.png",
    "seminaire":  "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/oy7zzngs_SEMINAIRE.png",
    "team_building":"https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1600&q=80",
    "journee_etude":"https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1600&q=80",
    "dejeuner_diner_entreprise":"https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=80",
    "formule_personnalisee":"https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=1600&q=80",
    "offres_loisirs":"https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/66jfvevy_OFFRE%20LOISIRS.png",
    "special_event":"https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/3g3onmkg_THE%20SUNSET.jpeg",
}
DEFAULT_HERO = OFFER_HERO_IMAGES["pass_day"]


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _client() -> Optional[SendGridAPIClient]:
    if not SENDGRID_ENABLED:
        return None
    return SendGridAPIClient(SENDGRID_API_KEY)


def _is_valid_email(s: Optional[str]) -> bool:
    return bool(s and _EMAIL_RE.match(s.strip()))


def _first_name(full_name: Optional[str]) -> str:
    if not full_name:
        return "cher client"
    parts = full_name.strip().split()
    return parts[0] if parts else "cher client"


def _tel_href(phone_with_spaces: str) -> str:
    """+225 07 17 400 400 → tel:+22507174000400."""
    return "tel:" + "".join(c for c in phone_with_spaces if c.isdigit() or c == "+")


# ----------- Master template -----------

def _render_template(
    *,
    hero_image: str,
    title: str,
    paragraphs: List[str],
    cta_label: Optional[str] = None,
    cta_url: Optional[str] = None,
    preheader: str = "",
) -> str:
    """Render the master luxury template matching the BBr mailing artwork.

    All inline styles are kept email-client safe (table-based layout, no flexbox,
    no SVG — Outlook strips SVG). Line breaks rely on ``<br>`` because Outlook
    ignores ``white-space:pre-line``.
    """
    # Convert any "\n" inside a paragraph into <br> so multi-line blocks
    # (e.g. "Référence : X\nDate : Y") actually break in Outlook.
    paragraphs_html = "".join(
        '<p style="margin:0 0 20px;font-family:Georgia,\'Playfair Display\',serif;'
        f'font-size:16px;line-height:1.6;color:{TEXT};text-align:center;">'
        + p.replace("\n", "<br/>")
        + "</p>"
        for p in paragraphs if p
    )

    inline_cta = ""
    if cta_label and cta_url:
        inline_cta = f"""
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:28px auto 8px;border-collapse:separate;border-radius:999px;">
          <tr><td align="center" bgcolor="{DARK}" style="background:{DARK};border-radius:999px;">
            <a href="{cta_url}" target="_blank"
               style="display:inline-block;padding:15px 64px;color:{CREAM};
               font-family:Georgia,'Playfair Display',serif;font-size:16px;
               text-decoration:none;letter-spacing:0.18em;text-transform:uppercase;
               border-radius:999px;mso-padding-alt:15px 64px;">{cta_label}</a>
          </td></tr>
        </table>"""

    footer_cta_bar = ""
    if cta_label and cta_url:
        footer_cta_bar = f"""
        <tr>
          <td bgcolor="{DARK}" style="background:{DARK};padding:28px 28px 30px;text-align:center;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;border-collapse:separate;border-radius:999px;">
              <tr><td align="center" bgcolor="{CREAM}" style="background:{CREAM};border-radius:999px;">
                <a href="{cta_url}" target="_blank"
                   style="display:inline-block;padding:14px 72px;color:{DARK};
                   font-family:Georgia,'Playfair Display',serif;font-size:16px;
                   text-decoration:none;letter-spacing:0.18em;text-transform:uppercase;
                   border-radius:999px;mso-padding-alt:14px 72px;">{cta_label}</a>
              </td></tr>
            </table>
          </td>
        </tr>"""

    return f"""\
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Boulay Beach Resort</title>
</head>
<body style="margin:0;padding:0;background:{WHITE};font-family:Helvetica,Arial,sans-serif;color:{TEXT};">
  <span style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">{preheader}</span>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="{WHITE}" style="background:{WHITE};">
    <tr>
      <td align="center" style="padding:0;background:{WHITE};">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" bgcolor="{WHITE}" style="background:{WHITE};max-width:640px;width:100%;">

          <!-- ===== Top: BBr logo on white ===== -->
          <tr>
            <td bgcolor="{WHITE}" style="background:{WHITE};padding:32px 28px 24px;text-align:center;">
              <img src="{BBR_LOGO_URL}" alt="Boulay Beach Resort"
                   width="120" style="display:inline-block;height:auto;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>

          <!-- ===== Hero image #1 ===== -->
          <tr>
            <td bgcolor="{PAGE_BG}" style="background:{PAGE_BG};padding:0;line-height:0;font-size:0;">
              <img src="{hero_image}" alt="" width="640"
                   style="display:block;width:100%;height:auto;max-height:380px;object-fit:cover;border:0;" />
            </td>
          </tr>

          <!-- ===== Content panel (cream) ===== -->
          <tr>
            <td bgcolor="{CREAM}" style="background:{CREAM};padding:46px 48px 40px;text-align:center;">
              <h1 style="margin:0 0 26px;font-family:Georgia,'Playfair Display',serif;
                  font-size:32px;line-height:1.18;color:{DARK};font-weight:700;
                  letter-spacing:-0.005em;">
                {title}
              </h1>
              {paragraphs_html}
              {inline_cta}
            </td>
          </tr>

          <!-- ===== Hero image #2 ===== -->
          <tr>
            <td bgcolor="{PAGE_BG}" style="background:{PAGE_BG};padding:0;line-height:0;font-size:0;">
              <img src="{hero_image}" alt="" width="640"
                   style="display:block;width:100%;height:auto;max-height:340px;object-fit:cover;border:0;" />
            </td>
          </tr>

          <!-- ===== Dark CTA bar ===== -->
          {footer_cta_bar}

          <!-- ===== Footer ===== -->
          <tr>
            <td bgcolor="{DARK}" style="background:{DARK};padding:34px 36px 36px;color:{CREAM};font-family:Helvetica,Arial,sans-serif;font-size:13px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <!-- Left column: brand + contacts -->
                  <td valign="top" width="55%" style="color:{CREAM};font-family:Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.75;">
                    <div style="font-weight:700;margin-bottom:2px;letter-spacing:0.02em;font-size:14px;">Life Is Here</div>
                    <a href="{_tel_href(BBR_PHONE_1)}" style="color:{CREAM};text-decoration:none;">{BBR_PHONE_1}</a><br/>
                    <a href="{_tel_href(BBR_PHONE_2)}" style="color:{CREAM};text-decoration:none;">{BBR_PHONE_2}</a><br/>
                    <a href="{BBR_INSTAGRAM_URL}" style="color:{CREAM};text-decoration:none;">{BBR_INSTAGRAM_HANDLE}</a><br/>
                    <a href="{BBR_WEBSITE_URL}" style="color:{CREAM};text-decoration:none;">{BBR_WEBSITE_LABEL}</a>
                  </td>
                  <!-- Right column: livret button + embarquement -->
                  <td valign="top" width="45%" align="right" style="text-align:right;color:{CREAM};font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.55;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="right" style="margin:0 0 18px;border-collapse:separate;border-radius:999px;">
                      <tr><td align="center" bgcolor="{CREAM}" style="background:{CREAM};border-radius:999px;">
                        <a href="{BBR_BOOKLET_URL}" target="_blank"
                           style="display:inline-block;padding:11px 24px;color:{DARK};
                           font-family:Helvetica,Arial,sans-serif;font-size:12.5px;font-weight:700;
                           text-decoration:none;letter-spacing:0.05em;border-radius:999px;
                           mso-padding-alt:11px 24px;">Télécharger notre livret</a>
                      </td></tr>
                    </table>
                    <br/>
                    <img src="{_BOAT_DATA_URI}" alt="" width="80" style="display:inline-block;height:auto;border:0;margin-bottom:6px;" />
                    <div style="color:{CREAM};font-size:12.5px;line-height:1.55;margin-top:2px;">
                      Embarquement dès 11H<br/>Départ toutes les heures
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


# Backward-compat helper used by /staff/integrations/sendgrid/test
def _wrap_html(content_html: str, *, preheader: str = "") -> str:
    """Wrap arbitrary HTML inside the master template (no hero image swap)."""
    return _render_template(
        hero_image=DEFAULT_HERO,
        title="Boulay Beach Resort",
        paragraphs=[content_html.strip()],
        preheader=preheader,
    )


# ---------- Templates ----------

def render_booking_confirmation(*, name: str, ref: str, offer_label: str,
                                date_str: str, boat_time: Optional[str],
                                amount_label: str, ticket_url: Optional[str],
                                offer_type: str = "") -> dict:
    """Confirmation de paiement (envoyée après webhook FineoPay)."""
    first = _first_name(name)
    hero = OFFER_HERO_IMAGES.get(offer_type, DEFAULT_HERO)

    intro = (
        f"Bonjour {first}, nous avons le plaisir de vous confirmer votre réservation pour "
        f"l'expérience {offer_label} au Boulay Beach Resort. Votre billet QR est en pièce jointe "
        f"et accessible via le bouton ci-dessous."
    )
    details = (
        f"Référence : {ref}\n"
        f"Date : {date_str}\n"
        + (f"Embarquement : {boat_time}\n" if boat_time else "")
        + f"Total réglé : {amount_label}"
    )
    closing = (
        "Présentez simplement votre QR à l'embarquement. Arrivez 30 minutes avant l'horaire de départ. "
        "Maillot, lunettes et crème solaire sont les bienvenus."
    )

    title = "Votre escapade BBr est confirmée"
    html = _render_template(
        hero_image=hero,
        title=title,
        paragraphs=[intro, details, closing],
        cta_label="Voir mon billet",
        cta_url=ticket_url or BBR_WEBSITE_URL,
        preheader=f"Confirmation de votre réservation {ref}",
    )

    plain = (
        f"Bonjour {first},\n\nVotre réservation est confirmée.\n\n"
        f"Expérience : {offer_label}\nRéférence : {ref}\nDate : {date_str}\n"
        + (f"Embarquement : {boat_time}\n" if boat_time else "")
        + f"Total réglé : {amount_label}\n\n"
        + (f"Voir mon billet : {ticket_url}\n\n" if ticket_url else "")
        + "Présentez votre QR à l'embarquement. À très bientôt sur l'île — BBr"
    )

    return {
        "subject": f"Votre billet Boulay Beach Resort — {offer_label} · {date_str}",
        "html": html,
        "plain": plain,
    }


def render_j_minus_1(*, name: str, ref: str, offer_label: str, date_str: str,
                     boat_time: Optional[str], offer_type: str = "") -> dict:
    first = _first_name(name)
    hero = OFFER_HERO_IMAGES.get(offer_type, DEFAULT_HERO)

    intro = (
        f"Bonjour {first}, demain c'est le grand jour. Nous sommes ravis de vous accueillir "
        f"pour votre {offer_label} sur l'Île Boulay."
    )
    details = (
        f"Référence : {ref}\n"
        f"Date : {date_str}\n"
        + (f"Embarquement : {boat_time}\n" if boat_time else "")
    )
    closing = (
        "Arrivez 30 minutes avant l'embarquement. Pensez à votre maillot, vos lunettes et "
        "votre crème solaire. À très bientôt sur l'île."
    )

    html = _render_template(
        hero_image=hero,
        title="Demain à Boulay Beach Resort",
        paragraphs=[intro, details, closing],
        cta_label="Voir mon billet",
        cta_url=f"{BBR_WEBSITE_URL}",
        preheader="Conseils pour profiter pleinement de votre journée",
    )

    plain = (
        f"Bonjour {first},\n\nDemain c'est le grand jour à Boulay Beach Resort.\n"
        f"Réf. {ref} · {offer_label} · {date_str}\n"
        + (f"Embarquement : {boat_time}\n" if boat_time else "")
        + "\nArrivez 30 min avant, maillot et crème solaire conseillés. À demain !"
    )
    return {
        "subject": f"Demain à Boulay Beach Resort — {offer_label}",
        "html": html,
        "plain": plain,
    }


def render_j_plus_1(*, name: str, review_url: Optional[str],
                    offer_type: str = "", offer_label: str = "") -> dict:
    first = _first_name(name)
    hero = OFFER_HERO_IMAGES.get(offer_type, DEFAULT_HERO)

    intro = (
        f"Bonjour {first}, merci d'avoir choisi le Boulay Beach Resort hier"
        + (f" pour votre {offer_label}." if offer_label else ".")
    )
    middle = (
        "Nous serions ravis de connaître votre expérience en quelques mots. "
        "Votre retour nourrit notre exigence et inspire nos prochaines créations."
    )
    closing = "Au plaisir de vous revoir bientôt sur l'île."

    html = _render_template(
        hero_image=hero,
        title="Merci de votre visite",
        paragraphs=[intro, middle, closing],
        cta_label="Donner mon avis" if review_url else "Découvrir nos offres",
        cta_url=review_url or BBR_WEBSITE_URL,
        preheader="Votre avis nous est précieux",
    )

    plain = (
        f"Bonjour {first},\n\nMerci d'avoir choisi le Boulay Beach Resort hier.\n"
        + (f"Donnez-nous votre avis : {review_url}\n\n" if review_url else "")
        + "Au plaisir de vous revoir — BBr"
    )
    return {
        "subject": "Merci pour votre visite à Boulay Beach Resort",
        "html": html,
        "plain": plain,
    }


# ---------- Sending ----------

async def send_email(db, *, to_email: str, subject: str, html: str, plain: str,
                     purpose: str = "generic",
                     booking_id: Optional[str] = None,
                     attachments: Optional[List[dict]] = None,
                     to_name: Optional[str] = None) -> dict:
    """Send a transactional email via SendGrid.

    ``attachments`` is a list of dicts: ``{"content": bytes, "filename": str,
    "mime": str, "disposition": "attachment"|"inline", "content_id": str?}``.

    Returns a result dict (never raises). Failures are logged in ``email_messages``.
    """
    log_doc = {
        "to": to_email,
        "subject": subject,
        "purpose": purpose,
        "booking_id": booking_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "queued",
        "provider": "sendgrid",
    }
    if not _is_valid_email(to_email):
        log_doc.update({"status": "invalid_email", "error": "invalid recipient"})
        await db.email_messages.insert_one(log_doc)
        return {"ok": False, "error": "invalid email"}
    if not SENDGRID_ENABLED:
        log_doc.update({"status": "disabled", "error": "SendGrid not configured"})
        await db.email_messages.insert_one(log_doc)
        return {"ok": False, "error": "SendGrid not configured"}

    try:
        from_email = Email(SENDGRID_FROM_EMAIL, SENDGRID_FROM_NAME)
        to = To(to_email, to_name) if to_name else To(to_email)
        message = Mail(from_email=from_email, to_emails=to, subject=subject,
                       plain_text_content=plain, html_content=html)
        if SENDGRID_BCC and _is_valid_email(SENDGRID_BCC):
            message.add_bcc(Bcc(SENDGRID_BCC))
        for att in (attachments or []):
            a = Attachment()
            a.file_content = FileContent(base64.b64encode(att["content"]).decode())
            a.file_name = FileName(att["filename"])
            a.file_type = FileType(att.get("mime", "application/octet-stream"))
            a.disposition = Disposition(att.get("disposition", "attachment"))
            if att.get("content_id"):
                from sendgrid.helpers.mail import ContentId
                a.content_id = ContentId(att["content_id"])
            message.add_attachment(a)
        cli = _client()
        resp = cli.send(message)
        ok = 200 <= resp.status_code < 300
        msg_id = resp.headers.get("X-Message-Id") if hasattr(resp, "headers") else None
        log_doc.update({
            "status": "accepted" if ok else "failed",
            "http_status": resp.status_code,
            "message_id": msg_id,
        })
        await db.email_messages.insert_one(log_doc)
        return {"ok": ok, "status": resp.status_code, "message_id": msg_id}
    except Exception as e:  # noqa: BLE001
        log.exception("SendGrid send failed")
        log_doc.update({"status": "error", "error": str(e)[:300]})
        await db.email_messages.insert_one(log_doc)
        return {"ok": False, "error": str(e)}
