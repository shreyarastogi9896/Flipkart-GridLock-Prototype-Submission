import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import EventForm from './EventForm';

export default function UserPanel({ onReportEvent }) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="dashboard-panel">
      <div className="panel-header">
        <div className="panel-header-row">
          <div className="panel-brand">
            <span className="panel-brand-mark">TIQ</span>
            <span className="panel-brand-title">TrafficIQ</span>
          </div>
          <motion.button className="logout-btn" onClick={handleLogout} whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>Logout</motion.button>
        </div>
        <span className="panel-role-badge">User Mode · {user?.name || 'Citizen'}</span>
      </div>

      <div className="panel-content">
        <motion.div className="section-block" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="section-title">Live Route Notice</div>
          <div className="route-info-card">
            <p className="muted-text">Only police-approved active events are shown to users. Use the route planner on the map to refresh your route around approved full blocks.</p>
          </div>
        </motion.div>

        <div className="section-block">
          <EventForm onSubmit={onReportEvent} title="Report Road Issue" submitLabel="Submit Report" />
        </div>
      </div>

      <div className="status-bar">
        <div className="status-dot" />
        <span className="status-text">Connected - Reports require police approval</span>
      </div>
    </div>
  );
}
