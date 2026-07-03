import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { auth } from '../services/auth/index.js';

/**
 * Sesión del usuario. Se restaura automáticamente al abrir la app (persistencia
 * en LocalStorage) y solo se cierra con "Cerrar sesión". Compatible con Firebase
 * Auth a futuro sin cambiar la UI.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // Restaura la sesión previa al montar.
  useEffect(() => {
    setUser(auth.getSession());
    setReady(true);
  }, []);

  const register = useCallback(async (datos) => {
    const u = await auth.register(datos);
    setUser(u);
    return u;
  }, []);

  const login = useCallback(async (datos) => {
    const u = await auth.login(datos);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await auth.logout();
    setUser(null);
  }, []);

  const actualizarUsuario = useCallback(async (patch) => {
    const u = await auth.updateUser(patch);
    if (u) setUser(u);
    return u;
  }, []);

  const value = useMemo(
    () => ({ user, ready, autenticado: Boolean(user), register, login, logout, actualizarUsuario }),
    [user, ready, register, login, logout, actualizarUsuario]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
