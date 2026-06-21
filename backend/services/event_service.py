from datetime import datetime
from bson import ObjectId
from services.recommendation_service import generate_recommendation
from core.database import events_collection

from services.parser_service import parse_event_with_genai
from services.ml_service import analyze_event, find_similar_incidents
from services.routing_service import create_block_record, geocode_place


def serialize_event(event: dict) -> dict:
    return {
        "id": str(event["_id"]),

        "location": event.get("location"),
        "description": event.get("description"),

        "latitude": event.get("latitude"),
        "longitude": event.get("longitude"),

        "zone": event.get("zone"),
        "junction": event.get("junction"),
        "police_station": event.get("police_station"),

        "parsed": event.get("parsed", {}),

        "road_block_required": event.get("road_block_required", False),
        "road_block_probability": event.get("road_block_probability", 0.0),

        "historical_intelligence": event.get("historical_intelligence", {}),

        "severity_score": event.get("severity_score", 0.0),

        "final_action": event.get("final_action"),
        "action_plan": event.get("action_plan"),
        "status": event.get("status"),

        "reported_at": event.get("reported_at"),
        "approved_at": event.get("approved_at"),
        "closed_at": event.get("closed_at"),
        "updated_at": event.get("updated_at"),
        "recommendation": event.get("recommendation", {}),
        "blocked_edge": event.get("blocked_edge"),
        "blocked_nodes": event.get("blocked_nodes", []),
        "blocked_edge_geometry": event.get("blocked_edge_geometry", []),
        "is_blocking_route": event.get("is_blocking_route", False),
        "route_block_error": event.get("route_block_error"),
    }


async def create_event(data):
    now = datetime.utcnow()

    latitude = data.latitude
    longitude = data.longitude

    if latitude is None or longitude is None:
        geo = geocode_place(data.location)
        latitude = geo["lat"]
        longitude = geo["lng"]

    parsed = await parse_event_with_genai(data.description)

    analysis = analyze_event(
    parsed=parsed,
    latitude=latitude,
    longitude=longitude,
    zone=data.zone,
    junction=data.junction,
    police_station=data.police_station,
    reported_at=now
)
    recommendation = await generate_recommendation(
    parsed=parsed,
    road_block_probability=analysis["road_closure_prediction"]["road_block_probability"],
    severity_score=analysis["severity_score"],
    historical_intelligence=analysis["historical_intelligence"]
)
    event_doc = {
        "location": data.location,
        "description": data.description,

        "latitude": latitude,
        "longitude": longitude,

        "zone": data.zone,
        "junction": data.junction,
        "police_station": data.police_station,

        "parsed": parsed,

        "road_block_required": analysis["road_closure_prediction"]["road_block_required"],
        "road_block_probability": analysis["road_closure_prediction"]["road_block_probability"],

        "historical_intelligence": analysis["historical_intelligence"],

        "severity_score": analysis["severity_score"],

        "final_action": None,
        "status": "PENDING",
        "recommendation": recommendation,

        "reported_at": now,
        "approved_at": None,
        "closed_at": None,
        "updated_at": now
    }

    result = await events_collection.insert_one(event_doc)

    saved_event = await events_collection.find_one(
        {"_id": result.inserted_id}
    )

    return serialize_event(saved_event)


async def get_all_events():
    events = []

    cursor = events_collection.find().sort("reported_at", -1)

    async for event in cursor:
        events.append(serialize_event(event))

    return events


async def get_pending_events():
    events = []

    cursor = events_collection.find(
        {"status": "PENDING"}
    ).sort("reported_at", -1)

    async for event in cursor:
        events.append(serialize_event(event))

    return events


async def get_active_events():
    events = []

    cursor = events_collection.find(
        {"status": "ACTIVE"}
    ).sort("reported_at", -1)

    async for event in cursor:
        events.append(serialize_event(event))

    return events


async def get_closed_events():
    events = []

    cursor = events_collection.find(
        {"status": "CLOSED"}
    ).sort("reported_at", -1)

    async for event in cursor:
        events.append(serialize_event(event))

    return events


async def get_event_by_id(event_id: str):
    if not ObjectId.is_valid(event_id):
        return None

    event = await events_collection.find_one(
        {"_id": ObjectId(event_id)}
    )

    if not event:
        return None

    return serialize_event(event)


async def approve_event(event_id: str, final_action: str, action_plan: str | None = None):
    if not ObjectId.is_valid(event_id):
        return None

    now = datetime.utcnow()
    event_object_id = ObjectId(event_id)
    event = await events_collection.find_one({"_id": event_object_id})

    if not event:
        return None

    update_data = {
        "status": "ACTIVE",
        "final_action": final_action,
        "action_plan": action_plan,
        "approved_at": now,
        "updated_at": now,
    }

    # For real diversion, only FULL_BLOCK events become route-blocking road edges.
    if final_action == "FULL_BLOCK" and event.get("latitude") is not None and event.get("longitude") is not None:
        try:
            block_record = create_block_record(
                latitude=float(event["latitude"]),
                longitude=float(event["longitude"]),
            )
            update_data.update(block_record)
            update_data["route_block_error"] = None
        except Exception as exc:
            # Do not fail police approval if OSM is temporarily unavailable.
            update_data.update({
                "is_blocking_route": False,
                "blocked_edge": None,
                "blocked_nodes": [],
                "blocked_edge_geometry": [],
                "route_block_error": str(exc),
            })
    else:
        update_data.update({
            "is_blocking_route": False,
            "blocked_edge": None,
            "blocked_nodes": [],
            "blocked_edge_geometry": [],
            "route_block_error": None,
        })

    result = await events_collection.update_one(
        {"_id": event_object_id},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        return None

    updated_event = await events_collection.find_one({"_id": event_object_id})

    return serialize_event(updated_event)


async def close_event(event_id: str):
    if not ObjectId.is_valid(event_id):
        return None

    now = datetime.utcnow()

    result = await events_collection.update_one(
        {"_id": ObjectId(event_id)},
        {
            "$set": {
                "status": "CLOSED",
                "closed_at": now,
                "updated_at": now
            }
        }
    )

    if result.matched_count == 0:
        return None

    event = await events_collection.find_one(
        {"_id": ObjectId(event_id)}
    )

    return serialize_event(event)


async def delete_event(event_id: str):
    if not ObjectId.is_valid(event_id):
        return False

    result = await events_collection.delete_one(
        {"_id": ObjectId(event_id)}
    )

    return result.deleted_count == 1


async def get_similar_events(event_id: str):
    event = await get_event_by_id(event_id)

    if not event:
        return None

    parsed = event.get("parsed", {})

    event_cause = (
        parsed.get("event_cause")
        or parsed.get("event_type")
        or "Unknown"
    )

    similar = find_similar_incidents(
        event_cause=event_cause,
        latitude=event.get("latitude"),
        longitude=event.get("longitude"),
        limit=5
    )

    return similar