import { persistence } from '../persistence/index.js';

/**
 * Autenticación con proveedores intercambiables.
 * Default: localAuthProvider (LocalStorage) para el piloto.
 * La interfaz es compatible con Firebase Auth: register / login / logout /
 * getSession devuelven el mismo shape { id, nombre, email }. Migrar a Firebase
 * en el futuro no cambia la UI (solo se registra otro provider).
 */
const USERS_KEY = 'ob_auth_users';
const SESSION_KEY = 'ob_auth_session';

// "Hash" trivial solo para el piloto local. NO es seguridad real; en producción
// la verificación ocurre en el proveedor (Firebase Auth) o en el backend.
function huella(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

const localAuthProvider = {
  id: 'local',

  _usuarios() {
    return persistence.get(USERS_KEY, []);
  },
  _guardarUsuarios(u) {
    persistence.set(USERS_KEY, u);
  },

  async register({ nombre, email, password }) {
    const correo = String(email || '').trim().toLowerCase();
    if (!correo || !password) throw new Error('Ingresa email y contraseña.');
    const usuarios = this._usuarios();
    if (usuarios.some((u) => u.email === correo)) {
      throw new Error('Ya existe una cuenta con ese email. Inicia sesión.');
    }
    const user = { id: `u-${Date.now()}`, nombre: nombre || correo.split('@')[0], email: correo, pass: huella(password) };
    this._guardarUsuarios([...usuarios, user]);
    persistence.set(SESSION_KEY, { userId: user.id });
    return { id: user.id, nombre: user.nombre, email: user.email };
  },

  async login({ email, password }) {
    const correo = String(email || '').trim().toLowerCase();
    const user = this._usuarios().find((u) => u.email === correo);
    if (!user || user.pass !== huella(password)) {
      throw new Error('Email o contraseña incorrectos.');
    }
    persistence.set(SESSION_KEY, { userId: user.id });
    return { id: user.id, nombre: user.nombre, email: user.email };
  },

  async logout() {
    persistence.remove(SESSION_KEY);
  },

  /** Restaura la sesión guardada (persistencia entre visitas). */
  getSession() {
    const s = persistence.get(SESSION_KEY);
    if (!s?.userId) return null;
    const user = this._usuarios().find((u) => u.id === s.userId);
    return user ? { id: user.id, nombre: user.nombre, email: user.email } : null;
  },

  async updateUser(patch) {
    const s = persistence.get(SESSION_KEY);
    if (!s?.userId) return null;
    const usuarios = this._usuarios();
    const idx = usuarios.findIndex((u) => u.id === s.userId);
    if (idx === -1) return null;
    if (patch.password) usuarios[idx].pass = huella(patch.password);
    if (patch.nombre !== undefined) usuarios[idx].nombre = patch.nombre;
    this._guardarUsuarios(usuarios);
    return { id: usuarios[idx].id, nombre: usuarios[idx].nombre, email: usuarios[idx].email };
  },
};

const PROVIDERS = { local: localAuthProvider };
export const auth = PROVIDERS[import.meta.env.VITE_AUTH_PROVIDER || 'local'] || localAuthProvider;
