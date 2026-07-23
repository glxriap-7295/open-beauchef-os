import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { authFb } from '../firebase/app.js';

/**
 * Proveedor de autenticación Firebase (email/password).
 * Misma interfaz que localAuthProvider + onAuthChange para restaurar la sesión
 * de forma asíncrona (Firebase persiste la sesión entre dispositivos/visitas).
 */
const map = (u) => (u ? { id: u.uid, nombre: u.displayName || (u.email || '').split('@')[0], email: u.email } : null);

// La sesión persiste en el navegador hasta "Cerrar sesión".
if (authFb) setPersistence(authFb, browserLocalPersistence)
  .catch((e) => console.warn('[Auth] No se pudo fijar la persistencia de sesión:', e?.message || e));

export const firebaseAuthProvider = {
  id: 'firebase',

  async register({ nombre, email, password }) {
    const cr = await createUserWithEmailAndPassword(authFb, email, password);
    if (nombre) await updateProfile(cr.user, { displayName: nombre })
      .catch((e) => console.warn('[Auth] No se pudo fijar el nombre del perfil:', e?.message || e));
    return map(cr.user);
  },

  async login({ email, password }) {
    const cr = await signInWithEmailAndPassword(authFb, email, password);
    return map(cr.user);
  },

  async logout() {
    await signOut(authFb);
  },

  getSession() {
    return map(authFb?.currentUser);
  },

  /** Suscribe cambios de sesión (restauración asíncrona). Devuelve unsubscribe. */
  onAuthChange(cb) {
    return onAuthStateChanged(authFb, (u) => cb(map(u)));
  },

  async updateUser(patch) {
    const u = authFb?.currentUser;
    if (!u) return null;
    if (patch.nombre !== undefined) await updateProfile(u, { displayName: patch.nombre })
      .catch((e) => console.warn('[Auth] No se pudo actualizar el nombre:', e?.message || e));
    if (patch.password) await updatePassword(u, patch.password)
      .catch((e) => { console.warn('[Auth] No se pudo actualizar la contraseña:', e?.message || e); throw e; });
    return map(authFb.currentUser);
  },
};
