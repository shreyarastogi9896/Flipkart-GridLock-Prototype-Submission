import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MapView from '../components/MapView';
import EventForm from '../components/EventForm';
import { approveEvent, closeEvent, createEvent, getActiveEvents, getPendingEvents } from '../api/eventsApi';
import { formatMinutes, normalizeEvents, severityLabel } from '../api/eventUtils';

const pageVariants = {
  initial: { opacity: 0, x: -24 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut' } },
  exit: { opacity: 0, x: 24, transition: { duration: 0.2 } },
};

const listItem = {
  hidden: { opacity: 0, x: -18 },
  show: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 18 },
};

const ACTIONS = ['IGNORE', 'MONITOR', 'PARTIAL_BLOCK', 'FULL_BLOCK'];

function getSeverityClass(score) {
  const value = Number(score || 0);
  if (value < 0.35) return 'low';
  if (value < 0.6) return 'medium';
  return 'high';
}

function cardSeverityClass(event) {
  if (event.severity <= 2) return 'severity-1';
  if (event.severity <= 3) return 'severity-3';
  return 'severity-5';
}

function defaultAction(event) {
  return event.final_action || event.recommendation?.recommended_action || 'MONITOR';
}

function defaultActionPlan(event) {
  if (event.action_plan) return event.action_plan;
  const resources = event.recommendation?.resources || {};
  const reason = event.recommendation?.reason || 'Review the incident and manage traffic as needed.';
  return `${reason}\n\nDeployment plan:\n- Traffic police: ${resources.traffic_police || 0}\n- Tow truck: ${resources.tow_truck || 0}\n- Ambulance: ${resources.ambulance || 0}`;
}

function RecommendationBox({ evt }) {
  const rec = evt.recommendation || {};
  const resources = rec.resources || {};

  return (
    <div className="ml-response ai-suggestion-box">
      <div className="ai-suggestion-title">AI Suggestion</div>
      <strong>Recommended action:</strong> {rec.recommended_action || 'MONITOR'}<br />
      <strong>Response level:</strong> {rec.response_level || 'N/A'}<br />
      <strong>Road closure probability:</strong> {Math.round(Number(evt.road_block_probability || 0) * 100)}%<br />
      <strong>Expected resolution:</strong> {formatMinutes(evt.etaMinutes)}<br />
      <strong>Resources:</strong> {resources.traffic_police || 0} police, {resources.tow_truck || 0} tow truck, {resources.ambulance || 0} ambulance
      {rec.reason && <div className="ai-reason-text">{rec.reason}</div>}
    </div>
  );
}

function formatCoordinate(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'N/A';
  return number.toFixed(5);
}

function DetailItem({ label, value, wide = false }) {
  const displayValue = value || value === 0 ? value : 'N/A';

  return (
    <div className={`event-detail-item${wide ? ' wide' : ''}`}>
      <span className="event-detail-label">{label}</span>
      <span className="event-detail-value">{displayValue}</span>
    </div>
  );
}

function PendingEventDetails({ evt }) {
  const parsed = evt.parsed || {};

  return (
    <div className="event-detail-grid">
      <DetailItem label="Location" value={evt.locationName} wide />
      <DetailItem label="Coordinates" value={`${formatCoordinate(evt.lat)}, ${formatCoordinate(evt.lon)}`} />
      <DetailItem label="Reported" value={evt.time || 'N/A'} />
      <DetailItem label="Zone" value={evt.zone} />
      <DetailItem label="Junction" value={evt.junction} />
      <DetailItem label="Police Station" value={evt.police_station} />
      <DetailItem label="Vehicle Type" value={evt.vehicleType} />
      <DetailItem label="Event Type" value={evt.type} />
      <DetailItem label="Road Block Probability" value={`${Math.round(Number(evt.road_block_probability || 0) * 100)}%`} />
      {parsed.impact && <DetailItem label="Impact" value={parsed.impact} wide />}
    </div>
  );
}

function PendingEventCard({ evt, selectedAction, selectedPlan, onActionChange, onPlanChange, onApprove, working }) {
  return (
    <motion.div key={evt.id} className={`event-card ${cardSeverityClass(evt)}`} variants={listItem} initial="hidden" animate="show" exit="exit" layout>
      <span className="event-card-code">{(evt.eventCause || 'EV').slice(0, 2).toUpperCase()}</span>
      <div className="event-card-body">
        <div className="event-card-type">{evt.eventCause} · PENDING REVIEW</div>
        <div className="event-card-location">{evt.locationName || 'Location pending'} | {evt.time}</div>

        <div className="event-card-meta">
          <span className={`severity-badge ${getSeverityClass(evt.severity_score)}`}>Severity {evt.severityPercent}% · {severityLabel(evt.severity_score)}</span>
          <span className="event-card-time">ETA {formatMinutes(evt.etaMinutes)}</span>
        </div>

        {evt.description && <div className="event-card-note">{evt.description}</div>}
        <PendingEventDetails evt={evt} />
        <RecommendationBox evt={evt} />

        <div className="officer-decision-panel">
          <label className="form-label compact-label" htmlFor={`action-${evt.id}`}>Officer Final Action</label>
          <select id={`action-${evt.id}`} className="form-select compact-input" value={selectedAction || defaultAction(evt)} onChange={(e) => onActionChange(evt.id, e.target.value)}>
            {ACTIONS.map((action) => <option key={action} value={action}>{action}</option>)}
          </select>

          <label className="form-label compact-label" htmlFor={`plan-${evt.id}`}>Published Action Plan</label>
          <textarea id={`plan-${evt.id}`} className="form-input form-textarea compact-plan" value={selectedPlan || ''} onChange={(e) => onPlanChange(evt.id, e.target.value)} rows="6" />
        </div>

        <div className="event-actions">
          <motion.button className="ml-action-btn approve-btn" onClick={() => onApprove(evt.id)} disabled={working} whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
            {working ? 'Approving...' : 'Approve & Publish to Users'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function ActiveEventCard({ evt, onClose, working }) {
  return (
    <motion.div key={evt.id} className={`event-card ${cardSeverityClass(evt)}`} variants={listItem} initial="hidden" animate="show" exit="exit" layout>
      <span className="event-card-code">{(evt.eventCause || 'EV').slice(0, 2).toUpperCase()}</span>
      <div className="event-card-body">
        <div className="event-card-type">{evt.eventCause} · ACTIVE</div>
        <div className="event-card-location">{evt.locationName || 'Location pending'} | {evt.time}</div>
        <div className="event-card-meta">
          <span className={`severity-badge ${getSeverityClass(evt.severity_score)}`}>Severity {evt.severityPercent}% · {severityLabel(evt.severity_score)}</span>
          <span className="event-card-time">ETA {formatMinutes(evt.etaMinutes)}</span>
        </div>
        {evt.description && <div className="event-card-note">{evt.description}</div>}

        <div className="ml-response block-note">
          <strong>Published final action:</strong> {evt.final_action || 'MONITOR'}<br />
          {evt.action_plan && <span>{evt.action_plan}</span>}
          {evt.final_action === 'FULL_BLOCK' && <><br /><strong>Diversion:</strong> nearest OSM road edge is blocked for route calculations.</>}
          {evt.routeBlockError && <><br /><span className="danger-text">Block error: {evt.routeBlockError}</span></>}
        </div>

        <div className="event-actions">
          <motion.button className="block-road-btn blocked" onClick={() => onClose(evt.id)} disabled={working} whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
            {working ? 'Closing...' : 'Close Event'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

export default function PoliceDashboard() {
  const [pendingEvents, setPendingEvents] = useState([]);
  const [activeEvents, setActiveEvents] = useState([]);
  const [selectedActions, setSelectedActions] = useState({});
  const [actionPlans, setActionPlans] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workingId, setWorkingId] = useState(null);
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [pendingData, activeData] = await Promise.all([getPendingEvents(), getActiveEvents()]);
      const pending = normalizeEvents(pendingData);
      const active = normalizeEvents(activeData);
      setPendingEvents(pending);
      setActiveEvents(active);
      setSelectedActions((prev) => {
        const next = { ...prev };
        pending.forEach((event) => { if (!next[event.id]) next[event.id] = defaultAction(event); });
        return next;
      });
      setActionPlans((prev) => {
        const next = { ...prev };
        pending.forEach((event) => { if (!next[event.id]) next[event.id] = defaultActionPlan(event); });
        return next;
      });
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Unable to load pending and active events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const handleAddEvent = useCallback(async (payload) => {
    await createEvent(payload);
    await loadEvents();
  }, [loadEvents]);

  const handleApprove = useCallback(async (eventId) => {
    setWorkingId(eventId);
    setError('');
    try {
      await approveEvent(
        eventId,
        selectedActions[eventId] || 'MONITOR',
        actionPlans[eventId] || 'Traffic police action published.'
      );
      await loadEvents();
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to approve event');
    } finally {
      setWorkingId(null);
    }
  }, [actionPlans, loadEvents, selectedActions]);

  const handleClose = useCallback(async (eventId) => {
    setWorkingId(eventId);
    setError('');
    try {
      await closeEvent(eventId);
      await loadEvents();
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to close event');
    } finally {
      setWorkingId(null);
    }
  }, [loadEvents]);

  const handleLogout = () => { logout(); navigate('/'); };

  const stats = useMemo(() => {
    const fullBlocks = activeEvents.filter((e) => e.final_action === 'FULL_BLOCK').length;
    const high = [...pendingEvents, ...activeEvents].filter((e) => Number(e.severity_score) >= 0.6).length;
    return { pending: pendingEvents.length, active: activeEvents.length, fullBlocks, high };
  }, [activeEvents, pendingEvents]);

  return (
    <motion.div className="dashboard police-dashboard-layout" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <div className="dashboard-panel police-review-panel">
        <div className="panel-header">
          <div className="panel-header-row">
            <div className="panel-brand"><span className="panel-brand-mark">OPS</span><span className="panel-brand-title">Police Command</span></div>
            <motion.button className="logout-btn" onClick={handleLogout} whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>Logout</motion.button>
          </div>
          <span className="panel-role-badge police">Pending verification · {user?.name || 'Officer'}</span>
        </div>

        <div className="panel-content">
          <div className="route-info-card command-stats-card">
            <div className="route-meta compact-stats">
              <div className="meta-item"><div className="meta-value warning-text">{stats.pending}</div><div className="meta-label">Pending</div></div>
              <div className="meta-item"><div className="meta-value">{stats.active}</div><div className="meta-label">Active</div></div>
              <div className="meta-item"><div className="meta-value danger-text">{stats.fullBlocks}</div><div className="meta-label">Full blocks</div></div>
            </div>
          </div>

          <div className="event-actions top-actions"><motion.button className="ml-action-btn" onClick={loadEvents} whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>Refresh Events</motion.button></div>
          {error && <div className="error-flash compact-message">{error}</div>}

          <div className="section-title">Pending Events <span className="section-count">{pendingEvents.length}</span></div>
          <div className="event-list pending-review-list">
            <AnimatePresence mode="popLayout">
              {loading ? <motion.div className="empty-state" key="loading-pending">Loading pending events...</motion.div> : pendingEvents.length === 0 ? <motion.div className="empty-state" key="empty-pending">No pending events</motion.div> : pendingEvents.map((evt) => (
                <PendingEventCard
                  key={evt.id}
                  evt={evt}
                  selectedAction={selectedActions[evt.id]}
                  selectedPlan={actionPlans[evt.id]}
                  onActionChange={(id, value) => setSelectedActions((prev) => ({ ...prev, [id]: value }))}
                  onPlanChange={(id, value) => setActionPlans((prev) => ({ ...prev, [id]: value }))}
                  onApprove={handleApprove}
                  working={workingId === evt.id}
                />
              ))}
            </AnimatePresence>
          </div>

          <div className="section-block field-event-block"><EventForm onSubmit={handleAddEvent} title="Add Field Event" submitLabel="Add Event" /></div>
        </div>

        <div className="status-bar"><div className="status-dot" /><span className="status-text">AI assists · Officer publishes final action</span></div>
      </div>

      <div className="dashboard-map police-map-column">
        <div className="map-toolbar">
          <div><span className="map-title">Active Operations Map</span><span className="map-subtitle">Approved active events only. Full blocks are applied to route calculations.</span></div>
          <span className="map-pill">{stats.active} active</span>
        </div>
        <div className="map-workspace police-active-workspace">
          <div className="map-shell"><MapView events={activeEvents} /></div>
          <div className="map-insights active-events-side">
            <div className="section-title">Active Events <span className="section-count">{activeEvents.length}</span></div>
            <div className="event-list active-side-list">
              <AnimatePresence mode="popLayout">
                {loading ? <motion.div className="empty-state" key="loading-active">Loading active events...</motion.div> : activeEvents.length === 0 ? <motion.div className="empty-state" key="empty-active">No active events</motion.div> : activeEvents.map((evt) => (
                  <ActiveEventCard key={evt.id} evt={evt} onClose={handleClose} working={workingId === evt.id} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
