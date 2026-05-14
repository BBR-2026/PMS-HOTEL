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
    "spa_wellness": {
        "id": "spa_wellness",
        "name_fr": "Spa & Wellness",
        "name_en": "Spa & Wellness",
        "schedule_fr": "Tous les jours · Soins 10h — 18h",
        "schedule_en": "Every day · Treatments 10am — 6pm",
        "tagline_fr": "Soins signature et rituels bien-être au bord de la lagune.",
        "tagline_en": "Signature treatments and wellness rituals by the lagoon.",
        "price_adult": 80000,
        "price_child": 0,
        "max_capacity": 12,
    },
    "seminaire": {
        "id": "seminaire",
        "name_fr": "Séminaire",
        "name_en": "Corporate Seminar",
        "schedule_fr": "Du lundi au vendredi · Journée pro",
        "schedule_en": "Monday to Friday · Business day",
        "tagline_fr": "Salles équipées, vue océan et pauses gastronomiques pour vos séminaires.",
        "tagline_en": "Equipped rooms, ocean view and gourmet breaks for your seminars.",
        "price_adult": 150000,
        "price_child": 0,
        "max_capacity": 80,
    },
    "team_building": {
        "id": "team_building",
        "name_fr": "Team Building",
        "name_en": "Team Building",
        "schedule_fr": "Du lundi au vendredi · Journée immersive",
        "schedule_en": "Monday to Friday · Immersive day",
        "tagline_fr": "Activités lagunaires, défis et expériences pour fédérer vos équipes.",
        "tagline_en": "Lagoon activities, challenges and experiences to unite your teams.",
        "price_adult": 100000,
        "price_child": 0,
        "max_capacity": 80,
    },
    "offres_loisirs": {
        "id": "offres_loisirs",
        "name_fr": "Offres Loisirs",
        "name_en": "Leisure Packs",
        "schedule_fr": "Tous les jours · Forfait découverte",
        "schedule_en": "Every day · Discovery pack",
        "tagline_fr": "Jet ski, paddle, kayak et plus — une journée d'activités lagunaires.",
        "tagline_en": "Jet ski, paddle, kayak and more — a day of lagoon activities.",
        "price_adult": 30000,
        "price_child": 15000,
        "max_capacity": 80,
    },
}

# Pôles d'entrée — taxonomie publique
POLES = {
    "beach_club": {
        "id": "beach_club",
        "name_fr": "Beach Club",
        "name_en": "Beach Club",
        "tagline_fr": "Le club de plage signature, du lundi au dimanche.",
        "tagline_en": "The signature beach club, Monday to Sunday.",
        "offers": ["pass_day", "sunset", "brunch"],
        "sort_order": 1,
    },
    "hebergement": {
        "id": "hebergement",
        "name_fr": "Hébergement",
        "name_en": "Accommodation",
        "tagline_fr": "Suites signature et soins bien-être au cœur de la lagune.",
        "tagline_en": "Signature suites and wellness treatments at the heart of the lagoon.",
        "offers": ["hebergement", "spa_wellness"],
        "sort_order": 2,
    },
    "corporate": {
        "id": "corporate",
        "name_fr": "Corporate",
        "name_en": "Corporate",
        "tagline_fr": "Séminaires et team buildings haut de gamme, en bord d'océan.",
        "tagline_en": "Premium seminars and team buildings, by the ocean.",
        "offers": ["seminaire", "team_building"],
        "sort_order": 3,
    },
    "activites_events": {
        "id": "activites_events",
        "name_fr": "Activités & Événements",
        "name_en": "Activities & Events",
        "tagline_fr": "Loisirs lagunaires et événements maison signés Boulay.",
        "tagline_en": "Lagoon leisure and signature in-house events by Boulay.",
        "offers": ["offres_loisirs", "events_maison"],  # 'events_maison' = special_events
        "sort_order": 4,
    },
    "le_kaai": {
        "id": "le_kaai",
        "name_fr": "Le Kaai",
        "name_en": "Le Kaai",
        "tagline_fr": "Le restaurant signature — gastronomie entre lagune et océan.",
        "tagline_en": "The signature restaurant — gastronomy between lagoon and ocean.",
        "offers": ["le_kaai"],
        "sort_order": 5,
    },
}

OFFER_TO_POLE = {offer_id: pid for pid, p in POLES.items() for offer_id in p["offers"]}
# Special events live under 'activites_events' as the 'events_maison' sub-offer
OFFER_TO_POLE["special_event"] = "activites_events"


def _pole_for_offer(offer_id: str) -> str:
    return OFFER_TO_POLE.get(offer_id, "")


OfferType = Literal[
    "pass_day", "sunset", "brunch", "le_kaai", "hebergement", "special_event",
    "spa_wellness", "seminaire", "team_building", "offres_loisirs",
]
BookingStatus = Literal["pending", "confirmed", "arrived", "completed", "cancelled"]

# Weekday boat times (every 2 hours) and weekend boat times (hourly)
BOAT_TIMES_WEEKDAY = ["10H", "12H", "14H", "16H", "18H", "20H"]
BOAT_TIMES_WEEKEND = [f"{h}H" for h in range(10, 21)]

# Boat departure times available per offer
BOAT_TIMES_BY_OFFER = {
    "pass_day": BOAT_TIMES_WEEKDAY,
    "sunset": BOAT_TIMES_WEEKEND,
    "brunch": BOAT_TIMES_WEEKEND,
    "spa_wellness": ["10H", "12H", "14H", "16H", "18H"],
    "seminaire": ["8H", "9H", "10H"],
    "team_building": ["8H", "9H", "10H"],
    "offres_loisirs": ["10H", "12H", "14H", "16H"],
    # le_kaai + hebergement are day-dependent — resolved via _boat_times_for_date()
}

# Python weekday(): Monday=0, Sunday=6
ALLOWED_WEEKDAYS_BY_OFFER = {
    "pass_day": [0, 1, 2, 3, 4],     # Monday to Friday
    "sunset": [5],                     # Saturday only
    "brunch": [6],                     # Sunday only
    "le_kaai": [0, 1, 2, 3, 4, 5, 6],  # Every day
    "hebergement": [0, 1, 2, 3, 4, 5, 6],  # Every day
    "spa_wellness": [0, 1, 2, 3, 4, 5, 6],  # Every day
    "seminaire": [0, 1, 2, 3, 4],          # Mon-Fri
    "team_building": [0, 1, 2, 3, 4],      # Mon-Fri
    "offres_loisirs": [0, 1, 2, 3, 4, 5, 6],  # Every day
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
    # Required when offer_type == "special_event". Identifies which event the booking targets.
    special_event_id: Optional[str] = None


class PayBooking(BaseModel):
    reference_token: str
    payment_method: Optional[Literal["fineo", "card", "mobile_money", "cash", "deposit"]] = "fineo"
    # When payment_method = "deposit" (Hébergement only): % of total paid as deposit.
    deposit_pct: Optional[Literal[10, 30, 70]] = None


class EventPrivatization(BaseModel):
    name: str
    surname: str
    phone: str
    email: EmailStr
    event_type: str
    event_date: str
    guest_count: int
    message: Optional[str] = ""


class SpecialEventCreate(BaseModel):
    """Bookable themed event (e.g. NYE, Valentine's, Easter Brunch).
    Only one event can be `is_featured=True` at a time — see /staff/special-events/{id}/feature.
    """
    title: str = Field(min_length=1, max_length=120)
    subtitle: Optional[str] = ""
    description: Optional[str] = ""
    image_url: Optional[str] = ""  # http URL or "data:image/...;base64,..."
    event_dates: List[str] = Field(default_factory=list)  # YYYY-MM-DD
    boat_times: List[str] = Field(default_factory=list)
    return_boat_times: List[str] = Field(default_factory=list)
    price_adult: int = Field(default=0, ge=0)
    price_child: int = Field(default=0, ge=0)
    capacity: int = Field(default=100, ge=1, le=2000)
    active_from: Optional[str] = None  # YYYY-MM-DD (visibility window start)
    active_to: Optional[str] = None  # YYYY-MM-DD
    cta_label: Optional[str] = "Réserver ma place"
    status: Literal["draft", "published", "archived"] = "draft"


class SpecialEventUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    event_dates: Optional[List[str]] = None
    boat_times: Optional[List[str]] = None
    return_boat_times: Optional[List[str]] = None
    price_adult: Optional[int] = Field(default=None, ge=0)
    price_child: Optional[int] = Field(default=None, ge=0)
    capacity: Optional[int] = Field(default=None, ge=1, le=2000)
    active_from: Optional[str] = None
    active_to: Optional[str] = None
    cta_label: Optional[str] = None
    status: Optional[Literal["draft", "published", "archived"]] = None


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


def _paste_logo(canvas, top: int, max_h: int = 110, max_w_ratio: float = 1.0):
    """Paste the BBr logo centred horizontally on ``canvas`` at vertical ``top``,
    sized so its height does not exceed ``max_h`` and width does not exceed
    ``max_w_ratio * canvas.width``. Returns the actual rendered height."""
    logo = _fetch_logo()
    if logo is None:
        return 0
    w0, h0 = logo.size
    new_h = max_h
    new_w = int(w0 * (new_h / h0))
    max_w = int(canvas.width * max_w_ratio)
    if new_w > max_w:
        new_w = max_w
        new_h = int(h0 * (new_w / w0))
    logo = logo.resize((new_w, new_h))
    canvas.paste(logo, ((canvas.width - new_w) // 2, top), logo)
    return new_h

_HERO_CACHE: dict = {}


def _fetch_hero(offer_id: str, hero_url: Optional[str] = None):
    """Fetch + cache the hero image. If ``hero_url`` is provided, it overrides
    the static OFFER_HERO_URLS lookup (used for special-event tickets with a
    staff-uploaded image). Accepts http(s) URLs and base64 ``data:`` URIs.
    """
    url = hero_url or OFFER_HERO_URLS.get(offer_id)
    if not url:
        return None
    if url in _HERO_CACHE:
        return _HERO_CACHE[url].copy()
    try:
        if url.startswith("data:"):
            # Inline base64-encoded image — supports "data:image/...;base64,xxxx"
            try:
                head, b64 = url.split(",", 1)
            except ValueError:
                return None
            data = base64.b64decode(b64)
        else:
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
    hero_url: Optional[str] = None,
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
    hero = _fetch_hero(offer_id, hero_url=hero_url)
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
    hero_url: Optional[str] = None,
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
    hero = _fetch_hero(offer_id, hero_url=hero_url)
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


# ---------- Activities catalog (jet ski, quad, ...) ----------
DEFAULT_ACTIVITIES = [
    # Activités & Loisirs — Sport & Terrains
    {"id": "multisport", "name_fr": "Terrain multisport (1h)", "name_en": "Multisport Field (1h)", "category": "Activités & Loisirs", "subcategory": "Sport & Terrains", "price": 50000, "active": True},
    {"id": "padel", "name_fr": "Terrain de padel (1h)", "name_en": "Padel Court (1h)", "category": "Activités & Loisirs", "subcategory": "Sport & Terrains", "price": 20000, "active": True},
    {"id": "beach_volley", "name_fr": "Beach Volley (30 min)", "name_en": "Beach Volley (30 min)", "category": "Activités & Loisirs", "subcategory": "Sport & Terrains", "price": 10000, "active": True},
    {"id": "tir_arc", "name_fr": "Tir à l'arc (30 min)", "name_en": "Archery (30 min)", "category": "Activités & Loisirs", "subcategory": "Sport & Terrains", "price": 10000, "active": True},
    # Activités & Loisirs — Activités Nautiques
    {"id": "jetski", "name_fr": "Jet Ski (10 min)", "name_en": "Jet Ski (10 min)", "category": "Activités & Loisirs", "subcategory": "Activités Nautiques", "price": 15000, "active": True},
    {"id": "pedalo", "name_fr": "Pédalo (20 min)", "name_en": "Pedal Boat (20 min)", "category": "Activités & Loisirs", "subcategory": "Activités Nautiques", "price": 5000, "active": True},
    {"id": "kayak", "name_fr": "Canoë-Kayak (20 min)", "name_en": "Canoe-Kayak (20 min)", "category": "Activités & Loisirs", "subcategory": "Activités Nautiques", "price": 5000, "active": True},
    {"id": "paddle", "name_fr": "Paddle (20 min)", "name_en": "Paddle (20 min)", "category": "Activités & Loisirs", "subcategory": "Activités Nautiques", "price": 5000, "active": True},
    # Activités & Loisirs — Randonnées & Mobilité
    {"id": "quad", "name_fr": "Quad (30 min)", "name_en": "Quad (30 min)", "category": "Activités & Loisirs", "subcategory": "Randonnées & Mobilité", "price": 30000, "active": True},
    {"id": "buggy", "name_fr": "Buggy (30 min)", "name_en": "Buggy (30 min)", "category": "Activités & Loisirs", "subcategory": "Randonnées & Mobilité", "price": 50000, "active": True},
    {"id": "golfette", "name_fr": "Randonnée en golfette (30 min)", "name_en": "Golf Cart Tour (30 min)", "category": "Activités & Loisirs", "subcategory": "Randonnées & Mobilité", "price": 50000, "active": True},
    {"id": "rando_pied", "name_fr": "Randonnée à pied (1h)", "name_en": "Hiking (1h)", "category": "Activités & Loisirs", "subcategory": "Randonnées & Mobilité", "price": 10000, "active": True},
    {"id": "vtt", "name_fr": "VTT (1h)", "name_en": "Mountain Bike (1h)", "category": "Activités & Loisirs", "subcategory": "Randonnées & Mobilité", "price": 5000, "active": True},
    # Activités & Loisirs — Bien-être
    {"id": "massage", "name_fr": "Massage Signature (60 min)", "name_en": "Signature Massage (60 min)", "category": "Activités & Loisirs", "subcategory": "Bien-être", "price": 45000, "active": True},
    {"id": "spa_day", "name_fr": "Forfait Spa Journée", "name_en": "Spa Day Pass", "category": "Activités & Loisirs", "subcategory": "Bien-être", "price": 60000, "active": True},
    # Menus
    {"id": "menu_kaai", "name_fr": "Menu Le Kaai", "name_en": "Le Kaai Menu", "category": "Menus", "subcategory": "Kaai", "price": 35000, "active": True},
    {"id": "menu_beach_club", "name_fr": "Menu Beach Club", "name_en": "Beach Club Menu", "category": "Menus", "subcategory": "Beach Club", "price": 28000, "active": True},
    {"id": "menu_lounge", "name_fr": "Menu Lounge", "name_en": "Lounge Menu", "category": "Menus", "subcategory": "Lounge", "price": 22000, "active": True},
    # Espace privatif — Plage
    {"id": "espace_plage_balinais_6", "name_fr": "Salon balinais (6 places)", "name_en": "Balinese Lounge (6 seats)", "category": "Espace privatif", "subcategory": "Plage", "price": 50000, "active": True},
    {"id": "espace_plage_transat", "name_fr": "Transat (1 place)", "name_en": "Sun Lounger (1 seat)", "category": "Espace privatif", "subcategory": "Plage", "price": 10000, "active": True},
    # Espace privatif — Terrasse N°3
    {"id": "espace_t3_balinais_5", "name_fr": "Salon balinais (5 places)", "name_en": "Balinese Lounge (5 seats)", "category": "Espace privatif", "subcategory": "Terrasse 3", "price": 50000, "active": True},
    {"id": "espace_t3_transat", "name_fr": "Transat (1 place)", "name_en": "Sun Lounger (1 seat)", "category": "Espace privatif", "subcategory": "Terrasse 3", "price": 10000, "active": True},
    # Espace privatif — Terrasse N°2
    {"id": "espace_t2_balinais_5", "name_fr": "Salon balinais (5 places)", "name_en": "Balinese Lounge (5 seats)", "category": "Espace privatif", "subcategory": "Terrasse 2", "price": 50000, "active": True},
    {"id": "espace_t2_transat", "name_fr": "Transat (1 place)", "name_en": "Sun Lounger (1 seat)", "category": "Espace privatif", "subcategory": "Terrasse 2", "price": 10000, "active": True},
    # Espace privatif — Terrasse N°1
    {"id": "espace_t1_balinais_6", "name_fr": "Salon balinais (6 places)", "name_en": "Balinese Lounge (6 seats)", "category": "Espace privatif", "subcategory": "Terrasse 1", "price": 50000, "active": True},
    {"id": "espace_t1_transat", "name_fr": "Transat (1 place)", "name_en": "Sun Lounger (1 seat)", "category": "Espace privatif", "subcategory": "Terrasse 1", "price": 10000, "active": True},
    {"id": "espace_t1_cosy_2", "name_fr": "Salon cosy (2 places)", "name_en": "Cosy Lounge (2 seats)", "category": "Espace privatif", "subcategory": "Terrasse 1", "price": 25000, "active": True},
    {"id": "espace_t1_jacuzzi", "name_fr": "Jacuzzi piscine", "name_en": "Pool Jacuzzi", "category": "Espace privatif", "subcategory": "Terrasse 1", "price": 100000, "active": True},
    {"id": "espace_t1_salon_sec_15", "name_fr": "Salon sec (15 places)", "name_en": "Dry Lounge (15 seats)", "category": "Espace privatif", "subcategory": "Terrasse 1", "price": 150000, "active": True},
    {"id": "espace_t1_salon_sec_10", "name_fr": "Salon sec (10 places)", "name_en": "Dry Lounge (10 seats)", "category": "Espace privatif", "subcategory": "Terrasse 1", "price": 100000, "active": True},
]


async def _seed_default_activities():
    """Seed the activities collection on first run. On subsequent runs, idempotently
    add any new built-in activity that didn't exist yet (so adding new defaults
    propagates without wiping admin-customised prices)."""
    if await db.activities.count_documents({}) == 0:
        await db.activities.insert_many([dict(a) for a in DEFAULT_ACTIVITIES])
        return
    # Idempotent top-up: insert defaults whose id is missing
    existing_ids = {d["id"] async for d in db.activities.find({}, {"_id": 0, "id": 1})}
    to_add = [dict(a) for a in DEFAULT_ACTIVITIES if a["id"] not in existing_ids]
    if to_add:
        await db.activities.insert_many(to_add)
    # Backfill category/subcategory for the original defaults — keeps user-defined prices.
    for a in DEFAULT_ACTIVITIES:
        if a["id"] in existing_ids:
            await db.activities.update_one(
                {
                    "id": a["id"],
                    "$or": [
                        {"category": {"$in": ["Nautique", "Terrestre", "Bien-être", "Activité"]}},
                        {"subcategory": {"$exists": False}},
                        {"subcategory": ""},
                    ],
                },
                {"$set": {"category": a["category"], "subcategory": a["subcategory"]}},
            )
    # Retire the v1 generic Espace privatif entries now superseded by per-item zones.
    # They stay in DB (historical wallet charges keep referencing them) but disappear from the picker.
    LEGACY_PRIVATIF_IDS = ["espace_plage", "espace_terrasse_1", "espace_terrasse_2", "espace_terrasse_3"]
    await db.activities.update_many(
        {"id": {"$in": LEGACY_PRIVATIF_IDS}, "active": True},
        {"$set": {"active": False}},
    )

    # ====== Versioned catalog upgrade: v2 — refreshed Activités & Loisirs taxonomy ======
    # Force-aligns ids with their new names/prices/subcategories ONCE. Subsequent boots
    # are no-ops because the flag flips. Admin price edits made AFTER the upgrade are preserved.
    flag = await db.app_state.find_one({"key": "activities_catalog_v2"})
    if not flag:
        REFRESH_IDS = {
            "multisport", "padel", "beach_volley", "tir_arc",
            "jetski", "pedalo", "kayak", "paddle",
            "quad", "buggy", "golfette", "rando_pied", "vtt",
            "massage", "spa_day",
        }
        for a in DEFAULT_ACTIVITIES:
            if a["id"] in REFRESH_IDS:
                await db.activities.update_one(
                    {"id": a["id"]},
                    {"$set": {
                        "name_fr": a["name_fr"],
                        "name_en": a["name_en"],
                        "category": a["category"],
                        "subcategory": a["subcategory"],
                        "price": a["price"],
                        "active": True,
                    }},
                    upsert=True,
                )
        # Retire activities no longer in the v2 catalog (preserves historical charges)
        DEPRECATED_IDS = ["jetski_60", "ski_nautique", "boat_tour"]
        await db.activities.update_many(
            {"id": {"$in": DEPRECATED_IDS}, "active": True},
            {"$set": {"active": False}},
        )
        await db.app_state.insert_one({"key": "activities_catalog_v2", "applied_at": now_iso()})
        logging.info("Activities catalog v2 migration applied")


# ---------- Wallet QR card (sandstone cream styling — distinct from gold ticket) ----------
def make_wallet_image(
    owner_name: str,
    wallet_token: str,
    booking_ref: str,
    lang: str = "fr",
) -> str:
    """Build a printable wallet card image (PNG data URL) shown next to the
    travel tickets. The wallet QR is scanned at point of sale (jet ski / quad /
    massage etc.) to charge activities to the guest's stay."""
    from PIL import Image, ImageDraw, ImageFont

    W, H = 980, 1320
    CREAM = (250, 246, 232)
    GOLD = (184, 146, 42)
    DARK = (10, 10, 10)
    MUTED = (90, 80, 60)

    img = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(img)

    # Gold ornamental border
    draw.rectangle([(24, 24), (W - 24, H - 24)], outline=GOLD, width=2)
    draw.rectangle([(40, 40), (W - 40, H - 40)], outline=GOLD, width=1)

    # Logo
    logo_h = _paste_logo(img, top=64, max_h=160, max_w_ratio=0.6)

    # Fonts
    try:
        f_eyebrow = ImageFont.truetype("DejaVuSans.ttf", 22)
        f_title = ImageFont.truetype("DejaVuSerif-Bold.ttf", 50)
        f_body = ImageFont.truetype("DejaVuSans.ttf", 22)
        f_small = ImageFont.truetype("DejaVuSans.ttf", 18)
        f_ref = ImageFont.truetype("DejaVuSansMono-Bold.ttf", 22)
    except Exception:
        f_eyebrow = f_title = f_body = f_small = f_ref = ImageFont.load_default()

    y = 64 + logo_h + 30

    eyebrow_text = "CARTE ACTIVITÉS" if lang == "fr" else "ACTIVITIES CARD"
    w_eb = draw.textlength(eyebrow_text, font=f_eyebrow)
    draw.text(((W - w_eb) / 2, y), eyebrow_text, fill=GOLD, font=f_eyebrow)
    y += 36

    title_text = "Boulay Beach Resort" if lang == "fr" else "Boulay Beach Resort"
    w_t = draw.textlength(title_text, font=f_title)
    draw.text(((W - w_t) / 2, y), title_text, fill=DARK, font=f_title)
    y += 70

    # Owner line
    draw.line([(W * 0.18, y), (W * 0.82, y)], fill=GOLD, width=1)
    y += 18
    name_text = f"Au nom de · {owner_name}" if lang == "fr" else f"In the name of · {owner_name}"
    w_n = draw.textlength(name_text, font=f_body)
    draw.text(((W - w_n) / 2, y), name_text, fill=DARK, font=f_body)
    y += 36
    ref_text = f"Réservation #{booking_ref}" if lang == "fr" else f"Booking #{booking_ref}"
    w_r = draw.textlength(ref_text, font=f_small)
    draw.text(((W - w_r) / 2, y), ref_text, fill=MUTED, font=f_small)
    y += 24
    draw.line([(W * 0.18, y), (W * 0.82, y)], fill=GOLD, width=1)
    y += 30

    # QR
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr_payload = json.dumps({"type": "wallet", "token": wallet_token, "booking_ref": booking_ref})
    qr.add_data(qr_payload)
    qr.make(fit=True)
    from qrcode.image.styledpil import StyledPilImage
    from qrcode.image.styles.moduledrawers.pil import RoundedModuleDrawer
    from qrcode.image.styles.colormasks import SolidFillColorMask
    qr_img = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=RoundedModuleDrawer(),
        color_mask=SolidFillColorMask(back_color=CREAM, front_color=(120, 90, 36)),
    ).convert("RGB")
    qr_size = 460
    qr_img = qr_img.resize((qr_size, qr_size))
    qx = (W - qr_size) // 2
    img.paste(qr_img, (qx, y))
    y += qr_size + 24

    # Caption
    lines = (
        [
            "Présentez ce QR aux points d'activités du resort",
            "(Jet Ski, Quad, Paddle, Spa, Excursions…)",
            "pour ajouter une prestation à votre séjour.",
            "Le solde est réglé au moment du check-out.",
        ]
        if lang == "fr"
        else [
            "Show this QR at any resort activity point",
            "(Jet Ski, Quad, Paddle, Spa, Excursions…)",
            "to add a service to your stay.",
            "Balance is settled at check-out.",
        ]
    )
    for line in lines:
        w_l = draw.textlength(line, font=f_small)
        draw.text(((W - w_l) / 2, y), line, fill=MUTED, font=f_small)
        y += 24

    # Footer ref
    short = wallet_token[:10].upper()
    foot_text = f"WALLET · {short}"
    w_f = draw.textlength(foot_text, font=f_ref)
    draw.text(((W - w_f) / 2, H - 80), foot_text, fill=GOLD, font=f_ref)

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
    out = _with_boat_times(OFFERS[offer_id])
    out["pole"] = _pole_for_offer(offer_id)
    return out


# ----- Poles (taxonomy of public entry points) -----
@api.get("/poles")
async def list_poles():
    """Public — returns the 5 entry-point pôles with their sub-offers hydrated.
    The frontend uses this to build the landing page (5 pôle cards) and the
    per-pôle landing pages (sub-offer mini-cards)."""
    out = []
    for pid, p in sorted(POLES.items(), key=lambda kv: kv[1].get("sort_order", 99)):
        sub_offers = []
        for oid in p["offers"]:
            if oid == "events_maison":
                # Synthetic sub-offer pointing at the special_events module
                sub_offers.append({
                    "id": "events_maison",
                    "name_fr": "Events Maison",
                    "name_en": "In-house Events",
                    "schedule_fr": "Événements spéciaux signature",
                    "schedule_en": "Signature special events",
                    "tagline_fr": "Découvrez les événements spéciaux à venir.",
                    "tagline_en": "Discover the upcoming signature events.",
                    "price_adult": 0,
                    "price_child": 0,
                    "max_capacity": 0,
                    "is_synthetic": True,
                    "kind": "events_list",
                })
            elif oid in OFFERS:
                o = dict(OFFERS[oid])
                o.update(_with_boat_times(o))
                sub_offers.append(o)
        out.append({**p, "sub_offers": sub_offers})
    return out


@api.get("/poles/{pole_id}")
async def get_pole(pole_id: str):
    if pole_id not in POLES:
        raise HTTPException(status_code=404, detail="Pôle non trouvé")
    p = POLES[pole_id]
    sub_offers = []
    for oid in p["offers"]:
        if oid == "events_maison":
            # Hydrate with all published+active special events (not just the featured one)
            today = datetime.now(timezone.utc).date().isoformat()
            cursor = db.special_events.find({"status": "published"}, {"_id": 0}).sort("created_at", -1)
            evs = []
            async for ev in cursor:
                if not _event_is_currently_active(ev, today):
                    continue
                evs.append({
                    **_public_event(ev),
                    "event_dates": [d for d in (ev.get("event_dates") or []) if d >= today],
                })
            sub_offers.append({
                "id": "events_maison",
                "name_fr": "Events Maison",
                "name_en": "In-house Events",
                "schedule_fr": "Événements spéciaux signature",
                "schedule_en": "Signature special events",
                "tagline_fr": "Découvrez les événements spéciaux à venir.",
                "tagline_en": "Discover the upcoming signature events.",
                "is_synthetic": True,
                "kind": "events_list",
                "events": evs,
            })
        elif oid in OFFERS:
            o = _with_boat_times(OFFERS[oid])
            sub_offers.append(o)
    return {**p, "sub_offers": sub_offers}


@api.get("/staff/consumption/analytics")
async def staff_consumption_analytics(period: str = "30d", staff=Depends(get_current_staff)):
    """Wallet-level consumption analytics (charges added on-site via /staff/activites).
    Aggregates ACTIVE (non-voided) wallet transactions over the period.
    Returns:
      - kpis: total_charges, total_revenue, active_count, voided_count, voided_amount
      - by_category / by_subcategory : count + revenue per group
      - top_items : top 8 most billed activities
      - daily_trend : revenue per day
    """
    await _require_role(staff, ["manager", "admin"])

    days_map = {"today": 0, "7d": 7, "30d": 30, "90d": 90}
    days = days_map.get(period, 30)
    cutoff_dt = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_iso = cutoff_dt.isoformat()

    # Pull the activities catalog once for category/subcategory lookup
    cat_map = {}
    async for a in db.activities.find({}, {"_id": 0, "id": 1, "category": 1, "subcategory": 1}):
        cat_map[a["id"]] = {"category": a.get("category") or "Autre", "subcategory": a.get("subcategory") or "—"}

    # Flatten all transactions across wallets where any tx falls in the window
    pipeline = [
        {"$match": {"transactions": {"$exists": True, "$ne": []}}},
        {"$unwind": "$transactions"},
        {"$match": {"transactions.created_at": {"$gte": cutoff_iso}}},
        {"$replaceRoot": {"newRoot": "$transactions"}},
    ]
    txs = [t async for t in db.wallets.aggregate(pipeline)]

    active = [t for t in txs if t.get("status") != "voided"]
    voided = [t for t in txs if t.get("status") == "voided"]

    total_revenue = sum(int(t.get("amount", 0) or 0) for t in active)
    voided_amount = sum(int(t.get("amount", 0) or 0) for t in voided)

    by_category: dict = {}
    by_subcategory: dict = {}
    by_item: dict = {}
    daily: dict = {}

    for t in active:
        aid = t.get("activity_id") or "custom"
        meta = cat_map.get(aid, {"category": "Offres spéciales", "subcategory": "—"})
        cat = meta["category"]
        sub = meta["subcategory"]
        amount = int(t.get("amount", 0) or 0)
        qty = int(t.get("quantity", 0) or 0)
        label = t.get("label") or aid

        by_category.setdefault(cat, {"category": cat, "count": 0, "revenue": 0, "quantity": 0})
        by_category[cat]["count"] += 1
        by_category[cat]["revenue"] += amount
        by_category[cat]["quantity"] += qty

        key = f"{cat}||{sub}"
        by_subcategory.setdefault(key, {"category": cat, "subcategory": sub, "count": 0, "revenue": 0, "quantity": 0})
        by_subcategory[key]["count"] += 1
        by_subcategory[key]["revenue"] += amount
        by_subcategory[key]["quantity"] += qty

        by_item.setdefault(aid, {"activity_id": aid, "label": label, "category": cat, "subcategory": sub, "count": 0, "revenue": 0, "quantity": 0})
        by_item[aid]["count"] += 1
        by_item[aid]["revenue"] += amount
        by_item[aid]["quantity"] += qty

        date_str = (t.get("created_at") or "")[:10]
        if date_str:
            daily.setdefault(date_str, {"date": date_str, "revenue": 0, "count": 0})
            daily[date_str]["revenue"] += amount
            daily[date_str]["count"] += 1

    return {
        "period": period,
        "kpis": {
            "active_count": len(active),
            "total_revenue": total_revenue,
            "voided_count": len(voided),
            "voided_amount": voided_amount,
            "avg_charge": int(total_revenue / len(active)) if active else 0,
        },
        "by_category": sorted(by_category.values(), key=lambda x: x["revenue"], reverse=True),
        "by_subcategory": sorted(by_subcategory.values(), key=lambda x: x["revenue"], reverse=True),
        "top_items": sorted(by_item.values(), key=lambda x: x["revenue"], reverse=True)[:8],
        "daily_trend": sorted(daily.values(), key=lambda x: x["date"]),
    }


@api.get("/staff/poles/{pole_id}/overview")
async def staff_pole_overview(pole_id: str, staff=Depends(get_current_staff)):
    """Return everything needed to render the pôle-focused staff page:
    pôle metadata, sub-offer breakdown, KPIs (today / 30d), recent bookings."""
    await _require_role(staff, ["manager", "admin"])
    if pole_id not in POLES:
        raise HTTPException(status_code=404, detail="Pôle non trouvé")
    pole = POLES[pole_id]
    offer_ids = list(pole.get("offers", []))
    # 'events_maison' is the synthetic sub-offer mapped to special_event bookings
    mongo_offer_filter = []
    has_events_maison = "events_maison" in offer_ids
    static_offers = [o for o in offer_ids if o != "events_maison"]
    if static_offers:
        mongo_offer_filter.append({"offer_type": {"$in": static_offers}})
    if has_events_maison:
        mongo_offer_filter.append({"offer_type": "special_event"})
    base_or = mongo_offer_filter + [{"pole": pole_id}]

    today = datetime.now(timezone.utc).date().isoformat()
    from datetime import timedelta as _td
    cutoff_30d = (datetime.now(timezone.utc).date() - _td(days=30)).isoformat()

    # Sub-offer breakdown (last 30d)
    sub_offer_stats = {oid: {"id": oid, "count": 0, "revenue": 0, "guests": 0} for oid in offer_ids}
    cursor_30d = db.bookings.find(
        {"$or": base_or, "date": {"$gte": cutoff_30d}, "status": {"$ne": "cancelled"}},
        {"_id": 0, "offer_type": 1, "total_amount": 1, "adults": 1, "children": 1},
    )
    today_count = 0
    today_revenue = 0
    today_guests = 0
    total_30d_count = 0
    total_30d_revenue = 0
    async for b in cursor_30d:
        oid = b.get("offer_type") or ""
        bucket = "events_maison" if oid == "special_event" else oid
        if bucket in sub_offer_stats:
            sub_offer_stats[bucket]["count"] += 1
            sub_offer_stats[bucket]["revenue"] += int(b.get("total_amount", 0) or 0)
            sub_offer_stats[bucket]["guests"] += int(b.get("adults", 0)) + int(b.get("children", 0))
        total_30d_count += 1
        total_30d_revenue += int(b.get("total_amount", 0) or 0)

    cursor_today = db.bookings.find(
        {"$or": base_or, "date": today, "status": {"$ne": "cancelled"}},
        {"_id": 0, "adults": 1, "children": 1, "total_amount": 1, "status": 1},
    )
    async for b in cursor_today:
        today_count += 1
        today_guests += int(b.get("adults", 0)) + int(b.get("children", 0))
        if b.get("status") in ("confirmed", "arrived", "completed"):
            today_revenue += int(b.get("total_amount", 0) or 0)

    # Recent bookings (last 20, most recent first by created_at)
    recent_cursor = db.bookings.find(
        {"$or": base_or, "status": {"$ne": "cancelled"}},
        {
            "_id": 0, "id": 1, "offer_type": 1, "offer_name": 1, "date": 1,
            "adults": 1, "children": 1, "boat_time": 1, "total_amount": 1,
            "status": 1, "phone": 1, "participants": 1, "created_at": 1, "paid_at": 1,
        },
    ).sort("created_at", -1).limit(20)
    recent = await recent_cursor.to_list(length=20)

    # ============== ANALYTICS (30 days) ==============
    # Pull all bookings of the pôle over the last 30d, including cancelled (to compute the rate)
    all_30d = await db.bookings.find(
        {"$or": base_or, "date": {"$gte": cutoff_30d}},
        {
            "_id": 0, "id": 1, "offer_type": 1, "date": 1, "status": 1,
            "adults": 1, "children": 1, "boat_time": 1, "total_amount": 1,
            "payment_method": 1, "paid_at": 1, "created_at": 1,
            "phone": 1, "email": 1, "participants": 1,
        },
    ).to_list(length=5000)

    weekday_labels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
    daily_revenue: dict = {}
    by_status: dict = {"pending": 0, "confirmed": 0, "arrived": 0, "completed": 0, "cancelled": 0}
    by_payment_method: dict = {}
    by_weekday: dict = {lbl: {"count": 0, "revenue": 0} for lbl in weekday_labels}
    by_boat_time: dict = {}
    by_client: dict = {}
    total_adults = 0
    total_children = 0
    lead_times: list = []
    revenue_paid = 0
    bookings_paid = 0

    for b in all_30d:
        st = b.get("status") or "pending"
        if st in by_status:
            by_status[st] += 1

        if st == "cancelled":
            continue  # All other analytics exclude cancelled bookings

        date_str = b.get("date") or ""
        amount = int(b.get("total_amount", 0) or 0)
        daily_revenue.setdefault(date_str, {"date": date_str, "revenue": 0, "count": 0})
        daily_revenue[date_str]["revenue"] += amount
        daily_revenue[date_str]["count"] += 1

        if b.get("paid_at"):
            revenue_paid += amount
            bookings_paid += 1

        method = b.get("payment_method") or "unknown"
        by_payment_method.setdefault(method, {"count": 0, "total": 0})
        by_payment_method[method]["count"] += 1
        by_payment_method[method]["total"] += amount

        try:
            wd = datetime.strptime(date_str, "%Y-%m-%d").weekday()
            wl = weekday_labels[wd]
            by_weekday[wl]["count"] += 1
            by_weekday[wl]["revenue"] += amount
        except (ValueError, IndexError):
            pass

        bt = b.get("boat_time") or "—"
        by_boat_time.setdefault(bt, 0)
        by_boat_time[bt] += 1

        adults = int(b.get("adults", 0) or 0)
        children = int(b.get("children", 0) or 0)
        total_adults += adults
        total_children += children

        created = b.get("created_at")
        if created and date_str:
            try:
                # created_at is iso, date is yyyy-mm-dd
                cdt = datetime.fromisoformat(created.replace("Z", "+00:00")).date()
                bdt = datetime.strptime(date_str, "%Y-%m-%d").date()
                lead = (bdt - cdt).days
                if lead >= 0:
                    lead_times.append(lead)
            except (ValueError, AttributeError):
                pass

        # Top clients: aggregate by phone (more stable than email for this pôle)
        phone = b.get("phone") or ""
        if phone:
            primary = (b.get("participants") or [{}])[0]
            by_client.setdefault(phone, {
                "phone": phone,
                "name": f"{primary.get('surname', '')} {primary.get('name', '')}".strip() or phone,
                "email": b.get("email") or "",
                "count": 0,
                "total": 0,
            })
            by_client[phone]["count"] += 1
            by_client[phone]["total"] += amount

    daily_trend = sorted(daily_revenue.values(), key=lambda x: x["date"])
    payment_method_list = [{"method": k, **v} for k, v in by_payment_method.items()]
    weekday_list = [{"day": lbl, **by_weekday[lbl]} for lbl in weekday_labels]
    boat_time_list = sorted(
        [{"boat_time": k, "count": v} for k, v in by_boat_time.items()],
        key=lambda x: x["count"], reverse=True,
    )[:8]
    top_clients = sorted(by_client.values(), key=lambda c: c["total"], reverse=True)[:5]

    active_30d = total_30d_count  # not cancelled
    cancelled_30d = by_status.get("cancelled", 0)
    total_with_cancelled = active_30d + cancelled_30d
    cancellation_rate = round((cancelled_30d / total_with_cancelled) * 100, 1) if total_with_cancelled else 0
    avg_basket = round(total_30d_revenue / active_30d) if active_30d else 0
    avg_lead_time = round(sum(lead_times) / len(lead_times), 1) if lead_times else 0
    paid_rate = round((bookings_paid / active_30d) * 100, 1) if active_30d else 0

    analytics = {
        "daily_trend": daily_trend,
        "by_status": [{"status": k, "count": v} for k, v in by_status.items()],
        "by_payment_method": payment_method_list,
        "by_weekday": weekday_list,
        "by_boat_time": boat_time_list,
        "top_clients": top_clients,
        "avg_basket": avg_basket,
        "avg_lead_time_days": avg_lead_time,
        "cancellation_rate": cancellation_rate,
        "paid_rate": paid_rate,
        "guests_breakdown": {"adults": total_adults, "children": total_children},
        "revenue_paid_30d": revenue_paid,
    }

    # Hydrate sub_offers with metadata + stats
    sub_offers_out = []
    for oid in offer_ids:
        if oid == "events_maison":
            sub_offers_out.append({
                "id": "events_maison",
                "name_fr": "Events Maison",
                "name_en": "In-house Events",
                "is_synthetic": True,
                "stats": sub_offer_stats[oid],
            })
        elif oid in OFFERS:
            o = dict(OFFERS[oid])
            sub_offers_out.append({
                "id": oid,
                "name_fr": o.get("name_fr"),
                "name_en": o.get("name_en"),
                "schedule_fr": o.get("schedule_fr"),
                "price_adult": o.get("price_adult"),
                "price_child": o.get("price_child"),
                "max_capacity": o.get("max_capacity"),
                "stats": sub_offer_stats[oid],
            })
    # Occupancy per sub-offer: count / (capacity * 30 days), capped at 100%
    for s in sub_offers_out:
        capacity = s.get("max_capacity") or 0
        if capacity > 0:
            s["occupancy_pct"] = round(min(100, ((s["stats"]["count"] / (capacity * 30)) * 100)), 1)
        else:
            s["occupancy_pct"] = None

    # ============== WALLET / CONSOMMATION SUR PLACE (activites_events only) ==============
    wallet_stats = None
    if pole_id == "activites_events":
        # Aggregate all wallet transactions in the last 30 days (active only,
        # voided ones counted apart for transparency).
        cutoff_dt = datetime.now(timezone.utc) - timedelta(days=30)
        cutoff_iso = cutoff_dt.isoformat()

        cat_map = {}
        async for a in db.activities.find({}, {"_id": 0, "id": 1, "category": 1, "subcategory": 1}):
            cat_map[a["id"]] = {
                "category": a.get("category") or "Autre",
                "subcategory": a.get("subcategory") or "—",
            }

        pipeline = [
            {"$match": {"transactions": {"$exists": True, "$ne": []}}},
            {"$unwind": "$transactions"},
            {"$match": {"transactions.created_at": {"$gte": cutoff_iso}}},
            {"$replaceRoot": {"newRoot": "$transactions"}},
        ]
        txs = [t async for t in db.wallets.aggregate(pipeline)]
        active_txs = [t for t in txs if t.get("status") != "voided"]
        voided_txs = [t for t in txs if t.get("status") == "voided"]

        w_total_revenue = sum(int(t.get("amount", 0) or 0) for t in active_txs)
        w_voided_amount = sum(int(t.get("amount", 0) or 0) for t in voided_txs)

        w_by_category: dict = {}
        w_by_item: dict = {}
        w_daily: dict = {}
        for t in active_txs:
            aid = t.get("activity_id") or "custom"
            meta = cat_map.get(aid, {"category": "Offres spéciales", "subcategory": "—"})
            cat = meta["category"]
            amount = int(t.get("amount", 0) or 0)
            qty = int(t.get("quantity", 0) or 0)
            label = t.get("label") or aid

            w_by_category.setdefault(cat, {"category": cat, "count": 0, "revenue": 0, "quantity": 0})
            w_by_category[cat]["count"] += 1
            w_by_category[cat]["revenue"] += amount
            w_by_category[cat]["quantity"] += qty

            w_by_item.setdefault(aid, {
                "activity_id": aid, "label": label,
                "category": cat, "subcategory": meta["subcategory"],
                "count": 0, "revenue": 0, "quantity": 0,
            })
            w_by_item[aid]["count"] += 1
            w_by_item[aid]["revenue"] += amount
            w_by_item[aid]["quantity"] += qty

            date_str = (t.get("created_at") or "")[:10]
            if date_str:
                w_daily.setdefault(date_str, {"date": date_str, "revenue": 0, "count": 0})
                w_daily[date_str]["revenue"] += amount
                w_daily[date_str]["count"] += 1

        wallet_stats = {
            "kpis": {
                "active_count": len(active_txs),
                "total_revenue": w_total_revenue,
                "voided_count": len(voided_txs),
                "voided_amount": w_voided_amount,
                "avg_charge": int(w_total_revenue / len(active_txs)) if active_txs else 0,
            },
            "by_category": sorted(w_by_category.values(), key=lambda x: x["revenue"], reverse=True),
            "top_items": sorted(w_by_item.values(), key=lambda x: x["revenue"], reverse=True)[:8],
            "daily_trend": sorted(w_daily.values(), key=lambda x: x["date"]),
        }

    return {
        "pole": {
            "id": pole_id,
            "name_fr": pole["name_fr"],
            "name_en": pole["name_en"],
            "tagline_fr": pole.get("tagline_fr"),
            "sort_order": pole.get("sort_order"),
        },
        "kpis": {
            "today": {"count": today_count, "guests": today_guests, "revenue": today_revenue},
            "last_30d": {"count": total_30d_count, "revenue": total_30d_revenue},
        },
        "sub_offers": sub_offers_out,
        "recent_bookings": recent,
        "analytics": analytics,
        "wallet_stats": wallet_stats,
    }


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
async def _resolve_special_event_offer(event_id: str) -> dict:
    """Load the event from db.special_events and return an OFFERS-shaped dict.
    Raises 400/404 if the event is missing, archived, or out of activation window.
    """
    if not event_id:
        raise HTTPException(status_code=400, detail="special_event_id is required for special_event bookings")
    ev = await db.special_events.find_one({"id": event_id}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail="Special event not found")
    if ev.get("status") != "published":
        raise HTTPException(status_code=400, detail="Special event is not currently published")
    today = datetime.now(timezone.utc).date().isoformat()
    if ev.get("active_from") and today < ev["active_from"]:
        raise HTTPException(status_code=400, detail="Special event booking is not yet open")
    if ev.get("active_to") and today > ev["active_to"]:
        raise HTTPException(status_code=400, detail="Special event booking window is closed")
    return {
        "id": "special_event",
        "event_id": ev["id"],
        "name_fr": ev.get("title") or "Événement Spécial",
        "name_en": ev.get("title") or "Special Event",
        "schedule_fr": ev.get("subtitle") or "",
        "schedule_en": ev.get("subtitle") or "",
        "tagline_fr": ev.get("description") or "",
        "tagline_en": ev.get("description") or "",
        "price_adult": int(ev.get("price_adult", 0)),
        "price_child": int(ev.get("price_child", 0)),
        "max_capacity": int(ev.get("capacity", 0)),
        "event_dates": list(ev.get("event_dates") or []),
        "boat_times": list(ev.get("boat_times") or []),
        "return_boat_times": list(ev.get("return_boat_times") or []),
        "image_url": ev.get("image_url") or "",
    }


@api.post("/bookings")
async def create_booking(body: BookingCreate):
    is_special = body.offer_type == "special_event"
    if is_special:
        offer = await _resolve_special_event_offer(body.special_event_id or "")
    else:
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

    if is_special:
        allowed_times = offer["boat_times"]
        if not allowed_times:
            raise HTTPException(status_code=400, detail="This special event has no boat schedule configured")
        if body.boat_time not in allowed_times:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid boat time for this event. Allowed: {', '.join(allowed_times)}",
            )
        event_dates = offer["event_dates"]
        if event_dates and body.date not in event_dates:
            raise HTTPException(
                status_code=400,
                detail=f"Selected date is not part of this event. Allowed: {', '.join(event_dates)}",
            )
    else:
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
    cap_filter = {"offer_type": body.offer_type, "date": body.date, "status": {"$ne": "cancelled"}}
    if is_special:
        cap_filter["special_event_id"] = offer["event_id"]
    cursor = db.bookings.find(
        cap_filter,
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
        "pole": _pole_for_offer(body.offer_type),
        "special_event_id": offer["event_id"] if is_special else None,
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

    if booking["offer_type"] == "special_event":
        offer = await _resolve_special_event_offer(booking.get("special_event_id") or "")
    else:
        offer = OFFERS[booking["offer_type"]]
    participants = booking.get("participants", [])

    # Compute paid amount (full vs deposit). Deposit is only valid for overnight offers.
    total_amount = int(booking.get("total_amount", 0))
    deposit_pct = None
    if body.payment_method == "deposit":
        if not offer.get("is_overnight"):
            raise HTTPException(status_code=400, detail="Deposit only available for overnight stays")
        if body.deposit_pct not in (10, 30, 70):
            raise HTTPException(status_code=400, detail="deposit_pct must be 10, 30 or 70")
        deposit_pct = int(body.deposit_pct)
        paid_amount = int(round(total_amount * deposit_pct / 100))
    else:
        paid_amount = total_amount
    balance_due = total_amount - paid_amount

    # Card / mobile-money / deposit payments produce the luxury styled gold QR.
    # Only true cash payments keep the plain receipt.
    styled_qr = body.payment_method in ("fineo", "card", "mobile_money", "deposit")
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
        "paid_amount_fcfa": int(paid_amount),
        "balance_due_fcfa": int(balance_due),
        "deposit_pct": deposit_pct,
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
        # Compact QR payload — only the ticket token. The full guest payload stays in DB (qr_payload)
        # for auditing. This keeps the encoded QR small enough to be scanned by mobile cameras even
        # when rendered in styled gold + rounded modules with H-level error correction.
        compact_qr = json.dumps(
            {"type": "ticket", "token": token, "ref": booking_id[:8].upper()},
            ensure_ascii=False, separators=(",", ":"),
        )
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
            "qr_code": make_qr(compact_qr, styled=styled_qr),
        }
        if styled_qr:
            # Card / mobile-money payments: composite ticket with brown details + gold QR
            entry["ticket_image"] = make_ticket_image(
                offer_id=booking["offer_type"],
                offer_name=offer["name_fr"],
                date_iso=booking["date"],
                boat_time=booking.get("boat_time", ""),
                owner_name=f"{p['name']} {p['surname']}",
                qr_payload=compact_qr,
                ref_code=token_short,
                lang="fr",
                hero_url=offer.get("image_url") or None,
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
                hero_url=offer.get("image_url") or None,
            )
        qr_codes.append(entry)

    paid_at = now_iso()

    # ---------- Wallet creation (activity payment QR) ----------
    primary = next((p for p in participants if p["kind"] == "adult"), participants[0] if participants else {})
    owner_name = f"{primary.get('name','')} {primary.get('surname','')}".strip() or "Invité"
    wallet_token = str(uuid.uuid4())
    booking_ref_short = booking_id[:8].upper()
    wallet_doc = {
        "id": str(uuid.uuid4()),
        "token": wallet_token,
        "booking_id": booking_id,
        "booking_ref": booking_ref_short,
        "owner_name": owner_name,
        "phone": booking.get("phone", ""),
        "email": booking.get("email", ""),
        "transactions": [],
        "total_charged": 0,
        "status": "open",
        "created_at": paid_at,
    }
    await db.wallets.insert_one(dict(wallet_doc))
    wallet_doc.pop("_id", None)
    wallet_qr = {
        "wallet_token": wallet_token,
        "qr_code": make_qr(json.dumps({"type": "wallet", "token": wallet_token, "booking_ref": booking_ref_short}), styled=True),
        "ticket_image": make_wallet_image(
            owner_name=owner_name,
            wallet_token=wallet_token,
            booking_ref=booking_ref_short,
            lang="fr",
        ),
    }

    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "confirmed",
            "qr_codes": qr_codes,
            "wallet_qr": wallet_qr,
            "wallet_token": wallet_token,
            "paid_at": paid_at,
            "payment_method": body.payment_method,
            "paid_amount": int(paid_amount),
            "balance_due": int(balance_due),
            "deposit_pct": deposit_pct,
        }},
    )
    booking["status"] = "confirmed"
    booking["qr_codes"] = qr_codes
    booking["wallet_qr"] = wallet_qr
    booking["wallet_token"] = wallet_token
    booking["paid_at"] = paid_at
    booking["payment_method"] = body.payment_method
    booking["paid_amount"] = int(paid_amount)
    booking["balance_due"] = int(balance_due)
    booking["deposit_pct"] = deposit_pct
    # Fiscal receipt for the booking payment (only if money was actually charged)
    if int(paid_amount) > 0:
        try:
            primary = next((p for p in participants if p.get("kind") == "adult"), None) or (participants[0] if participants else {})
            label = (
                f"Acompte {deposit_pct}% — {offer['name_fr']} ({booking['date']})"
                if body.payment_method == "deposit" and deposit_pct
                else f"{offer['name_fr']} — {booking['date']}"
            )
            line = {
                "description": label,
                "quantity": 1,
                "unit_price": int(paid_amount),
                "total": int(paid_amount),
            }
            await _create_receipt(
                source="booking",
                source_id=booking_id,
                customer_name=f"{primary.get('surname','').strip()} {primary.get('name','').strip()}".strip() or "—",
                customer_email=primary.get("email") or booking.get("email", ""),
                customer_phone=primary.get("phone") or booking.get("phone", ""),
                lines=[line],
                payment_method=body.payment_method,
                issued_by="public",
                issued_by_role="public",
                metadata={"offer_type": booking["offer_type"], "deposit_pct": deposit_pct},
            )
        except Exception as ex:
            logging.exception("Failed to create booking receipt: %s", ex)
    return booking


@api.get("/bookings/{booking_id}")
async def get_booking(booking_id: str, ref: str):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.get("reference_token") != ref:
        raise HTTPException(status_code=403, detail="Invalid reference token")
    return booking


# =================================================================
# SPECIAL EVENTS — bookable themed event with staff CRUD
# =================================================================
def _public_event(ev: dict) -> dict:
    """Strip internal fields before returning an event to public consumers."""
    today = datetime.now(timezone.utc).date().isoformat()
    return {
        "id": ev["id"],
        "title": ev.get("title", ""),
        "subtitle": ev.get("subtitle", ""),
        "description": ev.get("description", ""),
        "image_url": ev.get("image_url", ""),
        "event_dates": ev.get("event_dates") or [],
        "boat_times": ev.get("boat_times") or [],
        "return_boat_times": ev.get("return_boat_times") or [],
        "price_adult": int(ev.get("price_adult", 0)),
        "price_child": int(ev.get("price_child", 0)),
        "capacity": int(ev.get("capacity", 0)),
        "active_from": ev.get("active_from"),
        "active_to": ev.get("active_to"),
        "cta_label": ev.get("cta_label") or "Réserver ma place",
        "is_featured": bool(ev.get("is_featured")),
        "status": ev.get("status", "draft"),
        "today": today,
    }


def _event_is_currently_active(ev: dict, today: str) -> bool:
    if ev.get("status") != "published":
        return False
    if ev.get("active_from") and today < ev["active_from"]:
        return False
    if ev.get("active_to") and today > ev["active_to"]:
        return False
    return True


@api.get("/special-events/featured")
async def get_featured_special_event():
    """Public — returns the single currently-featured, published, in-window event.
    Used by the booking tunnel to inject the event card alongside the static offers.
    Returns ``{"event": null}`` when no event is featured/eligible.
    """
    today = datetime.now(timezone.utc).date().isoformat()
    ev = await db.special_events.find_one(
        {"is_featured": True, "status": "published"},
        {"_id": 0},
    )
    if not ev or not _event_is_currently_active(ev, today):
        return {"event": None}
    # Filter out past event_dates so the public UI only shows upcoming slots
    upcoming_dates = [d for d in (ev.get("event_dates") or []) if d >= today]
    out = _public_event(ev)
    out["event_dates"] = upcoming_dates
    # Compute remaining seats across all upcoming event dates (best-effort total)
    booked_cursor = db.bookings.find(
        {
            "offer_type": "special_event",
            "special_event_id": ev["id"],
            "status": {"$ne": "cancelled"},
        },
        {"_id": 0, "adults": 1, "children": 1, "date": 1},
    )
    booked_per_date: dict = {}
    async for b in booked_cursor:
        d = b.get("date") or ""
        booked_per_date[d] = booked_per_date.get(d, 0) + int(b.get("adults", 0)) + int(b.get("children", 0))
    out["seats_per_date"] = {d: max(0, int(ev.get("capacity", 0)) - booked_per_date.get(d, 0)) for d in upcoming_dates}
    return {"event": out}


@api.get("/special-events/{event_id}")
async def get_special_event(event_id: str):
    """Public — fetch a single published event by ID (used by the booking tunnel)."""
    ev = await db.special_events.find_one({"id": event_id}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    today = datetime.now(timezone.utc).date().isoformat()
    if not _event_is_currently_active(ev, today):
        raise HTTPException(status_code=400, detail="Cet événement n'est pas disponible à la réservation")
    out = _public_event(ev)
    out["event_dates"] = [d for d in (ev.get("event_dates") or []) if d >= today]
    # Per-date remaining seats
    booked_cursor = db.bookings.find(
        {"offer_type": "special_event", "special_event_id": ev["id"], "status": {"$ne": "cancelled"}},
        {"_id": 0, "adults": 1, "children": 1, "date": 1},
    )
    booked_per_date: dict = {}
    async for b in booked_cursor:
        d = b.get("date") or ""
        booked_per_date[d] = booked_per_date.get(d, 0) + int(b.get("adults", 0)) + int(b.get("children", 0))
    out["seats_per_date"] = {d: max(0, int(ev.get("capacity", 0)) - booked_per_date.get(d, 0)) for d in out["event_dates"]}
    return {"event": out}


@api.get("/staff/special-events")
async def staff_list_special_events(staff=Depends(get_current_staff)):
    """List all special events, including drafts and archived (for the back-office)."""
    items = await db.special_events.find({}, {"_id": 0}).sort("created_at", -1).to_list(length=500)
    today = datetime.now(timezone.utc).date().isoformat()
    # Hydrate with booked seat counts (sum across all dates)
    by_id: dict = {it["id"]: it for it in items}
    if by_id:
        agg = db.bookings.aggregate([
            {"$match": {
                "offer_type": "special_event",
                "special_event_id": {"$in": list(by_id.keys())},
                "status": {"$ne": "cancelled"},
            }},
            {"$group": {
                "_id": "$special_event_id",
                "guests": {"$sum": {"$add": [{"$ifNull": ["$adults", 0]}, {"$ifNull": ["$children", 0]}]}},
                "bookings": {"$sum": 1},
            }},
        ])
        async for row in agg:
            eid = row["_id"]
            if eid in by_id:
                by_id[eid]["booked_guests"] = int(row.get("guests", 0))
                by_id[eid]["booked_bookings"] = int(row.get("bookings", 0))
    for it in items:
        it.setdefault("booked_guests", 0)
        it.setdefault("booked_bookings", 0)
        it["is_active"] = _event_is_currently_active(it, today)
    return {"items": items}


@api.get("/staff/special-events/{event_id}")
async def staff_get_special_event(event_id: str, staff=Depends(get_current_staff)):
    ev = await db.special_events.find_one({"id": event_id}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail="Special event not found")
    return ev


@api.post("/staff/special-events")
async def staff_create_special_event(body: SpecialEventCreate, staff=Depends(get_current_staff)):
    await _require_role(staff, ["manager", "admin"])
    eid = str(uuid.uuid4())
    doc = {
        "id": eid,
        **body.model_dump(),
        "is_featured": False,
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "created_by_email": staff.get("email"),
    }
    await db.special_events.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api.patch("/staff/special-events/{event_id}")
async def staff_update_special_event(
    event_id: str,
    body: SpecialEventUpdate,
    staff=Depends(get_current_staff),
):
    await _require_role(staff, ["manager", "admin"])
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    update["updated_at"] = now_iso()
    res = await db.special_events.update_one({"id": event_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Special event not found")
    ev = await db.special_events.find_one({"id": event_id}, {"_id": 0})
    return ev


@api.post("/staff/special-events/{event_id}/feature")
async def staff_feature_special_event(event_id: str, staff=Depends(get_current_staff)):
    """Mark the given event as the single featured one (unsets every other event)."""
    await _require_role(staff, ["manager", "admin"])
    ev = await db.special_events.find_one({"id": event_id}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail="Special event not found")
    await db.special_events.update_many(
        {"id": {"$ne": event_id}},
        {"$set": {"is_featured": False, "updated_at": now_iso()}},
    )
    await db.special_events.update_one(
        {"id": event_id},
        {"$set": {"is_featured": True, "updated_at": now_iso()}},
    )
    return {"ok": True, "is_featured": True}


@api.post("/staff/special-events/{event_id}/unfeature")
async def staff_unfeature_special_event(event_id: str, staff=Depends(get_current_staff)):
    await _require_role(staff, ["manager", "admin"])
    res = await db.special_events.update_one(
        {"id": event_id},
        {"$set": {"is_featured": False, "updated_at": now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Special event not found")
    return {"ok": True, "is_featured": False}


@api.post("/staff/special-events/{event_id}/duplicate")
async def staff_duplicate_special_event(event_id: str, staff=Depends(get_current_staff)):
    await _require_role(staff, ["manager", "admin"])
    ev = await db.special_events.find_one({"id": event_id}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail="Special event not found")
    clone = dict(ev)
    clone["id"] = str(uuid.uuid4())
    clone["title"] = f"{clone.get('title', '')} (copie)".strip()
    clone["is_featured"] = False
    clone["status"] = "draft"
    clone["created_at"] = now_iso()
    clone["updated_at"] = now_iso()
    clone["created_by_email"] = staff.get("email")
    await db.special_events.insert_one(dict(clone))
    clone.pop("_id", None)
    return clone


@api.delete("/staff/special-events/{event_id}")
async def staff_delete_special_event(event_id: str, staff=Depends(get_current_staff)):
    await _require_role(staff, ["admin"])
    # Guard against deletion when bookings still reference the event
    used = await db.bookings.count_documents({
        "offer_type": "special_event",
        "special_event_id": event_id,
        "status": {"$ne": "cancelled"},
    })
    if used > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cet événement a {used} réservation(s) active(s). Archivez-le plutôt que de le supprimer.",
        )
    res = await db.special_events.delete_one({"id": event_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Special event not found")
    return {"ok": True}


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

    # Pôle breakdown — counts + revenue today + last 30 days
    pole_counts_today: dict = {pid: {"count": 0, "guests": 0, "revenue": 0} for pid in POLES}
    for b in bookings_today:
        pole = b.get("pole") or _pole_for_offer(b.get("offer_type", ""))
        if not pole or pole not in pole_counts_today:
            continue
        pole_counts_today[pole]["count"] += 1
        pole_counts_today[pole]["guests"] += int(b.get("adults", 0)) + int(b.get("children", 0))
        if b.get("status") in ("confirmed", "arrived", "completed"):
            pole_counts_today[pole]["revenue"] += int(b.get("total_amount", 0))

    # Last 30 days breakdown
    from datetime import timedelta as _td
    cutoff = (datetime.now(timezone.utc).date() - _td(days=30)).isoformat()
    pole_30d: dict = {pid: {"count": 0, "revenue": 0} for pid in POLES}
    cur30 = db.bookings.find(
        {"date": {"$gte": cutoff}, "status": {"$ne": "cancelled"}},
        {"_id": 0, "pole": 1, "offer_type": 1, "total_amount": 1},
    )
    async for b in cur30:
        pole = b.get("pole") or _pole_for_offer(b.get("offer_type", ""))
        if not pole or pole not in pole_30d:
            continue
        pole_30d[pole]["count"] += 1
        pole_30d[pole]["revenue"] += int(b.get("total_amount", 0) or 0)

    pole_breakdown = []
    for pid, p in sorted(POLES.items(), key=lambda kv: kv[1].get("sort_order", 99)):
        pole_breakdown.append({
            "id": pid,
            "name_fr": p["name_fr"],
            "today": pole_counts_today.get(pid, {"count": 0, "guests": 0, "revenue": 0}),
            "last_30d": pole_30d.get(pid, {"count": 0, "revenue": 0}),
        })

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
        "pole_breakdown": pole_breakdown,
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


@api.get("/staff/poles/{pole_id}/report.pdf")
async def staff_pole_report_pdf(pole_id: str, staff=Depends(get_current_staff)):
    """Generate a print-ready monthly PDF report for the given pôle.
    Contains: header + KPIs + sub-offers + analytics breakdowns.
    """
    await _require_role(staff, ["manager", "admin"])
    overview = await staff_pole_overview(pole_id, staff=staff)  # reuse full computation
    pole = overview["pole"]
    kpis = overview["kpis"]
    sub_offers = overview["sub_offers"]
    analytics = overview["analytics"] or {}
    recent = overview["recent_bookings"] or []

    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
    from fastapi.responses import StreamingResponse
    import io

    styles = _pdf_styles()
    GOLD = styles["GOLD"]
    DARK = styles["DARK"]
    LIGHT = styles["LIGHT"]
    MUTED = styles["MUTED"]

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=2 * cm, bottomMargin=2 * cm, leftMargin=2 * cm, rightMargin=2 * cm,
        title=f"Rapport pôle {pole['name_fr']}",
    )
    el = []
    now_dt = datetime.now(timezone.utc)
    now_human = now_dt.strftime("%d/%m/%Y %H:%M UTC")

    # ===== Header =====
    el.append(Paragraph("BOULAY BEACH RESORT", styles["sub"]))
    el.append(Paragraph(f"Rapport mensuel — Pôle {pole['name_fr']}", styles["h1"]))
    el.append(Paragraph(f"Période glissante : 30 derniers jours · Généré le {now_human}", styles["small"]))
    el.append(Spacer(1, 16))

    # ===== KPIs grid =====
    el.append(Paragraph("Vue d'ensemble", styles["h2"]))
    kpi_rows = [
        ["Réservations 30j", str(kpis["last_30d"].get("count", 0))],
        ["CA 30j", _format_xof(kpis["last_30d"].get("revenue", 0))],
        ["Réservations aujourd'hui", str(kpis["today"].get("count", 0))],
        ["Convives attendus aujourd'hui", str(kpis["today"].get("guests", 0))],
        ["Revenus encaissés aujourd'hui", _format_xof(kpis["today"].get("revenue", 0))],
        ["Panier moyen 30j", _format_xof(analytics.get("avg_basket", 0))],
        ["Délai moyen de réservation", f"{analytics.get('avg_lead_time_days', 0)} jours"],
        ["Taux de paiement", f"{analytics.get('paid_rate', 0)} %"],
        ["Taux d'annulation", f"{analytics.get('cancellation_rate', 0)} %"],
        [
            "Convives 30j",
            f"{(analytics.get('guests_breakdown', {}).get('adults', 0))} adultes · "
            f"{(analytics.get('guests_breakdown', {}).get('children', 0))} enfants",
        ],
    ]
    t = Table(kpi_rows, colWidths=[8 * cm, 8 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("TEXTCOLOR", (0, 0), (0, -1), MUTED),
        ("TEXTCOLOR", (1, 0), (1, -1), DARK),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, -2), 0.25, colors.HexColor("#E5E5E2")),
    ]))
    el.append(t)
    el.append(Spacer(1, 14))

    # ===== Sub-offers =====
    if sub_offers:
        el.append(Paragraph("Sous-offres", styles["h2"]))
        rows = [["Sous-offre", "Réservations", "CA (30j)", "Convives", "Occupation"]]
        for s in sub_offers:
            stats = s.get("stats") or {}
            occ = s.get("occupancy_pct")
            occ_str = "—" if occ is None else f"{occ} %"
            rows.append([
                s.get("name_fr", ""),
                str(stats.get("count", 0)),
                _format_xof(stats.get("revenue", 0)),
                str(stats.get("guests", 0)),
                occ_str,
            ])
        t = Table(rows, colWidths=[6 * cm, 2.5 * cm, 3.8 * cm, 2 * cm, 2.5 * cm], repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), GOLD),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("ALIGN", (0, 0), (0, -1), "LEFT"),
            ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#E5E5E2")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ]))
        el.append(t)
        el.append(Spacer(1, 14))

    # ===== Status pipeline =====
    by_status = analytics.get("by_status") or []
    if any(s.get("count", 0) for s in by_status):
        el.append(Paragraph("Pipeline des statuts", styles["h2"]))
        STATUS_FR = {
            "pending": "En attente", "confirmed": "Confirmée", "arrived": "Arrivée",
            "completed": "Terminée", "cancelled": "Annulée",
        }
        rows = [["Statut", "Nombre"]]
        for s in by_status:
            rows.append([STATUS_FR.get(s["status"], s["status"]), str(s.get("count", 0))])
        t = Table(rows, colWidths=[10 * cm, 4 * cm], repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), GOLD),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#E5E5E2")),
        ]))
        el.append(t)
        el.append(Spacer(1, 14))

    # ===== Payment methods =====
    pmethods = analytics.get("by_payment_method") or []
    if pmethods:
        el.append(Paragraph("Répartition par méthode de paiement", styles["h2"]))
        METHOD_FR = {"cash": "Espèces", "card": "Carte", "mobile_money": "Mobile Money", "fineo": "FINEO", "deposit": "Acompte", "unknown": "Non défini"}
        rows = [["Méthode", "Nombre", "Montant total"]]
        for p in sorted(pmethods, key=lambda x: x.get("total", 0), reverse=True):
            rows.append([
                METHOD_FR.get(p.get("method"), p.get("method")),
                str(p.get("count", 0)),
                _format_xof(p.get("total", 0)),
            ])
        t = Table(rows, colWidths=[7 * cm, 4 * cm, 5 * cm], repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), GOLD),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ]))
        el.append(t)
        el.append(Spacer(1, 14))

    # ===== Weekday =====
    weekday = analytics.get("by_weekday") or []
    if any(w.get("count", 0) for w in weekday):
        el.append(Paragraph("Répartition par jour de la semaine", styles["h2"]))
        rows = [["Jour", "Réservations", "CA"]]
        for w in weekday:
            rows.append([w["day"], str(w.get("count", 0)), _format_xof(w.get("revenue", 0))])
        t = Table(rows, colWidths=[5 * cm, 4 * cm, 7 * cm], repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), GOLD),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ]))
        el.append(t)
        el.append(Spacer(1, 14))

    # ===== Boat times =====
    btimes = analytics.get("by_boat_time") or []
    if btimes:
        el.append(Paragraph("Horaires de traversée les plus demandés", styles["h2"]))
        rows = [["Horaire", "Réservations"]]
        for b in btimes:
            rows.append([b.get("boat_time", "—"), str(b.get("count", 0))])
        t = Table(rows, colWidths=[10 * cm, 4 * cm], repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), GOLD),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ]))
        el.append(t)
        el.append(Spacer(1, 14))

    # ===== Top clients =====
    top_clients = analytics.get("top_clients") or []
    if top_clients:
        el.append(Paragraph("Top 5 clients (par CA)", styles["h2"]))
        rows = [["#", "Nom", "Téléphone", "Réservations", "CA"]]
        for i, c in enumerate(top_clients, start=1):
            rows.append([str(i), c.get("name", "—"), c.get("phone", "—"), str(c.get("count", 0)), _format_xof(c.get("total", 0))])
        t = Table(rows, colWidths=[0.8 * cm, 6 * cm, 4 * cm, 2.5 * cm, 3.5 * cm], repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), GOLD),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ]))
        el.append(t)
        el.append(Spacer(1, 14))

    # ===== Recent bookings (last 10) =====
    if recent:
        el.append(PageBreak())
        el.append(Paragraph("Réservations récentes", styles["h2"]))
        rows = [["Date", "Heure", "Offre", "Convives", "Montant", "Statut"]]
        STATUS_FR = {
            "pending": "En attente", "confirmed": "Confirmée", "arrived": "Arrivée",
            "completed": "Terminée", "cancelled": "Annulée",
        }
        for b in recent[:15]:
            adults = int(b.get("adults", 0) or 0)
            children = int(b.get("children", 0) or 0)
            convives = f"{adults}A" + (f" +{children}E" if children else "")
            date_iso = b.get("date") or ""
            m = date_iso.split("-") if date_iso else []
            date_fr = f"{m[2]}/{m[1]}/{m[0]}" if len(m) == 3 else "—"
            rows.append([
                date_fr,
                b.get("boat_time") or "—",
                b.get("offer_name", "")[:32],
                convives,
                _format_xof(b.get("total_amount", 0)),
                STATUS_FR.get(b.get("status"), b.get("status", "")),
            ])
        t = Table(rows, colWidths=[2.2 * cm, 1.6 * cm, 5.5 * cm, 2 * cm, 3 * cm, 2.7 * cm], repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), GOLD),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("ALIGN", (4, 1), (4, -1), "RIGHT"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ]))
        el.append(t)

    footer = _pdf_footer_factory(styles)
    doc.build(el, onFirstPage=footer, onLaterPages=footer)
    buf.seek(0)
    fname = f"bbr-pole-{pole_id}-{now_dt.strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
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


async def _resolve_qr_token(raw: str):
    """Resolve a raw user-supplied token into the real qr_token.

    A booking's `qr_codes[].qr_token` is a 32-hex-character lowercase string. However
    the printed PNG ticket only shows a short reference (e.g. "5DF111909C", which is
    `token[:10].upper()`). Receptionists tend to type that visible code into the manual
    scanner. Without normalisation the lookup would 404 because of case + length mismatch.

    Strategy:
      1. Try exact match (current behaviour, fastest).
      2. Else lowercase and try again.
      3. Else treat the input as a prefix (>=8 chars) and search via regex.
    Returns the booking dict + the matching qr_token, or (None, None).
    """
    if not raw:
        return None, None
    raw = raw.strip()
    # 1. Exact
    booking = await db.bookings.find_one({"qr_codes.qr_token": raw}, {"_id": 0})
    if booking:
        return booking, raw
    # 2. Lowercase exact
    low = raw.lower()
    if low != raw:
        booking = await db.bookings.find_one({"qr_codes.qr_token": low}, {"_id": 0})
        if booking:
            return booking, low
    # 3. Prefix match (only if user typed >=8 hex chars, to avoid ambiguity)
    import re as _re
    if _re.fullmatch(r"[0-9a-f]{8,}", low):
        pattern = _re.compile(f"^{_re.escape(low)}")
        booking = await db.bookings.find_one({"qr_codes.qr_token": {"$regex": pattern}}, {"_id": 0})
        if booking:
            real = next(
                (q.get("qr_token") for q in booking.get("qr_codes", []) if q.get("qr_token", "").startswith(low)),
                None,
            )
            if real:
                return booking, real
    return None, None


# ---------- QR Scanner (Module 4) ----------
@api.get("/staff/scan/{qr_token}")
async def scan_qr(qr_token: str, staff=Depends(get_current_staff)):
    """Look up a booking by QR token. Returns the participant + booking summary + scan history.

    Accepts: full 32-hex token (camera scan), lowercase/uppercase variants, OR the 10-char
    reference code (or any >=8-char prefix) printed on the styled PNG ticket.
    """
    booking, real_token = await _resolve_qr_token(qr_token)
    if not booking:
        raise HTTPException(status_code=404, detail="QR code non reconnu")
    guest = next((q for q in booking.get("qr_codes", []) if q.get("qr_token") == real_token), None)
    scans = (guest or {}).get("scans", [])
    next_direction = "aller" if len(scans) == 0 else ("retour" if len(scans) == 1 else None)

    # Fetch wallet to surface participant-level activities + consumptions
    wallet = None
    participant_charges: List[dict] = []
    participant_total = 0
    wallet_total = 0
    wallet_status = None
    if booking.get("wallet_token"):
        wallet = await db.wallets.find_one({"token": booking["wallet_token"]}, {"_id": 0})
        if wallet:
            wallet_status = wallet.get("status")
            for tx in wallet.get("transactions", []) or []:
                if tx.get("status") == "voided":
                    continue
                wallet_total += int(tx.get("amount", 0))
                if (tx.get("participant_token") or "").lower() == real_token.lower():
                    participant_charges.append(tx)
                    participant_total += int(tx.get("amount", 0))
    participant_charges.sort(key=lambda t: t.get("created_at", ""), reverse=True)
    summary = {
        "booking_id": booking["id"],
        "offer_type": booking.get("offer_type"),
        "offer_name": booking["offer_name"],
        "date": booking["date"],
        "checkout_date": booking.get("checkout_date"),
        "nights": booking.get("nights") or 0,
        "boat_time": booking.get("boat_time"),
        "return_boat_time": booking.get("return_boat_time"),
        "rooms": booking.get("rooms") or 1,
        "room_tier": booking.get("room_tier"),
        "room_tier_name": booking.get("room_tier_name"),
        "adults": booking.get("adults"),
        "children": booking.get("children"),
        "status": booking.get("status"),
        "payment_method": booking.get("payment_method"),
        "total_amount": booking.get("total_amount", 0),
        "paid_amount": booking.get("paid_amount", 0),
        "balance_due": booking.get("balance_due", 0),
        "deposit_pct": booking.get("deposit_pct"),
        "phone": booking.get("phone", ""),
        "email": booking.get("email", ""),
        "special_requests": booking.get("special_requests", ""),
        "wallet_token": booking.get("wallet_token"),
        "guest_name": guest.get("guest_name") if guest else "",
        "guest_surname": guest.get("guest_surname") if guest else "",
        "guest_nationality": guest.get("guest_nationality") if guest else "",
        "guest_phone": guest.get("guest_phone") if guest else "",
        "guest_email": guest.get("guest_email") if guest else "",
        "guest_label_fr": guest.get("label_fr") if guest else "",
        "qr_token": real_token,
        "scans": scans,
        "scan_count": len(scans),
        "next_direction": next_direction,
        "fully_used": next_direction is None,
        # Wallet / participant traceability
        "wallet_status": wallet_status,
        "wallet_total_charged": wallet_total,
        "participant_charges": participant_charges,
        "participant_total_charged": participant_total,
    }
    return summary


class WalletCharge(BaseModel):
    activity_id: Optional[str] = None
    label: Optional[str] = None
    amount: int = Field(default=0, ge=0)
    note: Optional[str] = ""
    quantity: int = Field(default=1, ge=1, le=20)
    # Optional participant traceability: when present, the charge is tagged with the
    # ticket QR token of the participant who consumed it (Sky Nautique, Quad,
    # boissons…). Allows per-guest tracing & filtering.
    participant_token: Optional[str] = None


@api.post("/staff/scan/{qr_token}/charge")
async def charge_via_scan(qr_token: str, body: WalletCharge, staff=Depends(get_current_staff)):
    """Charge an activity / consumption directly via the participant's ticket QR.

    The staff scans the participant QR, taps an activity or types a free amount —
    the charge is added to the booking's wallet AND tagged with the participant
    token so we know who consumed what.
    """
    booking, real_token = await _resolve_qr_token(qr_token)
    if not booking:
        raise HTTPException(status_code=404, detail="QR code non reconnu")
    if not booking.get("wallet_token"):
        raise HTTPException(status_code=400, detail="Aucune carte de consommation associée à cette réservation.")
    body.participant_token = real_token
    return await charge_wallet(booking["wallet_token"], body, staff=staff)  # type: ignore


class CheckinOverride(BaseModel):
    """Optional override applied by the staff when the guest didn't take the boat
    originally planned at booking time (missed it / swapped). When omitted, the
    boat is auto-resolved from the booking's planned schedule."""
    boat_time: Optional[str] = None
    boat_id: Optional[str] = None
    boat_name: Optional[str] = None
    skipper_name: Optional[str] = None
    direction: Optional[Literal["aller", "retour"]] = None


@api.post("/staff/scan/{qr_token}/checkin")
async def checkin_qr(
    qr_token: str,
    body: Optional[CheckinOverride] = None,
    staff=Depends(get_current_staff),
):
    """Register an embarkation scan (aller then retour). Max 2 scans per QR.

    Rules:
    - First scan → direction='aller' and booking status becomes 'arrived' if not already
    - Second scan → direction='retour' and booking status becomes 'completed'
    - Third scan → 400 'QR code déjà utilisé entièrement'
    Each scan stores: direction, scanned_at, staff_email, staff_name, boat_*.

    Optional body lets the staff override the boat actually taken (when the guest
    missed the planned one and embarked on a later/earlier crossing).

    Accepts the same flexible token formats as GET /staff/scan/{qr_token}.
    """
    booking, real_token = await _resolve_qr_token(qr_token)
    if not booking:
        raise HTTPException(status_code=404, detail="QR code non reconnu")
    qrs = booking.get("qr_codes", [])
    idx = next((i for i, q in enumerate(qrs) if q.get("qr_token") == real_token), -1)
    if idx == -1:
        raise HTTPException(status_code=404, detail="QR code non reconnu")
    scans = qrs[idx].get("scans") or []
    if len(scans) >= 2:
        raise HTTPException(status_code=400, detail="QR code déjà scanné (aller + retour). Plus aucun embarquement possible.")
    # Direction may be forced by the staff (rare: scan a 'retour' before 'aller' has been done).
    forced_dir = (body.direction if body else None) if body else None
    direction = forced_dir or ("aller" if len(scans) == 0 else "retour")
    # Default boat from the booking; can be overridden by the staff (missed boat, etc.)
    planned_boat = booking.get("boat_time") if direction == "aller" else (booking.get("return_boat_time") or booking.get("boat_time"))
    boat_date = booking.get("date") if direction == "aller" else (booking.get("checkout_date") or booking.get("date"))
    boat_time = (body.boat_time if body else None) or planned_boat
    boat_id = (body.boat_id if body else None)
    boat_name = (body.boat_name if body else None)
    skipper_name = ((body.skipper_name if body else None) or "").strip() or None
    if boat_id and not boat_name:
        bateau = await db.bateaux.find_one({"id": boat_id}, {"_id": 0, "name": 1})
        if bateau:
            boat_name = bateau.get("name")
    boat_label_bits = [b for b in [boat_time, direction] if b]
    boat_label = " ".join(boat_label_bits) or direction
    if boat_name:
        boat_label = f"{boat_label} · {boat_name}"
    overridden = bool(body and (body.boat_time or body.boat_id) and (body.boat_time or "") != (planned_boat or ""))
    entry = {
        "direction": direction,
        "scanned_at": now_iso(),
        "staff_email": staff.get("email"),
        "staff_name": staff.get("name") or "",
        "boat_time": boat_time,
        "boat_id": boat_id,
        "boat_name": boat_name,
        "boat_date": boat_date,
        "boat_label": boat_label,
        "planned_boat_time": planned_boat,
        "overridden": overridden,
        "skipper_name": skipper_name,
    }
    scans = scans + [entry]
    # Aggregate booking-level status across all QR codes:
    #  - 'arrived' if at least one aller scan and not everyone has done a return
    #  - 'completed' once all participants have done both aller + retour
    all_scans_after = [
        (q.get("scans") or []) + ([entry] if i == idx else [])
        for i, q in enumerate(qrs)
    ]
    all_arrived = all(len(s) >= 1 for s in all_scans_after)
    all_completed = all(len(s) >= 2 for s in all_scans_after)
    new_status = booking.get("status")
    set_ops = {f"qr_codes.{idx}.scans": scans}
    if all_completed:
        new_status = "completed"
        set_ops["status"] = "completed"
        set_ops["completed_at"] = now_iso()
    elif all_arrived and booking.get("status") in (None, "confirmed", "pending"):
        new_status = "arrived"
        set_ops["status"] = "arrived"
        set_ops["arrived_at"] = booking.get("arrived_at") or now_iso()
    await db.bookings.update_one({"id": booking["id"]}, {"$set": set_ops})
    return {
        "ok": True,
        "direction": direction,
        "scanned_at": entry["scanned_at"],
        "staff_email": entry["staff_email"],
        "staff_name": entry["staff_name"],
        "boat_time": entry["boat_time"],
        "boat_id": entry["boat_id"],
        "boat_name": entry["boat_name"],
        "boat_date": entry["boat_date"],
        "boat_label": entry["boat_label"],
        "planned_boat_time": entry["planned_boat_time"],
        "overridden": entry["overridden"],
        "skipper_name": entry["skipper_name"],
        "scan_count": len(scans),
        "next_direction": "retour" if len(scans) == 1 else None,
        "fully_used": len(scans) >= 2,
        "booking_status": new_status,
    }


@api.get("/staff/checkins/history")
async def checkins_history(
    date: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    boat_time: Optional[str] = None,
    direction: Optional[Literal["aller", "retour"]] = None,
    q: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    staff=Depends(get_current_staff),
):
    """Flat history of embarkation scans across all bookings.

    Filters: single ``date``, ``date_from``..``date_to`` range, ``boat_time``,
    ``direction`` (aller/retour), free text ``q`` (matches participant or staff name).
    Sorted by scan timestamp DESC.
    """
    await _require_role(staff, ["manager", "admin"])
    # We need to walk bookings + their qr_codes[].scans. Use a pipeline.
    match: dict = {"qr_codes.scans": {"$exists": True, "$ne": []}}
    pipeline: List[dict] = [
        {"$match": match},
        {"$project": {"_id": 0, "id": 1, "offer_name": 1, "qr_codes": 1, "phone": 1, "email": 1}},
        {"$unwind": "$qr_codes"},
        {"$match": {"qr_codes.scans": {"$exists": True, "$ne": []}}},
        {"$unwind": "$qr_codes.scans"},
        {"$project": {
            "booking_id": "$id",
            "offer_name": "$offer_name",
            "guest_name": "$qr_codes.guest_name",
            "guest_surname": "$qr_codes.guest_surname",
            "guest_email": {"$ifNull": ["$qr_codes.guest_email", "$email"]},
            "guest_phone": {"$ifNull": ["$qr_codes.guest_phone", "$phone"]},
            "qr_token": "$qr_codes.qr_token",
            "direction": "$qr_codes.scans.direction",
            "scanned_at": "$qr_codes.scans.scanned_at",
            "staff_email": "$qr_codes.scans.staff_email",
            "staff_name": "$qr_codes.scans.staff_name",
            "boat_time": "$qr_codes.scans.boat_time",
            "boat_id": "$qr_codes.scans.boat_id",
            "boat_name": "$qr_codes.scans.boat_name",
            "boat_date": "$qr_codes.scans.boat_date",
            "boat_label": "$qr_codes.scans.boat_label",
            "planned_boat_time": "$qr_codes.scans.planned_boat_time",
            "overridden": "$qr_codes.scans.overridden",
            "skipper_name": "$qr_codes.scans.skipper_name",
        }},
    ]
    secondary_match: dict = {}
    if direction:
        secondary_match["direction"] = direction
    if boat_time:
        secondary_match["boat_time"] = boat_time
    if date:
        secondary_match["boat_date"] = date
    elif date_from or date_to:
        rng = {}
        if date_from:
            rng["$gte"] = date_from
        if date_to:
            rng["$lte"] = date_to
        secondary_match["boat_date"] = rng
    if q:
        import re as _re
        rgx = _re.compile(_re.escape(q), _re.IGNORECASE)
        secondary_match["$or"] = [
            {"guest_name": rgx},
            {"guest_surname": rgx},
            {"staff_name": rgx},
            {"staff_email": rgx},
            {"skipper_name": rgx},
        ]
    if secondary_match:
        pipeline.append({"$match": secondary_match})
    pipeline.append({"$sort": {"scanned_at": -1}})

    # Compute total before pagination
    count_pipe = pipeline + [{"$count": "n"}]
    counts = [r async for r in db.bookings.aggregate(count_pipe)]
    total = counts[0]["n"] if counts else 0

    page = max(1, page)
    page_size = max(1, min(200, page_size))
    pipeline.append({"$skip": (page - 1) * page_size})
    pipeline.append({"$limit": page_size})
    items = [r async for r in db.bookings.aggregate(pipeline)]

    # Aggregate per-boat summary on the same filter (no skip/limit)
    summary_pipe = pipeline[:-2] + [
        {"$group": {
            "_id": {"boat_label": "$boat_label", "boat_date": "$boat_date", "direction": "$direction"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id.boat_date": -1, "_id.boat_label": 1}},
    ]
    summary = [
        {
            "boat_label": (row["_id"] or {}).get("boat_label") or "—",
            "boat_date": (row["_id"] or {}).get("boat_date") or "—",
            "direction": (row["_id"] or {}).get("direction") or "—",
            "count": row["count"],
        }
        async for row in db.bookings.aggregate(summary_pipe)
    ]
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
        "summary": summary,
    }


@api.get("/staff/skippers")
async def list_recent_skippers(staff=Depends(get_current_staff)):
    """Return the distinct list of skipper names that have already been entered
    on a previous scan. Used by the scanner modal to autocomplete the field.
    Sorted by most-recently used first. Max 30 entries.
    """
    pipeline = [
        {"$match": {"qr_codes.scans.skipper_name": {"$nin": [None, ""]}}},
        {"$unwind": "$qr_codes"},
        {"$unwind": "$qr_codes.scans"},
        {"$match": {"qr_codes.scans.skipper_name": {"$nin": [None, ""]}}},
        {"$group": {
            "_id": "$qr_codes.scans.skipper_name",
            "last_used": {"$max": "$qr_codes.scans.scanned_at"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"last_used": -1}},
        {"$limit": 30},
        {"$project": {"_id": 0, "name": "$_id", "last_used": 1, "count": 1}},
    ]
    items = [r async for r in db.bookings.aggregate(pipeline)]
    return {"items": items}


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
    pole: Optional[str] = None,
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
    if pole:
        # Match bookings tagged with the pole, or fallback to offer_type ∈ pole.offers
        # so legacy bookings (without `pole` field) still surface.
        if pole in POLES:
            offers_in_pole = list(POLES[pole].get("offers", []))
            # special_event lives under activites_events via OFFER_TO_POLE
            if pole == "activites_events":
                offers_in_pole = list(set(offers_in_pole + ["special_event"]))
            q["$or"] = (q.get("$or") or []) + [
                {"pole": pole},
                {"offer_type": {"$in": offers_in_pole}},
            ]
        else:
            q["pole"] = pole
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
async def payments_summary(
    pole: Optional[str] = None,
    period: Optional[str] = "30d",
    staff=Depends(get_current_staff),
):
    """Payment KPIs + lists for the dedicated /staff/payments page.
    Optional filters:
      - pole : restricts unpaid+paid stats to a given pôle
      - period : 'today' | '7d' | '30d' | 'all' — affects the paid-by-method breakdown
    """
    await _require_role(staff, ["manager", "admin"])
    pole_filter: dict = {}
    if pole and pole in POLES:
        offers_in = list(POLES[pole].get("offers", []))
        if pole == "activites_events":
            offers_in = list(set(offers_in + ["special_event"]))
        pole_filter = {"$or": [{"pole": pole}, {"offer_type": {"$in": offers_in}}]}

    unpaid_match: dict = {
        "$and": [
            {"$or": [{"paid_at": None}, {"paid_at": {"$exists": False}}]},
            {"status": {"$ne": "cancelled"}},
        ],
    }
    if pole_filter:
        unpaid_match["$and"].append(pole_filter)
    unpaid_cursor = db.bookings.find(
        unpaid_match,
        {
            "_id": 0, "id": 1, "offer_type": 1, "offer_name": 1, "date": 1,
            "total_amount": 1, "deposit_amount": 1, "deposit_pct": 1, "paid_amount": 1,
            "phone": 1, "email": 1, "participants": 1, "pole": 1, "status": 1,
            "created_at": 1, "boat_time": 1, "adults": 1, "children": 1,
        },
    ).sort("created_at", -1)
    unpaid = await unpaid_cursor.to_list(length=500)
    unpaid_total = sum(b.get("total_amount", 0) for b in unpaid)

    # Paid breakdown — period-bounded
    paid_match: dict = {"paid_at": {"$ne": None}}
    if period and period != "all":
        days = {"today": 0, "7d": 7, "30d": 30, "90d": 90}.get(period, 30)
        cutoff = (datetime.now(timezone.utc).date() - timedelta(days=days)).isoformat()
        paid_match["date"] = {"$gte": cutoff}
    if pole_filter:
        paid_match = {"$and": [paid_match, pole_filter]}
    paid = await db.bookings.find(
        paid_match,
        {"_id": 0, "id": 1, "offer_name": 1, "date": 1, "payment_method": 1, "total_amount": 1, "paid_amount": 1, "paid_at": 1, "phone": 1, "participants": 1, "pole": 1, "status": 1},
    ).sort("paid_at", -1).to_list(length=2000)
    by_method: dict = {}
    paid_total = 0
    for b in paid:
        m = b.get("payment_method") or "unknown"
        by_method.setdefault(m, {"count": 0, "total": 0})
        by_method[m]["count"] += 1
        by_method[m]["total"] += b.get("total_amount", 0)
        paid_total += int(b.get("total_amount", 0) or 0)

    # Today's paid amount (always, for the "today" KPI tile)
    today_iso = datetime.now(timezone.utc).date().isoformat()
    today_paid = await db.bookings.find(
        {"paid_at": {"$ne": None}, "date": today_iso},
        {"_id": 0, "total_amount": 1},
    ).to_list(length=1000)
    today_revenue = sum(int(b.get("total_amount", 0) or 0) for b in today_paid)

    return {
        "unpaid": unpaid,
        "unpaid_count": len(unpaid),
        "unpaid_total": unpaid_total,
        "paid_count": len(paid),
        "paid_total": paid_total,
        "today_revenue": today_revenue,
        "today_paid_count": len(today_paid),
        "by_method": by_method,
        "recent_paid": paid[:30],
        "period": period or "30d",
        "pole": pole or "",
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
    by_pole: dict = {pid: {"id": pid, "name_fr": POLES[pid]["name_fr"], "count": 0, "total": 0} for pid in POLES}
    by_method: dict = {}
    by_day: dict = {}
    by_client: dict = {}

    for b in paid:
        oid = b.get("offer_type", "unknown")
        by_offer.setdefault(oid, {"offer_id": oid, "offer_name": b.get("offer_name", oid), "count": 0, "total": 0})
        by_offer[oid]["count"] += 1
        by_offer[oid]["total"] += b.get("total_amount", 0)

        pole = b.get("pole") or _pole_for_offer(oid)
        if pole in by_pole:
            by_pole[pole]["count"] += 1
            by_pole[pole]["total"] += b.get("total_amount", 0)

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
        "by_pole": list(by_pole.values()),
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

# ---------- Activities & Wallets (in-resort spend) ----------
class ActivityModel(BaseModel):
    id: str
    name_fr: str
    name_en: Optional[str] = None
    category: Optional[str] = "Activité"
    subcategory: Optional[str] = ""
    price: int = Field(ge=0)
    active: bool = True


class WalletCharge(BaseModel):  # noqa: F811 — declared earlier near scanner endpoints
    activity_id: Optional[str] = None
    label: Optional[str] = None
    amount: int = Field(default=0, ge=0)
    note: Optional[str] = ""
    quantity: int = Field(default=1, ge=1, le=20)
    participant_token: Optional[str] = None


@api.get("/activities")
async def list_activities_public():
    """Public list of activities — used to inform the booking UX of available services."""
    await _seed_default_activities()
    items = await db.activities.find({"active": True}, {"_id": 0}).sort("category", 1).to_list(length=200)
    return {"items": items}


@api.get("/staff/activities")
async def list_activities_staff(staff=Depends(get_current_staff)):
    await _require_role(staff, ["receptionist", "manager", "admin"])
    await _seed_default_activities()
    items = await db.activities.find({}, {"_id": 0}).sort("category", 1).to_list(length=200)
    return {"items": items}


@api.post("/staff/activities")
async def create_activity(body: ActivityModel, staff=Depends(get_current_staff)):
    await _require_role(staff, ["manager", "admin"])
    if await db.activities.find_one({"id": body.id}):
        raise HTTPException(status_code=400, detail="Activity id already exists")
    doc = body.model_dump()
    await db.activities.insert_one(dict(doc))
    return doc


@api.patch("/staff/activities/{activity_id}")
async def update_activity(activity_id: str, body: ActivityModel, staff=Depends(get_current_staff)):
    await _require_role(staff, ["manager", "admin"])
    payload = body.model_dump(exclude={"id"})
    res = await db.activities.update_one({"id": activity_id}, {"$set": payload})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Activity not found")
    return {"ok": True}


@api.delete("/staff/activities/{activity_id}")
async def delete_activity(activity_id: str, staff=Depends(get_current_staff)):
    await _require_role(staff, ["manager", "admin"])
    res = await db.activities.delete_one({"id": activity_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Activity not found")
    return {"ok": True}


async def _wallet_summary(wallet: dict) -> dict:
    """Build a serialisable summary of a wallet doc + linked booking info."""
    wallet = dict(wallet)
    wallet.pop("_id", None)
    booking_id = wallet.get("booking_id")
    if booking_id:
        b = await db.bookings.find_one(
            {"id": booking_id},
            {"_id": 0, "id": 1, "offer_name": 1, "date": 1, "checkout_date": 1, "phone": 1,
             "email": 1, "status": 1, "boat_time": 1, "return_boat_time": 1, "balance_due": 1,
             "total_amount": 1, "paid_amount": 1, "deposit_pct": 1, "participants": 1,
             "room_tier_name": 1, "rooms": 1, "adults": 1, "children": 1},
        )
        wallet["booking"] = b
    txs = wallet.get("transactions", [])
    wallet["total_charged"] = sum(t.get("amount", 0) for t in txs if t.get("status") != "voided")
    return wallet


@api.get("/staff/wallets/{token}")
async def get_wallet(token: str, staff=Depends(get_current_staff)):
    """Look up a wallet by its QR token (scanner) or short reference."""
    await _require_role(staff, ["receptionist", "manager", "admin"])
    wallet = await db.wallets.find_one({"token": token}, {"_id": 0})
    if not wallet:
        # Try short token (first 10 chars uppercase) as fallback
        short = token.strip().lower()
        async for w in db.wallets.find({}, {"_id": 0}):
            if w["token"].lower().startswith(short) or w.get("booking_ref", "").lower() == short:
                wallet = w
                break
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return await _wallet_summary(wallet)


@api.post("/staff/wallets/{token}/charge")
async def charge_wallet(token: str, body: WalletCharge, staff=Depends(get_current_staff)):
    """Add an activity charge to the wallet. Either ``activity_id`` (catalog
    lookup, amount × quantity) or a custom ``label + amount`` is required."""
    await _require_role(staff, ["receptionist", "manager", "admin"])
    wallet = await db.wallets.find_one({"token": token}, {"_id": 0})
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    if wallet.get("status") == "closed":
        raise HTTPException(status_code=400, detail="Wallet already closed")

    activity_label = body.label or "Prestation"
    unit_price = body.amount
    if body.activity_id:
        activity = await db.activities.find_one({"id": body.activity_id, "active": True}, {"_id": 0})
        if not activity:
            raise HTTPException(status_code=404, detail="Activity not found")
        activity_label = activity["name_fr"]
        unit_price = int(activity["price"])
    if unit_price <= 0:
        raise HTTPException(status_code=400, detail="amount must be > 0 (or provide a valid activity_id)")
    total = unit_price * body.quantity
    # Resolve participant from booking.qr_codes for traceability
    participant_name = None
    if body.participant_token and wallet.get("booking_id"):
        booking_for_p = await db.bookings.find_one(
            {"id": wallet["booking_id"]},
            {"_id": 0, "qr_codes": 1},
        )
        if booking_for_p:
            p = next(
                (q for q in (booking_for_p.get("qr_codes") or [])
                 if (q.get("qr_token") or "").lower() == body.participant_token.lower()),
                None,
            )
            if p:
                participant_name = f"{p.get('guest_surname','').strip()} {p.get('guest_name','').strip()}".strip() or None
    tx = {
        "id": str(uuid.uuid4()),
        "activity_id": body.activity_id,
        "label": activity_label,
        "unit_price": unit_price,
        "quantity": body.quantity,
        "amount": total,
        "note": body.note or "",
        "status": "active",
        "created_at": now_iso(),
        "created_by": staff.get("name"),
        "created_by_role": staff.get("role"),
        "participant_token": body.participant_token,
        "participant_name": participant_name,
    }
    await db.wallets.update_one(
        {"token": token},
        {
            "$push": {"transactions": tx},
            "$inc": {"total_charged": total},
        },
    )
    # Fiscal receipt for this on-site activity charge — tagged with the participant when known
    try:
        receipt_customer = participant_name or wallet.get("customer_name", "")
        await _create_receipt(
            source="activity",
            source_id=token,
            customer_name=receipt_customer,
            customer_email=wallet.get("customer_email", ""),
            customer_phone=wallet.get("customer_phone", ""),
            lines=[{
                "description": activity_label,
                "quantity": int(body.quantity),
                "unit_price": int(unit_price),
                "total": int(total),
            }],
            payment_method="on_site",
            issued_by=staff.get("name") or "",
            issued_by_role=staff.get("role") or "",
            metadata={
                "sub_id": tx["id"],
                "booking_id": wallet.get("booking_id"),
                "participant_token": body.participant_token,
                "participant_name": participant_name,
            },
        )
    except Exception as ex:
        logging.exception("Failed to create activity receipt: %s", ex)
    fresh = await db.wallets.find_one({"token": token}, {"_id": 0})
    return await _wallet_summary(fresh)


@api.delete("/staff/wallets/{token}/charge/{tx_id}")
async def void_wallet_charge(token: str, tx_id: str, staff=Depends(get_current_staff)):
    """Void a charge (kept in history, balance adjusted)."""
    await _require_role(staff, ["manager", "admin"])
    wallet = await db.wallets.find_one({"token": token, "transactions.id": tx_id}, {"_id": 0})
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet or charge not found")
    tx = next((t for t in wallet.get("transactions", []) if t["id"] == tx_id), None)
    if not tx or tx.get("status") == "voided":
        raise HTTPException(status_code=400, detail="Charge already voided")
    await db.wallets.update_one(
        {"token": token, "transactions.id": tx_id},
        {
            "$set": {
                "transactions.$.status": "voided",
                "transactions.$.voided_at": now_iso(),
                "transactions.$.voided_by": staff.get("name"),
            },
            "$inc": {"total_charged": -tx["amount"]},
        },
    )
    fresh = await db.wallets.find_one({"token": token}, {"_id": 0})
    return await _wallet_summary(fresh)


@api.post("/staff/wallets/{token}/close")
async def close_wallet(token: str, staff=Depends(get_current_staff)):
    """Mark the wallet as settled (paid at check-out)."""
    await _require_role(staff, ["manager", "admin"])
    res = await db.wallets.update_one(
        {"token": token},
        {"$set": {"status": "closed", "closed_at": now_iso(), "closed_by": staff.get("name")}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Wallet not found")
    fresh = await db.wallets.find_one({"token": token}, {"_id": 0})
    return await _wallet_summary(fresh)


# =================================================================
# MODULE 6 — LE KAAI (TABLES) — historical anchor
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


class KaaiZone(BaseModel):
    """Logical seating zone with a hard capacity cap used as an overbooking guard."""
    name: str = Field(min_length=1, max_length=40)
    capacity: int = Field(ge=0, le=500)
    sort_order: int = 0


class KaaiZoneUpdate(BaseModel):
    capacity: Optional[int] = Field(default=None, ge=0, le=500)
    sort_order: Optional[int] = None


DEFAULT_KAAI_ZONES = [
    {"name": "Terrasse 1", "capacity": 24, "sort_order": 1},
    {"name": "Terrasse 2", "capacity": 24, "sort_order": 2},
    {"name": "Salle", "capacity": 32, "sort_order": 3},
]


async def _seed_default_kaai_zones():
    """Seed default Le Kaai zones if collection is empty AND migrate legacy table zones."""
    if await db.kaai_zones.count_documents({}) == 0:
        seeds = [{**z, "id": str(uuid.uuid4()), "created_at": now_iso()} for z in DEFAULT_KAAI_ZONES]
        await db.kaai_zones.insert_many(seeds)
        logging.info("Seeded %d Le Kaai zones", len(seeds))
        # Migrate legacy zone labels on tables: split 'Terrasse' across Terrasse 1 / Terrasse 2.
        legacy = await db.kaai_tables.find({"zone": "Terrasse"}, {"_id": 0, "id": 1, "number": 1}).sort("number", 1).to_list(length=500)
        if legacy:
            half = max(1, len(legacy) // 2)
            ops = []
            for i, t in enumerate(legacy):
                new_zone = "Terrasse 1" if i < half else "Terrasse 2"
                ops.append((t["id"], new_zone))
            for tid, nz in ops:
                await db.kaai_tables.update_one({"id": tid}, {"$set": {"zone": nz}})
        # Migrate any other unknown zone to 'Salle' to keep capacities consistent.
        known = {z["name"] for z in DEFAULT_KAAI_ZONES}
        await db.kaai_tables.update_many(
            {"zone": {"$nin": list(known)}},
            {"$set": {"zone": "Salle"}},
        )


async def _seed_default_kaai_tables():
    """Seed default Le Kaai tables if none exist."""
    if await db.kaai_tables.count_documents({}) == 0:
        layout = [
            ("Terrasse 1", 6, 2),
            ("Terrasse 2", 6, 4),
            ("Salle", 8, 2),
            ("Salle", 4, 4),
            ("Salle", 4, 6),
        ]
        seeds = []
        i = 1
        for zone, count, cap in layout:
            for _ in range(count):
                seeds.append({"id": str(uuid.uuid4()), "number": f"T{i:02d}", "capacity": cap, "zone": zone, "status": "active"})
                i += 1
        await db.kaai_tables.insert_many(seeds)
        logging.info("Seeded %d Le Kaai tables", len(seeds))


# ----- Zones CRUD -----
@api.get("/staff/kaai/zones")
async def list_kaai_zones(staff=Depends(get_current_staff)):
    await _require_role(staff, ["manager", "admin"])
    await _seed_default_kaai_zones()
    items = await db.kaai_zones.find({}, {"_id": 0}).sort("sort_order", 1).to_list(length=200)
    return {"items": items}


@api.post("/staff/kaai/zones")
async def create_kaai_zone(body: KaaiZone, staff=Depends(get_current_staff)):
    await _require_role(staff, ["admin"])
    # Names are unique (case-insensitive).
    import re as _re
    existing = await db.kaai_zones.find_one({"name": {"$regex": f"^{_re.escape(body.name)}$", "$options": "i"}}, {"_id": 0, "id": 1})
    if existing:
        raise HTTPException(status_code=400, detail="Une zone porte déjà ce nom")
    doc = {**body.model_dump(), "id": str(uuid.uuid4()), "created_at": now_iso()}
    await db.kaai_zones.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/staff/kaai/zones/{zone_id}")
async def update_kaai_zone(zone_id: str, body: KaaiZoneUpdate, staff=Depends(get_current_staff)):
    await _require_role(staff, ["manager", "admin"])
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update:
        return {"ok": True}
    res = await db.kaai_zones.update_one({"id": zone_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Zone introuvable")
    return {"ok": True}


@api.delete("/staff/kaai/zones/{zone_id}")
async def delete_kaai_zone(zone_id: str, staff=Depends(get_current_staff)):
    await _require_role(staff, ["admin"])
    res = await db.kaai_zones.delete_one({"id": zone_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Zone introuvable")
    return {"ok": True}


# ----- Helpers: zone occupancy + guard -----
async def _kaai_zone_occupancy(date: str):
    """Return {zone_name: seats_used} on a given day, based on table assignments
    (each assigned booking counts adults + children seats against its table's zone)."""
    tables = await db.kaai_tables.find({}, {"_id": 0, "id": 1, "zone": 1}).to_list(length=1000)
    table_zone = {t["id"]: t.get("zone", "Salle") for t in tables}
    bookings = await db.bookings.find(
        {"offer_type": "le_kaai", "date": date, "status": {"$ne": "cancelled"}, "table_id": {"$exists": True, "$ne": None}},
        {"_id": 0, "table_id": 1, "adults": 1, "children": 1},
    ).to_list(length=1000)
    usage: dict = {}
    for b in bookings:
        z = table_zone.get(b.get("table_id"))
        if not z:
            continue
        usage[z] = usage.get(z, 0) + int(b.get("adults") or 0) + int(b.get("children") or 0)
    return usage


async def _kaai_zone_guard(date: str, table_id: str, adults: int, children: int, exclude_booking_id: Optional[str] = None):
    """Raise HTTP 400 if assigning this booking would push the table's zone above its capacity."""
    table = await db.kaai_tables.find_one({"id": table_id}, {"_id": 0, "zone": 1})
    if not table:
        return  # caller handles 404
    zone_name = table.get("zone") or "Salle"
    zone = await db.kaai_zones.find_one({"name": zone_name}, {"_id": 0, "capacity": 1})
    if not zone:
        return  # no zone configured → no guard
    capacity = int(zone.get("capacity") or 0)
    if capacity <= 0:
        return
    # Current usage minus this booking if it already occupies a table in the same zone
    usage = await _kaai_zone_occupancy(date)
    current = usage.get(zone_name, 0)
    if exclude_booking_id:
        existing = await db.bookings.find_one(
            {"id": exclude_booking_id},
            {"_id": 0, "table_id": 1, "adults": 1, "children": 1},
        )
        if existing and existing.get("table_id"):
            t2 = await db.kaai_tables.find_one({"id": existing["table_id"]}, {"_id": 0, "zone": 1})
            if t2 and (t2.get("zone") == zone_name):
                current -= int(existing.get("adults") or 0) + int(existing.get("children") or 0)
                current = max(0, current)
    new_total = current + int(adults or 0) + int(children or 0)
    if new_total > capacity:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Capacité de la salle « {zone_name} » dépassée "
                f"({new_total}/{capacity} couverts pour le {date})."
            ),
        )


@api.get("/staff/kaai/tables")
async def list_kaai_tables(staff=Depends(get_current_staff)):
    await _require_role(staff, ["manager", "admin"])
    await _seed_default_kaai_zones()
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
    """Le Kaai bookings + table assignments + zones with capacity/occupation for a day."""
    await _require_role(staff, ["manager", "admin"])
    await _seed_default_kaai_zones()
    bookings = await db.bookings.find(
        {"offer_type": "le_kaai", "date": date, "status": {"$ne": "cancelled"}},
        {"_id": 0, "id": 1, "boat_time": 1, "adults": 1, "children": 1, "phone": 1, "email": 1,
         "participants": 1, "status": 1, "special_requests": 1, "table_id": 1, "paid_at": 1, "created_at": 1},
    ).sort("boat_time", 1).to_list(length=500)
    tables = await db.kaai_tables.find({}, {"_id": 0}).sort("number", 1).to_list(length=500)
    zones_raw = await db.kaai_zones.find({}, {"_id": 0}).sort("sort_order", 1).to_list(length=200)
    usage = await _kaai_zone_occupancy(date)
    zones = []
    for z in zones_raw:
        used = int(usage.get(z["name"], 0))
        cap = int(z.get("capacity") or 0)
        zones.append({
            **z,
            "used": used,
            "available": max(0, cap - used),
            "saturation_pct": round((used / cap * 100), 1) if cap else 0,
        })
    return {"date": date, "bookings": bookings, "tables": tables, "zones": zones}


@api.patch("/staff/kaai/bookings/{booking_id}/table")
async def assign_kaai_table(
    booking_id: str,
    table_id: Optional[str] = Body(None, embed=True),
    staff=Depends(get_current_staff),
):
    """Assign or unassign a table to a Le Kaai booking, enforcing zone capacity."""
    await _require_role(staff, ["manager", "admin"])
    booking = await db.bookings.find_one(
        {"id": booking_id, "offer_type": "le_kaai"},
        {"_id": 0, "offer_type": 1, "date": 1, "adults": 1, "children": 1, "table_id": 1},
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Le Kaai booking not found")
    if table_id:
        table = await db.kaai_tables.find_one({"id": table_id}, {"_id": 0, "capacity": 1, "status": 1})
        if not table:
            raise HTTPException(status_code=404, detail="Table not found")
        if table.get("status") == "indisponible":
            raise HTTPException(status_code=400, detail="Cette table est indisponible.")
        guests = int(booking.get("adults") or 0) + int(booking.get("children") or 0)
        if guests > int(table.get("capacity") or 0):
            raise HTTPException(
                status_code=400,
                detail=f"Capacité de la table dépassée ({guests} convives > {table.get('capacity')}).",
            )
        # Zone capacity guard (excludes the current booking if it was already on this zone)
        await _kaai_zone_guard(
            date=booking["date"],
            table_id=table_id,
            adults=int(booking.get("adults") or 0),
            children=int(booking.get("children") or 0),
            exclude_booking_id=booking_id,
        )
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


# ---------- Hébergement: history & stats ----------
def _heb_period_window(period: str):
    """Return (date_from_iso, date_to_iso, label) covering a period. Filters on check-in date.
    Periods: day, week, month, year, all. Bounds are inclusive."""
    today = datetime.now(timezone.utc).date()
    if period == "day":
        return today.isoformat(), today.isoformat(), "Aujourd'hui"
    if period == "week":
        return (today - timedelta(days=6)).isoformat(), today.isoformat(), "7 derniers jours"
    if period == "month":
        return (today - timedelta(days=29)).isoformat(), today.isoformat(), "30 derniers jours"
    if period == "year":
        return (today - timedelta(days=364)).isoformat(), today.isoformat(), "12 derniers mois"
    return "1970-01-01", "2999-12-31", "Depuis le lancement"


@api.get("/staff/hebergement/stats")
async def hebergement_stats(period: str = "month", staff=Depends(get_current_staff)):
    """Hébergement statistics over a period: occupancy, revenue, by tier, top guests, history."""
    await _require_role(staff, ["manager", "admin"])
    date_from, date_to, label = _heb_period_window(period)
    cursor = db.bookings.find(
        {
            "offer_type": "hebergement",
            "status": {"$ne": "cancelled"},
            "date": {"$gte": date_from, "$lte": date_to},
        },
        {"_id": 0, "id": 1, "date": 1, "checkout_date": 1, "nights": 1, "rooms": 1,
         "room_tier": 1, "room_tier_name": 1, "total_amount": 1, "paid_amount": 1,
         "balance_due": 1, "adults": 1, "children": 1, "participants": 1,
         "boat_time": 1, "return_boat_time": 1, "payment_method": 1, "deposit_pct": 1,
         "status": 1, "paid_at": 1, "created_at": 1, "phone": 1, "email": 1},
    )
    bookings = await cursor.to_list(length=2000)

    heb_offer = OFFERS.get("hebergement", {})
    tier_inventory = {t["id"]: int(t.get("inventory", 0)) for t in heb_offer.get("room_tiers", [])}
    tier_name_by_id = {t["id"]: t.get("name_fr", t["id"]) for t in heb_offer.get("room_tiers", [])}
    total_inventory = sum(tier_inventory.values())

    nights_sold = 0
    revenue_total = 0
    revenue_paid = 0
    balance_due_total = 0
    total_stays = len(bookings)
    by_tier_agg: dict = {tid: {"tier_id": tid, "tier_name": tier_name_by_id.get(tid, tid),
                                 "stays": 0, "rooms": 0, "nights": 0, "revenue": 0,
                                 "inventory": tier_inventory.get(tid, 0)} for tid in tier_inventory}
    # Per-day occupancy across the window
    try:
        d_from = datetime.strptime(date_from, "%Y-%m-%d").date()
        d_to = datetime.strptime(date_to, "%Y-%m-%d").date()
    except Exception:
        d_from = datetime.now(timezone.utc).date()
        d_to = d_from
    daily_nights: dict = {}
    daily_revenue: dict = {}
    cur = d_from
    while cur <= d_to:
        daily_nights[cur.isoformat()] = 0
        daily_revenue[cur.isoformat()] = 0
        cur += timedelta(days=1)
    days_in_window = max(1, (d_to - d_from).days + 1)
    # Top guests aggregation
    guest_agg: dict = {}
    for b in bookings:
        n = int(b.get("nights") or 0)
        r = int(b.get("rooms") or 1)
        room_nights = n * r
        nights_sold += room_nights
        amount = int(b.get("total_amount") or 0)
        paid = int(b.get("paid_amount") or 0)
        bal = int(b.get("balance_due") or 0)
        revenue_total += amount
        revenue_paid += paid
        balance_due_total += bal
        tid = b.get("room_tier") or "unknown"
        if tid in by_tier_agg:
            by_tier_agg[tid]["stays"] += 1
            by_tier_agg[tid]["rooms"] += r
            by_tier_agg[tid]["nights"] += room_nights
            by_tier_agg[tid]["revenue"] += amount
        # Daily occupancy: each night between arrival and checkout-1
        try:
            arr = datetime.strptime(b["date"], "%Y-%m-%d").date()
            chk = datetime.strptime(b.get("checkout_date") or b["date"], "%Y-%m-%d").date()
        except Exception:
            continue
        per_night_rev = (amount // n) if n > 0 else 0
        nd = arr
        while nd < chk:
            key = nd.isoformat()
            if key in daily_nights:
                daily_nights[key] += r
                daily_revenue[key] += per_night_rev
            nd += timedelta(days=1)
        # Guest
        primary = next((p for p in (b.get("participants") or []) if p.get("kind") == "adult"), None) or {}
        if primary:
            email = (primary.get("email") or b.get("email") or "").lower()
            if email:
                g = guest_agg.setdefault(email, {
                    "email": email,
                    "name": primary.get("name", ""),
                    "surname": primary.get("surname", ""),
                    "nationality": primary.get("nationality", ""),
                    "stays": 0,
                    "nights": 0,
                    "revenue": 0,
                })
                g["stays"] += 1
                g["nights"] += room_nights
                g["revenue"] += amount

    available_room_nights = total_inventory * days_in_window
    occupancy_rate = round((nights_sold / available_room_nights * 100), 1) if available_room_nights else 0
    avg_stay_nights = round((nights_sold / total_stays), 1) if total_stays else 0
    avg_revenue_per_stay = int(revenue_total / total_stays) if total_stays else 0
    avg_revenue_per_night = int(revenue_total / nights_sold) if nights_sold else 0

    by_tier = []
    for tid, agg in by_tier_agg.items():
        share = (agg["revenue"] / revenue_total * 100) if revenue_total else 0
        tier_available = agg["inventory"] * days_in_window
        tier_occ = round((agg["nights"] / tier_available * 100), 1) if tier_available else 0
        by_tier.append({**agg, "revenue_share_pct": round(share, 1), "occupancy_pct": tier_occ})
    by_tier.sort(key=lambda x: x["revenue"], reverse=True)

    daily_trend = [
        {"date": d, "nights": daily_nights[d], "revenue": daily_revenue[d]}
        for d in sorted(daily_nights.keys())
    ]
    top_guests = sorted(guest_agg.values(), key=lambda x: x["nights"], reverse=True)[:10]

    # History (most recent first, limited)
    history = sorted(bookings, key=lambda b: (b.get("date") or "", b.get("created_at") or ""), reverse=True)
    # Strip heavy fields for the history table
    history_lite = [
        {
            "id": b["id"],
            "date": b.get("date"),
            "checkout_date": b.get("checkout_date"),
            "nights": int(b.get("nights") or 0),
            "rooms": int(b.get("rooms") or 1),
            "room_tier": b.get("room_tier"),
            "room_tier_name": b.get("room_tier_name"),
            "adults": int(b.get("adults") or 0),
            "children": int(b.get("children") or 0),
            "total_amount": int(b.get("total_amount") or 0),
            "paid_amount": int(b.get("paid_amount") or 0),
            "balance_due": int(b.get("balance_due") or 0),
            "deposit_pct": b.get("deposit_pct"),
            "payment_method": b.get("payment_method"),
            "status": b.get("status"),
            "boat_time": b.get("boat_time"),
            "return_boat_time": b.get("return_boat_time"),
            "phone": b.get("phone"),
            "email": b.get("email"),
            "primary_name": (
                next((p for p in (b.get("participants") or []) if p.get("kind") == "adult"), None) or {}
            ).get("name", ""),
            "primary_surname": (
                next((p for p in (b.get("participants") or []) if p.get("kind") == "adult"), None) or {}
            ).get("surname", ""),
        }
        for b in history
    ]
    return {
        "period": period,
        "period_label": label,
        "date_from": date_from,
        "date_to": date_to,
        "days_in_window": days_in_window,
        "total_inventory": total_inventory,
        "tier_inventory": tier_inventory,
        "kpis": {
            "total_stays": total_stays,
            "nights_sold": nights_sold,
            "occupancy_rate_pct": occupancy_rate,
            "revenue_total": revenue_total,
            "revenue_paid": revenue_paid,
            "balance_due_total": balance_due_total,
            "avg_stay_nights": avg_stay_nights,
            "avg_revenue_per_stay": avg_revenue_per_stay,
            "avg_revenue_per_night": avg_revenue_per_night,
        },
        "by_tier": by_tier,
        "daily_trend": daily_trend,
        "top_guests": top_guests,
        "history": history_lite,
    }


@api.get("/staff/hebergement/report.pdf")
async def export_hebergement_pdf(period: str = "month", staff=Depends(get_current_staff)):
    """Stylized PDF report of Hébergement statistics for the selected period."""
    await _require_role(staff, ["manager", "admin"])
    data = await hebergement_stats(period=period, staff=staff)  # type: ignore

    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from fastapi.responses import StreamingResponse

    styles = _pdf_styles()
    GOLD, DARK, LIGHT, MUTED = styles["GOLD"], styles["DARK"], styles["LIGHT"], styles["MUTED"]
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm)
    elements = []
    elements.append(Paragraph("Boulay Beach Resort", styles["h1"]))
    elements.append(Paragraph(f"Rapport Hébergement — {data['period_label']} ({data['date_from']} → {data['date_to']})", styles["sub"]))

    k = data["kpis"]
    kpi_rows = [
        ["Séjours", "Nuitées vendues", "Taux d'occupation", "Revenu total"],
        [str(k["total_stays"]), str(k["nights_sold"]), f"{k['occupancy_rate_pct']}%", _format_xof(k["revenue_total"])],
    ]
    kpi_tbl = Table(kpi_rows, colWidths=[4.2 * cm, 4.2 * cm, 4.2 * cm, 4.2 * cm])
    kpi_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, 0), 7),
        ("TEXTCOLOR", (0, 0), (-1, 0), MUTED),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, 1), 12),
        ("TEXTCOLOR", (0, 1), (-1, 1), DARK),
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, GOLD),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E0D5B5")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(kpi_tbl)
    elements.append(Spacer(1, 0.2 * cm))
    sub_rows = [
        ["Séjour moyen", "Revenu / séjour", "Revenu / nuitée", "Encaissé / Solde dû"],
        [
            f"{k['avg_stay_nights']} nuits",
            _format_xof(k["avg_revenue_per_stay"]),
            _format_xof(k["avg_revenue_per_night"]),
            f"{_format_xof(k['revenue_paid'])} / {_format_xof(k['balance_due_total'])}",
        ],
    ]
    sub_tbl = Table(sub_rows, colWidths=[4.2 * cm, 4.2 * cm, 4.2 * cm, 4.2 * cm])
    sub_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, 0), 7),
        ("TEXTCOLOR", (0, 0), (-1, 0), MUTED),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, 1), 10),
        ("TEXTCOLOR", (0, 1), (-1, 1), DARK),
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, GOLD),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E0D5B5")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(sub_tbl)

    # By tier
    if data.get("by_tier"):
        elements.append(Paragraph("Répartition par catégorie", styles["h2"]))
        rows = [["Catégorie", "Séjours", "Nuitées", "Taux occ.", "Revenu", "Part"]]
        for t in data["by_tier"]:
            rows.append([
                t["tier_name"],
                str(t["stays"]),
                str(t["nights"]),
                f"{t['occupancy_pct']}%",
                _format_xof(t["revenue"]),
                f"{t['revenue_share_pct']}%",
            ])
        tbl = Table(rows, colWidths=[5 * cm, 2.2 * cm, 2.2 * cm, 2.2 * cm, 3.5 * cm, 1.8 * cm])
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

    # Top guests
    if data.get("top_guests"):
        elements.append(Paragraph("Top 10 clients (par nuitées)", styles["h2"]))
        rows = [["#", "Client", "Nationalité", "Séjours", "Nuitées", "Total dépensé"]]
        for i, g in enumerate(data["top_guests"], start=1):
            full = f"{g.get('surname','')} {g.get('name','')}".strip() or "—"
            rows.append([str(i), full, g.get("nationality") or "—", str(g["stays"]), str(g["nights"]), _format_xof(g["revenue"])])
        tbl = Table(rows, colWidths=[1 * cm, 4.5 * cm, 3.5 * cm, 2 * cm, 2 * cm, 3.5 * cm], repeatRows=1)
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

    # History (recent stays)
    if data.get("history"):
        elements.append(Paragraph("Historique des séjours", styles["h2"]))
        rows = [["Arrivée", "Départ", "Client", "Cat.", "Ch.", "Nuits", "Total", "Solde"]]
        for b in data["history"][:60]:
            full = f"{b.get('primary_surname','')} {b.get('primary_name','')}".strip() or "—"
            rows.append([
                b.get("date") or "—",
                b.get("checkout_date") or "—",
                full[:24],
                (b.get("room_tier_name") or "—")[:18],
                str(b.get("rooms") or 1),
                str(b.get("nights") or 0),
                _format_xof(b.get("total_amount") or 0),
                _format_xof(b.get("balance_due") or 0),
            ])
        tbl = Table(rows, colWidths=[2.1 * cm, 2.1 * cm, 4 * cm, 3 * cm, 1 * cm, 1.2 * cm, 2.8 * cm, 2.6 * cm], repeatRows=1)
        tbl.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 7.5),
            ("TEXTCOLOR", (0, 0), (-1, 0), GOLD),
            ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
            ("FONTSIZE", (0, 1), (-1, -1), 7.5),
            ("TEXTCOLOR", (0, 1), (-1, -1), DARK),
            ("ALIGN", (4, 0), (-1, -1), "RIGHT"),
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
    filename = f"bbr-hebergement-{period}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------- Staff-created bookings (manager+) ----------
class StaffBookingCreate(BaseModel):
    """Body for POST /staff/bookings — manager creates a booking on behalf of a guest."""
    offer_type: OfferType
    date: str
    checkout_date: Optional[str] = None
    room_tier: Optional[str] = None
    rooms: int = Field(default=1, ge=1, le=20)
    adults: int = Field(ge=0, le=20)
    children: int = Field(ge=0, le=20)
    boat_time: str
    return_boat_time: Optional[str] = None
    participants: List[Participant]
    special_requests: Optional[str] = ""
    # Payment: manager picks the method directly. For 'deposit', supply deposit_pct.
    payment_method: Literal["card", "mobile_money", "cash", "deposit"] = "cash"
    deposit_pct: Optional[Literal[10, 30, 70]] = None


@api.post("/staff/bookings")
async def staff_create_booking(body: StaffBookingCreate, staff=Depends(get_current_staff)):
    """Manager creates a confirmed booking + immediate payment, generating tickets + wallet."""
    await _require_role(staff, ["manager", "admin"])
    # Step 1: create booking (reuses public validator)
    payload = BookingCreate(
        offer_type=body.offer_type,
        date=body.date,
        checkout_date=body.checkout_date,
        room_tier=body.room_tier,
        rooms=body.rooms,
        adults=body.adults,
        children=body.children,
        boat_time=body.boat_time,
        return_boat_time=body.return_boat_time,
        participants=body.participants,
        special_requests=body.special_requests or "",
    )
    booking = await create_booking(payload)  # type: ignore
    # Mark as staff-created for audit/reporting
    await db.bookings.update_one(
        {"id": booking["id"]},
        {"$set": {"created_by_staff": True, "created_by_email": staff.get("email")}},
    )
    # Step 2: pay immediately with chosen method
    pay = PayBooking(
        reference_token=booking["reference_token"],
        payment_method=body.payment_method,
        deposit_pct=body.deposit_pct,
    )
    paid = await pay_booking(booking["id"], pay)  # type: ignore
    paid["created_by_staff"] = True
    paid["created_by_email"] = staff.get("email")
    return paid


# =================================================================
# MODULE RECEIPTS — Fiscal receipts (activities + bookings/events)
# =================================================================
# A receipt is created automatically whenever real money changes hands:
#   - Wallet activity charge        → source="activity"
#   - Booking paid (public/staff)   → source="booking"
#   - Event privatization paid      → source="event"
# Each receipt carries an HMAC signature derived from the immutable fields so
# the staff app can verify authenticity later (digital seal).

RECEIPT_SECRET = os.environ.get("RECEIPT_SECRET", JWT_SECRET)


async def _next_receipt_number() -> str:
    """Generate sequential daily receipt number BBR-YYYYMMDD-XXXXX (atomic counter)."""
    day = datetime.now(timezone.utc).date().isoformat().replace("-", "")
    counter = await db.counters.find_one_and_update(
        {"id": f"receipt-{day}"},
        {"$inc": {"value": 1}},
        upsert=True,
        return_document=True,
    )
    seq = (counter or {}).get("value") or 1
    return f"BBR-{day}-{seq:05d}"


def _sign_receipt(receipt: dict) -> str:
    """Compact HMAC-SHA256 signature over receipt id + total + source_id + issued_at."""
    import hmac as _hmac
    import hashlib as _hashlib
    msg = f"{receipt['id']}|{receipt['total']}|{receipt.get('source_id') or ''}|{receipt['issued_at']}".encode()
    digest = _hmac.new(RECEIPT_SECRET.encode(), msg, _hashlib.sha256).hexdigest()
    return digest[:16].upper()


async def _create_receipt(
    *,
    source: Literal["activity", "booking", "event"],
    source_id: str,
    customer_name: str,
    customer_email: str = "",
    customer_phone: str = "",
    lines: List[dict],
    payment_method: str,
    currency: str = "XOF",
    issued_by: str = "system",
    issued_by_role: str = "system",
    metadata: Optional[dict] = None,
):
    """Persist a fiscal receipt. Idempotent on (source, source_id, sub_id)."""
    sub_id = (metadata or {}).get("sub_id")
    # Idempotency: don't create twice for the same wallet charge / booking payment
    if sub_id:
        existing = await db.receipts.find_one({"source": source, "source_id": source_id, "metadata.sub_id": sub_id}, {"_id": 0})
        if existing:
            return existing
    elif source == "booking":
        existing = await db.receipts.find_one({"source": source, "source_id": source_id}, {"_id": 0})
        if existing:
            return existing
    subtotal = sum(int(ln.get("total", 0)) for ln in lines)
    rid = str(uuid.uuid4())
    issued_at = now_iso()
    receipt = {
        "id": rid,
        "receipt_number": await _next_receipt_number(),
        "source": source,
        "source_id": source_id,
        "customer_name": customer_name or "—",
        "customer_email": customer_email or "",
        "customer_phone": customer_phone or "",
        "lines": [
            {
                "description": str(ln.get("description", "")),
                "quantity": int(ln.get("quantity", 1)),
                "unit_price": int(ln.get("unit_price", 0)),
                "total": int(ln.get("total", 0)),
            }
            for ln in lines
        ],
        "subtotal": subtotal,
        "total": subtotal,
        "currency": currency,
        "payment_method": payment_method,
        "issued_at": issued_at,
        "issued_by": issued_by,
        "issued_by_role": issued_by_role,
        "metadata": metadata or {},
        "voided": False,
    }
    receipt["signature"] = _sign_receipt(receipt)
    await db.receipts.insert_one(dict(receipt))
    receipt.pop("_id", None)
    return receipt


@api.get("/staff/receipts")
async def list_receipts(
    source: Optional[Literal["activity", "booking", "event"]] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    q: Optional[str] = None,
    payment_method: Optional[str] = None,
    page: int = 1,
    page_size: int = 30,
    staff=Depends(get_current_staff),
):
    """List receipts. Manager+admin only."""
    await _require_role(staff, ["manager", "admin"])
    filter_q: dict = {"voided": {"$ne": True}}
    if source:
        filter_q["source"] = source
    if payment_method:
        filter_q["payment_method"] = payment_method
    if date_from or date_to:
        rng: dict = {}
        if date_from:
            rng["$gte"] = date_from
        if date_to:
            rng["$lte"] = date_to + "T23:59:59Z"
        filter_q["issued_at"] = rng
    if q:
        import re as _re
        rgx = _re.compile(_re.escape(q), _re.IGNORECASE)
        filter_q["$or"] = [
            {"receipt_number": rgx},
            {"customer_name": rgx},
            {"customer_email": rgx},
            {"customer_phone": rgx},
        ]
    page = max(1, page)
    page_size = max(1, min(100, page_size))
    total = await db.receipts.count_documents(filter_q)
    cursor = (
        db.receipts.find(filter_q, {"_id": 0})
        .sort("issued_at", -1)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    items = await cursor.to_list(length=page_size)
    # Aggregate totals per source for the current filter (informational footer)
    pipeline = [
        {"$match": filter_q},
        {"$group": {"_id": "$source", "count": {"$sum": 1}, "total": {"$sum": "$total"}}},
    ]
    by_source = {}
    async for row in db.receipts.aggregate(pipeline):
        by_source[row["_id"]] = {"count": row["count"], "total": int(row["total"])}
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
        "summary_by_source": by_source,
    }


@api.get("/staff/receipts/{receipt_id}.pdf")
async def export_receipt_pdf(receipt_id: str, staff=Depends(get_current_staff)):
    """Stylized fiscal receipt PDF (BBR header, line items, subtotal, total, signature)."""
    await _require_role(staff, ["manager", "admin"])
    receipt = await db.receipts.find_one({"id": receipt_id}, {"_id": 0})
    if not receipt:
        raise HTTPException(status_code=404, detail="Reçu introuvable")

    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from fastapi.responses import StreamingResponse

    styles = _pdf_styles()
    GOLD, DARK, LIGHT, MUTED = styles["GOLD"], styles["DARK"], styles["LIGHT"], styles["MUTED"]
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm)
    elements = []
    elements.append(Paragraph("Boulay Beach Resort", styles["h1"]))
    elements.append(Paragraph("Reçu de paiement", styles["sub"]))

    # Receipt meta block
    src_fr = {"activity": "Activité sur place", "booking": "Réservation", "event": "Privatisation / Événement"}.get(receipt["source"], receipt["source"])
    meta_rows = [
        ["N° de reçu", receipt["receipt_number"]],
        ["Date d'émission", receipt["issued_at"].replace("T", " à ").split(".")[0] + " UTC"],
        ["Type", src_fr],
        ["Client", receipt.get("customer_name") or "—"],
    ]
    if receipt.get("customer_email"):
        meta_rows.append(["Email", receipt["customer_email"]])
    if receipt.get("customer_phone"):
        meta_rows.append(["Téléphone", receipt["customer_phone"]])
    meta_rows.append(["Émis par", f"{receipt.get('issued_by','')} ({receipt.get('issued_by_role','')})"])
    meta_tbl = Table(meta_rows, colWidths=[4.5 * cm, 12 * cm])
    meta_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), MUTED),
        ("TEXTCOLOR", (1, 0), (1, -1), DARK),
        ("LINEBELOW", (0, 0), (-1, -1), 0.2, colors.HexColor("#EEE")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(meta_tbl)
    elements.append(Spacer(1, 0.4 * cm))

    # Line items
    lines_rows = [["Description", "Qté", "P.U.", "Total"]]
    for ln in receipt["lines"]:
        lines_rows.append([
            ln["description"],
            str(ln.get("quantity", 1)),
            _format_xof(ln.get("unit_price", 0)),
            _format_xof(ln.get("total", 0)),
        ])
    lines_tbl = Table(lines_rows, colWidths=[9 * cm, 1.8 * cm, 3 * cm, 3 * cm], repeatRows=1)
    lines_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("TEXTCOLOR", (0, 0), (-1, 0), GOLD),
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, GOLD),
        ("FONTSIZE", (0, 1), (-1, -1), 9.5),
        ("TEXTCOLOR", (0, 1), (-1, -1), DARK),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("LINEBELOW", (0, 1), (-1, -1), 0.2, colors.HexColor("#EEE")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(lines_tbl)
    elements.append(Spacer(1, 0.3 * cm))

    # Totals
    totals_rows = [
        ["Sous-total", _format_xof(receipt["subtotal"])],
        ["Total payé", _format_xof(receipt["total"])],
        ["Mode de paiement", PAYMENT_METHOD_FR_LABEL.get(receipt["payment_method"], receipt["payment_method"])],
    ]
    totals_tbl = Table(totals_rows, colWidths=[13 * cm, 3.8 * cm])
    totals_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica"),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("FONTSIZE", (0, 1), (-1, 1), 13),
        ("TEXTCOLOR", (0, 0), (0, -1), MUTED),
        ("TEXTCOLOR", (1, 0), (1, -1), DARK),
        ("TEXTCOLOR", (0, 1), (-1, 1), GOLD),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("LINEABOVE", (0, 1), (-1, 1), 0.5, GOLD),
        ("LINEBELOW", (0, 1), (-1, 1), 0.5, GOLD),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(totals_tbl)
    elements.append(Spacer(1, 0.8 * cm))

    # Digital seal
    seal = receipt.get("signature") or ""
    elements.append(Paragraph(
        f"<b>Signature numérique</b>&nbsp;·&nbsp; <font face='Courier'>{seal}</font>",
        styles["small"],
    ))
    elements.append(Paragraph(
        "Ce reçu fait foi du paiement. La signature numérique HMAC-SHA256 garantit son authenticité.",
        styles["small"],
    ))
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph(
        "Boulay Beach Resort · Abidjan, Côte d'Ivoire · contact@boulaybeach.ci",
        styles["small"],
    ))

    doc.build(elements, onFirstPage=_pdf_footer_factory(styles), onLaterPages=_pdf_footer_factory(styles))
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{receipt["receipt_number"]}.pdf"'},
    )


PAYMENT_METHOD_FR_LABEL = {
    "card": "Carte bancaire",
    "fineo": "Carte bancaire",
    "mobile_money": "Mobile Money",
    "cash": "Espèces",
    "deposit": "Acompte (carte)",
    "on_site": "Sur place",
    "transfer": "Virement",
}


@api.get("/staff/receipts/{receipt_id}")
async def get_receipt(receipt_id: str, staff=Depends(get_current_staff)):
    await _require_role(staff, ["manager", "admin"])
    receipt = await db.receipts.find_one({"id": receipt_id}, {"_id": 0})
    if not receipt:
        raise HTTPException(status_code=404, detail="Reçu introuvable")
    return receipt


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


class EventPayment(BaseModel):
    amount: int = Field(ge=1, le=100_000_000)
    payment_method: Literal["card", "mobile_money", "cash", "transfer"] = "cash"
    description: Optional[str] = None


@api.post("/staff/loisirs/events/{event_id}/payment")
async def register_event_payment(event_id: str, body: EventPayment, staff=Depends(get_current_staff)):
    """Register a payment for a privatization request and emit a fiscal receipt."""
    await _require_role(staff, ["manager", "admin"])
    event = await db.event_requests.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    description = body.description or f"Privatisation — {event.get('event_type','Événement')} du {event.get('event_date','')}"
    receipt = await _create_receipt(
        source="event",
        source_id=event_id,
        customer_name=f"{event.get('surname','')} {event.get('name','')}".strip() or "—",
        customer_email=event.get("email", ""),
        customer_phone=event.get("phone", ""),
        lines=[{"description": description, "quantity": 1, "unit_price": int(body.amount), "total": int(body.amount)}],
        payment_method=body.payment_method,
        issued_by=staff.get("name") or "",
        issued_by_role=staff.get("role") or "",
        metadata={
            "event_type": event.get("event_type"),
            "event_date": event.get("event_date"),
            "guest_count": event.get("guest_count"),
            "sub_id": str(uuid.uuid4()),  # allow multiple payments per event (e.g. acompte then solde)
        },
    )
    # Append payment to event for audit/history
    await db.event_requests.update_one(
        {"id": event_id},
        {
            "$push": {"payments": {
                "id": receipt["id"],
                "receipt_number": receipt["receipt_number"],
                "amount": int(body.amount),
                "payment_method": body.payment_method,
                "paid_at": receipt["issued_at"],
                "paid_by": staff.get("email") or "",
            }},
            "$inc": {"total_paid": int(body.amount)},
        },
    )
    return {"ok": True, "receipt": receipt}


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


@app.on_event("startup")
async def backfill_booking_poles():
    """One-shot retroactive migration: every booking without a `pole` field gets one
    derived from its offer_type. Re-runs are cheap (it filters on missing/empty pole)."""
    try:
        updated = 0
        for offer_id, pole_id in OFFER_TO_POLE.items():
            res = await db.bookings.update_many(
                {"offer_type": offer_id, "$or": [{"pole": {"$exists": False}}, {"pole": ""}, {"pole": None}]},
                {"$set": {"pole": pole_id}},
            )
            updated += res.modified_count
        if updated:
            logging.info("Backfilled `pole` field on %d existing bookings", updated)
    except Exception as e:
        logging.warning("Pole backfill failed: %s", e)



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
