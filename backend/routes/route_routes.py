from fastapi import APIRouter, HTTPException
import networkx as nx

from core.database import events_collection
from schemas.route_schema import RouteRequest
from services.routing_service import compute_route_from_places


router = APIRouter(prefix="/api", tags=["Routing"])


@router.post("/route")
async def calculate_route(payload: RouteRequest):
    try:
        active_events = []
        cursor = events_collection.find({"status": "ACTIVE", "final_action": "FULL_BLOCK"})
        async for event in cursor:
            active_events.append(event)

        route_data = compute_route_from_places(
            source_place=payload.source_place,
            dest_place=payload.dest_place,
            active_events=active_events,
        )

        return {
            "success": True,
            "message": "Route calculated with active road blocks applied",
            "data": route_data,
        }
    except nx.NetworkXNoPath:
        raise HTTPException(status_code=404, detail="No route found after applying active road blocks")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
