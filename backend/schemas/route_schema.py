from pydantic import BaseModel, Field


class RouteRequest(BaseModel):
    source_place: str = Field(..., example="Majestic Bengaluru")
    dest_place: str = Field(..., example="Koramangala Bengaluru")
