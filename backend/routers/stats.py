"""
Advanced stats router — extracted from server.py during the iter-24 refactor.

Owns: GET /staff/stats/advanced

Computes YoY revenue, booking funnel, average lead time, top nationalities,
average party size per offer, weekday distribution, Hébergement occupancy
rate, and fleet fuel consumption.

Read-only — no mutation. Safe to extract first as a refactor proof-of-concept.
"""
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException


def build_router(db, get_current_staff, require_role, OFFERS) -> APIRouter:
    """Build the stats router.

    Injected dependencies:
      - db: motor AsyncIOMotorDatabase
      - get_current_staff: FastAPI Depends function returning the auth'd staff
      - require_role: async fn(staff, roles) → raise 403 if missing
      - OFFERS: dict of offer_id → offer config (used for hébergement inventory)
    """
    r = APIRouter()

    @r.get("/staff/stats/advanced")
    async def stats_advanced(year: Optional[int] = None, staff=Depends(get_current_staff)):
        """Advanced statistics for the back-office: YoY comparison, booking funnel,
        average lead time, top nationalities, average party size, weekday distribution,
        Hébergement occupancy rate, fleet fuel consumption."""
        await require_role(staff, ["manager", "admin"])
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

        cur_rev, _cur_count = _agg_yoy(cur)
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

        funnel: dict = {"pending": 0, "confirmed": 0, "arrived": 0, "completed": 0, "cancelled": 0}
        for b in cur:
            st = b.get("status", "pending")
            if st in funnel:
                funnel[st] += 1

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

        party_by_offer: dict = {}
        for b in cur:
            if b.get("status") == "cancelled":
                continue
            oid = b.get("offer_type", "unknown")
            party_by_offer.setdefault(oid, {"offer_id": oid, "offer_name": b.get("offer_name", oid),
                                            "total_guests": 0, "bookings": 0})
            party_by_offer[oid]["total_guests"] += int(b.get("adults", 0)) + int(b.get("children", 0))
            party_by_offer[oid]["bookings"] += 1
        party_size = [
            {"offer_id": k, "offer_name": v["offer_name"],
             "avg_party_size": round(v["total_guests"] / v["bookings"], 1) if v["bookings"] else 0,
             "bookings": v["bookings"]}
            for k, v in party_by_offer.items()
        ]

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
        end_of_year = datetime.strptime(f"{target_year}-12-31", "%Y-%m-%d").date()
        days_elapsed = min((today - datetime.strptime(year_from, "%Y-%m-%d").date()).days + 1, 365)
        if today > end_of_year:
            days_elapsed = 365
        elif today.year < target_year:
            days_elapsed = 0
        available_nights = total_inventory * max(days_elapsed, 1)
        occupancy_rate = round((nights_sold / available_nights * 100), 1) if available_nights > 0 else 0

        boats = await db.bateaux.find(
            {}, {"_id": 0, "id": 1, "name": 1, "capacity": 1, "fuel_litres_per_trip": 1, "status": 1},
        ).to_list(length=200)
        completed_pipeline = [
            {"$match": {"status": "terminé", "date": {"$gte": year_from, "$lt": year_to}}},
            {"$group": {
                "_id": "$bateau_id",
                "trips_completed": {"$sum": 1},
                "trips_aller": {"$sum": {"$cond": [{"$eq": ["$direction", "aller"]}, 1, 0]}},
                "trips_retour": {"$sum": {"$cond": [{"$eq": ["$direction", "retour"]}, 1, 0]}},
            }},
        ]
        by_boat = {r["_id"]: r async for r in db.traversees.aggregate(completed_pipeline)}
        fleet_stats = []
        total_litres = 0
        total_trips = 0
        for b in boats:
            stats = by_boat.get(b["id"], {})
            trips = int(stats.get("trips_completed", 0))
            litres_per = int(b.get("fuel_litres_per_trip") or 0)
            litres = trips * litres_per
            total_litres += litres
            total_trips += trips
            fleet_stats.append({
                "id": b["id"],
                "name": b["name"],
                "capacity": b.get("capacity", 0),
                "status": b.get("status", "actif"),
                "fuel_litres_per_trip": litres_per,
                "trips_completed": trips,
                "trips_aller": int(stats.get("trips_aller", 0)),
                "trips_retour": int(stats.get("trips_retour", 0)),
                "fuel_litres_total": litres,
            })
        fleet_stats.sort(key=lambda x: x["fuel_litres_total"], reverse=True)

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
            "fleet": {
                "boats": fleet_stats,
                "total_trips": total_trips,
                "total_litres": total_litres,
            },
        }

    return r
