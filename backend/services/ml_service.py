import os
import math
import joblib
import pandas as pd
from datetime import datetime


BASE_DIR = os.path.dirname(os.path.dirname(__file__))
ML_DIR = os.path.join(BASE_DIR, "ml")


road_closure_model = joblib.load(
    os.path.join(ML_DIR, "road_closure_model.pkl")
)

encoders = joblib.load(
    os.path.join(ML_DIR, "encoders.pkl")
)

closure_rate_lookup = joblib.load(
    os.path.join(ML_DIR, "closure_rate_lookup.pkl")
)


event_intelligence_df = pd.read_csv(
    os.path.join(ML_DIR, "event_intelligence.csv")
)

zone_junction_df = pd.read_csv(
    os.path.join(ML_DIR, "zone_junction_intelligence.csv")
)

nearby_incidents_df = pd.read_csv(
    os.path.join(ML_DIR, "nearby_incidents.csv")
)


FEATURES = [
    "event_cause",
    "historical_closure_rate",
    "latitude",
    "longitude",
    "zone",
    "junction",
    "police_station",
    "veh_type",
    "hour",
    "month",
    "day_of_week",
    "weekend"
]


def safe_label_encode(column_name: str, value: str) -> int:
    encoder = encoders[column_name]

    value = str(value) if value else "Unknown"

    if value in encoder.classes_:
        return int(encoder.transform([value])[0])

    if "Unknown" in encoder.classes_:
        return int(encoder.transform(["Unknown"])[0])

    return 0


def urgency_to_score(urgency: str) -> float:
    return {
        "low": 0.20,
        "medium": 0.45,
        "high": 0.70,
        "immediate": 0.95
    }.get(urgency, 0.20)


def blockage_to_score(blockage: str) -> float:
    return {
        "none": 0.10,
        "partial": 0.60,
        "full": 0.90
    }.get(blockage, 0.10)


def traffic_to_score(traffic: str) -> float:
    return {
        "normal": 0.10,
        "moderate": 0.45,
        "heavy": 0.75
    }.get(traffic, 0.10)


def predict_road_closure(
    event_cause: str,
    veh_type: str,
    latitude: float | None,
    longitude: float | None,
    zone: str = "Unknown",
    junction: str = "Unknown",
    police_station: str = "Unknown",
    reported_at: datetime | None = None
) -> dict:

    if reported_at is None:
        reported_at = datetime.utcnow()

    event_cause = event_cause or "Unknown"
    veh_type = veh_type or "Unknown"

    if veh_type == "none":
        veh_type = "Unknown"

    historical_closure_rate = closure_rate_lookup.get(
        event_cause,
        0.0
    )

    input_data = {
        "event_cause": safe_label_encode("event_cause", event_cause),
        "historical_closure_rate": historical_closure_rate,
        "latitude": latitude if latitude is not None else 0.0,
        "longitude": longitude if longitude is not None else 0.0,
        "zone": safe_label_encode("zone", zone),
        "junction": safe_label_encode("junction", junction),
        "police_station": safe_label_encode("police_station", police_station),
        "veh_type": safe_label_encode("veh_type", veh_type),
        "hour": reported_at.hour,
        "month": reported_at.month,
        "day_of_week": reported_at.weekday(),
        "weekend": 1 if reported_at.weekday() >= 5 else 0
    }

    input_df = pd.DataFrame([input_data], columns=FEATURES)

    prediction = int(road_closure_model.predict(input_df)[0])
    probability = float(road_closure_model.predict_proba(input_df)[0][1])

    return {
        "road_block_required": bool(prediction),
        "road_block_probability": round(probability, 2)
    }


def get_event_intelligence(
    event_cause: str,
    zone: str = "Unknown",
    junction: str = "Unknown"
) -> dict:

    event_cause = event_cause or "Unknown"
    zone = zone or "Unknown"
    junction = junction or "Unknown"

    exact_match = zone_junction_df[
        (zone_junction_df["event_cause"] == event_cause)
        & (zone_junction_df["zone"] == zone)
        & (zone_junction_df["junction"] == junction)
    ]

    if not exact_match.empty:
        row = exact_match.iloc[0]

        return {
            "historical_incidents": int(row["historical_incidents"]),
            "historical_closure_rate": float(row["closure_rate"]),
            "expected_resolution_minutes": int(row["median_duration"]),
            "intelligence_source": "zone_junction"
        }

    cause_match = event_intelligence_df[
        event_intelligence_df["event_cause"] == event_cause
    ]

    if not cause_match.empty:
        row = cause_match.iloc[0]

        return {
            "historical_incidents": int(row["historical_incidents"]),
            "historical_closure_rate": float(row["closure_rate"]),
            "expected_resolution_minutes": int(row["median_duration"]),
            "intelligence_source": "event_cause"
        }

    return {
        "historical_incidents": 0,
        "historical_closure_rate": 0.0,
        "expected_resolution_minutes": 30,
        "intelligence_source": "default"
    }


def haversine_distance(lat1, lon1, lat2, lon2):
    radius = 6371

    lat1 = math.radians(float(lat1))
    lon1 = math.radians(float(lon1))
    lat2 = math.radians(float(lat2))
    lon2 = math.radians(float(lon2))

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1)
        * math.cos(lat2)
        * math.sin(dlon / 2) ** 2
    )

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return radius * c


def find_similar_incidents(
    event_cause: str,
    latitude: float | None,
    longitude: float | None,
    limit: int = 5
) -> list:

    df = nearby_incidents_df.copy()

    event_cause = event_cause or "Unknown"

    if event_cause:
        df = df[df["event_cause"] == event_cause]

    if latitude is not None and longitude is not None and not df.empty:
        df["distance_km"] = df.apply(
            lambda row: haversine_distance(
                latitude,
                longitude,
                row["latitude"],
                row["longitude"]
            ),
            axis=1
        )

        df = df.sort_values("distance_km")

    else:
        df["distance_km"] = None

    df = df.head(limit)

    results = []

    for _, row in df.iterrows():
        results.append(
            {
                "event_cause": row["event_cause"],
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "duration_minutes": int(row["duration_minutes"]),
                "requires_road_closure": bool(row["requires_road_closure"]),
                "distance_km": None
                if pd.isna(row["distance_km"])
                else round(float(row["distance_km"]), 2)
            }
        )

    return results


def calculate_severity_score(
    road_block_probability: float,
    historical_closure_rate: float,
    historical_incidents: int,
    urgency: str,
    blockage_level: str,
    traffic_condition: str
) -> float:

    incident_score = min(historical_incidents / 300, 1.0)

    severity_score = (
        0.30 * road_block_probability
        + 0.20 * historical_closure_rate
        + 0.20 * urgency_to_score(urgency)
        + 0.20 * blockage_to_score(blockage_level)
        + 0.10 * traffic_to_score(traffic_condition)
    )

    severity_score = severity_score + (0.05 * incident_score)

    return round(min(severity_score, 1.0), 2)


def analyze_event(
    parsed: dict,
    latitude: float | None,
    longitude: float | None,
    zone: str = "Unknown",
    junction: str = "Unknown",
    police_station: str = "Unknown",
    reported_at: datetime | None = None
) -> dict:

    event_cause = (
        parsed.get("event_cause")
        or parsed.get("event_type")
        or "Unknown"
    )

    veh_type = (
        parsed.get("vehicle_type")
        or parsed.get("veh_type")
        or "Unknown"
    )

    road_closure = predict_road_closure(
        event_cause=event_cause,
        veh_type=veh_type,
        latitude=latitude,
        longitude=longitude,
        zone=zone,
        junction=junction,
        police_station=police_station,
        reported_at=reported_at
    )

    intelligence = get_event_intelligence(
        event_cause=event_cause,
        zone=zone,
        junction=junction
    )

    severity_score = calculate_severity_score(
        road_block_probability=road_closure["road_block_probability"],
        historical_closure_rate=intelligence["historical_closure_rate"],
        historical_incidents=intelligence["historical_incidents"],
        urgency=parsed.get("urgency", "low"),
        blockage_level=parsed.get("blockage_level", "none"),
        traffic_condition=parsed.get("traffic_condition", "normal")
    )

    return {
        "road_closure_prediction": road_closure,
        "historical_intelligence": intelligence,
        "severity_score": severity_score
    }