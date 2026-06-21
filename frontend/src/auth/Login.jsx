import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.12 } },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120, damping: 18 } },
};

const demoCredentials = {
  user: { email: 'user@trafficiq.local', password: 'user123' },
  police: { email: 'police@trafficiq.local', password: 'police123' },
};

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('user');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(demoCredentials.user.email);
  const [password, setPassword] = useState(demoCredentials.user.password);
  const [error, setError] = useState('');

  const switchRole = (nextRole) => {
    setRole(nextRole);
    if (mode === 'login') {
      setEmail(demoCredentials[nextRole].email);
      setPassword(demoCredentials[nextRole].password);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    if (nextMode === 'login') {
      setEmail(demoCredentials[role].email);
      setPassword(demoCredentials[role].password);
    } else {
      setEmail('');
      setPassword('');
      setName('');
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');
    try {
      const session = mode === 'login'
        ? login({ email, password, role })
        : register({ name, email, password, role });
      navigate(session.role === 'police' ? '/police' : '/user');
    } catch (err) {
      setError(err.message || 'Authentication failed');
    }
  };

  return (
    <div className="login-page auth-page-modern">
      <motion.div className="auth-shell" variants={container} initial="hidden" animate="show">
        <motion.div className="auth-hero" variants={item}>
          <div className="login-logo"><span className="logo-mark">TIQ</span></div>
          <h1 className="login-title">TrafficIQ</h1>
          <p className="login-subtitle">AI-powered traffic event reporting, police approval, and diversion-aware routing.</p>
          <div className="auth-feature-grid">
            <div><strong>AI Parser</strong><span>Understands messy reports</span></div>
            <div><strong>Police Control</strong><span>Approve before publishing</span></div>
            <div><strong>Live Routing</strong><span>Avoids full-block roads</span></div>
          </div>
        </motion.div>

        <motion.div className="login-container login-card auth-card-modern" variants={item}>
          <div className="auth-card-header">
            <div>
              <h2>{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
              <p>{mode === 'login' ? 'Choose your role and sign in.' : 'Create a citizen or police demo account.'}</p>
            </div>
          </div>

          <div className="role-choice-grid">
            <button type="button" className={`role-choice-card ${role === 'user' ? 'active' : ''}`} onClick={() => switchRole('user')}>
              <span>Citizen</span>
              <small>Report events and view approved alerts</small>
            </button>
            <button type="button" className={`role-choice-card ${role === 'police' ? 'active' : ''}`} onClick={() => switchRole('police')}>
              <span>Police</span>
              <small>Verify, publish, and close events</small>
            </button>
          </div>

          <div className="login-tabs compact-auth-tabs">
            <button type="button" className={`login-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => switchMode('login')}>Login</button>
            <button type="button" className={`login-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => switchMode('register')}>Create account</button>
          </div>

          {error && <motion.div className="error-flash" variants={item}>{error}</motion.div>}

          <form className="login-form" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label" htmlFor="login-name">Name</label>
                <input id="login-name" className="form-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" required />
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email</label>
              <input id="login-email" className="form-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <input id="login-password" className="form-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" required />
            </div>

            <motion.button type="submit" className="submit-btn" whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
              {mode === 'login' ? 'Login' : 'Create account'} as {role === 'police' ? 'Police' : 'Citizen'}
            </motion.button>

            {mode === 'login' && (
              <div className="demo-credentials-note">
                Demo: {demoCredentials[role].email} / {demoCredentials[role].password}
              </div>
            )}
          </form>
        </motion.div>
      </motion.div>
    </div>
  );
}
