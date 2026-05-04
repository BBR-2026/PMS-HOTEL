"""Boulay Beach Resort - Reservation API"""
import os
import io
import uuid
import base64
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta, date as date_type
from typing import List, Optional, Literal

import jwt
import qrcode
import bcrypt
from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, EmailStr

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

# Fixed offer catalog
OFFERS = {
    "pass_day": {
        "id": "pass_day",
        "name_fr": "Pass Day",
        "name_en": "Pass Day",
        "tagline_fr": "L'expérience plage signature, du lever au coucher du soleil.",
        "tagline_en": "The signature beach experience, from sunrise to sunset.",
        "price_adult": 50000,
        "price_child": 25000,
        "max_capacity": 80,
    },
    "sunset": {
        "id": "sunset",
        "name_fr": "The Sunset",
        "name_en": "The Sunset",
        "tagline_fr": "Cocktails dorés et horizon flamboyant à l'heure magique.",
        "tagline_en": "Golden cocktails and a flaming horizon at the magic hour.",
        "price_adult": 60000,
        "price_child": 30000,
        "max_capacity": 60,
    },
    "brunch": {
        "id": "brunch",
        "name_fr": "The Brunch",
        "name_en": "The Brunch",
        "tagline_fr": "Un dimanche d'exception entre océan et gastronomie.",
        "tagline_en": "An exceptional Sunday between ocean and gastronomy.",
        "price_adult": 60000,
        "price_child": 30000,
        "max_capacity": 50,
    },
}

OfferType = Literal["pass_day", "sunset", "brunch"]
BookingStatus = Literal["pending", "confirmed", "arrived", "completed", "cancelled"]

# ----- Models -----
class ClientRegister(BaseModel):
    name: str
    surname: str
    phone: str
    email: EmailStr
    password: str

class ClientLogin(BaseModel):
    email: EmailStr
    password: str

class StaffLogin(BaseModel):
    email: EmailStr
    password: str

class ClientPublic(BaseModel):
    id: str
    name: str
    surname: str
    phone: str
    email: EmailStr

class StaffPublic(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: Literal["admin", "manager", "receptionist"]

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class BookingCreate(BaseModel):
    offer_type: OfferType
    date: str  # ISO YYYY-MM-DD
    adults: int = Field(ge=1, le=20)
    children: int = Field(ge=0, le=20)
    special_requests: Optional[str] = ""

class Booking(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    client_id: str
    offer_type: OfferType
    offer_name: str
    date: str
    adults: int
    children: int
    total_amount: int
    status: BookingStatus
    qr_code: Optional[str] = None  # data URL
    qr_token: str
    special_requests: Optional[str] = ""
    created_at: str
    paid_at: Optional[str] = None
    client_snapshot: Optional[dict] = None

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

def make_qr(payload: str) -> str:
    img = qrcode.make(payload)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

bearer = HTTPBearer(auto_error=False)

async def get_current_client(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    if not creds:
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = decode_token(creds.credentials)
    if payload.get("type") != "client":
        raise HTTPException(status_code=403, detail="Client account required")
    user = await db.clients.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

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

# ----- Auth: Clients -----
@api.post("/auth/client/register", response_model=TokenResponse)
async def register_client(body: ClientRegister):
    existing = await db.clients.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    cid = str(uuid.uuid4())
    doc = {
        "id": cid,
        "name": body.name.strip(),
        "surname": body.surname.strip(),
        "phone": body.phone.strip(),
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "created_at": now_iso(),
    }
    await db.clients.insert_one(doc)
    token = create_token({"sub": cid, "type": "client", "email": doc["email"]})
    public = {k: doc[k] for k in ["id", "name", "surname", "phone", "email"]}
    return TokenResponse(access_token=token, user=public)

@api.post("/auth/client/login", response_model=TokenResponse)
async def login_client(body: ClientLogin):
    user = await db.clients.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token({"sub": user["id"], "type": "client", "email": user["email"]})
    public = {k: user[k] for k in ["id", "name", "surname", "phone", "email"]}
    return TokenResponse(access_token=token, user=public)

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_client)):
    return user

# ----- Auth: Staff -----
@api.post("/auth/staff/login", response_model=TokenResponse)
async def login_staff(body: StaffLogin):
    user = await db.staff.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token({"sub": user["id"], "type": "staff", "role": user["role"]})
    public = {"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]}
    return TokenResponse(access_token=token, user=public)

# ----- Offers -----
@api.get("/offers")
async def list_offers():
    return list(OFFERS.values())

@api.get("/offers/{offer_id}")
async def get_offer(offer_id: str):
    if offer_id not in OFFERS:
        raise HTTPException(status_code=404, detail="Offer not found")
    return OFFERS[offer_id]

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
    return {"offer_id": offer_id, "date": when, "max_capacity": max_cap, "booked": booked, "remaining": max(max_cap - booked, 0)}

# ----- Bookings -----
@api.post("/bookings")
async def create_booking(body: BookingCreate, user: dict = Depends(get_current_client)):
    if body.offer_type not in OFFERS:
        raise HTTPException(status_code=400, detail="Invalid offer")
    offer = OFFERS[body.offer_type]
    # validate date
    try:
        booking_date = datetime.strptime(body.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format (YYYY-MM-DD)")
    if booking_date < datetime.now(timezone.utc).date():
        raise HTTPException(status_code=400, detail="Date must be in the future")

    total_guests = body.adults + body.children
    if total_guests <= 0:
        raise HTTPException(status_code=400, detail="At least one guest required")

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
    qr_token = uuid.uuid4().hex
    total = body.adults * offer["price_adult"] + body.children * offer["price_child"]
    doc = {
        "id": bid,
        "client_id": user["id"],
        "offer_type": body.offer_type,
        "offer_name": offer["name_fr"],
        "date": body.date,
        "adults": body.adults,
        "children": body.children,
        "total_amount": total,
        "status": "pending",
        "qr_code": None,
        "qr_token": qr_token,
        "special_requests": body.special_requests or "",
        "created_at": now_iso(),
        "paid_at": None,
        "client_snapshot": {
            "name": user["name"], "surname": user["surname"],
            "phone": user["phone"], "email": user["email"],
        },
    }
    await db.bookings.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.post("/bookings/{booking_id}/pay")
async def pay_booking(booking_id: str, user: dict = Depends(get_current_client)):
    """FINEO placeholder - mark booking confirmed and generate QR."""
    booking = await db.bookings.find_one({"id": booking_id, "client_id": user["id"]}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["status"] not in ("pending", "confirmed"):
        raise HTTPException(status_code=400, detail="Booking cannot be paid in current state")

    qr_payload = f"BBR|{booking['id']}|{booking['qr_token']}"
    qr_data_url = make_qr(qr_payload)
    paid_at = now_iso()
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": "confirmed", "qr_code": qr_data_url, "paid_at": paid_at}},
    )
    booking["status"] = "confirmed"
    booking["qr_code"] = qr_data_url
    booking["paid_at"] = paid_at
    return booking

@api.get("/bookings/me")
async def my_bookings(user: dict = Depends(get_current_client)):
    cursor = db.bookings.find({"client_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(500)

@api.get("/bookings/{booking_id}")
async def get_booking(booking_id: str, user: dict = Depends(get_current_client)):
    booking = await db.bookings.find_one({"id": booking_id, "client_id": user["id"]}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking

@api.delete("/bookings/{booking_id}")
async def cancel_booking(booking_id: str, user: dict = Depends(get_current_client)):
    booking = await db.bookings.find_one({"id": booking_id, "client_id": user["id"]}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["status"] in ("arrived", "completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Booking cannot be cancelled")
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": "cancelled", "cancelled_at": now_iso()}},
    )
    return {"id": booking_id, "status": "cancelled"}

# ----- Event privatization -----
@api.post("/events/privatization")
async def event_privatization(body: EventPrivatization):
    eid = str(uuid.uuid4())
    doc = body.model_dump()
    doc.update({"id": eid, "status": "new", "created_at": now_iso()})
    await db.event_requests.insert_one(doc)
    doc.pop("_id", None)
    return doc

# ----- Startup: seed staff -----
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
logger = logging.getLogger(__name__)
