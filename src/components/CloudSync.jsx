import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { usePreparacion } from '../context/PreparacionContext.jsx';
import { firebaseHabilitado } from '../services/firebase/app.js';
import { loadStartup, saveStartup } from '../services/firebase/data.js';

/**
 * Sincroniza el estado del emprendedor con Firestore cuando Firebase está
 * configurado y hay sesión. Si Firebase no está activo, no hace nada (la app
 * sigue con LocalStorage). Se monta una vez dentro de los providers.
 */
export default function CloudSync() {
  const { user } = useAuth();
  const { estadoRaw, hidratar } = usePreparacion();
  const hidratadoRef = useRef(false);
  const uidRef = useRef(null);

  // 1) Al iniciar sesión, trae el estado guardado en la nube (si existe).
  useEffect(() => {
    if (!firebaseHabilitado() || !user?.id) {
      hidratadoRef.current = false;
      uidRef.current = null;
      return;
    }
    let vivo = true;
    hidratadoRef.current = false;
    uidRef.current = user.id;
    loadStartup(user.id)
      .then((doc) => {
        if (vivo && doc) hidratar(doc);
      })
      .catch((e) => console.warn('[CloudSync] No se pudo cargar el estado desde Firestore:', e?.message || e))
      .finally(() => { if (vivo) hidratadoRef.current = true; });
    return () => { vivo = false; };
  }, [user?.id, hidratar]);

  // 2) Guarda cambios en la nube (debounce), solo tras hidratar.
  useEffect(() => {
    if (!firebaseHabilitado() || !user?.id || !hidratadoRef.current) return undefined;
    const t = setTimeout(() => {
      saveStartup(user.id, estadoRaw, user)
        .catch((e) => console.error('[CloudSync] Firestore rechazó el guardado (las transacciones no se persistieron):', e?.message || e));
    }, 800);
    return () => clearTimeout(t);
  }, [estadoRaw, user]);

  return null;
}
