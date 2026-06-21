import { motion } from 'framer-motion';

export default function PolicePanel({ events = [], onToggleBlock }) {
  const activeCount = events.length;
  const blockedCount = events.filter((event) => event.blocked).length;

  return (
    <div className="dashboard-panel police-panel">
      <div className="panel-header">
        <div className="panel-brand">
          <span className="panel-brand-mark">OPS</span>
          <span className="panel-brand-title">Control Room</span>
        </div>
        <span className="panel-role-badge police">Police Command</span>
      </div>

      <div className="panel-content">
        <div className="route-info-card">
          <div className="route-meta compact-stats">
            <div className="meta-item">
              <div className="meta-value">{activeCount}</div>
              <div className="meta-label">Active Events</div>
            </div>
            <div className="meta-item">
              <div className="meta-value warning-text">{blockedCount}</div>
              <div className="meta-label">Blocked</div>
            </div>
          </div>
        </div>

        <div className="section-block">
          <div className="section-title">Active Events</div>
          <div className="event-list">
            {events.map((event) => (
              <div className={`event-card severity-${event.severity}`} key={event.id}>
                <span className="event-card-code">{event.type.slice(0, 2).toUpperCase()}</span>
                <div className="event-card-body">
                  <div className="event-card-type">{event.type}</div>
                  <div className="event-card-location">
                    {event.locationName || 'Location pending'}
                  </div>
                  <motion.button
                    className={`block-road-btn ${event.blocked ? 'blocked' : ''}`}
                    onClick={() => onToggleBlock(event.id)}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {event.blocked ? 'Road Blocked' : 'Block Road'}
                  </motion.button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
