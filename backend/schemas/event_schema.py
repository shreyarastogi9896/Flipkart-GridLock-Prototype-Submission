from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


class EventCreate(BaseModel):
    location: str = Field(..., example="PVS Meerut")
    description: str = Field(..., example="Truck overturned near PVS, heavy traffic congestion")
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    zone: Optional[str] = "Unknown"
    junction: Optional[str] = "Unknown"
    police_station: Optional[str] = "Unknown"


class EventActionUpdate(BaseModel):
    final_action: str = Field(..., example="PARTIAL_BLOCK")
    action_plan: Optional[str] = Field(None, example="Deploy two traffic police officers and one tow truck. Divert heavy vehicles temporarily.")


class EventResponse(BaseModel):
    id: str
    location: str
    description: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    zone: Optional[str] = "Unknown"
    junction: Optional[str] = "Unknown"
    police_station: Optional[str] = "Unknown"
    parsed: Dict[str, Any]
    road_block_required: bool
    road_block_probability: float
    historical_intelligence: Dict[str, Any]
    severity_score: float
    recommendation: Dict[str, Any] = {}
    final_action: Optional[str] = None
    action_plan: Optional[str] = None
    status: str
    reported_at: datetime
    approved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    updated_at: datetime
