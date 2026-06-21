from fastapi import APIRouter, HTTPException

from schemas.event_schema import EventCreate, EventActionUpdate

from services.event_service import (
    create_event,
    get_all_events,
    get_pending_events,
    get_active_events,
    get_closed_events,
    get_event_by_id,
    approve_event,
    close_event,
    delete_event,
    get_similar_events
)


router = APIRouter(
    prefix="/api/events",
    tags=["Events"]
)


@router.post("/")
async def report_event(event: EventCreate):
    try:
        data = await create_event(event)

        return {
            "success": True,
            "message": "Event reported successfully",
            "data": data
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.get("/")
async def fetch_all_events():
    events = await get_all_events()

    return {
        "success": True,
        "count": len(events),
        "data": events
    }


@router.get("/pending")
async def fetch_pending_events():
    events = await get_pending_events()

    return {
        "success": True,
        "count": len(events),
        "data": events
    }


@router.get("/active")
async def fetch_active_events():
    events = await get_active_events()

    return {
        "success": True,
        "count": len(events),
        "data": events
    }


@router.get("/closed")
async def fetch_closed_events():
    events = await get_closed_events()

    return {
        "success": True,
        "count": len(events),
        "data": events
    }


@router.get("/{event_id}")
async def fetch_single_event(event_id: str):
    event = await get_event_by_id(event_id)

    if not event:
        raise HTTPException(
            status_code=404,
            detail="Event not found"
        )

    return {
        "success": True,
        "data": event
    }


@router.patch("/{event_id}/approve")
async def approve_reported_event(
    event_id: str,
    action_data: EventActionUpdate
):
    event = await approve_event(
        event_id=event_id,
        final_action=action_data.final_action,
        action_plan=action_data.action_plan
    )

    if not event:
        raise HTTPException(
            status_code=404,
            detail="Event not found"
        )

    return {
        "success": True,
        "message": "Event approved and activated",
        "data": event
    }


@router.patch("/{event_id}/close")
async def close_reported_event(event_id: str):
    event = await close_event(event_id)

    if not event:
        raise HTTPException(
            status_code=404,
            detail="Event not found"
        )

    return {
        "success": True,
        "message": "Event closed successfully",
        "data": event
    }


@router.delete("/{event_id}")
async def remove_event(event_id: str):
    deleted = await delete_event(event_id)

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail="Event not found"
        )

    return {
        "success": True,
        "message": "Event deleted successfully"
    }


@router.get("/{event_id}/similar")
async def fetch_similar_events(event_id: str):
    similar = await get_similar_events(event_id)

    if similar is None:
        raise HTTPException(
            status_code=404,
            detail="Event not found"
        )

    return {
        "success": True,
        "count": len(similar),
        "data": similar
    }