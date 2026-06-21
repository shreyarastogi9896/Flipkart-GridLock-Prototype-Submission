import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import { formatMinutes } from '../api/eventUtils';

const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

const DEFAULT_CENTER = [12.9716, 77.5946];
const DEFAULT_ZOOM = 10;

const EVENT_COLORS = {
  accident: '#ef4444',
  congestion: '#f59e0b',
  traffic: '#f59e0b',
  road_block: '#ef4444',
  fire: '#f97316',
  construction: '#a855f7',
  unknown: '#06b6d4',
};

const EVENT_LABELS = {
  accident: 'Accident',
  congestion: 'Congestion',
  traffic: 'Traffic congestion',
  road_block: 'Road block',
  fire: 'Fire',
  construction: 'Construction',
  unknown: 'Event',
};

const SEVERITY_RADIUS = {
  1: 6,
  2: 8,
  3: 10,
  4: 13,
  5: 16,
};

function eventMarkerColor(evt) {
  if (evt.final_action === 'FULL_BLOCK') return '#ef4444';
  if (evt.final_action === 'PARTIAL_BLOCK') return '#facc15';
  return EVENT_COLORS[evt.type] || '#06b6d4';
}

function toLeafletPositions(points = []) {
  return points
    .map((point) => {
      if (Array.isArray(point)) return point;
      return [Number(point.lat), Number(point.lng)];
    })
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
}

function RouteViewport({ positions }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length < 2) return;
    map.fitBounds(positions, { padding: [36, 36] });
  }, [map, positions]);

  return null;
}

export default function MapView({ events = [], route = [], blockedEdges = [] }) {
  const validEvents = events.filter((evt) => Number.isFinite(evt.lat) && Number.isFinite(evt.lon));
  const routePositions = toLeafletPositions(route);
  const center = routePositions[0] || (validEvents[0] ? [validEvents[0].lat, validEvents[0].lon] : DEFAULT_CENTER);

  const fullBlockEvents = validEvents.filter(
    (evt) => evt.status === 'ACTIVE' && evt.final_action === 'FULL_BLOCK'
  );

  return (
    <MapContainer
      center={center}
      zoom={DEFAULT_ZOOM}
      zoomControl
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer url={DARK_TILES} attribution={ATTRIBUTION} />
      <RouteViewport positions={routePositions} />

      {routePositions.length > 1 && (
        <Polyline
          positions={routePositions}
          pathOptions={{
            color: '#22c55e',
            weight: 6,
            opacity: 0.95,
            lineCap: 'round',
          }}
        />
      )}

      {blockedEdges.map((edge, index) => {
        const positions = toLeafletPositions(edge.blocked_edge_geometry || []);
        if (positions.length < 2) return null;
        return (
          <Polyline
            key={`blocked-edge-${edge.event_id || index}`}
            positions={positions}
            pathOptions={{
              color: '#ef4444',
              weight: 7,
              opacity: 0.95,
              dashArray: '8, 5',
              lineCap: 'round',
            }}
          />
        );
      })}

      {fullBlockEvents.map((evt) => {
        const positions = toLeafletPositions(evt.blockedEdgeGeometry || []);
        if (positions.length < 2) return null;
        return (
          <Polyline
            key={`${evt.id}-stored-blocked-edge`}
            positions={positions}
            pathOptions={{
              color: '#ef4444',
              weight: 7,
              opacity: 0.9,
              dashArray: '6, 6',
              lineCap: 'round',
            }}
          />
        );
      })}

      {fullBlockEvents.map((evt) => (
        <CircleMarker
          key={`${evt.id}-block-highlight`}
          center={[evt.lat, evt.lon]}
          radius={(SEVERITY_RADIUS[evt.severity] || 8) + 10}
          pathOptions={{
            color: '#ef4444',
            fillColor: '#ef4444',
            fillOpacity: 0.12,
            weight: 3,
          }}
        />
      ))}

      {validEvents.map((evt) => (
        <CircleMarker
          key={evt.id}
          center={[evt.lat, evt.lon]}
          radius={SEVERITY_RADIUS[evt.severity] || 8}
          pathOptions={{
            color: eventMarkerColor(evt),
            fillColor: eventMarkerColor(evt),
            fillOpacity: 0.45,
            weight: 2,
          }}
        >
          <Popup>
            <div className="map-popup">
              <strong>{EVENT_LABELS[evt.type] || evt.type}</strong>
              {evt.locationName && <span>{evt.locationName}</span>}
              <span>Status: {evt.status}</span>
              <span>Severity: {evt.severityPercent}%</span>
              <span>ETA: {formatMinutes(evt.etaMinutes)}</span>
              {evt.recommendation?.recommended_action && (
                <span className="popup-note">AI: {evt.recommendation.recommended_action}</span>
              )}
              {evt.final_action && (
                <span className={evt.final_action === 'PARTIAL_BLOCK' ? 'popup-warning' : 'popup-danger'}>
                  Final: {evt.final_action}
                </span>
              )}
              {evt.final_action === 'FULL_BLOCK' && <span className="popup-danger">Road edge blocked</span>}
              {evt.routeBlockError && <span className="popup-danger">Block error: {evt.routeBlockError}</span>}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
