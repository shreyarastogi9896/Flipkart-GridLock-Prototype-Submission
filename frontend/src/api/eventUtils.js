export function formatMinutes(minutes) {
  const value = Number(minutes || 0);
  if (!value) return 'N/A';

  const hours = Math.floor(value / 60);
  const mins = value % 60;

  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}

export function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function severityNumber(event) {
  const score = Number(event?.severity_score ?? event?.severity ?? 0);
  if (score <= 1) {
    return Math.max(1, Math.min(5, Math.ceil(score * 5)) || 1);
  }
  return Math.max(1, Math.min(5, Math.round(score)) || 1);
}

export function severityLabel(score) {
  const value = Number(score || 0);
  if (value < 0.35) return 'Low';
  if (value < 0.6) return 'Medium';
  return 'High';
}

export function normalizeEvent(event) {
  const parsed = event?.parsed || {};
  const recommendation = event?.recommendation || {};
  const severity = severityNumber(event);

  return {
    ...event,
    id: event.id,
    type: parsed.event_type || parsed.event_cause || 'event',
    eventCause: parsed.event_cause || parsed.event_type || 'unknown',
    vehicleType: parsed.vehicle_type || 'none',
    lat: Number(event.latitude),
    lon: Number(event.longitude),
    locationName: event.location,
    severity,
    severityPercent: Math.round(Number(event.severity_score || 0) * 100),
    time: formatDateTime(event.reported_at),
    blocked: event.status === 'ACTIVE' && event.final_action === 'FULL_BLOCK',
    diversion: event.final_action || recommendation.recommended_action,
    recommendation,
    action_plan: event.action_plan || '',
    etaMinutes: event?.historical_intelligence?.expected_resolution_minutes,
    blockedEdge: event.blocked_edge,
    blockedNodes: event.blocked_nodes || [],
    blockedEdgeGeometry: event.blocked_edge_geometry || [],
    isBlockingRoute: Boolean(event.is_blocking_route),
    routeBlockError: event.route_block_error,
  };
}

export function normalizeEvents(events = []) {
  return events
    .map(normalizeEvent)
    .filter((event) => Number.isFinite(event.lat) && Number.isFinite(event.lon));
}
