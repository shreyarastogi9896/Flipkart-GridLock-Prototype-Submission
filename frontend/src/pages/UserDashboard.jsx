import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import MapView from '../components/MapView';
import UserPanel from '../components/UserPanel';
import { calculateRoute, createEvent, getActiveEvents, getApiBaseUrl } from '../api/eventsApi';
import { formatMinutes, normalizeEvents } from '../api/eventUtils';

const pageVariants = {
  initial: { opacity: 0, x: -30 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  exit: { opacity: 0, x: 30, transition: { duration: 0.25 } },
};

const DEFAULT_ROUTE_INPUT = {
  source_place: 'Majestic Bengaluru',
  dest_place: 'Koramangala Bengaluru',
};

function eventClass(event) {
  if (event.severity <= 2) return 'severity-1';
  if (event.severity <= 3) return 'severity-3';
  return 'severity-5';
}

export default function UserDashboard() {
  const [events, setEvents] = useState([]);
  const [routeInput, setRouteInput] = useState(DEFAULT_ROUTE_INPUT);
  const [route, setRoute] = useState([]);
  const [blockedEdges, setBlockedEdges] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getActiveEvents();
      setEvents(normalizeEvents(data));
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Unable to load active events');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshRoute = useCallback(async () => {
    setRouteLoading(true);
    setError('');
    try {
      if (!routeInput.source_place.trim() || !routeInput.dest_place.trim()) {
        throw new Error('Please enter source and destination place names');
      }

      const data = await calculateRoute({
        source_place: routeInput.source_place.trim(),
        dest_place: routeInput.dest_place.trim(),
      });

      setRoute((data.route || []).map((point) => [point.lat, point.lng]));
      setBlockedEdges(data.blocked_edges || []);
      setRouteInfo(data);
      await loadEvents();
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Unable to calculate route');
    } finally {
      setRouteLoading(false);
    }
  }, [loadEvents, routeInput]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleReportEvent = async (payload) => {
    await createEvent(payload);
    await loadEvents();
  };

  const handleRouteChange = (field, value) => {
    setRouteInput((prev) => ({ ...prev, [field]: value }));
  };

  const affectedAreas = useMemo(
    () => events.filter((event) => event.severity >= 3 || event.final_action),
    [events]
  );

  const fullBlocks = events.filter((event) => event.final_action === 'FULL_BLOCK').length;

  return (
    <motion.div className="dashboard" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <UserPanel onReportEvent={handleReportEvent} />
      <div className="dashboard-map">
        <div className="map-toolbar">
          <div>
            <span className="map-title">TrafficIQ Live Monitor</span>
            <span className="map-subtitle">Approved active incidents only · Backend: {getApiBaseUrl()}</span>
          </div>
          <span className="map-pill">{fullBlocks} live full blocks</span>
        </div>

        <div className="route-planner-card">
          <div className="route-planner-header">
            <div>
              <strong>Route planner</strong>
              <span>Enter place names. The backend geocodes them and avoids approved FULL_BLOCK road edges.</span>
            </div>
            <button className="ml-action-btn" onClick={refreshRoute} disabled={routeLoading}>
              {routeLoading ? 'Refreshing...' : 'Refresh Route'}
            </button>
          </div>
          <div className="route-grid route-grid-places">
            <label>
              Source place
              <input value={routeInput.source_place} onChange={(e) => handleRouteChange('source_place', e.target.value)} placeholder="Majestic Bengaluru" />
            </label>
            <label>
              Destination place
              <input value={routeInput.dest_place} onChange={(e) => handleRouteChange('dest_place', e.target.value)} placeholder="Koramangala Bengaluru" />
            </label>
          </div>
          {routeInfo && (
            <div className="route-result-strip">
              Route: {routeInfo.route_length_km} km · Active full blocks applied: {routeInfo.blocked_edges_applied}
              {routeInfo.source?.place && routeInfo.destination?.place && (
                <span> · {routeInfo.source.place} → {routeInfo.destination.place}</span>
              )}
            </div>
          )}
        </div>

        <div className="map-workspace">
          <div className="map-shell">
            <MapView events={events} route={route} blockedEdges={blockedEdges} />
          </div>
          <div className="map-insights">
            <div className="section-title">Active Event Intelligence <span className="section-count">{affectedAreas.length}</span></div>
            {loading && <div className="empty-state">Loading active events...</div>}
            {error && <div className="error-flash compact-message">{error}</div>}
            {!loading && affectedAreas.length === 0 ? (
              <div className="empty-state">No approved active events</div>
            ) : (
              affectedAreas.map((event) => (
                <div className={`insight-card ${eventClass(event)}`} key={`insight-${event.id}`}>
                  <div className="insight-card-title">{event.locationName || 'Affected area'}</div>
                  <div className="insight-card-meta">
                    {event.status} | Severity {event.severityPercent}% | ETA {formatMinutes(event.etaMinutes)} | {event.time}
                  </div>
                  {event.description && <div className="insight-card-text">{event.description}</div>}
                  {event.final_action && <div className="insight-card-route danger">Police action: {event.final_action}</div>}
                  {event.action_plan && <div className="insight-card-text"><strong>Published action plan:</strong> {event.action_plan}</div>}
                  {event.final_action === 'FULL_BLOCK' && <div className="insight-card-route">This road edge is applied as a block when route is refreshed.</div>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
