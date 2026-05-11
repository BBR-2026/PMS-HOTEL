"""Boulay Beach Resort - Reservation API (guest checkout flow)"""
import os
import io
import json
import uuid
import base64
import logging
import urllib.request
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import jwt
import qrcode
import bcrypt
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from PIL import Image, ImageDraw, ImageFont

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ----- Config -----
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET", "boulay-beach-resort-secret-key-change-me")
JWT_ALG = "HS256"
JWT_EXPIRE_HOURS = 72

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

OFFERS = {
    "pass_day": {
        "id": "pass_day",
        "name_fr": "Day Pass",
        "name_en": "Day Pass",
        "schedule_fr": "Du Lundi au Vendredi",
        "schedule_en": "Monday to Friday",
        "tagline_fr": "L'expérience plage signature, du lundi au vendredi.",
        "tagline_en": "The signature beach experience, Monday to Friday.",
        "price_adult": 50000,
        "price_child": 25000,
        "max_capacity": 250,
    },
    "sunset": {
        "id": "sunset",
        "name_fr": "The Sunset",
        "name_en": "The Sunset",
        "schedule_fr": "Tous les samedis · 12h — 17h",
        "schedule_en": "Every Saturday · 12pm — 5pm",
        "tagline_fr": "Cocktails dorés et horizon flamboyant à l'heure magique.",
        "tagline_en": "Golden cocktails and a flaming horizon at the magic hour.",
        "price_adult": 60000,
        "price_child": 30000,
        "max_capacity": 250,
    },
    "brunch": {
        "id": "brunch",
        "name_fr": "The Brunch",
        "name_en": "The Brunch",
        "schedule_fr": "Tous les dimanches · 12h — 16h",
        "schedule_en": "Every Sunday · 12pm — 4pm",
        "tagline_fr": "Un dimanche d'exception entre océan et gastronomie.",
        "tagline_en": "An exceptional Sunday between ocean and gastronomy.",
        "price_adult": 60000,
        "price_child": 30000,
        "max_capacity": 250,
    },
    "le_kaai": {
        "id": "le_kaai",
        "name_fr": "Le Kaai",
        "name_en": "Le Kaai",
        "schedule_fr": "Tous les jours · 11h — 22h30",
        "schedule_en": "Every day · 11am — 10:30pm",
        "tagline_fr": "Le restaurant signature de Boulay — gastronomie entre lagune et océan.",
        "tagline_en": "Boulay's signature restaurant — gastronomy between lagoon and ocean.",
        "price_adult": 0,
        "price_child": 0,
        "max_capacity": 250,
    },
    "hebergement": {
        "id": "hebergement",
        "name_fr": "Hébergement",
        "name_en": "Accommodation",
        "schedule_fr": "Du lundi au dimanche · Séjour à l'hôtel",
        "schedule_en": "Monday to Sunday · Hotel stay",
        "tagline_fr": "Une nuit en suspens entre lagune et océan, dans nos suites signature.",
        "tagline_en": "A night suspended between lagoon and ocean, in our signature suites.",
        "price_adult": 0,
        "price_child": 0,
        "max_capacity": 60,
        "is_overnight": True,
        "room_tiers": [
            {
                "id": "superieure",
                "name_fr": "Chambre Supérieure",
                "name_en": "Superior Room",
                "price": 200000,
            },
            {
                "id": "suite_jardin",
                "name_fr": "Suite Côté Jardin",
                "name_en": "Garden View Suite",
                "price": 420000,
            },
            {
                "id": "suite_mer",
                "name_fr": "Suite Côté Mer",
                "name_en": "Sea View Suite",
                "price": 470000,
            },
        ],
    },
}

OfferType = Literal["pass_day", "sunset", "brunch", "le_kaai", "hebergement"]
BookingStatus = Literal["pending", "confirmed", "arrived", "completed", "cancelled"]

# Weekday boat times (every 2 hours) and weekend boat times (hourly)
BOAT_TIMES_WEEKDAY = ["10H", "12H", "14H", "16H", "18H", "20H"]
BOAT_TIMES_WEEKEND = [f"{h}H" for h in range(10, 21)]

# Boat departure times available per offer
BOAT_TIMES_BY_OFFER = {
    "pass_day": BOAT_TIMES_WEEKDAY,
    "sunset": BOAT_TIMES_WEEKEND,
    "brunch": BOAT_TIMES_WEEKEND,
    # le_kaai + hebergement are day-dependent — resolved via _boat_times_for_date()
}

# Python weekday(): Monday=0, Sunday=6
ALLOWED_WEEKDAYS_BY_OFFER = {
    "pass_day": [0, 1, 2, 3, 4],     # Monday to Friday
    "sunset": [5],                     # Saturday only
    "brunch": [6],                     # Sunday only
    "le_kaai": [0, 1, 2, 3, 4, 5, 6],  # Every day
    "hebergement": [0, 1, 2, 3, 4, 5, 6],  # Every day
}


def _boat_times_for_date(offer_id: str, weekday: int) -> list:
    """Return valid boat times for the given offer + weekday (Python Mon=0..Sun=6)."""
    if offer_id in ("le_kaai", "hebergement"):
        return BOAT_TIMES_WEEKEND if weekday in (5, 6) else BOAT_TIMES_WEEKDAY
    return BOAT_TIMES_BY_OFFER.get(offer_id, [])


# ----- Models -----
class StaffLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class Participant(BaseModel):
    name: str
    surname: str
    email: EmailStr
    phone: str
    nationality: str
    kind: Literal["adult", "child"]


class BookingCreate(BaseModel):
    offer_type: OfferType
    date: str  # YYYY-MM-DD (arrival date for overnight stays)
    checkout_date: Optional[str] = None  # YYYY-MM-DD, required if offer is_overnight
    room_tier: Optional[str] = None  # required if offer has room_tiers
    rooms: int = Field(default=1, ge=1, le=20)
    adults: int = Field(ge=0, le=20)
    children: int = Field(ge=0, le=20)
    boat_time: str
    participants: List[Participant]
    special_requests: Optional[str] = ""


class PayBooking(BaseModel):
    reference_token: str
    payment_method: Optional[Literal["fineo", "card", "mobile_money", "cash"]] = "fineo"


class EventPrivatization(BaseModel):
    name: str
    surname: str
    phone: str
    email: EmailStr
    event_type: str
    event_date: str
    guest_count: int
    message: Optional[str] = ""


# ----- Helpers -----
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


def create_token(payload: dict) -> str:
    data = payload.copy()
    data["exp"] = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    return jwt.encode(data, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def make_qr(payload: str, styled: bool = False) -> str:
    """Generate a QR code as a base64 PNG data URL.

    When ``styled`` is True, the QR is rendered with rounded gold modules on a
    white background and a small white square in the centre containing the
    "BBr" mark — to match the luxury ticket template used for card / mobile
    money receipts. Otherwise a plain black-and-white QR is returned.
    """
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H if styled else qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    if styled:
        from qrcode.image.styledpil import StyledPilImage
        from qrcode.image.styles.moduledrawers.pil import RoundedModuleDrawer
        from qrcode.image.styles.colormasks import SolidFillColorMask
        from PIL import Image, ImageDraw, ImageFont
        gold = (140, 95, 38)  # warm brown-gold matching the ticket palette
        img = qr.make_image(
            image_factory=StyledPilImage,
            module_drawer=RoundedModuleDrawer(),
            color_mask=SolidFillColorMask(back_color=(255, 255, 255), front_color=gold),
        ).convert("RGB")
        # Stamp "BBr" in the centre on a white square (covered by ECC level H)
        w, h = img.size
        box = int(min(w, h) * 0.22)
        x0, y0 = (w - box) // 2, (h - box) // 2
        draw = ImageDraw.Draw(img)
        draw.rectangle([x0, y0, x0 + box, y0 + box], fill="white")
        # Best-effort font load — fall back to default if unavailable
        font = None
        for path in (
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        ):
            try:
                font = ImageFont.truetype(path, size=int(box * 0.5))
                break
            except Exception:
                continue
        if font is None:
            font = ImageFont.load_default()
        text = "BBr"
        bbox = draw.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text(
            (x0 + (box - tw) / 2 - bbox[0], y0 + (box - th) / 2 - bbox[1]),
            text,
            fill=gold,
            font=font,
        )
    else:
        img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


# --- Ticket image generation (printable PNG matching the brand template) ---
OFFER_HERO_URLS = {
    "pass_day": "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/4kr4z5g1_DAY%20PASS.jpeg",
    "sunset": "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/3g3onmkg_THE%20SUNSET.jpeg",
    "brunch": "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/1txrnqdp_B%20BRUNCH.jpeg",
    "le_kaai": "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/kgqk46mw_LE%20KAAI.jpeg",
    "hebergement": "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1600&q=80",
}

_HERO_CACHE: dict = {}


def _fetch_hero(offer_id: str):
    url = OFFER_HERO_URLS.get(offer_id)
    if not url:
        return None
    if url in _HERO_CACHE:
        return _HERO_CACHE[url].copy()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read()
        img = Image.open(io.BytesIO(data)).convert("RGB")
        _HERO_CACHE[url] = img
        return img.copy()
    except Exception as e:
        logging.warning("Failed to fetch hero for %s: %s", offer_id, e)
        return None


def _load_font(size: int, bold: bool = False):
    candidates = (
        [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        ]
        if bold
        else [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        ]
    )
    for path in candidates:
        try:
            return ImageFont.truetype(path, size=size)
        except Exception:
            continue
    return ImageFont.load_default()


def _format_date_long(date_iso: str, lang: str = "fr") -> str:
    try:
        d = datetime.strptime(date_iso, "%Y-%m-%d").date()
        if lang == "fr":
            days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
            months = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
            return f"{days[d.weekday()]} {d.day:02d} {months[d.month]} {d.year}"
        return d.strftime("%A %B %d %Y")
    except Exception:
        return date_iso


def make_ticket_image(
    offer_id: str,
    offer_name: str,
    date_iso: str,
    boat_time: str,
    owner_name: str,
    qr_payload: str,
    ref_code: str,
    lang: str = "fr",
) -> str:
    """Render the full luxury ticket as a base64 PNG data URL.

    Layout mirrors the brand template: BBr header, offer hero image with chevron
    strip, brown details block (left greeting + right Owner/Offer/Date/Boarding),
    centred gold QR with BBr stamp, and printed reference code below.
    """
    W = 900
    GOLD = (140, 95, 38)
    BROWN = (107, 68, 35)

    # Header layout
    H_PAD = 36
    H_HEADER = 130
    hero_w = W - 60
    hero_h = int(hero_w * 9 / 16)
    H_BROWN = 280
    QR_SIZE = 340
    H_QR_BLOCK = QR_SIZE + 110
    H = H_PAD + H_HEADER + hero_h + H_BROWN + 24 + H_QR_BLOCK + H_PAD

    img = Image.new("RGB", (W, H), "white")
    draw = ImageDraw.Draw(img)
    # Outer gold border to match printed template
    draw.rectangle([8, 8, W - 8, H - 8], outline=GOLD, width=2)

    # ---- Header ----
    y = H_PAD
    f_logo = _load_font(60, bold=True)
    f_sub = _load_font(13, bold=True)
    f_sub2 = _load_font(10)

    bbox = draw.textbbox((0, 0), "BBr", font=f_logo)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) / 2 - bbox[0], y), "BBr", fill=GOLD, font=f_logo)
    y += 72
    text = "BOULAY BEACH RESORT"
    bbox = draw.textbbox((0, 0), text, font=f_sub)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) / 2 - bbox[0], y), text, fill=GOLD, font=f_sub)
    y += 18
    text = "HOTEL & BEACH LIFE"
    bbox = draw.textbbox((0, 0), text, font=f_sub2)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) / 2 - bbox[0], y), text, fill=GOLD, font=f_sub2)
    y = H_PAD + H_HEADER

    # ---- Hero image ----
    hero_x = 30
    hero = _fetch_hero(offer_id)
    if hero is not None:
        ratio_src = hero.width / hero.height
        ratio_dst = hero_w / hero_h
        if ratio_src > ratio_dst:
            # crop sides
            new_w = int(hero.height * ratio_dst)
            left = (hero.width - new_w) // 2
            hero = hero.crop((left, 0, left + new_w, hero.height))
        else:
            new_h = int(hero.width / ratio_dst)
            top = (hero.height - new_h) // 2
            hero = hero.crop((0, top, hero.width, top + new_h))
        hero = hero.resize((hero_w, hero_h))
        img.paste(hero, (hero_x, y))
    else:
        draw.rectangle([hero_x, y, hero_x + hero_w, y + hero_h], fill=(220, 215, 205))

    # No decorative chevron strip — the hero image sits flush against the brown
    # details block below.
    y += hero_h

    # ---- Brown details block ----
    box_x0, box_y0 = 30, y
    box_x1, box_y1 = W - 30, y + H_BROWN
    draw.rectangle([box_x0, box_y0, box_x1, box_y1], fill=BROWN)

    f_h = _load_font(20, bold=True)
    f_body = _load_font(15)
    f_label = _load_font(13)
    f_value = _load_font(18, bold=True)

    col_left_x = box_x0 + 28
    col_right_x = box_x0 + (box_x1 - box_x0) // 2 + 10
    text_y = box_y0 + 30

    if lang == "fr":
        greet = [
            ("Voici votre pass, émis", True),
            ("suite à votre réservation.", True),
            ("", False),
            ("Nous vous souhaitons", False),
            ("une expérience inoubliable.", False),
            ("", False),
            ("Life is Here.", False),
        ]
        labels = ("Propriétaire", "Offre", "Date", "Heure d'embarquement")
    else:
        greet = [
            ("Here is your pass, issued", True),
            ("upon your reservation.", True),
            ("", False),
            ("We wish you", False),
            ("an unforgettable experience.", False),
            ("", False),
            ("Life is Here.", False),
        ]
        labels = ("Owner", "Offer", "Date", "Boarding time")

    cur_y = text_y
    for line, bold in greet:
        font = f_h if bold else f_body
        if line:
            draw.text((col_left_x, cur_y), line, fill="white", font=font)
        cur_y += 24 if bold else 22

    # Right column: 4 fields with thin white dividers
    field_y = text_y
    field_h = (H_BROWN - 60) // 4
    fields = (
        (labels[0], owner_name),
        (labels[1], offer_name),
        (labels[2], _format_date_long(date_iso, lang)),
        (labels[3], boat_time),
    )
    for label, value in fields:
        draw.text((col_right_x, field_y), label + " :", fill=(240, 235, 225), font=f_label)
        draw.text((col_right_x, field_y + 22), value, fill="white", font=f_value)
        draw.line(
            [(col_right_x, field_y + field_h - 4), (box_x1 - 28, field_y + field_h - 4)],
            fill=(255, 255, 255),
            width=1,
        )
        field_y += field_h

    y = box_y1 + 24

    # ---- QR section ----
    qr_obj = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr_obj.add_data(qr_payload)
    qr_obj.make(fit=True)
    from qrcode.image.styledpil import StyledPilImage
    from qrcode.image.styles.moduledrawers.pil import RoundedModuleDrawer
    from qrcode.image.styles.colormasks import SolidFillColorMask

    qr_img = (
        qr_obj.make_image(
            image_factory=StyledPilImage,
            module_drawer=RoundedModuleDrawer(),
            color_mask=SolidFillColorMask(back_color=(255, 255, 255), front_color=GOLD),
        )
        .convert("RGB")
        .resize((QR_SIZE, QR_SIZE))
    )
    # Stamp BBr in the centre of the QR
    qr_draw = ImageDraw.Draw(qr_img)
    cbox = int(QR_SIZE * 0.22)
    cx, cy = QR_SIZE // 2, QR_SIZE // 2
    qr_draw.rectangle([cx - cbox // 2, cy - cbox // 2, cx + cbox // 2, cy + cbox // 2], fill="white")
    f_bbr = _load_font(int(cbox * 0.5), bold=True)
    bbox = qr_draw.textbbox((0, 0), "BBr", font=f_bbr)
    bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    qr_draw.text((cx - bw / 2 - bbox[0], cy - bh / 2 - bbox[1]), "BBr", fill=GOLD, font=f_bbr)

    qr_x = (W - QR_SIZE) // 2
    img.paste(qr_img, (qr_x, y + 10))

    # Reference code below
    f_ref = _load_font(30, bold=True)
    bbox = draw.textbbox((0, 0), ref_code, font=f_ref)
    rw = bbox[2] - bbox[0]
    draw.text(((W - rw) / 2 - bbox[0], y + 10 + QR_SIZE + 28), ref_code, fill=BROWN, font=f_ref)

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def make_cash_receipt_image(
    offer_id: str,
    offer_name: str,
    date_iso: str,
    boat_time: str,
    owner_name: str,
    ref_code: str,
    lang: str = "fr",
) -> str:
    """Render the *temporary cash receipt* template as a base64 PNG data URL.

    Layout: gold-bordered logo header on white, hero image of the offer, then a
    cream/beige body holding a greeting (left) and the four reservation fields
    (right) separated by thin grey dividers. The reference code is printed in
    the bottom-right corner. No QR code (cash payments don't get a QR-as-pass).
    """
    W = 900
    GOLD = (140, 95, 38)
    CREAM = (245, 238, 219)
    DARK = (50, 38, 28)
    LIGHT_DARK = (70, 58, 48)
    LINE = (180, 170, 150)

    H_PAD = 36
    H_HEADER = 140
    hero_w = W - 120
    hero_h = int(hero_w * 9 / 16)
    H_BODY = 520
    H = H_PAD + H_HEADER + 20 + hero_h + H_BODY + H_PAD

    img = Image.new("RGB", (W, H), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    # --- Header: gold-bordered box with BBr logo + subtitles centred ---
    y = H_PAD
    box_x0, box_x1 = 60, W - 60
    box_y0 = y
    box_y1 = y + H_HEADER
    draw.rectangle([box_x0, box_y0, box_x1, box_y1], outline=GOLD, width=2)

    f_logo = _load_font(60, bold=True)
    f_sub = _load_font(13, bold=True)
    f_sub2 = _load_font(10)

    inner_y = box_y0 + 20
    bbox = draw.textbbox((0, 0), "BBr", font=f_logo)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) / 2 - bbox[0], inner_y), "BBr", fill=GOLD, font=f_logo)
    inner_y += 70
    text = "BOULAY BEACH RESORT"
    bbox = draw.textbbox((0, 0), text, font=f_sub)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) / 2 - bbox[0], inner_y), text, fill=GOLD, font=f_sub)
    inner_y += 16
    text = "HOTEL & BEACH LIFE"
    bbox = draw.textbbox((0, 0), text, font=f_sub2)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) / 2 - bbox[0], inner_y), text, fill=GOLD, font=f_sub2)

    y = box_y1 + 20

    # --- Hero image ---
    hero_x = 60
    hero = _fetch_hero(offer_id)
    if hero is not None:
        ratio_src = hero.width / hero.height
        ratio_dst = hero_w / hero_h
        if ratio_src > ratio_dst:
            new_w = int(hero.height * ratio_dst)
            left = (hero.width - new_w) // 2
            hero = hero.crop((left, 0, left + new_w, hero.height))
        else:
            new_h = int(hero.width / ratio_dst)
            top = (hero.height - new_h) // 2
            hero = hero.crop((0, top, hero.width, top + new_h))
        hero = hero.resize((hero_w, hero_h))
        img.paste(hero, (hero_x, y))
    else:
        draw.rectangle([hero_x, y, hero_x + hero_w, y + hero_h], fill=(220, 215, 205))
    y += hero_h

    # --- Cream body: greeting on left, 4 fields on right ---
    body_x0, body_x1 = 60, W - 60
    body_y0 = y
    body_y1 = y + H_BODY
    draw.rectangle([body_x0, body_y0, body_x1, body_y1], fill=CREAM)

    pad = 40
    col_left_x = body_x0 + pad
    col_right_x = body_x0 + (body_x1 - body_x0) // 2 + 10
    col_right_end = body_x1 - pad

    f_h = _load_font(20, bold=True)
    f_body = _load_font(16)
    f_label = _load_font(16)
    f_value = _load_font(16, bold=True)
    f_ref = _load_font(26, bold=True)

    if lang == "fr":
        bold_block = (
            "Voici votre réçu temporaire, émis "
            "suite à votre réservation avec paiement en espèces."
        )
        body_block = "Nous vous souhaitons une expérience inoubliable."
        signoff = "Life is Here."
        labels = ("Propriétaire", "Offre", "Date", "Heure d'embarquement")
    else:
        bold_block = (
            "Here is your temporary receipt, "
            "issued upon your reservation with cash payment."
        )
        body_block = "We wish you an unforgettable experience."
        signoff = "Life is Here."
        labels = ("Owner", "Offer", "Date", "Boarding time")

    def _wrap(text: str, font, max_w: int) -> list:
        """Greedy word-wrap into a list of lines that fit within max_w pixels."""
        words = text.split()
        lines: list = []
        cur = ""
        for w in words:
            test = (cur + " " + w).strip()
            tw = draw.textbbox((0, 0), test, font=font)[2]
            if tw <= max_w or not cur:
                cur = test
            else:
                lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
        return lines

    left_max_w = (body_x0 + (body_x1 - body_x0) // 2) - col_left_x - 30
    cy = body_y0 + 40
    for line in _wrap(bold_block, f_h, left_max_w):
        draw.text((col_left_x, cy), line, fill=DARK, font=f_h)
        cy += 28
    cy += 22
    for line in _wrap(body_block, f_body, left_max_w):
        draw.text((col_left_x, cy), line, fill=LIGHT_DARK, font=f_body)
        cy += 24
    cy += 18
    draw.text((col_left_x, cy), signoff, fill=LIGHT_DARK, font=f_body)

    # Right column: 4 fields with thin grey dividers
    field_y = body_y0 + 40
    fields = (
        (labels[0], owner_name),
        (labels[1], offer_name),
        (labels[2], _format_date_long(date_iso, lang)),
        (labels[3], boat_time),
    )
    for label, value in fields:
        label_text = label + " : "
        draw.text((col_right_x, field_y), label_text, fill=LIGHT_DARK, font=f_label)
        bbox = draw.textbbox((0, 0), label_text, font=f_label)
        lw = bbox[2] - bbox[0]
        draw.text((col_right_x + lw, field_y), value, fill=DARK, font=f_value)
        draw.line(
            [(col_right_x, field_y + 30), (col_right_end, field_y + 30)],
            fill=LINE,
            width=1,
        )
        field_y += 64

    # Reference code in the bottom-right corner of the cream body
    bbox = draw.textbbox((0, 0), ref_code, font=f_ref)
    rw = bbox[2] - bbox[0]
    draw.text(
        (col_right_end - rw - bbox[0], body_y1 - 65),
        ref_code,
        fill=DARK,
        font=f_ref,
    )

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


bearer = HTTPBearer(auto_error=False)


async def get_current_staff(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    if not creds:
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = decode_token(creds.credentials)
    if payload.get("type") != "staff":
        raise HTTPException(status_code=403, detail="Staff account required")
    user = await db.staff.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Staff not found")
    return user


# ----- App -----
app = FastAPI(title="Boulay Beach Resort API")
api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"name": "Boulay Beach Resort API", "status": "ok"}


# ----- Auth: Staff (kept for back-office) -----
@api.post("/auth/staff/login", response_model=TokenResponse)
async def login_staff(body: StaffLogin):
    user = await db.staff.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token({"sub": user["id"], "type": "staff", "role": user["role"]})
    public = {"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]}
    return TokenResponse(access_token=token, user=public)


# ----- Offers -----
def _with_boat_times(offer: dict) -> dict:
    oid = offer["id"]
    extra = {"allowed_weekdays": ALLOWED_WEEKDAYS_BY_OFFER.get(oid, [])}
    if oid == "le_kaai":
        extra["boat_times_weekday"] = BOAT_TIMES_WEEKDAY
        extra["boat_times_weekend"] = BOAT_TIMES_WEEKEND
        extra["boat_times"] = BOAT_TIMES_WEEKDAY  # default fallback
    else:
        extra["boat_times"] = BOAT_TIMES_BY_OFFER.get(oid, [])
    return {**offer, **extra}


@api.get("/offers")
async def list_offers():
    return [_with_boat_times(o) for o in OFFERS.values()]


@api.get("/offers/{offer_id}")
async def get_offer(offer_id: str):
    if offer_id not in OFFERS:
        raise HTTPException(status_code=404, detail="Offer not found")
    return _with_boat_times(OFFERS[offer_id])


# ----- Availability -----
@api.get("/availability/{offer_id}/{when}")
async def availability(offer_id: str, when: str):
    if offer_id not in OFFERS:
        raise HTTPException(status_code=404, detail="Offer not found")
    max_cap = OFFERS[offer_id]["max_capacity"]
    cursor = db.bookings.find(
        {"offer_type": offer_id, "date": when, "status": {"$ne": "cancelled"}},
        {"_id": 0, "adults": 1, "children": 1},
    )
    booked = 0
    async for b in cursor:
        booked += int(b.get("adults", 0)) + int(b.get("children", 0))
    return {
        "offer_id": offer_id,
        "date": when,
        "max_capacity": max_cap,
        "booked": booked,
        "remaining": max(max_cap - booked, 0),
    }


# ----- Bookings (guest flow, no auth) -----
@api.post("/bookings")
async def create_booking(body: BookingCreate):
    if body.offer_type not in OFFERS:
        raise HTTPException(status_code=400, detail="Invalid offer")
    offer = OFFERS[body.offer_type]

    # Validate boat_time against offer-specific allowed times (day-dependent for le_kaai)
    try:
        booking_date = datetime.strptime(body.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format (YYYY-MM-DD)")
    if booking_date < datetime.now(timezone.utc).date():
        raise HTTPException(status_code=400, detail="Date must be in the future")

    allowed_times = _boat_times_for_date(body.offer_type, booking_date.weekday())
    if body.boat_time not in allowed_times:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid boat time for {body.offer_type}. Allowed: {', '.join(allowed_times)}",
        )

    # Validate day-of-week matches the offer (Day Pass Mon-Fri, Sunset Sat, Brunch Sun)
    allowed_weekdays = ALLOWED_WEEKDAYS_BY_OFFER.get(body.offer_type, [])
    if booking_date.weekday() not in allowed_weekdays:
        names = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}
        allowed_names = [names[d] for d in allowed_weekdays]
        raise HTTPException(
            status_code=400,
            detail=f"Selected date is not available for {body.offer_type}. Allowed days: {', '.join(allowed_names)}",
        )

    total_guests = body.adults + body.children
    if total_guests <= 0:
        raise HTTPException(status_code=400, detail="At least one guest required")

    # Validate participants match the adult/child counts
    if len(body.participants) != total_guests:
        raise HTTPException(
            status_code=400,
            detail=f"Expected {total_guests} participants, received {len(body.participants)}",
        )
    adult_count = sum(1 for p in body.participants if p.kind == "adult")
    child_count = sum(1 for p in body.participants if p.kind == "child")
    if adult_count != body.adults or child_count != body.children:
        raise HTTPException(
            status_code=400,
            detail="Participants adult/child distribution does not match",
        )
    for p in body.participants:
        if not p.name.strip() or not p.surname.strip() or not p.nationality.strip() or not p.phone.strip():
            raise HTTPException(status_code=400, detail="All participant fields are required")

    # capacity check
    cursor = db.bookings.find(
        {"offer_type": body.offer_type, "date": body.date, "status": {"$ne": "cancelled"}},
        {"_id": 0, "adults": 1, "children": 1},
    )
    booked = 0
    async for b in cursor:
        booked += int(b.get("adults", 0)) + int(b.get("children", 0))
    if booked + total_guests > offer["max_capacity"]:
        raise HTTPException(status_code=400, detail="Not enough availability for this date")

    bid = str(uuid.uuid4())
    reference_token = uuid.uuid4().hex
    is_overnight = bool(offer.get("is_overnight"))
    room_tiers = offer.get("room_tiers") or []
    selected_tier = None
    nights = 0
    checkout_iso = None
    if is_overnight:
        if not body.checkout_date:
            raise HTTPException(status_code=400, detail="checkout_date is required for overnight stays")
        try:
            checkout = datetime.strptime(body.checkout_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid checkout_date format (YYYY-MM-DD)")
        nights = (checkout - booking_date).days
        if nights < 1:
            raise HTTPException(status_code=400, detail="Checkout date must be at least one day after arrival")
        checkout_iso = body.checkout_date
        if room_tiers:
            if not body.room_tier:
                raise HTTPException(status_code=400, detail="room_tier is required for this offer")
            selected_tier = next((t for t in room_tiers if t["id"] == body.room_tier), None)
            if not selected_tier:
                raise HTTPException(status_code=400, detail="Invalid room_tier")
            total = nights * body.rooms * selected_tier["price"]
        else:
            total = nights * (body.adults * offer["price_adult"] + body.children * offer["price_child"])
    else:
        total = body.adults * offer["price_adult"] + body.children * offer["price_child"]
    participants_docs = [
        {
            "name": p.name.strip(),
            "surname": p.surname.strip(),
            "email": p.email.lower(),
            "phone": p.phone.strip(),
            "nationality": p.nationality.strip(),
            "kind": p.kind,
        }
        for p in body.participants
    ]
    # Primary contact = first adult (or first participant if none)
    primary = next((p for p in participants_docs if p["kind"] == "adult"), participants_docs[0])
    doc = {
        "id": bid,
        "reference_token": reference_token,
        "offer_type": body.offer_type,
        "offer_name": offer["name_fr"],
        "date": body.date,
        "checkout_date": checkout_iso,
        "nights": nights,
        "room_tier": selected_tier["id"] if selected_tier else None,
        "room_tier_name": selected_tier["name_fr"] if selected_tier else None,
        "room_tier_price": selected_tier["price"] if selected_tier else None,
        "rooms": body.rooms,
        "adults": body.adults,
        "children": body.children,
        "total_amount": total,
        "status": "pending",
        "qr_codes": [],
        "participants": participants_docs,
        "boat_time": body.boat_time,
        "phone": primary["phone"],
        "email": primary["email"],
        "special_requests": body.special_requests or "",
        "created_at": now_iso(),
        "paid_at": None,
    }
    await db.bookings.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.post("/bookings/{booking_id}/pay")
async def pay_booking(booking_id: str, body: PayBooking):
    """FINEO placeholder - validates reference token, generates one QR per guest.
    Each QR encodes a complete JSON payload with all booking information."""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.get("reference_token") != body.reference_token:
        raise HTTPException(status_code=403, detail="Invalid reference token")
    if booking["status"] != "pending":
        raise HTTPException(status_code=400, detail="Booking already processed")

    offer = OFFERS[booking["offer_type"]]
    participants = booking.get("participants", [])
    # Card / mobile-money payments produce the luxury styled gold QR.
    # Cash payments keep a plain black-and-white QR.
    styled_qr = body.payment_method in ("fineo", "card", "mobile_money")
    base_payload = {
        "v": 1,
        "issuer": "Boulay Beach Resort",
        "booking_id": booking_id,
        "booking_ref": booking_id[:8].upper(),
        "offer_id": booking["offer_type"],
        "offer_name": offer["name_fr"],
        "schedule": offer["schedule_fr"],
        "date": booking["date"],
        "boat_time": booking.get("boat_time", ""),
        "adults": int(booking.get("adults", 0)),
        "children": int(booking.get("children", 0)),
        "total_amount_fcfa": int(booking["total_amount"]),
        "phone": booking["phone"],
        "email": booking["email"],
        "special_requests": booking.get("special_requests", "") or "",
    }

    qr_codes = []
    adult_i = 0
    child_i = 0
    for p in participants:
        token = uuid.uuid4().hex
        if p["kind"] == "adult":
            adult_i += 1
            idx = adult_i
            label_fr = f"Adulte #{idx}"
            label_en = f"Adult #{idx}"
        else:
            child_i += 1
            idx = child_i
            label_fr = f"Enfant #{idx}"
            label_en = f"Child #{idx}"
        guest_payload = {
            **base_payload,
            "guest_kind": p["kind"],
            "guest_index": idx,
            "guest_label": label_fr,
            "guest_name": p["name"],
            "guest_surname": p["surname"],
            "guest_email": p.get("email", ""),
            "guest_phone": p.get("phone", ""),
            "guest_nationality": p["nationality"],
            "guest_token": token,
        }
        payload_str = json.dumps(guest_payload, ensure_ascii=False, separators=(",", ":"))
        token_short = token[:10].upper()
        entry = {
            "label_fr": label_fr,
            "label_en": label_en,
            "kind": p["kind"],
            "guest_name": p["name"],
            "guest_surname": p["surname"],
            "guest_email": p.get("email", ""),
            "guest_phone": p.get("phone", ""),
            "guest_nationality": p["nationality"],
            "qr_token": token,
            "qr_payload": payload_str,
            "qr_code": make_qr(payload_str, styled=styled_qr),
        }
        if styled_qr:
            # Card / mobile-money payments: composite ticket with brown details + gold QR
            entry["ticket_image"] = make_ticket_image(
                offer_id=booking["offer_type"],
                offer_name=offer["name_fr"],
                date_iso=booking["date"],
                boat_time=booking.get("boat_time", ""),
                owner_name=f"{p['name']} {p['surname']}",
                qr_payload=payload_str,
                ref_code=token_short,
                lang="fr",
            )
        else:
            # Cash payments: cream "temporary receipt" with no QR shown
            entry["ticket_image"] = make_cash_receipt_image(
                offer_id=booking["offer_type"],
                offer_name=offer["name_fr"],
                date_iso=booking["date"],
                boat_time=booking.get("boat_time", ""),
                owner_name=f"{p['name']} {p['surname']}",
                ref_code=token_short,
                lang="fr",
            )
        qr_codes.append(entry)

    paid_at = now_iso()
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "confirmed",
            "qr_codes": qr_codes,
            "paid_at": paid_at,
            "payment_method": body.payment_method,
        }},
    )
    booking["status"] = "confirmed"
    booking["qr_codes"] = qr_codes
    booking["paid_at"] = paid_at
    booking["payment_method"] = body.payment_method
    return booking


@api.get("/bookings/{booking_id}")
async def get_booking(booking_id: str, ref: str):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.get("reference_token") != ref:
        raise HTTPException(status_code=403, detail="Invalid reference token")
    return booking


# ----- Event privatization -----
@api.post("/events/privatization")
async def event_privatization(body: EventPrivatization):
    eid = str(uuid.uuid4())
    doc = body.model_dump()
    doc.update({"id": eid, "status": "new", "created_at": now_iso()})
    await db.event_requests.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ----- Startup: seed staff (kept for future back-office) -----
@app.on_event("startup")
async def seed_staff():
    seeds = [
        {"email": "admin@boulay.ci", "name": "Admin Boulay", "role": "admin", "password": "Admin@2026"},
        {"email": "manager@boulay.ci", "name": "Manager Boulay", "role": "manager", "password": "Manager@2026"},
        {"email": "reception@boulay.ci", "name": "Réception Boulay", "role": "receptionist", "password": "Reception@2026"},
    ]
    for s in seeds:
        existing = await db.staff.find_one({"email": s["email"]})
        if not existing:
            await db.staff.insert_one({
                "id": str(uuid.uuid4()),
                "email": s["email"],
                "name": s["name"],
                "role": s["role"],
                "password_hash": hash_password(s["password"]),
                "created_at": now_iso(),
            })
    logging.info("Staff seeding complete")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
