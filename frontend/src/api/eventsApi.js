import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function createEvent(payload) {
  const response = await api.post('/api/events/', payload);
  return response.data.data;
}

export async function getAllEvents() {
  const response = await api.get('/api/events/');
  return response.data.data || [];
}

export async function calculateRoute(payload) {
  const response = await api.post('/api/route', payload);
  return response.data.data;
}

export async function getPendingEvents() {
  const response = await api.get('/api/events/pending');
  return response.data.data || [];
}

export async function getActiveEvents() {
  const response = await api.get('/api/events/active');
  return response.data.data || [];
}

export async function approveEvent(eventId, finalAction, actionPlan = '') {
  const response = await api.patch(`/api/events/${eventId}/approve`, {
    final_action: finalAction,
    action_plan: actionPlan,
  });
  return response.data.data;
}

export async function closeEvent(eventId) {
  const response = await api.patch(`/api/events/${eventId}/close`);
  return response.data.data;
}

export async function getSimilarEvents(eventId) {
  const response = await api.get(`/api/events/${eventId}/similar`);
  return response.data.data || [];
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}
