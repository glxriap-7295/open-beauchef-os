import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Inicialización opt-in de Firebase.
 *
 * Solo se activa si defines las variables VITE_FIREBASE_*. Si faltan, la app
 * sigue funcionando 100% con LocalStorage (nada se rompe). Cuando están
 * presentes, se habilitan Auth (sesión multi-dispositivo) y Firestore
 * (datos por cuenta + vista admin).
 */
const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function firebaseHabilitado() {
  return Boolean(cfg.apiKey && cfg.projectId && cfg.appId);
}

let app = null;
let authFb = null;
let db = null;

if (firebaseHabilitado()) {
  try {
    app = initializeApp(cfg);
    authFb = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[firebase] No se pudo inicializar; usando modo local.', e);
    app = null; authFb = null; db = null;
  }
}

export { app, authFb, db };
