"""
Scanner History router — extracted from server.py during iter-25 refactor.

Owns: GET /staff/checkins/history

Returns the flat list of all embarkation scans across every booking, with
filters (date / range / direction / boat / offer_type / search) + per-boat
summary aggregation.

Pure read-only — safe to extract first from the broader scanner family.

The remaining scanner endpoints (`/staff/scan/{token}` + `/checkin` + `/charge`
+ `/scan/override`) involve `_resolve_qr_token`, wallet integration, OFFERS
and `make_qr` — they will be moved in a follow-up extraction along with the
helper functions.
"""
from typing import Optional, List, Literal
from fastapi import APIRouter, Depends


def build_router(db, get_current_staff, require_role) -> APIRouter:
    r = APIRouter()

    @r.get("/staff/checkins/history")
    async def checkins_history(
        date: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        boat_time: Optional[str] = None,
        direction: Optional[Literal["aller", "retour"]] = None,
        offer_type: Optional[str] = None,
        q: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
        staff=Depends(get_current_staff),
    ):
        """Flat history of embarkation scans across all bookings.

        Filters: single `date`, `date_from`..`date_to` range, `boat_time`,
        `direction` (aller/retour), `offer_type` (booking offer filter),
        free text `q` (matches participant / staff / skipper name). Sorted
        by scan timestamp DESC.
        """
        await require_role(staff, [
            "admin", "manager", "manager_pole", "management_general",
            "receptionist", "hotesse", "logistique", "verification",
        ])
        match: dict = {"qr_codes.scans": {"$exists": True, "$ne": []}}
        if offer_type:
            match["offer_type"] = offer_type
        pipeline: List[dict] = [
            {"$match": match},
            {"$project": {"_id": 0, "id": 1, "offer_name": 1, "offer_type": 1,
                          "qr_codes": 1, "phone": 1, "email": 1}},
            {"$unwind": "$qr_codes"},
            {"$match": {"qr_codes.scans": {"$exists": True, "$ne": []}}},
            {"$unwind": "$qr_codes.scans"},
            {"$project": {
                "booking_id": "$id",
                "offer_name": "$offer_name",
                "offer_type": "$offer_type",
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
            rng: dict = {}
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

        count_pipe = pipeline + [{"$count": "n"}]
        counts = [r async for r in db.bookings.aggregate(count_pipe)]
        total = counts[0]["n"] if counts else 0

        page = max(1, page)
        page_size = max(1, min(200, page_size))
        pipeline.append({"$skip": (page - 1) * page_size})
        pipeline.append({"$limit": page_size})
        items = [r async for r in db.bookings.aggregate(pipeline)]

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

    return r
