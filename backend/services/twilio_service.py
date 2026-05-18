"""Twilio notifications service for Boulay Beach Resort.

Sends transactional SMS + WhatsApp messages (booking confirmation, J-1
reminder, J+1 review, staff alerts). The service is idempotent and
fail-safe: any Twilio error is logged but never propagated to the caller
(notifications must never block a booking flow).

Important:
- WhatsApp is preferred when available (richer content + media). SMS is the
  automatic fallback.
- Templates use French elegant tone (resort luxe positioning).
- Every outbound message is logged in MongoDB collection ``twilio_messages``
  for audit / delivery tracking.
"""
from __future__ import annotations
import os
import logging
from datetime import datetime, timezone
from typing import Optional

from twilio.rest import Client as TwilioClient
from twilio.base.exceptions import TwilioRestException

log = logging.getLogger("twilio_svc")

TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_MESSAGING_SERVICE_SID = os.environ.get("TWILIO_MESSAGING_SERVICE_SID", "")
TWILIO_WHATSAPP_FROM = os.environ.get("TWILIO_WHATSAPP_FROM", "")
TWILIO_SMS_FROM = os.environ.get("TWILIO_SMS_FROM", "")
TWILIO_TEST_RECIPIENT = os.environ.get("TWILIO_TEST_RECIPIENT", "")  # trial-only safety net
TWILIO_TRIAL_SAFE_DEFAULT = os.environ.get("TWILIO_TRIAL_SAFE", "false").lower() in ("1", "true", "yes")

TWILIO_ENABLED = bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN)

_client: Optional[TwilioClient] = None


def get_client() -> Optional[TwilioClient]:
    global _client
    if not TWILIO_ENABLED:
        return None
    if _client is None:
        _client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    return _client


def _normalise_phone(phone: str) -> str:
    """Force E.164 format. Accepts '0704600600', '+2250704600600',
    '+225 0704 60 06 00' etc. Defaults to Côte d'Ivoire (+225) when no
    international prefix is present.

    Côte d'Ivoire mobile numbers are 10 digits starting with 0 (07/05/01).
    The leading 0 is part of the national number and MUST be preserved
    when prefixing with +225 (full international form: +225 0X XX XX XX XX,
    13 chars total).
    """
    if not phone:
        return ""
    s = "".join(c for c in str(phone) if c.isdigit() or c == "+")
    if s.startswith("00"):
        s = "+" + s[2:]
    if s.startswith("+"):
        return s
    # Local form (no international prefix). CI numbers since 2021 are 10
    # digits and the leading 0 is significant — keep it.
    digits = s
    if digits.startswith("225"):
        # User typed "2250708..." without "+" — add it.
        return "+" + digits
    return "+225" + digits


# ============== TEMPLATES (French — Resort luxe) ==============

def tpl_booking_confirmed(first_name: str, ref: str, offer_label: str,
                          date: str, boat_time: str, qr_url: str,
                          amount_fcfa: int) -> dict:
    name = (first_name or "").strip().split(" ")[0] or "Cher client"
    body = (
        f"Bonjour {name}, votre réservation au Boulay Beach Resort est confirmée \u2728\n\n"
        f"Référence : *{ref}*\n"
        f"Expérience : {offer_label}\n"
        f"Date : {date}\n"
        f"Embarquement : {boat_time}\n"
        f"Montant payé : {amount_fcfa:,} FCFA\n\n"
        f"Votre billet QR : {qr_url}\n\n"
        f"Présentez-le à l'embarquement. À très bientôt sur l'île \U0001F334"
    ).replace(",", " ")
    return {"body": body, "media_url": qr_url}


def tpl_j_minus_1(first_name: str, ref: str, date: str, boat_time: str) -> dict:
    name = (first_name or "").strip().split(" ")[0] or "Cher client"
    body = (
        f"Bonjour {name},\n\n"
        f"Demain c'est le grand jour au Boulay Beach Resort \U0001F334\n"
        f"Embarquement : *{boat_time}* — réf. {ref}\n\n"
        f"Quelques conseils pour profiter pleinement :\n"
        f"• Arrivez 30 min avant l'embarquement\n"
        f"• Pensez à votre maillot, lunettes et crème solaire\n"
        f"• Votre billet QR vous a été envoyé après votre paiement\n\n"
        f"Belle journée demain \u2728"
    )
    return {"body": body, "media_url": None}


def tpl_j_plus_1(first_name: str, ref: str) -> dict:
    name = (first_name or "").strip().split(" ")[0] or "Cher client"
    body = (
        f"Bonjour {name},\n\n"
        f"Merci d'avoir choisi le Boulay Beach Resort hier \u2728\n"
        f"Nous serions ravis de connaître votre expérience.\n\n"
        f"Donnez-nous votre avis en 1 minute : "
        f"https://reserve-bbr.preview.emergentagent.com/avis?ref={ref}\n\n"
        f"Au plaisir de vous revoir bientôt \U0001F334"
    )
    return {"body": body, "media_url": None}


def tpl_staff_alert(title: str, detail: str) -> dict:
    body = f"\U0001F514 BBR — {title}\n\n{detail}"
    return {"body": body, "media_url": None}


# ============== CORE SEND ==============

def _log_outbound(db, payload: dict) -> None:
    try:
        db.twilio_messages.insert_one({
            **payload,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as ex:  # never block notifications on log failure
        log.warning("twilio_messages log failed: %s", ex)


def _send_once(channel: str, from_addr: str, to_addr: str, body: str,
               media_url: Optional[str] = None,
               messaging_service: Optional[str] = None):
    cli = get_client()
    if not cli:
        raise RuntimeError("Twilio non configuré")
    kwargs = {"to": to_addr, "body": body}
    if media_url and channel == "whatsapp":
        kwargs["media_url"] = [media_url]
    if messaging_service and channel == "sms":
        kwargs["messaging_service_sid"] = messaging_service
    else:
        kwargs["from_"] = from_addr
    return cli.messages.create(**kwargs)


async def send_notification(db, *, phone: str, body: str,
                            media_url: Optional[str] = None,
                            purpose: str = "generic",
                            booking_id: Optional[str] = None,
                            trial_safe: Optional[bool] = None) -> dict:
    """Send via WhatsApp with SMS fallback. Returns dict with sent channels &
    SIDs. NEVER raises — failures are logged in twilio_messages.

    ``trial_safe`` (None = use TWILIO_TRIAL_SAFE env default). When True,
    redirects outbound to TWILIO_TEST_RECIPIENT (useful only on Twilio Trial
    accounts where unverified numbers cannot receive). On paid accounts this
    MUST be False so messages reach the real recipient."""
    if trial_safe is None:
        trial_safe = TWILIO_TRIAL_SAFE_DEFAULT
    result = {"whatsapp": None, "sms": None, "errors": []}
    if not TWILIO_ENABLED:
        result["errors"].append("Twilio désactivé (env vars manquantes)")
        return result

    to = _normalise_phone(phone)
    if not to:
        result["errors"].append("Numéro manquant ou invalide")
        return result

    # Trial-safety: redirect ALL outbound to the verified test number when
    # the recipient is not the verified one (avoids 21408 "unverified caller").
    final_to = to
    if trial_safe and TWILIO_TEST_RECIPIENT and to != _normalise_phone(TWILIO_TEST_RECIPIENT):
        log.info("Trial-safe: rerouting %s → %s", to, TWILIO_TEST_RECIPIENT)
        final_to = _normalise_phone(TWILIO_TEST_RECIPIENT)
        body = f"[→ destinataire réel : {to}]\n\n" + body

    # 1) Try WhatsApp first
    if TWILIO_WHATSAPP_FROM:
        try:
            msg = _send_once(
                channel="whatsapp",
                from_addr=TWILIO_WHATSAPP_FROM,
                to_addr=f"whatsapp:{final_to}",
                body=body,
                media_url=media_url,
            )
            result["whatsapp"] = {"sid": msg.sid, "status": msg.status, "to": final_to}
            _log_outbound(db, {
                "sid": msg.sid, "channel": "whatsapp", "to": final_to,
                "from": TWILIO_WHATSAPP_FROM, "status": msg.status,
                "purpose": purpose, "booking_id": booking_id, "body_preview": body[:200],
            })
            return result  # success on WhatsApp = done
        except TwilioRestException as e:
            result["errors"].append(f"whatsapp:{e.code}:{e.msg}")
            log.info("WhatsApp failed (%s) → trying SMS fallback", e.code)
        except Exception as e:
            result["errors"].append(f"whatsapp:exc:{e}")

    # 2) SMS fallback
    try:
        msg = _send_once(
            channel="sms",
            from_addr=TWILIO_SMS_FROM,
            to_addr=final_to,
            body=body,
            messaging_service=TWILIO_MESSAGING_SERVICE_SID or None,
        )
        result["sms"] = {"sid": msg.sid, "status": msg.status, "to": final_to}
        _log_outbound(db, {
            "sid": msg.sid, "channel": "sms", "to": final_to,
            "from": TWILIO_SMS_FROM, "status": msg.status,
            "purpose": purpose, "booking_id": booking_id, "body_preview": body[:200],
        })
    except TwilioRestException as e:
        result["errors"].append(f"sms:{e.code}:{e.msg}")
    except Exception as e:
        result["errors"].append(f"sms:exc:{e}")

    return result


# ============== HIGH-LEVEL HELPERS (used by FastAPI handlers) ==============

async def notify_booking_paid(db, booking: dict, qr_image_url: str) -> dict:
    """Send the booking confirmation right after a successful payment."""
    tpl = tpl_booking_confirmed(
        first_name=booking.get("first_name") or booking.get("name", ""),
        ref=(booking.get("id") or "")[:8].upper(),
        offer_label=booking.get("offer_label_fr") or booking.get("offer_type", ""),
        date=booking.get("date", ""),
        boat_time=booking.get("boat_time", ""),
        qr_url=qr_image_url,
        amount_fcfa=int(booking.get("paid_amount", booking.get("total_amount", 0)) or 0),
    )
    return await send_notification(
        db=db, phone=booking.get("phone", ""), body=tpl["body"], media_url=tpl["media_url"],
        purpose="booking_paid", booking_id=booking.get("id"),
    )


async def notify_j_minus_1(db, booking: dict) -> dict:
    tpl = tpl_j_minus_1(
        first_name=booking.get("first_name") or booking.get("name", ""),
        ref=(booking.get("id") or "")[:8].upper(),
        date=booking.get("date", ""),
        boat_time=booking.get("boat_time", ""),
    )
    return await send_notification(
        db=db, phone=booking.get("phone", ""), body=tpl["body"],
        purpose="j_minus_1", booking_id=booking.get("id"),
    )


async def notify_j_plus_1(db, booking: dict) -> dict:
    tpl = tpl_j_plus_1(
        first_name=booking.get("first_name") or booking.get("name", ""),
        ref=(booking.get("id") or "")[:8].upper(),
    )
    return await send_notification(
        db=db, phone=booking.get("phone", ""), body=tpl["body"],
        purpose="j_plus_1", booking_id=booking.get("id"),
    )


async def notify_staff(db, *, recipient_phone: str, title: str, detail: str) -> dict:
    tpl = tpl_staff_alert(title=title, detail=detail)
    return await send_notification(
        db=db, phone=recipient_phone, body=tpl["body"],
        purpose="staff_alert",
    )
