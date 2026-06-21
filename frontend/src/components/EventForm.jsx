import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function EventForm({ onSubmit, title = 'Report Event', submitLabel = 'Report Event' }) {
  const [location, setLocation] = useState('MG Road Bengaluru');
  const [description, setDescription] = useState('Car accident at MG Road causing traffic congestion and partial blockage.');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleUseSample = () => {
    setLocation('MG Road Bengaluru');
    setDescription('Truck accident near MG Road causing traffic congestion. One lane blocked and traffic moving slowly.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        location: location.trim(),
        description: description.trim(),
      };

      await onSubmit(payload);
      setDescription('');
      setMessage('Event submitted successfully. Police will verify it before publishing to users.');
      setTimeout(() => setMessage(''), 3200);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to submit event');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      <div className="section-title">
        {title}
        <button type="button" className="mini-link-btn" onClick={handleUseSample}>Use Sample</button>
      </div>

      <AnimatePresence>
        {message && <motion.div className="success-flash" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>{message}</motion.div>}
        {error && <motion.div className="error-flash" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>{error}</motion.div>}
      </AnimatePresence>

      <form className="event-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="event-location">Location / Place</label>
          <input id="event-location" className="form-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Example: MG Road Bengaluru" required />
          <small className="form-hint">Coordinates are geocoded automatically by the backend.</small>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="event-description">Event Description</label>
          <textarea id="event-description" className="form-input form-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Example: Car accident, partial blockage, heavy traffic" rows="5" required />
        </div>

        <motion.button type="submit" className="submit-btn" disabled={submitting} whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
          {submitting ? 'Submitting...' : submitLabel}
        </motion.button>
      </form>
    </motion.div>
  );
}
