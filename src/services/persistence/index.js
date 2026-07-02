/**
 * Capa de persistencia con proveedores intercambiables.
 * Default: LocalStorageProvider (funciona sin backend).
 * Futuro: FirebaseProvider (stub) — se activará con VITE_PERSISTENCE=firebase
 * y las credenciales correspondientes, sin cambiar el resto de la app.
 */

const localStorageProvider = {
  id: 'local',
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
};

// Stub para el futuro. Intencionalmente delega en local hasta que se configure
// Firebase (no requiere Firebase hoy; ver README para variables de entorno).
const firebaseProvider = {
  id: 'firebase',
  _warned: false,
  _warn() {
    if (!this._warned) {
      // eslint-disable-next-line no-console
      console.info('[persistence] FirebaseProvider aún no configurado; usando LocalStorage.');
      this._warned = true;
    }
  },
  get(key, fallback) { this._warn(); return localStorageProvider.get(key, fallback); },
  set(key, value) { this._warn(); return localStorageProvider.set(key, value); },
  remove(key) { this._warn(); return localStorageProvider.remove(key); },
};

const PROVIDERS = { local: localStorageProvider, firebase: firebaseProvider };

export const persistence =
  PROVIDERS[import.meta.env.VITE_PERSISTENCE || 'local'] || localStorageProvider;
