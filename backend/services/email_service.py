"""Boulay Beach Resort — SendGrid email service.

Mirrors the `twilio_service` shape so that the calling code can dispatch a
notification to WhatsApp + SMS + Email in a uniform way. Every send is
logged in MongoDB collection ``email_messages`` so the admin can audit
deliveries from the back-office, even when the SendGrid event webhook isn't
configured yet.

Templates are rendered with simple ``str.format`` so we don't take a new
dependency on Jinja2 just for transactional emails.
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

GOLD = "#B8922A"
DARK = "#0A0A0A"
CREAM = "#FAFAF7"

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _client() -> Optional[SendGridAPIClient]:
    if not SENDGRID_ENABLED:
        return None
    return SendGridAPIClient(SENDGRID_API_KEY)


def _is_valid_email(s: Optional[str]) -> bool:
    return bool(s and _EMAIL_RE.match(s.strip()))


# ---------- BBR-branded HTML wrapper ----------

def _wrap_html(content_html: str, *, preheader: str = "") -> str:
    """Wrap email content in a luxury BBR-branded HTML envelope."""
    return f"""\
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Boulay Beach Resort</title>
</head>
<body style="margin:0;padding:0;background:{CREAM};font-family:'Helvetica Neue',Arial,sans-serif;color:{DARK};">
  <span style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">{preheader}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:{CREAM};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;max-width:600px;border:1px solid rgba(10,10,10,0.08);">
          <!-- Header gold bar -->
          <tr>
            <td style="background:{DARK};padding:22px 28px;text-align:center;">
              <div style="font-family:Georgia,'Playfair Display',serif;color:#ffffff;font-size:22px;letter-spacing:0.18em;">BOULAY · BEACH · RESORT</div>
              <div style="height:2px;width:60px;background:{GOLD};margin:10px auto 0;"></div>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:34px 32px 26px;color:{DARK};font-size:15px;line-height:1.6;">
              {content_html}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:{CREAM};padding:22px 28px;border-top:1px solid rgba(10,10,10,0.08);font-size:11px;color:rgba(10,10,10,0.55);text-align:center;letter-spacing:0.06em;">
              Boulay Beach Resort · Île de Boulay · Abidjan, Côte d'Ivoire<br/>
              <a href="https://workflow-boulaybeachresort.com" style="color:{GOLD};text-decoration:none;">workflow-boulaybeachresort.com</a> ·
              <a href="mailto:reservations@boulaybeachresort.com" style="color:{GOLD};text-decoration:none;">reservations@boulaybeachresort.com</a>
            </td>
          </tr>
        </table>
        <div style="font-size:10px;color:rgba(10,10,10,0.4);margin-top:14px;letter-spacing:0.08em;">Document automatique — Ne pas répondre à ce message</div>
      </td>
    </tr>
  </table>
</body>
</html>"""


# ---------- Templates ----------

def render_booking_confirmation(*, name: str, ref: str, offer_label: str,
                                date_str: str, boat_time: Optional[str],
                                amount_label: str, ticket_url: Optional[str]) -> dict:
    """Confirmation de paiement avec QR (envoyé après webhook FineoPay)."""
    boat_line = f"<tr><td style='padding:5px 0;color:rgba(10,10,10,0.55);'>Embarquement</td><td style='padding:5px 0;text-align:right;font-weight:600;'>{boat_time}</td></tr>" if boat_time else ""
    ticket_btn = f'<a href="{ticket_url}" style="display:inline-block;background:{GOLD};color:#ffffff;padding:13px 26px;text-decoration:none;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;">Télécharger mon billet</a>' if ticket_url else ""
    body = f"""
      <div style="font-size:11px;letter-spacing:0.28em;color:{GOLD};text-transform:uppercase;margin-bottom:6px;">Réservation confirmée</div>
      <h1 style="font-family:Georgia,'Playfair Display',serif;font-size:28px;color:{DARK};margin:0 0 14px;line-height:1.2;">Bienvenue, {name}.</h1>
      <p style="margin:0 0 22px;color:rgba(10,10,10,0.7);">Nous avons bien reçu votre paiement. Votre billet QR est en pièce jointe et également téléchargeable ci-dessous. Présentez-le simplement à l'embarquement.</p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid rgba(10,10,10,0.08);padding:18px 20px;margin-bottom:24px;">
        <tr><td style="padding:5px 0;color:rgba(10,10,10,0.55);font-size:13px;">Référence</td><td style="padding:5px 0;text-align:right;font-weight:600;font-size:13px;font-family:'Courier New',monospace;">{ref}</td></tr>
        <tr><td style="padding:5px 0;color:rgba(10,10,10,0.55);font-size:13px;">Expérience</td><td style="padding:5px 0;text-align:right;font-weight:600;font-size:13px;">{offer_label}</td></tr>
        <tr><td style="padding:5px 0;color:rgba(10,10,10,0.55);font-size:13px;">Date</td><td style="padding:5px 0;text-align:right;font-weight:600;font-size:13px;">{date_str}</td></tr>
        {boat_line}
        <tr><td style="padding:9px 0 5px;border-top:1px solid rgba(10,10,10,0.08);color:{GOLD};font-size:11px;letter-spacing:0.22em;text-transform:uppercase;">Total réglé</td><td style="padding:9px 0 5px;border-top:1px solid rgba(10,10,10,0.08);text-align:right;font-weight:700;color:{GOLD};font-size:15px;">{amount_label}</td></tr>
      </table>

      <div style="text-align:center;margin:6px 0 16px;">{ticket_btn}</div>
      <p style="margin:24px 0 0;color:rgba(10,10,10,0.55);font-size:12px;line-height:1.6;">
        <strong style="color:{DARK};">Bon à savoir :</strong> arrivez 30 minutes avant l'embarquement. Maillot, lunettes et crème solaire sont les bienvenus.
        À très bientôt sur l'île 🌴
      </p>
    """
    plain = (
        f"Bienvenue, {name}.\n\n"
        f"Votre paiement est confirmé.\n"
        f"Référence : {ref}\nExpérience : {offer_label}\nDate : {date_str}\n"
        + (f"Embarquement : {boat_time}\n" if boat_time else "")
        + f"Total réglé : {amount_label}\n\n"
        + (f"Téléchargez votre billet : {ticket_url}\n\n" if ticket_url else "")
        + "Présentez votre QR à l'embarquement. À très bientôt sur l'île — Boulay Beach Resort"
    )
    return {
        "subject": f"Votre billet Boulay Beach Resort — {offer_label} · {date_str}",
        "html": _wrap_html(body, preheader=f"Confirmation de votre réservation {ref}"),
        "plain": plain,
    }


def render_j_minus_1(*, name: str, ref: str, offer_label: str, date_str: str, boat_time: Optional[str]) -> dict:
    boat_line = f"<li><strong>Embarquement :</strong> {boat_time}</li>" if boat_time else ""
    body = f"""
      <div style="font-size:11px;letter-spacing:0.28em;color:{GOLD};text-transform:uppercase;margin-bottom:6px;">Demain c'est le grand jour</div>
      <h1 style="font-family:Georgia,'Playfair Display',serif;font-size:26px;color:{DARK};margin:0 0 14px;">Bonjour {name},</h1>
      <p style="margin:0 0 18px;color:rgba(10,10,10,0.7);">Nous sommes ravis de vous accueillir demain pour votre <strong>{offer_label}</strong> à Boulay Beach Resort.</p>
      <ul style="color:rgba(10,10,10,0.75);padding-left:20px;line-height:1.8;">
        <li><strong>Référence :</strong> {ref}</li>
        <li><strong>Date :</strong> {date_str}</li>
        {boat_line}
        <li>Arrivez 30 minutes avant l'embarquement</li>
        <li>Pensez à votre maillot, lunettes et crème solaire</li>
      </ul>
      <p style="margin:22px 0 0;color:rgba(10,10,10,0.55);font-size:12px;">Belle journée demain ✨</p>
    """
    plain = f"Bonjour {name},\n\nDemain c'est le grand jour à Boulay Beach Resort.\nRéf. {ref} · {offer_label} · {date_str}\n" + (f"Embarquement : {boat_time}\n" if boat_time else "") + "\nArrivez 30 min avant, maillot et crème solaire conseillés. À demain ✨"
    return {
        "subject": f"Demain à Boulay Beach Resort — {offer_label}",
        "html": _wrap_html(body, preheader="Conseils pour profiter pleinement de votre journée"),
        "plain": plain,
    }


def render_j_plus_1(*, name: str, review_url: Optional[str]) -> dict:
    review_btn = f'<a href="{review_url}" style="display:inline-block;background:{GOLD};color:#ffffff;padding:13px 30px;text-decoration:none;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;">Donner mon avis</a>' if review_url else ""
    body = f"""
      <div style="font-size:11px;letter-spacing:0.28em;color:{GOLD};text-transform:uppercase;margin-bottom:6px;">Merci de votre visite</div>
      <h1 style="font-family:Georgia,'Playfair Display',serif;font-size:26px;color:{DARK};margin:0 0 14px;">Bonjour {name},</h1>
      <p style="margin:0 0 22px;color:rgba(10,10,10,0.7);">Merci d'avoir choisi Boulay Beach Resort hier. Nous serions ravis de connaître votre expérience en quelques mots.</p>
      <div style="text-align:center;margin:18px 0;">{review_btn}</div>
      <p style="margin:22px 0 0;color:rgba(10,10,10,0.55);font-size:12px;">Au plaisir de vous revoir bientôt sur l'île 🌴</p>
    """
    plain = f"Bonjour {name},\n\nMerci d'avoir choisi Boulay Beach Resort hier. Pouvez-vous nous laisser votre avis ?\n" + (f"{review_url}\n\n" if review_url else "") + "Au plaisir de vous revoir 🌴"
    return {
        "subject": "Merci pour votre visite à Boulay Beach Resort",
        "html": _wrap_html(body, preheader="Votre avis nous est précieux"),
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
