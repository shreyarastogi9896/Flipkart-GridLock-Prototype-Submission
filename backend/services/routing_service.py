import math
from functools import lru_cache
from typing import Any

import networkx as nx
import osmnx as ox


EARTH_RADIUS_KM = 6371.0088


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return EARTH_RADIUS_KM * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def _safe_int(value: Any):
    try:
        return int(value)
    except Exception:
        return value


def geocode_place(place: str) -> dict:
    """Convert a place name into latitude/longitude using OSMnx/Nominatim."""
    if not place or not str(place).strip():
        raise ValueError("Place name is required")

    lat, lng = ox.geocode(str(place).strip())
    return {"lat": float(lat), "lng": float(lng), "place": place}


@lru_cache(maxsize=12)
def load_graph(center_lat: float, center_lng: float, dist_m: int):
    """Load and cache a drivable OSM graph around a rounded center point."""
    return ox.graph_from_point(
        (center_lat, center_lng),
        dist=dist_m,
        network_type="drive",
        simplify=True,
    )


def get_graph_for_route(source_lat: float, source_lng: float, dest_lat: float, dest_lng: float, block_points: tuple = ()): 
    all_points = [(source_lat, source_lng), (dest_lat, dest_lng), *block_points]
    center_lat = round(sum(p[0] for p in all_points) / len(all_points), 4)
    center_lng = round(sum(p[1] for p in all_points) / len(all_points), 4)

    max_distance_km = max(
        haversine_km(center_lat, center_lng, lat, lng)
        for lat, lng in all_points
    )

    # Minimum 1.5 km, enough extra margin for alternative roads, capped for demo speed.
    dist_m = int(max(1200, min(3000, (max_distance_km * 1000) + 2000)))
    return load_graph(center_lat, center_lng, dist_m).copy()


def create_block_record(latitude: float, longitude: float) -> dict:
    """Find the nearest real OSM edge for an event and return stored block metadata."""
    G = load_graph(round(latitude, 4), round(longitude, 4), 1500).copy()

    u, v, key = ox.distance.nearest_edges(G, X=longitude, Y=latitude)
    edge_data = G.get_edge_data(u, v, key) or {}

    edge_geometry = []
    geometry = edge_data.get("geometry")

    if geometry is not None:
        edge_geometry = [
            {"lat": float(lat), "lng": float(lng)}
            for lng, lat in geometry.coords
        ]
    else:
        edge_geometry = [
            {"lat": float(G.nodes[u]["y"]), "lng": float(G.nodes[u]["x"])},
            {"lat": float(G.nodes[v]["y"]), "lng": float(G.nodes[v]["x"])},
        ]

    return {
        "blocked_edge": {
            "u": _safe_int(u),
            "v": _safe_int(v),
            "key": _safe_int(key),
        },
        "blocked_nodes": [_safe_int(u), _safe_int(v)],
        "blocked_edge_geometry": edge_geometry,
        "is_blocking_route": True,
    }


def _remove_edge_if_present(G, u, v, key=None) -> bool:
    removed = False

    if key is not None and G.has_edge(u, v, key):
        G.remove_edge(u, v, key)
        removed = True
    elif G.has_edge(u, v):
        keys = list(G[u][v].keys())
        for edge_key in keys:
            G.remove_edge(u, v, edge_key)
            removed = True

    if key is not None and G.has_edge(v, u, key):
        G.remove_edge(v, u, key)
        removed = True
    elif G.has_edge(v, u):
        keys = list(G[v][u].keys())
        for edge_key in keys:
            G.remove_edge(v, u, edge_key)
            removed = True

    return removed


def apply_event_blocks(G, active_events: list[dict]) -> dict:
    """Remove FULL_BLOCK event edges from route graph."""
    blocked_edges_applied = 0
    blocked_edges = []

    for event in active_events:
        if event.get("status") != "ACTIVE" or event.get("final_action") != "FULL_BLOCK":
            continue

        edge = event.get("blocked_edge") or {}
        removed = False

        if edge.get("u") is not None and edge.get("v") is not None:
            removed = _remove_edge_if_present(G, edge.get("u"), edge.get("v"), edge.get("key"))

        # If stored edge is outside the graph or missing, fall back to nearest edge by event coordinates.
        if not removed and event.get("latitude") is not None and event.get("longitude") is not None:
            try:
                u, v, key = ox.distance.nearest_edges(G, X=float(event["longitude"]), Y=float(event["latitude"]))
                removed = _remove_edge_if_present(G, u, v, key)
                edge = {"u": _safe_int(u), "v": _safe_int(v), "key": _safe_int(key)}
            except Exception:
                removed = False

        if removed:
            blocked_edges_applied += 1
            blocked_edges.append({
                "event_id": str(event.get("_id", event.get("id", ""))),
                "location": event.get("location"),
                "edge": edge,
                "blocked_edge_geometry": event.get("blocked_edge_geometry", []),
            })

    return {
        "blocked_edges_applied": blocked_edges_applied,
        "blocked_edges": blocked_edges,
    }


def compute_route(source_lat: float, source_lng: float, dest_lat: float, dest_lng: float, active_events: list[dict]) -> dict:
    block_points = tuple(
        (float(e["latitude"]), float(e["longitude"]))
        for e in active_events
        if e.get("status") == "ACTIVE"
        and e.get("final_action") == "FULL_BLOCK"
        and e.get("latitude") is not None
        and e.get("longitude") is not None
    )

    G = get_graph_for_route(source_lat, source_lng, dest_lat, dest_lng, block_points)
    block_info = apply_event_blocks(G, active_events)

    source_node = ox.distance.nearest_nodes(G, X=source_lng, Y=source_lat)
    dest_node = ox.distance.nearest_nodes(G, X=dest_lng, Y=dest_lat)

    route_nodes = nx.shortest_path(G, source=source_node, target=dest_node, weight="length")
    route_length_m = nx.shortest_path_length(G, source=source_node, target=dest_node, weight="length")

    coordinates = [
        {"lat": float(G.nodes[node]["y"]), "lng": float(G.nodes[node]["x"])}
        for node in route_nodes
    ]

    return {
        "route": coordinates,
        "route_length_m": round(float(route_length_m), 2),
        "route_length_km": round(float(route_length_m) / 1000, 2),
        "blocked_edges_applied": block_info["blocked_edges_applied"],
        "blocked_edges": block_info["blocked_edges"],
    }


def compute_route_from_places(source_place: str, dest_place: str, active_events: list[dict]) -> dict:
    source = geocode_place(source_place)
    destination = geocode_place(dest_place)

    route_data = compute_route(
        source_lat=source["lat"],
        source_lng=source["lng"],
        dest_lat=destination["lat"],
        dest_lng=destination["lng"],
        active_events=active_events,
    )

    route_data["source"] = source
    route_data["destination"] = destination
    return route_data
