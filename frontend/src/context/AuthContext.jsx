import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

const AuthContext = createContext(null);
const USERS_KEY = 'trafficiq_users';
const SESSION_KEY = 'trafficiq_session';

const DEFAULT_USERS = [
  { name: 'Citizen Demo', email: 'user@trafficiq.local', password: 'user123', role: 'user' },
  { name: 'Control Room', email: 'police@trafficiq.local', password: 'police123', role: 'police' },
];

function readUsers() {
  try {
    const stored = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    if (stored.length) return stored;
  } catch (_) {}
  localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
  return DEFAULT_USERS;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch (_) {
      return null;
    }
  });

  useEffect(() => {
    readUsers();
  }, []);

  const login = useCallback(({ email, password, role }) => {
    const users = readUsers();
    const found = users.find(
      (item) =>
        item.email.toLowerCase() === email.trim().toLowerCase() &&
        item.password === password &&
        item.role === role
    );

    if (!found) {
      throw new Error('Invalid credentials for selected role');
    }

    const session = { name: found.name, email: found.email, role: found.role };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
    return session;
  }, []);

  const register = useCallback(({ name, email, password, role }) => {
    const users = readUsers();
    const cleanEmail = email.trim().toLowerCase();

    if (users.some((item) => item.email.toLowerCase() === cleanEmail)) {
      throw new Error('An account with this email already exists');
    }

    const newUser = {
      name: name.trim() || (role === 'police' ? 'Police Officer' : 'Citizen'),
      email: cleanEmail,
      password,
      role,
    };

    const nextUsers = [...users, newUser];
    localStorage.setItem(USERS_KEY, JSON.stringify(nextUsers));

    const session = { name: newUser.name, email: newUser.email, role: newUser.role };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
    return session;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, register, logout }), [user, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
