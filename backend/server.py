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
        "name_fr": "The Sunset experience",
        "name_en": "The Sunset Experience",
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
        "name_fr": "B Brunch",
        "name_en": "B Brunch",
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
                "inventory": 18,
            },
            {
                "id": "suite_jardin",
                "name_fr": "Suite Côté Jardin",
                "name_en": "Garden View Suite",
                "price": 420000,
                "inventory": 6,
            },
            {
                "id": "suite_mer",
                "name_fr": "Suite Côté Mer",
                "name_en": "Sea View Suite",
                "price": 470000,
                "inventory": 6,
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
    return_boat_time: Optional[str] = None  # required for overnight stays (departure from resort on checkout day)
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
        gold = (140, 95, 38)  # warm brown-gold matching the ticket palette
        img = qr.make_image(
            image_factory=StyledPilImage,
            module_drawer=RoundedModuleDrawer(),
            color_mask=SolidFillColorMask(back_color=(255, 255, 255), front_color=gold),
        ).convert("RGB")
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

BBR_LOGO_URL = "https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/2p8ulkeu_LOGO_BBr_VF_Plan_de_travail_1-removebg-preview.png"
_LOGO_CACHE: dict = {}


def _fetch_logo():
    """Fetch + cache the BBr logo (RGBA, transparent background)."""
    if BBR_LOGO_URL in _LOGO_CACHE:
        return _LOGO_CACHE[BBR_LOGO_URL].copy()
    try:
        req = urllib.request.Request(BBR_LOGO_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read()
        logo = Image.open(io.BytesIO(data)).convert("RGBA")
        _LOGO_CACHE[BBR_LOGO_URL] = logo
        return logo.copy()
    except Exception as e:
        logging.warning("Failed to fetch BBr logo: %s", e)
        return None


def _paste_logo(canvas, top: int, max_h: int = 110):
    """Paste the BBr logo centred horizontally on ``canvas`` at vertical ``top``,
    sized so its height does not exceed ``max_h``. Returns the actual rendered
    height so callers can advance their layout cursor."""
    logo = _fetch_logo()
    if logo is None:
        return 0
    w0, h0 = logo.size
    new_h = max_h
    new_w = int(w0 * (new_h / h0))
    logo = logo.resize((new_w, new_h))
    canvas.paste(logo, ((canvas.width - new_w) // 2, top), logo)
    return new_h

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
        # Trim the bottom white/cream "footer band" that brand marketing assets
        # commonly include below the chevron decoration. Without this, that band
        # bleeds into the ticket layout as an unwanted white strip between the
        # photo and the brown / cream details block. 6% empirically matches the
        # standard BBR offer assets (DAY PASS, THE SUNSET, B BRUNCH, LE KAAI).
        trim = max(2, int(img.height * 0.06))
        if img.height - trim > 50:
            img = img.crop((0, 0, img.width, img.height - trim))
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
    H_HEADER = 320
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

    # ---- Header: BBr logo (image) ----
    y = H_PAD
    logo_h = _paste_logo(img, y, max_h=H_HEADER - 20, max_w_ratio=0.85)
    if logo_h == 0:
        # Fallback: text-only header if the logo failed to load
        f_logo = _load_font(60, bold=True)
        bbox = draw.textbbox((0, 0), "BBr", font=f_logo)
        draw.text(((W - (bbox[2] - bbox[0])) / 2 - bbox[0], y), "BBr", fill=GOLD, font=f_logo)
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
    H_HEADER = 230
    hero_w = W - 120
    hero_h = int(hero_w * 9 / 16)
    H_BODY = 520
    H = H_PAD + H_HEADER + 20 + hero_h + H_BODY + H_PAD

    img = Image.new("RGB", (W, H), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    # --- Header: gold-bordered box with BBr logo image ---
    y = H_PAD
    box_x0, box_x1 = 60, W - 60
    box_y0 = y
    box_y1 = y + H_HEADER
    draw.rectangle([box_x0, box_y0, box_x1, box_y1], outline=GOLD, width=2)

    # Paste the logo centred inside the bordered box
    logo = _fetch_logo()
    if logo is not None:
        inner_h = H_HEADER - 24
        w0, h0 = logo.size
        new_h = inner_h
        new_w = int(w0 * (new_h / h0))
        # Cap width so the logo doesn't bleed over the gold border
        max_w = (box_x1 - box_x0) - 24
        if new_w > max_w:
            new_w = max_w
            new_h = int(h0 * (new_w / w0))
        logo_r = logo.resize((new_w, new_h))
        cx = box_x0 + (box_x1 - box_x0 - new_w) // 2
        cy = box_y0 + (H_HEADER - new_h) // 2
        img.paste(logo_r, (cx, cy), logo_r)
    else:
        f_logo = _load_font(60, bold=True)
        bbox = draw.textbbox((0, 0), "BBr", font=f_logo)
        draw.text((box_x0 + (box_x1 - box_x0 - (bbox[2] - bbox[0])) / 2 - bbox[0], box_y0 + 30), "BBr", fill=GOLD, font=f_logo)

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
    if oid in ("le_kaai", "hebergement"):
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
    return_boat_time = None
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
        # Validate return boat time against checkout weekday
        if not body.return_boat_time:
            raise HTTPException(status_code=400, detail="return_boat_time is required for overnight stays")
        return_allowed = _boat_times_for_date(body.offer_type, checkout.weekday())
        if body.return_boat_time not in return_allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid return boat time. Allowed: {', '.join(return_allowed)}",
            )
        return_boat_time = body.return_boat_time
        if room_tiers:
            if not body.room_tier:
                raise HTTPException(status_code=400, detail="room_tier is required for this offer")
            selected_tier = next((t for t in room_tiers if t["id"] == body.room_tier), None)
            if not selected_tier:
                raise HTTPException(status_code=400, detail="Invalid room_tier")
            # Overbooking guard: for every night in the stay, sum existing rooms for this tier must
            # leave at least body.rooms slots available against the tier's `inventory`.
            tier_inventory = int(selected_tier.get("inventory", 0))
            if tier_inventory > 0:
                # Find any existing hebergement booking overlapping this date range with the same tier
                overlapping = db.bookings.find(
                    {
                        "offer_type": "hebergement",
                        "room_tier": body.room_tier,
                        "status": {"$ne": "cancelled"},
                        "date": {"$lt": body.checkout_date},
                        "checkout_date": {"$gt": body.date},
                    },
                    {"_id": 0, "date": 1, "checkout_date": 1, "rooms": 1},
                )
                # Build per-night occupancy
                night_occ: dict = {}
                async for ob in overlapping:
                    a = datetime.strptime(ob["date"], "%Y-%m-%d").date()
                    c = datetime.strptime(ob["checkout_date"], "%Y-%m-%d").date()
                    n = a
                    while n < c:
                        night_occ[n.isoformat()] = night_occ.get(n.isoformat(), 0) + int(ob.get("rooms", 1))
                        n += timedelta(days=1)
                # Check each night of our new booking
                night = booking_date
                while night < checkout:
                    used = night_occ.get(night.isoformat(), 0)
                    if used + body.rooms > tier_inventory:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Plus de chambres '{selected_tier['name_fr']}' disponibles pour la nuit du {night.isoformat()} ({tier_inventory - used} restantes).",
                        )
                    night += timedelta(days=1)
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
        "return_boat_time": return_boat_time,
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
        "return_boat_time": booking.get("return_boat_time") or "",
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


# =================================================================
# BACK-OFFICE (Staff) — Module 1 (Dashboard) & 3 (Embarquement)
# =================================================================

class Bateau(BaseModel):
    name: str
    capacity: int = Field(ge=1, le=300)
    status: Literal["actif", "maintenance"] = "actif"


class BateauUpdate(BaseModel):
    name: Optional[str] = None
    capacity: Optional[int] = None
    status: Optional[Literal["actif", "maintenance"]] = None


class Traversee(BaseModel):
    bateau_id: str
    date: str  # YYYY-MM-DD
    depart_time: str  # "12H" etc
    direction: Literal["aller", "retour"] = "aller"


async def _seed_default_bateaux():
    """Seed 3 default boats if none exist."""
    if await db.bateaux.count_documents({}) == 0:
        defaults = [
            {"id": str(uuid.uuid4()), "name": "L'Étoile de Boulay", "capacity": 50, "status": "actif"},
            {"id": str(uuid.uuid4()), "name": "Le Lagon d'Or", "capacity": 40, "status": "actif"},
            {"id": str(uuid.uuid4()), "name": "Le Sunset Express", "capacity": 30, "status": "actif"},
        ]
        await db.bateaux.insert_many(defaults)
        logging.info("Seeded %d default boats", len(defaults))


async def _require_role(staff: dict, allowed: list):
    if staff.get("role") not in allowed:
        raise HTTPException(status_code=403, detail="Insufficient privileges")


# ---------- Dashboard KPIs (Module 1) ----------
@api.get("/staff/dashboard")
async def staff_dashboard(staff=Depends(get_current_staff)):
    """KPIs + planning du jour + alertes pour la page d'accueil staff."""
    today = datetime.now(timezone.utc).date().isoformat()
    cursor = db.bookings.find({"date": today}, {"_id": 0, "reference_token": 0, "qr_codes": 0})
    bookings_today = await cursor.to_list(length=500)

    revenue_today = sum(b.get("total_amount", 0) for b in bookings_today if b.get("status") in ("confirmed", "arrived", "completed"))
    guests_today = sum(b.get("adults", 0) + b.get("children", 0) for b in bookings_today)
    crossings = await db.traversees.count_documents({"date": today})

    # Status pipeline counts
    pipeline_counts = {"pending": 0, "confirmed": 0, "arrived": 0, "completed": 0, "cancelled": 0}
    for b in bookings_today:
        s = b.get("status", "pending")
        pipeline_counts[s] = pipeline_counts.get(s, 0) + 1

    # Alerts
    now = datetime.now(timezone.utc)
    imminent = []
    for b in bookings_today:
        bt = b.get("boat_time", "")
        if bt and bt.endswith("H"):
            try:
                hour = int(bt[:-1])
                btime = datetime.combine(now.date(), datetime.min.time()).replace(tzinfo=timezone.utc, hour=hour)
                diff = (btime - now).total_seconds() / 3600
                if 0 <= diff <= 2 and b.get("status") in ("pending", "confirmed"):
                    imminent.append({"booking_id": b["id"], "client": b.get("phone", ""), "offer": b.get("offer_name", ""), "boat_time": bt, "guests": b.get("adults", 0) + b.get("children", 0)})
            except Exception:
                pass

    unpaid = await db.bookings.find({"status": "pending"}, {"_id": 0, "id": 1, "offer_name": 1, "total_amount": 1, "phone": 1, "date": 1}).limit(20).to_list(length=20)

    return {
        "kpis": {
            "bookings_today": len(bookings_today),
            "revenue_today": revenue_today,
            "guests_today": guests_today,
            "crossings_today": crossings,
        },
        "pipeline": pipeline_counts,
        "bookings_today": bookings_today,
        "alerts": {
            "imminent_arrivals": imminent,
            "unpaid_bookings": unpaid,
        },
    }


# ---------- Bateaux CRUD (Module 3) ----------
@api.get("/staff/bateaux")
async def list_bateaux(staff=Depends(get_current_staff)):
    await _seed_default_bateaux()
    items = await db.bateaux.find({}, {"_id": 0}).to_list(length=200)
    return items


@api.post("/staff/bateaux")
async def create_bateau(body: Bateau, staff=Depends(get_current_staff)):
    await _require_role(staff, ["manager", "admin"])
    doc = {"id": str(uuid.uuid4()), **body.model_dump()}
    await db.bateaux.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.patch("/staff/bateaux/{bateau_id}")
async def update_bateau(bateau_id: str, body: BateauUpdate, staff=Depends(get_current_staff)):
    await _require_role(staff, ["manager", "admin"])
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.bateaux.update_one({"id": bateau_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Bateau not found")
    return {"ok": True}


@api.delete("/staff/bateaux/{bateau_id}")
async def delete_bateau(bateau_id: str, staff=Depends(get_current_staff)):
    await _require_role(staff, ["admin"])
    res = await db.bateaux.delete_one({"id": bateau_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bateau not found")
    return {"ok": True}


# ---------- Traversées (Module 3) ----------
@api.get("/staff/traversees")
async def list_traversees(date: Optional[str] = None, staff=Depends(get_current_staff)):
    """List all crossings (default = today) with linked passengers."""
    if date is None:
        date = datetime.now(timezone.utc).date().isoformat()
    crossings = await db.traversees.find({"date": date}, {"_id": 0}).to_list(length=200)
    # Hydrate with bateau info + passenger count
    bateaux = {b["id"]: b for b in await db.bateaux.find({}, {"_id": 0}).to_list(length=200)}
    for c in crossings:
        c["bateau"] = bateaux.get(c.get("bateau_id"), {})
        passengers = await db.traversee_passengers.find({"traversee_id": c["id"]}, {"_id": 0}).to_list(length=500)
        c["passengers"] = passengers
        c["passenger_count"] = sum(p.get("guests", 1) for p in passengers)
    return sorted(crossings, key=lambda x: (x.get("date", ""), x.get("depart_time", "")))


@api.post("/staff/traversees")
async def create_traversee(body: Traversee, staff=Depends(get_current_staff)):
    await _require_role(staff, ["manager", "admin"])
    bateau = await db.bateaux.find_one({"id": body.bateau_id}, {"_id": 0})
    if not bateau:
        raise HTTPException(status_code=404, detail="Bateau not found")
    tid = str(uuid.uuid4())
    doc = {
        "id": tid,
        "bateau_id": body.bateau_id,
        "date": body.date,
        "depart_time": body.depart_time,
        "direction": body.direction,
        "status": "programmé",
        "created_at": now_iso(),
    }
    await db.traversees.insert_one(doc)
    # Auto-create the corresponding return trip ~5h later, only for "aller"
    if body.direction == "aller":
        try:
            hour = int(body.depart_time.replace("H", ""))
            ret_hour = min(hour + 5, 22)
            ret_doc = {
                "id": str(uuid.uuid4()),
                "bateau_id": body.bateau_id,
                "date": body.date,
                "depart_time": f"{ret_hour}H",
                "direction": "retour",
                "status": "programmé",
                "parent_id": tid,
                "created_at": now_iso(),
            }
            await db.traversees.insert_one(ret_doc)
        except Exception:
            pass
    return {k: v for k, v in doc.items() if k != "_id"}


@api.patch("/staff/traversees/{tid}/status")
async def update_traversee_status(tid: str, status: str = Body(..., embed=True), staff=Depends(get_current_staff)):
    await _require_role(staff, ["receptionist", "manager", "admin"])
    if status not in ("programmé", "en_cours", "terminé"):
        raise HTTPException(status_code=400, detail="Invalid status")
    res = await db.traversees.update_one({"id": tid}, {"$set": {"status": status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Traversee not found")
    return {"ok": True}


@api.post("/staff/traversees/{tid}/board")
async def board_passenger(tid: str, body: dict = Body(...), staff=Depends(get_current_staff)):
    """Mark a booking as boarded on a crossing."""
    await _require_role(staff, ["receptionist", "manager", "admin"])
    booking_id = body.get("booking_id")
    if not booking_id:
        raise HTTPException(status_code=400, detail="booking_id required")
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    crossing = await db.traversees.find_one({"id": tid})
    if not crossing:
        raise HTTPException(status_code=404, detail="Traversee not found")
    # Capacity check
    bateau = await db.bateaux.find_one({"id": crossing["bateau_id"]}, {"_id": 0})
    existing = await db.traversee_passengers.find({"traversee_id": tid}).to_list(length=500)
    booked = sum(p.get("guests", 1) for p in existing)
    guests = booking.get("adults", 0) + booking.get("children", 0)
    if bateau and booked + guests > bateau["capacity"]:
        raise HTTPException(status_code=400, detail=f"Capacity exceeded ({bateau['capacity']})")
    # Upsert
    await db.traversee_passengers.update_one(
        {"traversee_id": tid, "booking_id": booking_id},
        {
            "$set": {
                "traversee_id": tid,
                "booking_id": booking_id,
                "guests": guests,
                "client_name": f"{booking.get('participants', [{}])[0].get('surname', '')} {booking.get('participants', [{}])[0].get('name', '')}".strip(),
                "offer_name": booking.get("offer_name"),
                "boarded_at": now_iso(),
            }
        },
        upsert=True,
    )
    # Mark booking arrived
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": "arrived"}})
    return {"ok": True, "guests_boarded": guests}


@api.delete("/staff/traversees/{tid}/board/{booking_id}")
async def unboard_passenger(tid: str, booking_id: str, staff=Depends(get_current_staff)):
    await _require_role(staff, ["receptionist", "manager", "admin"])
    await db.traversee_passengers.delete_one({"traversee_id": tid, "booking_id": booking_id})
    return {"ok": True}


# ---------- Traversées — Historique & Rapport PDF ----------
def _resolve_period_range(period: str, ref: str) -> tuple:
    """Convert (period, ref date YYYY-MM-DD) to (start_date_iso, end_date_iso_exclusive, label)."""
    try:
        d = datetime.strptime(ref, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date (YYYY-MM-DD)")
    if period == "day":
        return d.isoformat(), (d + timedelta(days=1)).isoformat(), d.strftime("%A %d %B %Y")
    if period == "week":
        start = d - timedelta(days=d.weekday())  # Monday
        end = start + timedelta(days=7)
        return start.isoformat(), end.isoformat(), f"Semaine du {start.strftime('%d %b')} au {(end - timedelta(days=1)).strftime('%d %b %Y')}"
    if period == "month":
        start = d.replace(day=1)
        next_month = (start + timedelta(days=32)).replace(day=1)
        return start.isoformat(), next_month.isoformat(), start.strftime("%B %Y")
    raise HTTPException(status_code=400, detail="period must be day|week|month")


async def _fetch_history(date_from: str, date_to: str, status: Optional[str] = None) -> dict:
    """Aggregate crossings + passenger counts in a date range. date_to is exclusive."""
    q: dict = {"date": {"$gte": date_from, "$lt": date_to}}
    if status:
        q["status"] = status
    crossings = await db.traversees.find(q, {"_id": 0}).sort([("date", 1), ("depart_time", 1)]).to_list(length=5000)
    bateaux = await db.bateaux.find({}, {"_id": 0}).to_list(length=200)
    boat_by_id = {b["id"]: b for b in bateaux}

    # Aggregate passengers per crossing
    tids = [c["id"] for c in crossings]
    pax_by_tid: dict = {tid: {"count": 0, "guests": 0} for tid in tids}
    if tids:
        cur = db.traversee_passengers.find({"traversee_id": {"$in": tids}}, {"_id": 0})
        async for p in cur:
            tid = p["traversee_id"]
            pax_by_tid[tid]["count"] += 1
            pax_by_tid[tid]["guests"] += int(p.get("guests", 1))

    by_status = {"programmé": 0, "en_cours": 0, "terminé": 0}
    by_day: dict = {}
    by_boat: dict = {}
    by_direction = {"aller": 0, "retour": 0}
    total_passengers = 0
    total_guests = 0
    items = []

    for c in crossings:
        st = c.get("status") or "programmé"
        by_status[st] = by_status.get(st, 0) + 1
        by_day.setdefault(c["date"], {"date": c["date"], "total": 0, "programmé": 0, "en_cours": 0, "terminé": 0, "guests": 0})
        by_day[c["date"]]["total"] += 1
        by_day[c["date"]][st] = by_day[c["date"]].get(st, 0) + 1
        bid = c["bateau_id"]
        bname = (boat_by_id.get(bid) or {}).get("name", "—")
        by_boat.setdefault(bid, {"bateau_id": bid, "bateau_name": bname, "total": 0, "terminé": 0, "guests": 0})
        by_boat[bid]["total"] += 1
        if st == "terminé":
            by_boat[bid]["terminé"] += 1
        by_direction[c.get("direction", "aller")] = by_direction.get(c.get("direction", "aller"), 0) + 1
        pax = pax_by_tid.get(c["id"], {"count": 0, "guests": 0})
        total_passengers += pax["count"]
        total_guests += pax["guests"]
        by_day[c["date"]]["guests"] += pax["guests"]
        by_boat[bid]["guests"] += pax["guests"]
        items.append({
            **c,
            "bateau_name": bname,
            "passenger_count": pax["count"],
            "guests": pax["guests"],
        })

    return {
        "total": len(crossings),
        "by_status": by_status,
        "by_direction": by_direction,
        "by_day": [by_day[k] for k in sorted(by_day.keys())],
        "by_boat": sorted(by_boat.values(), key=lambda x: x["total"], reverse=True),
        "total_passengers": total_passengers,
        "total_guests": total_guests,
        "items": items,
    }


@api.get("/staff/traversees/history")
async def traversees_history(
    period: str = "day",
    date: Optional[str] = None,
    status: Optional[str] = None,
    staff=Depends(get_current_staff),
):
    """Crossings history with stats. period=day|week|month, date=YYYY-MM-DD (default today),
    status=programmé|en_cours|terminé (optional filter)."""
    await _require_role(staff, ["receptionist", "manager", "admin"])
    ref = date or datetime.now(timezone.utc).date().isoformat()
    date_from, date_to, label = _resolve_period_range(period, ref)
    if status and status not in ("programmé", "en_cours", "terminé"):
        raise HTTPException(status_code=400, detail="Invalid status")
    payload = await _fetch_history(date_from, date_to, status)
    return {
        "period": period,
        "reference_date": ref,
        "label": label,
        "date_from": date_from,
        "date_to": date_to,
        "status_filter": status,
        **payload,
    }


@api.get("/staff/traversees/history/report.pdf")
async def traversees_history_pdf(
    period: str = "day",
    date: Optional[str] = None,
    status: Optional[str] = None,
    staff=Depends(get_current_staff),
):
    """Generate a luxury-styled PDF report of the crossings for the given period."""
    await _require_role(staff, ["receptionist", "manager", "admin"])
    ref = date or datetime.now(timezone.utc).date().isoformat()
    date_from, date_to, label = _resolve_period_range(period, ref)
    if status and status not in ("programmé", "en_cours", "terminé"):
        raise HTTPException(status_code=400, detail="Invalid status")
    data = await _fetch_history(date_from, date_to, status)

    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
    from reportlab.pdfgen import canvas as rl_canvas
    from fastapi.responses import StreamingResponse

    GOLD = colors.HexColor("#B8922A")
    DARK = colors.HexColor("#0A0A0A")
    LIGHT = colors.HexColor("#FAFAF7")
    MUTED = colors.HexColor("#888888")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=22, textColor=DARK, alignment=0, spaceAfter=4)
    sub = ParagraphStyle("sub", parent=styles["Normal"], fontName="Helvetica", fontSize=10, textColor=GOLD, alignment=0, spaceAfter=16, leading=14)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, textColor=GOLD, spaceBefore=12, spaceAfter=6)
    body = ParagraphStyle("body", parent=styles["Normal"], fontName="Helvetica", fontSize=9, textColor=DARK)
    small = ParagraphStyle("small", parent=styles["Normal"], fontName="Helvetica", fontSize=8, textColor=MUTED)

    elements = []
    elements.append(Paragraph("Boulay Beach Resort", h1))
    period_label = {"day": "Journalier", "week": "Hebdomadaire", "month": "Mensuel"}.get(period, period)
    filter_label = f" — Statut : {status}" if status else ""
    elements.append(Paragraph(f"Rapport des traversées · {period_label} · {label}{filter_label}", sub))

    # KPI block
    kpi_data = [
        ["Total", "Programmées", "En cours", "Terminées", "Passagers"],
        [
            str(data["total"]),
            str(data["by_status"].get("programmé", 0)),
            str(data["by_status"].get("en_cours", 0)),
            str(data["by_status"].get("terminé", 0)),
            str(data["total_guests"]),
        ],
    ]
    kpi_tbl = Table(kpi_data, colWidths=[3.4 * cm] * 5)
    kpi_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, 0), 7),
        ("TEXTCOLOR", (0, 0), (-1, 0), MUTED),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, 1), 16),
        ("TEXTCOLOR", (0, 1), (-1, 1), DARK),
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, GOLD),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E0D5B5")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(kpi_tbl)

    # By boat
    if data["by_boat"]:
        elements.append(Paragraph("Répartition par bateau", h2))
        boat_rows = [["Bateau", "Total", "Terminées", "Passagers"]]
        for b in data["by_boat"]:
            boat_rows.append([b["bateau_name"], str(b["total"]), str(b["terminé"]), str(b["guests"])])
        boat_tbl = Table(boat_rows, colWidths=[7 * cm, 3 * cm, 3 * cm, 3 * cm])
        boat_tbl.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("TEXTCOLOR", (0, 0), (-1, 0), GOLD),
            ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
            ("FONTSIZE", (0, 1), (-1, -1), 9),
            ("TEXTCOLOR", (0, 1), (-1, -1), DARK),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, GOLD),
            ("LINEBELOW", (0, 1), (-1, -1), 0.25, colors.HexColor("#EEE")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(boat_tbl)

    # By day (for week/month)
    if period in ("week", "month") and data["by_day"]:
        elements.append(Paragraph("Détail par jour", h2))
        day_rows = [["Date", "Total", "Programmées", "En cours", "Terminées", "Passagers"]]
        for d in data["by_day"]:
            day_rows.append([d["date"], str(d["total"]), str(d.get("programmé", 0)),
                             str(d.get("en_cours", 0)), str(d.get("terminé", 0)), str(d.get("guests", 0))])
        day_tbl = Table(day_rows, colWidths=[3 * cm, 2 * cm, 2.5 * cm, 2.2 * cm, 2.3 * cm, 2.5 * cm])
        day_tbl.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("TEXTCOLOR", (0, 0), (-1, 0), GOLD),
            ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
            ("FONTSIZE", (0, 1), (-1, -1), 8.5),
            ("TEXTCOLOR", (0, 1), (-1, -1), DARK),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, GOLD),
            ("LINEBELOW", (0, 1), (-1, -1), 0.25, colors.HexColor("#EEE")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        elements.append(day_tbl)

    # Detailed crossings
    elements.append(Paragraph("Liste des traversées", h2))
    if not data["items"]:
        elements.append(Paragraph("Aucune traversée sur cette période.", body))
    else:
        rows = [["Date", "Heure", "Direction", "Bateau", "Statut", "Passagers"]]
        status_map = {"programmé": "Programmée", "en_cours": "En cours", "terminé": "Terminée"}
        for it in data["items"]:
            rows.append([
                it.get("date", ""),
                it.get("depart_time", ""),
                (it.get("direction") or "").capitalize(),
                it.get("bateau_name", ""),
                status_map.get(it.get("status"), it.get("status", "")),
                str(it.get("guests", 0)),
            ])
        crossings_tbl = Table(rows, colWidths=[2.5 * cm, 1.6 * cm, 2.2 * cm, 4.5 * cm, 2.8 * cm, 2 * cm], repeatRows=1)
        crossings_tbl.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("TEXTCOLOR", (0, 0), (-1, 0), GOLD),
            ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
            ("TEXTCOLOR", (0, 1), (-1, -1), DARK),
            ("ALIGN", (4, 0), (-1, -1), "CENTER"),
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, GOLD),
            ("LINEBELOW", (0, 1), (-1, -1), 0.2, colors.HexColor("#EEE")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(crossings_tbl)

    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph(
        f"Rapport généré le {datetime.now(timezone.utc).strftime('%d/%m/%Y à %H:%M UTC')} · Boulay Beach Resort, Abidjan",
        small,
    ))

    def _footer(canvas, doc_):
        canvas.saveState()
        canvas.setStrokeColor(GOLD)
        canvas.setLineWidth(0.5)
        canvas.line(2 * cm, 1.5 * cm, A4[0] - 2 * cm, 1.5 * cm)
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(MUTED)
        canvas.drawString(2 * cm, 1 * cm, "Boulay Beach Resort — Rapport interne — Confidentiel")
        canvas.drawRightString(A4[0] - 2 * cm, 1 * cm, f"Page {doc_.page}")
        canvas.restoreState()

    doc.build(elements, onFirstPage=_footer, onLaterPages=_footer)
    buf.seek(0)
    filename = f"bbr-traversees-{period}-{ref}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------- Shared PDF helpers ----------
def _pdf_styles():
    """Return common reportlab styles used by all BBr PDF reports."""
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    GOLD = colors.HexColor("#B8922A")
    DARK = colors.HexColor("#0A0A0A")
    LIGHT = colors.HexColor("#FAFAF7")
    MUTED = colors.HexColor("#888888")
    base = getSampleStyleSheet()
    return {
        "GOLD": GOLD, "DARK": DARK, "LIGHT": LIGHT, "MUTED": MUTED,
        "h1": ParagraphStyle("h1", parent=base["Title"], fontName="Helvetica-Bold", fontSize=22, textColor=DARK, alignment=0, spaceAfter=4),
        "sub": ParagraphStyle("sub", parent=base["Normal"], fontName="Helvetica", fontSize=10, textColor=GOLD, alignment=0, spaceAfter=16, leading=14),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=12, textColor=GOLD, spaceBefore=12, spaceAfter=6),
        "body": ParagraphStyle("body", parent=base["Normal"], fontName="Helvetica", fontSize=9, textColor=DARK),
        "small": ParagraphStyle("small", parent=base["Normal"], fontName="Helvetica", fontSize=8, textColor=MUTED),
    }


def _pdf_footer_factory(styles):
    """Return a (canvas, doc) footer drawer using shared style."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    GOLD, MUTED = styles["GOLD"], styles["MUTED"]

    def _footer(canvas, doc_):
        canvas.saveState()
        canvas.setStrokeColor(GOLD)
        canvas.setLineWidth(0.5)
        canvas.line(2 * cm, 1.5 * cm, A4[0] - 2 * cm, 1.5 * cm)
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(MUTED)
        canvas.drawString(2 * cm, 1 * cm, "Boulay Beach Resort — Rapport interne — Confidentiel")
        canvas.drawRightString(A4[0] - 2 * cm, 1 * cm, f"Page {doc_.page}")
        canvas.restoreState()
    return _footer


def _format_xof(amount: int) -> str:
    """Format an integer as XOF amount, e.g. 1 500 000 FCFA."""
    try:
        n = int(amount or 0)
    except Exception:
        n = 0
    return f"{n:,}".replace(",", " ") + " FCFA"


# ---------- QR Scanner (Module 4) ----------
@api.get("/staff/scan/{qr_token}")
async def scan_qr(qr_token: str, staff=Depends(get_current_staff)):
    """Look up a booking by QR token. Returns the participant + booking summary."""
    booking = await db.bookings.find_one({"qr_codes.qr_token": qr_token}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="QR code not recognised")
    guest = next((q for q in booking.get("qr_codes", []) if q.get("qr_token") == qr_token), None)
    summary = {
        "booking_id": booking["id"],
        "offer_name": booking["offer_name"],
        "date": booking["date"],
        "boat_time": booking.get("boat_time"),
        "adults": booking.get("adults"),
        "children": booking.get("children"),
        "status": booking.get("status"),
        "payment_method": booking.get("payment_method"),
        "total_amount": booking.get("total_amount", 0),
        "special_requests": booking.get("special_requests", ""),
        "guest_name": guest.get("guest_name") if guest else "",
        "guest_surname": guest.get("guest_surname") if guest else "",
        "guest_nationality": guest.get("guest_nationality") if guest else "",
    }
    return summary


@api.post("/staff/bookings/{booking_id}/arrived")
async def mark_arrived(booking_id: str, staff=Depends(get_current_staff)):
    res = await db.bookings.update_one({"id": booking_id}, {"$set": {"status": "arrived", "arrived_at": now_iso()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"ok": True}


# =================================================================
# MODULE 2 — Reservations management (list, filters, detail, actions)
# =================================================================

@api.get("/staff/bookings")
async def list_bookings(
    offer_type: Optional[str] = None,
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 200,
    staff=Depends(get_current_staff),
):
    """List bookings with filters. payment_status = paid | unpaid."""
    await _require_role(staff, ["manager", "admin"])
    q: dict = {}
    if offer_type:
        q["offer_type"] = offer_type
    if status:
        q["status"] = status
    if date_from or date_to:
        d: dict = {}
        if date_from:
            d["$gte"] = date_from
        if date_to:
            d["$lte"] = date_to
        q["date"] = d
    if payment_status == "paid":
        q["paid_at"] = {"$ne": None}
    elif payment_status == "unpaid":
        q["$or"] = [{"paid_at": None}, {"paid_at": {"$exists": False}}]
    if search:
        s = search.strip()
        q.setdefault("$or", []).extend([
            {"phone": {"$regex": s, "$options": "i"}},
            {"email": {"$regex": s, "$options": "i"}},
            {"participants.name": {"$regex": s, "$options": "i"}},
            {"participants.surname": {"$regex": s, "$options": "i"}},
        ])
    cursor = db.bookings.find(
        q,
        {"_id": 0, "reference_token": 0, "qr_codes.qr_code": 0, "qr_codes.qr_payload": 0, "qr_codes.ticket_image": 0},
    ).sort([("date", -1), ("created_at", -1)]).limit(limit)
    items = await cursor.to_list(length=limit)
    return items


@api.get("/staff/bookings/calendar")
async def bookings_calendar(month: str, staff=Depends(get_current_staff)):
    """Return all bookings for a month (YYYY-MM) grouped by date for calendar view."""
    await _require_role(staff, ["manager", "admin"])
    if not month or len(month) != 7:
        raise HTTPException(status_code=400, detail="month must be YYYY-MM")
    date_from = f"{month}-01"
    next_month = datetime.strptime(date_from, "%Y-%m-%d").date() + timedelta(days=32)
    date_to = next_month.replace(day=1).isoformat()
    cursor = db.bookings.find(
        {"date": {"$gte": date_from, "$lt": date_to}},
        {"_id": 0, "id": 1, "date": 1, "offer_type": 1, "offer_name": 1, "status": 1, "adults": 1, "children": 1, "boat_time": 1, "total_amount": 1, "paid_at": 1},
    )
    items = await cursor.to_list(length=2000)
    by_date: dict = {}
    for b in items:
        by_date.setdefault(b["date"], []).append(b)
    return {"month": month, "by_date": by_date, "total": len(items)}


@api.get("/staff/bookings/{booking_id}")
async def booking_detail(booking_id: str, staff=Depends(get_current_staff)):
    """Full booking detail (excludes heavy ticket_image / qr_code base64 payloads)."""
    await _require_role(staff, ["manager", "admin"])
    booking = await db.bookings.find_one(
        {"id": booking_id},
        {"_id": 0, "reference_token": 0, "qr_codes.qr_code": 0, "qr_codes.qr_payload": 0, "qr_codes.ticket_image": 0},
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking


@api.patch("/staff/bookings/{booking_id}/status")
async def update_booking_status(booking_id: str, status: str = Body(..., embed=True), staff=Depends(get_current_staff)):
    """Move booking through the lifecycle: pending → confirmed → arrived → completed → cancelled.

    Cancelled bookings cannot be re-opened directly; the only valid transition out
    of `cancelled` is staying `cancelled` (use a brand-new booking instead).
    """
    await _require_role(staff, ["manager", "admin"])
    if status not in ("pending", "confirmed", "arrived", "completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Invalid status")
    existing = await db.bookings.find_one({"id": booking_id}, {"_id": 0, "status": 1})
    if not existing:
        raise HTTPException(status_code=404, detail="Booking not found")
    if existing.get("status") == "cancelled" and status != "cancelled":
        raise HTTPException(status_code=400, detail="Cancelled bookings cannot be re-opened")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": status}})
    return {"ok": True, "status": status}


@api.patch("/staff/bookings/{booking_id}/payment")
async def update_booking_payment(
    booking_id: str,
    payment_method: str = Body(..., embed=True),
    paid: bool = Body(True, embed=True),
    staff=Depends(get_current_staff),
):
    """Mark a booking as paid / unpaid by staff (e.g. cash collected at counter).

    Only auto-confirms when the booking is still `pending` — never regresses an
    already-arrived or already-completed booking.
    """
    await _require_role(staff, ["manager", "admin"])
    existing = await db.bookings.find_one({"id": booking_id}, {"_id": 0, "status": 1})
    if not existing:
        raise HTTPException(status_code=404, detail="Booking not found")
    update: dict = {"payment_method": payment_method}
    if paid:
        update["paid_at"] = now_iso()
        if existing.get("status") == "pending":
            update["status"] = "confirmed"
    else:
        update["paid_at"] = None
    await db.bookings.update_one({"id": booking_id}, {"$set": update})
    return {"ok": True}


@api.get("/staff/payments/summary")
async def payments_summary(staff=Depends(get_current_staff)):
    """Quick KPIs for the Paiements tab: unpaid + by-method breakdown."""
    await _require_role(staff, ["manager", "admin"])
    unpaid_cursor = db.bookings.find(
        {"$or": [{"paid_at": None}, {"paid_at": {"$exists": False}}], "status": {"$ne": "cancelled"}},
        {"_id": 0, "id": 1, "offer_name": 1, "date": 1, "total_amount": 1, "phone": 1, "email": 1, "participants": 1},
    )
    unpaid = await unpaid_cursor.to_list(length=500)
    unpaid_total = sum(b.get("total_amount", 0) for b in unpaid)
    paid = await db.bookings.find(
        {"paid_at": {"$ne": None}},
        {"_id": 0, "payment_method": 1, "total_amount": 1},
    ).to_list(length=5000)
    by_method: dict = {}
    for b in paid:
        m = b.get("payment_method") or "unknown"
        by_method.setdefault(m, {"count": 0, "total": 0})
        by_method[m]["count"] += 1
        by_method[m]["total"] += b.get("total_amount", 0)
    return {
        "unpaid": unpaid,
        "unpaid_count": len(unpaid),
        "unpaid_total": unpaid_total,
        "by_method": by_method,
    }


# =================================================================
# MODULE 5 — CLIENTS (CRM)
# =================================================================

@api.get("/staff/clients")
async def list_clients(search: Optional[str] = None, staff=Depends(get_current_staff)):
    """Aggregate clients from bookings by primary email (contact)."""
    await _require_role(staff, ["manager", "admin"])
    pipeline = [
        {"$match": {"status": {"$ne": "cancelled"}, "email": {"$nin": [None, ""]}}},
        {
            "$group": {
                "_id": {"$toLower": "$email"},
                "email": {"$first": "$email"},
                "phone": {"$first": "$phone"},
                "name": {"$first": {
                    "$let": {
                        "vars": {"adults": {"$filter": {"input": "$participants", "as": "p", "cond": {"$eq": ["$$p.kind", "adult"]}}}},
                        "in": {"$ifNull": [{"$arrayElemAt": ["$$adults.name", 0]}, {"$arrayElemAt": ["$participants.name", 0]}]},
                    }
                }},
                "surname": {"$first": {
                    "$let": {
                        "vars": {"adults": {"$filter": {"input": "$participants", "as": "p", "cond": {"$eq": ["$$p.kind", "adult"]}}}},
                        "in": {"$ifNull": [{"$arrayElemAt": ["$$adults.surname", 0]}, {"$arrayElemAt": ["$participants.surname", 0]}]},
                    }
                }},
                "nationality": {"$first": {
                    "$let": {
                        "vars": {"adults": {"$filter": {"input": "$participants", "as": "p", "cond": {"$eq": ["$$p.kind", "adult"]}}}},
                        "in": {"$ifNull": [{"$arrayElemAt": ["$$adults.nationality", 0]}, {"$arrayElemAt": ["$participants.nationality", 0]}]},
                    }
                }},
                "bookings_count": {"$sum": 1},
                "total_spent": {
                    "$sum": {
                        "$cond": [{"$ne": ["$paid_at", None]}, "$total_amount", 0]
                    }
                },
                "last_visit": {"$max": "$date"},
                "first_visit": {"$min": "$date"},
                "offers": {"$addToSet": "$offer_type"},
            }
        },
        {"$sort": {"last_visit": -1}},
        {"$limit": 1000},
    ]
    items = await db.bookings.aggregate(pipeline).to_list(length=1000)
    for it in items:
        it.pop("_id", None)
    if search:
        s = search.strip().lower()
        items = [
            it for it in items
            if s in (it.get("email") or "").lower()
            or s in (it.get("phone") or "").lower()
            or s in (it.get("name") or "").lower()
            or s in (it.get("surname") or "").lower()
        ]
    return {"items": items, "count": len(items)}


@api.get("/staff/clients/export.csv")
async def export_clients_csv(staff=Depends(get_current_staff)):
    """CSV export of aggregated client list."""
    await _require_role(staff, ["manager", "admin"])
    from fastapi.responses import Response
    import csv
    pipeline = [
        {"$match": {"status": {"$ne": "cancelled"}, "email": {"$nin": [None, ""]}}},
        {
            "$group": {
                "_id": {"$toLower": "$email"},
                "email": {"$first": "$email"},
                "phone": {"$first": "$phone"},
                "name": {"$first": {
                    "$let": {
                        "vars": {"adults": {"$filter": {"input": "$participants", "as": "p", "cond": {"$eq": ["$$p.kind", "adult"]}}}},
                        "in": {"$ifNull": [{"$arrayElemAt": ["$$adults.name", 0]}, {"$arrayElemAt": ["$participants.name", 0]}]},
                    }
                }},
                "surname": {"$first": {
                    "$let": {
                        "vars": {"adults": {"$filter": {"input": "$participants", "as": "p", "cond": {"$eq": ["$$p.kind", "adult"]}}}},
                        "in": {"$ifNull": [{"$arrayElemAt": ["$$adults.surname", 0]}, {"$arrayElemAt": ["$participants.surname", 0]}]},
                    }
                }},
                "nationality": {"$first": {
                    "$let": {
                        "vars": {"adults": {"$filter": {"input": "$participants", "as": "p", "cond": {"$eq": ["$$p.kind", "adult"]}}}},
                        "in": {"$ifNull": [{"$arrayElemAt": ["$$adults.nationality", 0]}, {"$arrayElemAt": ["$participants.nationality", 0]}]},
                    }
                }},
                "bookings_count": {"$sum": 1},
                "total_spent": {"$sum": {"$cond": [{"$ne": ["$paid_at", None]}, "$total_amount", 0]}},
                "last_visit": {"$max": "$date"},
                "first_visit": {"$min": "$date"},
            }
        },
        {"$sort": {"last_visit": -1}},
    ]
    items = await db.bookings.aggregate(pipeline).to_list(length=10000)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Nom", "Prénom", "Email", "Téléphone", "Nationalité", "Réservations", "Total dépensé (FCFA)", "Première visite", "Dernière visite"])
    for it in items:
        writer.writerow([
            it.get("surname") or "",
            it.get("name") or "",
            it.get("email") or "",
            it.get("phone") or "",
            it.get("nationality") or "",
            it.get("bookings_count", 0),
            it.get("total_spent", 0),
            it.get("first_visit") or "",
            it.get("last_visit") or "",
        ])
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="bbr-clients.csv"'},
    )


@api.get("/staff/clients/report.pdf")
async def export_clients_pdf(search: Optional[str] = None, staff=Depends(get_current_staff)):
    """Stylized PDF export of the aggregated clients list."""
    await _require_role(staff, ["manager", "admin"])
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from fastapi.responses import StreamingResponse

    pipeline = [
        {"$match": {"status": {"$ne": "cancelled"}, "email": {"$nin": [None, ""]}}},
        {
            "$group": {
                "_id": {"$toLower": "$email"},
                "email": {"$first": "$email"},
                "phone": {"$first": "$phone"},
                "name": {"$first": {
                    "$let": {
                        "vars": {"adults": {"$filter": {"input": "$participants", "as": "p", "cond": {"$eq": ["$$p.kind", "adult"]}}}},
                        "in": {"$ifNull": [{"$arrayElemAt": ["$$adults.name", 0]}, {"$arrayElemAt": ["$participants.name", 0]}]},
                    }
                }},
                "surname": {"$first": {
                    "$let": {
                        "vars": {"adults": {"$filter": {"input": "$participants", "as": "p", "cond": {"$eq": ["$$p.kind", "adult"]}}}},
                        "in": {"$ifNull": [{"$arrayElemAt": ["$$adults.surname", 0]}, {"$arrayElemAt": ["$participants.surname", 0]}]},
                    }
                }},
                "nationality": {"$first": {
                    "$let": {
                        "vars": {"adults": {"$filter": {"input": "$participants", "as": "p", "cond": {"$eq": ["$$p.kind", "adult"]}}}},
                        "in": {"$ifNull": [{"$arrayElemAt": ["$$adults.nationality", 0]}, {"$arrayElemAt": ["$participants.nationality", 0]}]},
                    }
                }},
                "bookings_count": {"$sum": 1},
                "total_spent": {"$sum": {"$cond": [{"$ne": ["$paid_at", None]}, "$total_amount", 0]}},
                "last_visit": {"$max": "$date"},
                "first_visit": {"$min": "$date"},
            }
        },
        {"$sort": {"total_spent": -1, "last_visit": -1}},
        {"$limit": 2000},
    ]
    items = await db.bookings.aggregate(pipeline).to_list(length=2000)
    if search:
        s = search.strip().lower()
        items = [
            it for it in items
            if s in (it.get("email") or "").lower()
            or s in (it.get("phone") or "").lower()
            or s in (it.get("name") or "").lower()
            or s in (it.get("surname") or "").lower()
        ]

    total_clients = len(items)
    total_revenue = sum(int(it.get("total_spent") or 0) for it in items)
    total_bookings = sum(int(it.get("bookings_count") or 0) for it in items)

    styles = _pdf_styles()
    GOLD, DARK, LIGHT, MUTED = styles["GOLD"], styles["DARK"], styles["LIGHT"], styles["MUTED"]
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm)
    elements = []
    elements.append(Paragraph("Boulay Beach Resort", styles["h1"]))
    sub_label = f"Base clients — {total_clients} client(s)"
    if search:
        sub_label += f" — Recherche : {search}"
    elements.append(Paragraph(sub_label, styles["sub"]))

    kpi_rows = [
        ["Clients", "Réservations cumulées", "Revenu cumulé"],
        [str(total_clients), str(total_bookings), _format_xof(total_revenue)],
    ]
    kpi_tbl = Table(kpi_rows, colWidths=[5.6 * cm, 5.6 * cm, 5.6 * cm])
    kpi_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, 0), 7),
        ("TEXTCOLOR", (0, 0), (-1, 0), MUTED),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, 1), 14),
        ("TEXTCOLOR", (0, 1), (-1, 1), DARK),
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, GOLD),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E0D5B5")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(kpi_tbl)

    elements.append(Paragraph("Liste des clients", styles["h2"]))
    if not items:
        elements.append(Paragraph("Aucun client.", styles["body"]))
    else:
        rows = [["#", "Nom", "Email", "Téléphone", "Résa", "Total dépensé", "Dernière visite"]]
        for i, it in enumerate(items, start=1):
            rows.append([
                str(i),
                f"{it.get('surname') or ''} {it.get('name') or ''}".strip() or "—",
                it.get("email") or "—",
                it.get("phone") or "—",
                str(it.get("bookings_count") or 0),
                _format_xof(it.get("total_spent") or 0),
                it.get("last_visit") or "—",
            ])
        tbl = Table(rows, colWidths=[0.8 * cm, 3.8 * cm, 4.7 * cm, 2.6 * cm, 1.2 * cm, 2.8 * cm, 2.1 * cm], repeatRows=1)
        tbl.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("TEXTCOLOR", (0, 0), (-1, 0), GOLD),
            ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
            ("FONTSIZE", (0, 1), (-1, -1), 7.5),
            ("TEXTCOLOR", (0, 1), (-1, -1), DARK),
            ("ALIGN", (4, 0), (5, -1), "RIGHT"),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, GOLD),
            ("LINEBELOW", (0, 1), (-1, -1), 0.2, colors.HexColor("#EEE")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(tbl)

    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph(
        f"Rapport généré le {datetime.now(timezone.utc).strftime('%d/%m/%Y à %H:%M UTC')} · Boulay Beach Resort, Abidjan",
        styles["small"],
    ))

    doc.build(elements, onFirstPage=_pdf_footer_factory(styles), onLaterPages=_pdf_footer_factory(styles))
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="bbr-clients.pdf"'},
    )


@api.get("/staff/clients/{email}")
async def client_detail(email: str, staff=Depends(get_current_staff)):
    """Full client history for the given email (case-insensitive)."""
    await _require_role(staff, ["manager", "admin"])
    cursor = db.bookings.find(
        {"email": {"$regex": f"^{email}$", "$options": "i"}},
        {"_id": 0, "reference_token": 0, "qr_codes.qr_code": 0, "qr_codes.qr_payload": 0, "qr_codes.ticket_image": 0},
    ).sort([("date", -1)])
    bookings = await cursor.to_list(length=500)
    if not bookings:
        raise HTTPException(status_code=404, detail="Client not found")
    primary = next((p for b in bookings for p in b.get("participants", []) if p.get("kind") == "adult"), None) or {}
    total_spent = sum(b.get("total_amount", 0) for b in bookings if b.get("paid_at"))
    return {
        "email": bookings[0].get("email"),
        "phone": bookings[0].get("phone"),
        "name": primary.get("name", ""),
        "surname": primary.get("surname", ""),
        "nationality": primary.get("nationality", ""),
        "bookings_count": len(bookings),
        "total_spent": total_spent,
        "bookings": bookings,
    }


# =================================================================
# MODULE 7 — REVENUE (CHIFFRE D'AFFAIRES)
# =================================================================

@api.get("/staff/revenue")
async def revenue_overview(
    period: str = "month",  # day | week | month | year | all
    staff=Depends(get_current_staff),
):
    """Revenue dashboard: KPIs, by offer, by payment method, daily trend, top clients."""
    await _require_role(staff, ["manager", "admin"])
    today = datetime.now(timezone.utc).date()
    if period == "day":
        date_from = today
    elif period == "week":
        date_from = today - timedelta(days=7)
    elif period == "month":
        date_from = today - timedelta(days=30)
    elif period == "year":
        date_from = today - timedelta(days=365)
    else:
        date_from = None

    q: dict = {"paid_at": {"$ne": None}}
    if date_from:
        q["date"] = {"$gte": date_from.isoformat()}

    paid = await db.bookings.find(
        q,
        {"_id": 0, "offer_type": 1, "offer_name": 1, "date": 1, "total_amount": 1, "payment_method": 1, "email": 1, "phone": 1, "participants": 1, "paid_at": 1},
    ).to_list(length=10000)

    total_revenue = sum(b.get("total_amount", 0) for b in paid)
    total_bookings = len(paid)
    avg_basket = (total_revenue / total_bookings) if total_bookings else 0

    by_offer: dict = {}
    by_method: dict = {}
    by_day: dict = {}
    by_client: dict = {}

    for b in paid:
        oid = b.get("offer_type", "unknown")
        by_offer.setdefault(oid, {"offer_id": oid, "offer_name": b.get("offer_name", oid), "count": 0, "total": 0})
        by_offer[oid]["count"] += 1
        by_offer[oid]["total"] += b.get("total_amount", 0)

        m = b.get("payment_method") or "unknown"
        by_method.setdefault(m, {"method": m, "count": 0, "total": 0})
        by_method[m]["count"] += 1
        by_method[m]["total"] += b.get("total_amount", 0)

        d = b.get("date") or ""
        if d:
            by_day.setdefault(d, 0)
            by_day[d] += b.get("total_amount", 0)

        email = (b.get("email") or "").lower()
        if email:
            participants = b.get("participants", [])
            primary = next((p for p in participants if p.get("kind") == "adult"), participants[0] if participants else {})
            by_client.setdefault(email, {
                "email": email,
                "phone": b.get("phone", ""),
                "name": primary.get("name", "") if primary else "",
                "surname": primary.get("surname", "") if primary else "",
                "count": 0,
                "total": 0,
            })
            by_client[email]["count"] += 1
            by_client[email]["total"] += b.get("total_amount", 0)

    daily_trend = [{"date": d, "amount": amt} for d, amt in sorted(by_day.items())]
    top_clients = sorted(by_client.values(), key=lambda c: c["total"], reverse=True)[:10]

    return {
        "period": period,
        "total_revenue": total_revenue,
        "total_bookings": total_bookings,
        "avg_basket": int(avg_basket),
        "by_offer": list(by_offer.values()),
        "by_method": list(by_method.values()),
        "daily_trend": daily_trend,
        "top_clients": top_clients,
    }


@api.get("/staff/revenue/report.pdf")
async def export_revenue_pdf(
    period: str = "month",  # day | week | month | year | all
    staff=Depends(get_current_staff),
):
    """Stylized PDF report of the revenue dashboard for the selected period."""
    await _require_role(staff, ["manager", "admin"])
    # Reuse the revenue aggregator to compute the same payload (no auth re-check)
    data = await revenue_overview(period=period, staff=staff)  # type: ignore

    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from fastapi.responses import StreamingResponse

    period_label = {
        "day": "Aujourd'hui",
        "week": "7 derniers jours",
        "month": "30 derniers jours",
        "year": "12 derniers mois",
        "all": "Depuis le lancement",
    }.get(period, period)

    method_label = {
        "fineo": "FINEO",
        "card": "Carte bancaire",
        "mobile_money": "Mobile Money",
        "cash": "Espèces",
        "unknown": "Inconnu",
    }

    styles = _pdf_styles()
    GOLD, DARK, LIGHT, MUTED = styles["GOLD"], styles["DARK"], styles["LIGHT"], styles["MUTED"]
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm)
    elements = []
    elements.append(Paragraph("Boulay Beach Resort", styles["h1"]))
    elements.append(Paragraph(f"Rapport de chiffre d'affaires — {period_label}", styles["sub"]))

    # KPIs
    kpi_rows = [
        ["Revenu total", "Réservations payées", "Panier moyen"],
        [_format_xof(data["total_revenue"]), str(data["total_bookings"]), _format_xof(data["avg_basket"])],
    ]
    kpi_tbl = Table(kpi_rows, colWidths=[5.6 * cm, 5.6 * cm, 5.6 * cm])
    kpi_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, 0), 7),
        ("TEXTCOLOR", (0, 0), (-1, 0), MUTED),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, 1), 14),
        ("TEXTCOLOR", (0, 1), (-1, 1), DARK),
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, GOLD),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E0D5B5")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(kpi_tbl)

    # By offer
    if data.get("by_offer"):
        elements.append(Paragraph("Répartition par offre", styles["h2"]))
        rows = [["Offre", "Réservations", "Revenu", "Part"]]
        total = data["total_revenue"] or 1
        for o in sorted(data["by_offer"], key=lambda x: x["total"], reverse=True):
            pct = (o["total"] / total * 100) if total else 0
            rows.append([o["offer_name"], str(o["count"]), _format_xof(o["total"]), f"{pct:.1f}%"])
        tbl = Table(rows, colWidths=[7 * cm, 3 * cm, 4 * cm, 2.5 * cm])
        tbl.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("TEXTCOLOR", (0, 0), (-1, 0), GOLD),
            ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
            ("FONTSIZE", (0, 1), (-1, -1), 9),
            ("TEXTCOLOR", (0, 1), (-1, -1), DARK),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, GOLD),
            ("LINEBELOW", (0, 1), (-1, -1), 0.25, colors.HexColor("#EEE")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        elements.append(tbl)

    # By payment method
    if data.get("by_method"):
        elements.append(Paragraph("Répartition par méthode de paiement", styles["h2"]))
        rows = [["Méthode", "Réservations", "Revenu", "Part"]]
        total = data["total_revenue"] or 1
        for m in sorted(data["by_method"], key=lambda x: x["total"], reverse=True):
            pct = (m["total"] / total * 100) if total else 0
            rows.append([method_label.get(m["method"], m["method"]), str(m["count"]), _format_xof(m["total"]), f"{pct:.1f}%"])
        tbl = Table(rows, colWidths=[7 * cm, 3 * cm, 4 * cm, 2.5 * cm])
        tbl.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("TEXTCOLOR", (0, 0), (-1, 0), GOLD),
            ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
            ("FONTSIZE", (0, 1), (-1, -1), 9),
            ("TEXTCOLOR", (0, 1), (-1, -1), DARK),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, GOLD),
            ("LINEBELOW", (0, 1), (-1, -1), 0.25, colors.HexColor("#EEE")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        elements.append(tbl)

    # Top clients
    if data.get("top_clients"):
        elements.append(Paragraph("Top 10 clients", styles["h2"]))
        rows = [["#", "Client", "Email", "Résa", "Total dépensé"]]
        for i, c in enumerate(data["top_clients"], start=1):
            full_name = f"{c.get('surname','')} {c.get('name','')}".strip() or "—"
            rows.append([str(i), full_name, c.get("email") or "—", str(c.get("count") or 0), _format_xof(c.get("total") or 0)])
        tbl = Table(rows, colWidths=[1 * cm, 4.5 * cm, 5.5 * cm, 1.8 * cm, 3.7 * cm], repeatRows=1)
        tbl.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("TEXTCOLOR", (0, 0), (-1, 0), GOLD),
            ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
            ("FONTSIZE", (0, 1), (-1, -1), 8.5),
            ("TEXTCOLOR", (0, 1), (-1, -1), DARK),
            ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, GOLD),
            ("LINEBELOW", (0, 1), (-1, -1), 0.25, colors.HexColor("#EEE")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        elements.append(tbl)

    # Daily trend (compact table)
    if data.get("daily_trend"):
        elements.append(Paragraph("Évolution journalière", styles["h2"]))
        rows = [["Date", "Revenu"]]
        for d in data["daily_trend"]:
            rows.append([d["date"], _format_xof(d["amount"])])
        tbl = Table(rows, colWidths=[4 * cm, 4 * cm], repeatRows=1)
        tbl.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("TEXTCOLOR", (0, 0), (-1, 0), GOLD),
            ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
            ("FONTSIZE", (0, 1), (-1, -1), 8.5),
            ("TEXTCOLOR", (0, 1), (-1, -1), DARK),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, GOLD),
            ("LINEBELOW", (0, 1), (-1, -1), 0.25, colors.HexColor("#EEE")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(tbl)

    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph(
        f"Rapport généré le {datetime.now(timezone.utc).strftime('%d/%m/%Y à %H:%M UTC')} · Boulay Beach Resort, Abidjan",
        styles["small"],
    ))

    doc.build(elements, onFirstPage=_pdf_footer_factory(styles), onLaterPages=_pdf_footer_factory(styles))
    buf.seek(0)
    filename = f"bbr-revenue-{period}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =================================================================
# MODULE 6 — LE KAAI (TABLES)
# =================================================================

class KaaiTable(BaseModel):
    number: str
    capacity: int = Field(ge=1, le=30)
    zone: Optional[str] = "Salle"
    status: Literal["active", "indisponible"] = "active"


class KaaiTableUpdate(BaseModel):
    number: Optional[str] = None
    capacity: Optional[int] = None
    zone: Optional[str] = None
    status: Optional[Literal["active", "indisponible"]] = None


async def _seed_default_kaai_tables():
    """Seed default Le Kaai tables if none exist."""
    if await db.kaai_tables.count_documents({}) == 0:
        zones = [("Terrasse", 6, 2), ("Terrasse", 6, 4), ("Salle", 8, 2), ("Salle", 8, 4), ("Salle", 4, 6), ("Bord de mer", 4, 2)]
        seeds = []
        i = 1
        for zone, count, cap in zones:
            for _ in range(count):
                seeds.append({"id": str(uuid.uuid4()), "number": f"T{i:02d}", "capacity": cap, "zone": zone, "status": "active"})
                i += 1
        await db.kaai_tables.insert_many(seeds)
        logging.info("Seeded %d Le Kaai tables", len(seeds))


@api.get("/staff/kaai/tables")
async def list_kaai_tables(staff=Depends(get_current_staff)):
    await _require_role(staff, ["manager", "admin"])
    await _seed_default_kaai_tables()
    items = await db.kaai_tables.find({}, {"_id": 0}).sort("number", 1).to_list(length=500)
    return {"items": items}


@api.post("/staff/kaai/tables")
async def create_kaai_table(body: KaaiTable, staff=Depends(get_current_staff)):
    await _require_role(staff, ["manager", "admin"])
    doc = body.model_dump()
    doc.update({"id": str(uuid.uuid4()), "created_at": now_iso()})
    await db.kaai_tables.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/staff/kaai/tables/{table_id}")
async def update_kaai_table(table_id: str, body: KaaiTableUpdate, staff=Depends(get_current_staff)):
    await _require_role(staff, ["manager", "admin"])
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update:
        return {"ok": True}
    res = await db.kaai_tables.update_one({"id": table_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Table not found")
    return {"ok": True}


@api.delete("/staff/kaai/tables/{table_id}")
async def delete_kaai_table(table_id: str, staff=Depends(get_current_staff)):
    await _require_role(staff, ["admin"])
    res = await db.kaai_tables.delete_one({"id": table_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Table not found")
    # Also clear assignments referencing this table
    await db.bookings.update_many({"table_id": table_id}, {"$unset": {"table_id": ""}})
    return {"ok": True}


@api.get("/staff/kaai/day")
async def kaai_day(date: str, staff=Depends(get_current_staff)):
    """Le Kaai bookings + table assignments for a specific day."""
    await _require_role(staff, ["manager", "admin"])
    bookings = await db.bookings.find(
        {"offer_type": "le_kaai", "date": date, "status": {"$ne": "cancelled"}},
        {"_id": 0, "id": 1, "boat_time": 1, "adults": 1, "children": 1, "phone": 1, "email": 1,
         "participants": 1, "status": 1, "special_requests": 1, "table_id": 1, "paid_at": 1, "created_at": 1},
    ).sort("boat_time", 1).to_list(length=500)
    tables = await db.kaai_tables.find({}, {"_id": 0}).sort("number", 1).to_list(length=500)
    return {"date": date, "bookings": bookings, "tables": tables}


@api.patch("/staff/kaai/bookings/{booking_id}/table")
async def assign_kaai_table(
    booking_id: str,
    table_id: Optional[str] = Body(None, embed=True),
    staff=Depends(get_current_staff),
):
    """Assign or unassign a table to a Le Kaai booking."""
    await _require_role(staff, ["manager", "admin"])
    booking = await db.bookings.find_one({"id": booking_id, "offer_type": "le_kaai"}, {"_id": 0, "offer_type": 1})
    if not booking:
        raise HTTPException(status_code=404, detail="Le Kaai booking not found")
    if table_id:
        table = await db.kaai_tables.find_one({"id": table_id}, {"_id": 0})
        if not table:
            raise HTTPException(status_code=404, detail="Table not found")
        await db.bookings.update_one({"id": booking_id}, {"$set": {"table_id": table_id}})
    else:
        await db.bookings.update_one({"id": booking_id}, {"$unset": {"table_id": ""}})
    return {"ok": True}


# =================================================================
# MODULE HÉBERGEMENT — STAFF CALENDAR & DAILY ARRIVALS/DEPARTURES
# =================================================================

@api.get("/staff/hebergement/today")
async def hebergement_today(date: Optional[str] = None, staff=Depends(get_current_staff)):
    """Arrivals (check-in) and departures (check-out) for a given day. Defaults to today."""
    await _require_role(staff, ["manager", "admin", "receptionist"])
    target = date or datetime.now(timezone.utc).date().isoformat()
    arrivals = await db.bookings.find(
        {"offer_type": "hebergement", "date": target, "status": {"$ne": "cancelled"}},
        {"_id": 0, "id": 1, "boat_time": 1, "room_tier_name": 1, "rooms": 1, "adults": 1,
         "children": 1, "phone": 1, "email": 1, "participants": 1, "status": 1, "paid_at": 1,
         "nights": 1, "checkout_date": 1, "special_requests": 1},
    ).sort("boat_time", 1).to_list(length=500)
    departures = await db.bookings.find(
        {"offer_type": "hebergement", "checkout_date": target, "status": {"$ne": "cancelled"}},
        {"_id": 0, "id": 1, "return_boat_time": 1, "room_tier_name": 1, "rooms": 1, "adults": 1,
         "children": 1, "phone": 1, "email": 1, "participants": 1, "status": 1, "date": 1,
         "nights": 1, "special_requests": 1},
    ).sort("return_boat_time", 1).to_list(length=500)
    return {"date": target, "arrivals": arrivals, "departures": departures}


@api.get("/staff/hebergement/calendar")
async def hebergement_calendar(month: str, staff=Depends(get_current_staff)):
    """Monthly room occupancy: for each day, how many rooms are occupied per tier."""
    await _require_role(staff, ["manager", "admin"])
    if not month or len(month) != 7:
        raise HTTPException(status_code=400, detail="month must be YYYY-MM")
    date_from = datetime.strptime(f"{month}-01", "%Y-%m-%d").date()
    next_month = (date_from + timedelta(days=32)).replace(day=1)
    # Find any booking that overlaps this month
    cursor = db.bookings.find(
        {
            "offer_type": "hebergement",
            "status": {"$ne": "cancelled"},
            "date": {"$lt": next_month.isoformat()},
            "checkout_date": {"$gt": date_from.isoformat()},
        },
        {"_id": 0, "id": 1, "date": 1, "checkout_date": 1, "rooms": 1, "room_tier": 1, "room_tier_name": 1,
         "adults": 1, "children": 1, "email": 1, "phone": 1, "participants": 1},
    )
    items = await cursor.to_list(length=2000)
    # Expand per-night occupancy
    occupancy: dict = {}  # date -> {tier_id: {name, rooms}}
    bookings_by_day: dict = {}  # date -> [booking]
    cur = date_from
    while cur < next_month:
        d = cur.isoformat()
        occupancy[d] = {}
        bookings_by_day[d] = []
        cur += timedelta(days=1)
    for b in items:
        arr = datetime.strptime(b["date"], "%Y-%m-%d").date()
        chk = datetime.strptime(b["checkout_date"], "%Y-%m-%d").date()
        night = arr
        while night < chk:
            key = night.isoformat()
            if key in occupancy:
                tier = b.get("room_tier") or "unknown"
                occupancy[key].setdefault(tier, {"tier_id": tier, "tier_name": b.get("room_tier_name") or tier, "rooms": 0})
                occupancy[key][tier]["rooms"] += int(b.get("rooms", 1))
                bookings_by_day[key].append({"id": b["id"], "rooms": b.get("rooms", 1), "tier": tier, "tier_name": b.get("room_tier_name"), "guests": int(b.get("adults", 0)) + int(b.get("children", 0))})
            night += timedelta(days=1)
    # Format as list per day
    # Build inventory lookup for hebergement tiers (after potential admin overrides)
    heb_offer = OFFERS.get("hebergement", {})
    tier_inventory = {t["id"]: int(t.get("inventory", 0)) for t in heb_offer.get("room_tiers", [])}
    total_inventory = sum(tier_inventory.values())
    days = []
    for d in sorted(occupancy.keys()):
        by_tier_list = []
        any_over = False
        for v in occupancy[d].values():
            cap = tier_inventory.get(v["tier_id"], 0)
            over = cap > 0 and v["rooms"] > cap
            if over:
                any_over = True
            by_tier_list.append({**v, "inventory": cap, "is_overbooked": over})
        total_rooms = sum(v["rooms"] for v in occupancy[d].values())
        days.append({
            "date": d,
            "total_rooms": total_rooms,
            "total_inventory": total_inventory,
            "is_overbooked": any_over,
            "by_tier": by_tier_list,
            "bookings": bookings_by_day[d],
        })
    return {"month": month, "days": days, "tier_inventory": tier_inventory, "total_inventory": total_inventory}


# =================================================================
# MODULE LOISIRS — Event privatization requests
# =================================================================

@api.get("/staff/loisirs/events")
async def list_event_requests(status: Optional[str] = None, staff=Depends(get_current_staff)):
    """List event/privatization requests."""
    await _require_role(staff, ["manager", "admin"])
    q: dict = {}
    if status:
        q["status"] = status
    items = await db.event_requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(length=500)
    return {"items": items, "count": len(items)}


@api.patch("/staff/loisirs/events/{event_id}")
async def update_event_request(
    event_id: str,
    status: Optional[str] = Body(None, embed=True),
    notes: Optional[str] = Body(None, embed=True),
    staff=Depends(get_current_staff),
):
    """Update an event request status / notes."""
    await _require_role(staff, ["manager", "admin"])
    if status and status not in ("new", "contacted", "confirmed", "declined", "completed"):
        raise HTTPException(status_code=400, detail="Invalid status")
    update: dict = {}
    if status:
        update["status"] = status
    if notes is not None:
        update["notes"] = notes
    if not update:
        return {"ok": True}
    res = await db.event_requests.update_one({"id": event_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event request not found")
    return {"ok": True}


# =================================================================
# CONFIG ADMIN — Staff user management & offer price overrides
# =================================================================

class StaffUserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=8)
    role: Literal["receptionist", "manager", "admin"]


class StaffUserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=8)
    role: Optional[Literal["receptionist", "manager", "admin"]] = None


@api.get("/staff/config/users")
async def list_staff_users(staff=Depends(get_current_staff)):
    await _require_role(staff, ["admin"])
    items = await db.staff.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", 1).to_list(length=200)
    return {"items": items}


@api.post("/staff/config/users")
async def create_staff_user(body: StaffUserCreate, staff=Depends(get_current_staff)):
    await _require_role(staff, ["admin"])
    existing = await db.staff.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "email": body.email.lower(),
        "role": body.role,
        "password_hash": hash_password(body.password),
        "created_at": now_iso(),
    }
    await db.staff.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


@api.patch("/staff/config/users/{user_id}")
async def update_staff_user(user_id: str, body: StaffUserUpdate, staff=Depends(get_current_staff)):
    await _require_role(staff, ["admin"])
    target = await db.staff.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    update: dict = {}
    if body.name is not None:
        update["name"] = body.name.strip()
    if body.email is not None:
        update["email"] = body.email.lower()
    if body.role is not None:
        update["role"] = body.role
    if body.password is not None:
        update["password_hash"] = hash_password(body.password)
    if not update:
        return {"ok": True}
    await db.staff.update_one({"id": user_id}, {"$set": update})
    return {"ok": True}


@api.delete("/staff/config/users/{user_id}")
async def delete_staff_user(user_id: str, staff=Depends(get_current_staff)):
    await _require_role(staff, ["admin"])
    if user_id == staff.get("id"):
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    res = await db.staff.delete_one({"id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}


class OfferPriceOverride(BaseModel):
    price_adult: Optional[int] = Field(default=None, ge=0)
    price_child: Optional[int] = Field(default=None, ge=0)
    max_capacity: Optional[int] = Field(default=None, ge=1)
    room_tiers: Optional[List[dict]] = None  # [{id, name_fr, name_en, price}]


async def _apply_overrides(offer: dict) -> dict:
    """Merge any stored overrides on top of the static OFFERS dict."""
    override = await db.offer_overrides.find_one({"offer_id": offer["id"]}, {"_id": 0})
    if not override:
        return offer
    merged = dict(offer)
    for k in ("price_adult", "price_child", "max_capacity"):
        if override.get(k) is not None:
            merged[k] = override[k]
    if override.get("room_tiers"):
        merged["room_tiers"] = override["room_tiers"]
    return merged


@api.get("/staff/config/offers")
async def list_config_offers(staff=Depends(get_current_staff)):
    """All offers with overrides applied — used by admin config screen."""
    await _require_role(staff, ["admin"])
    result = []
    for o in OFFERS.values():
        merged = await _apply_overrides(o)
        result.append(_with_boat_times(merged))
    return {"items": result}


@api.patch("/staff/config/offers/{offer_id}")
async def update_offer_override(offer_id: str, body: OfferPriceOverride, staff=Depends(get_current_staff)):
    await _require_role(staff, ["admin"])
    if offer_id not in OFFERS:
        raise HTTPException(status_code=404, detail="Offer not found")
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    if not payload:
        return {"ok": True}
    payload["offer_id"] = offer_id
    payload["updated_at"] = now_iso()
    await db.offer_overrides.update_one(
        {"offer_id": offer_id},
        {"$set": payload},
        upsert=True,
    )
    # Mutate in-memory OFFERS dict so public site reflects immediately
    for k in ("price_adult", "price_child", "max_capacity"):
        if payload.get(k) is not None:
            OFFERS[offer_id][k] = payload[k]
    if payload.get("room_tiers"):
        OFFERS[offer_id]["room_tiers"] = payload["room_tiers"]
    return {"ok": True}


# =================================================================
# MODULE STATS AVANCÉES — Year-over-year, funnel, lead time, nationalités, occupation
# =================================================================

@api.get("/staff/stats/advanced")
async def stats_advanced(year: Optional[int] = None, staff=Depends(get_current_staff)):
    """Advanced statistics for the back-office: YoY comparison, booking funnel,
    average lead time, top nationalities, average party size, weekday/hour distribution,
    Hébergement occupancy rate."""
    await _require_role(staff, ["manager", "admin"])
    today = datetime.now(timezone.utc).date()
    target_year = year or today.year
    prev_year = target_year - 1
    year_from = f"{target_year}-01-01"
    year_to = f"{target_year + 1}-01-01"
    prev_from = f"{prev_year}-01-01"
    prev_to = f"{target_year}-01-01"

    cur = await db.bookings.find(
        {"date": {"$gte": year_from, "$lt": year_to}},
        {"_id": 0, "offer_type": 1, "offer_name": 1, "date": 1, "checkout_date": 1, "boat_time": 1,
         "adults": 1, "children": 1, "total_amount": 1, "status": 1, "paid_at": 1, "created_at": 1,
         "rooms": 1, "room_tier": 1, "participants": 1},
    ).to_list(length=20000)
    prev = await db.bookings.find(
        {"date": {"$gte": prev_from, "$lt": prev_to}},
        {"_id": 0, "offer_type": 1, "date": 1, "total_amount": 1, "status": 1, "paid_at": 1},
    ).to_list(length=20000)

    def _agg_yoy(items):
        """Aggregate revenue + bookings counts by month from a list of bookings (paid only)."""
        by_month = {f"{i:02d}": 0 for i in range(1, 13)}
        count_by_month = {f"{i:02d}": 0 for i in range(1, 13)}
        for b in items:
            if not b.get("paid_at"):
                continue
            d = b.get("date") or ""
            if len(d) < 7:
                continue
            mo = d[5:7]
            by_month[mo] = by_month.get(mo, 0) + b.get("total_amount", 0)
            count_by_month[mo] = count_by_month.get(mo, 0) + 1
        return by_month, count_by_month

    cur_rev, cur_count = _agg_yoy(cur)
    prev_rev, _ = _agg_yoy(prev)
    months_label = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"]
    yoy = [
        {
            "month": months_label[i - 1],
            "current": cur_rev[f"{i:02d}"],
            "previous": prev_rev[f"{i:02d}"],
            "delta_pct": round(((cur_rev[f"{i:02d}"] - prev_rev[f"{i:02d}"]) / prev_rev[f"{i:02d}"] * 100), 1)
            if prev_rev[f"{i:02d}"] > 0 else None,
        }
        for i in range(1, 13)
    ]

    # Booking funnel
    funnel: dict = {"pending": 0, "confirmed": 0, "arrived": 0, "completed": 0, "cancelled": 0}
    for b in cur:
        st = b.get("status", "pending")
        if st in funnel:
            funnel[st] += 1

    # Lead time (days between created_at and date) — paid bookings only
    lead_times = []
    for b in cur:
        if not b.get("paid_at"):
            continue
        try:
            created = datetime.fromisoformat((b.get("created_at") or "").replace("Z", "+00:00")).date()
            target = datetime.strptime(b.get("date") or "", "%Y-%m-%d").date()
            delta = (target - created).days
            if 0 <= delta <= 365:
                lead_times.append(delta)
        except Exception:
            continue
    avg_lead_time = round(sum(lead_times) / len(lead_times), 1) if lead_times else 0

    # Top nationalities (from participants)
    nat_counts: dict = {}
    for b in cur:
        if b.get("status") == "cancelled":
            continue
        for p in b.get("participants", []):
            n = (p.get("nationality") or "").strip()
            if n:
                nat_counts[n] = nat_counts.get(n, 0) + 1
    top_nationalities = sorted(
        [{"nationality": k, "count": v} for k, v in nat_counts.items()],
        key=lambda x: x["count"], reverse=True,
    )[:10]

    # Average party size per offer
    party_by_offer: dict = {}
    for b in cur:
        if b.get("status") == "cancelled":
            continue
        oid = b.get("offer_type", "unknown")
        party_by_offer.setdefault(oid, {"offer_id": oid, "offer_name": b.get("offer_name", oid), "total_guests": 0, "bookings": 0})
        party_by_offer[oid]["total_guests"] += int(b.get("adults", 0)) + int(b.get("children", 0))
        party_by_offer[oid]["bookings"] += 1
    party_size = [
        {"offer_id": k, "offer_name": v["offer_name"], "avg_party_size": round(v["total_guests"] / v["bookings"], 1) if v["bookings"] else 0, "bookings": v["bookings"]}
        for k, v in party_by_offer.items()
    ]

    # Weekday distribution (paid bookings, all offers combined)
    weekday_names = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
    by_weekday = {i: 0 for i in range(7)}
    for b in cur:
        if not b.get("paid_at"):
            continue
        try:
            wd = datetime.strptime(b.get("date") or "", "%Y-%m-%d").weekday()
            by_weekday[wd] += 1
        except Exception:
            continue
    weekday_dist = [{"day": weekday_names[i], "count": by_weekday[i]} for i in range(7)]

    # Hébergement occupancy rate (YTD)
    heb_offer = OFFERS.get("hebergement", {})
    total_inventory = sum(int(t.get("inventory", 0)) for t in heb_offer.get("room_tiers", []))
    nights_sold = 0
    for b in cur:
        if b.get("offer_type") != "hebergement" or b.get("status") == "cancelled":
            continue
        try:
            a = datetime.strptime(b.get("date") or "", "%Y-%m-%d").date()
            c = datetime.strptime(b.get("checkout_date") or "", "%Y-%m-%d").date()
            nights_sold += max(0, (c - a).days) * int(b.get("rooms", 1))
        except Exception:
            continue
    # Days elapsed in target year so far (or full year if past)
    end_of_year = datetime.strptime(f"{target_year}-12-31", "%Y-%m-%d").date()
    days_elapsed = min((today - datetime.strptime(year_from, "%Y-%m-%d").date()).days + 1, 365)
    if today > end_of_year:
        days_elapsed = 365
    elif today.year < target_year:
        days_elapsed = 0
    available_nights = total_inventory * max(days_elapsed, 1)
    occupancy_rate = round((nights_sold / available_nights * 100), 1) if available_nights > 0 else 0

    return {
        "year": target_year,
        "previous_year": prev_year,
        "yoy": yoy,
        "funnel": funnel,
        "avg_lead_time_days": avg_lead_time,
        "top_nationalities": top_nationalities,
        "party_size": party_size,
        "weekday_distribution": weekday_dist,
        "hebergement": {
            "total_inventory": total_inventory,
            "nights_sold": nights_sold,
            "available_nights": available_nights,
            "occupancy_rate_pct": occupancy_rate,
            "days_elapsed": days_elapsed,
        },
    }



@app.on_event("startup")
async def apply_offer_overrides_on_boot():
    try:
        async for ov in db.offer_overrides.find({}, {"_id": 0}):
            oid = ov.get("offer_id")
            if oid in OFFERS:
                for k in ("price_adult", "price_child", "max_capacity"):
                    if ov.get(k) is not None:
                        OFFERS[oid][k] = ov[k]
                if ov.get("room_tiers"):
                    OFFERS[oid]["room_tiers"] = ov["room_tiers"]
        logging.info("Offer overrides applied on boot")
    except Exception as e:
        logging.warning("Offer override boot failed: %s", e)



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
