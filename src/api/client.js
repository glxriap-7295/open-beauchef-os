import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE || 'http://localhost:3000';
const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL || 'paloma@decantopia.cl';
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD || 'paloma1234';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
});

let token = null;

// Adjunta el Bearer token automáticamente cuando existe.
api.interceptors.request.use((config) => {
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** POST /auth/login — guarda el token en memoria. */
export async function login(email = DEMO_EMAIL, password = DEMO_PASSWORD) {
  const { data } = await api.post('/auth/login', { email, password });
  token = data.token;
  return data;
}

/** GET /startup/profile */
export async function getProfile() {
  const { data } = await api.get('/startup/profile');
  return data;
}

/** GET /reports/p-and-l?mes=YYYY-MM (sin mes = consolidado) */
export async function getPandL(mes) {
  const { data } = await api.get('/reports/p-and-l', { params: mes ? { mes } : {} });
  return data;
}

/** GET /reports/cash-flow?mes=YYYY-MM (opcional) */
export async function getCashFlow(mes) {
  const { data } = await api.get('/reports/cash-flow', { params: mes ? { mes } : {} });
  return data;
}

/** GET /reports/runway */
export async function getRunway() {
  const { data } = await api.get('/reports/runway');
  return data;
}

/**
 * Verifica la conexión con el backend e intenta autenticarse.
 * Devuelve { conectado, perfil } sin lanzar excepción.
 */
export async function probarConexion() {
  try {
    await login();
    const perfil = await getProfile();
    return { conectado: true, perfil };
  } catch (err) {
    return { conectado: false, error: err?.message || 'Sin conexión al backend' };
  }
}

export { BASE_URL };
