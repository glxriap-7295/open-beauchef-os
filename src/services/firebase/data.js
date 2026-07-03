import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from './app.js';

/**
 * Persistencia de datos por cuenta en Firestore.
 * Colección `startups/{uid}` con el estado completo del emprendedor.
 * Todo es no-op seguro si Firebase no está configurado (db === null).
 */

/** Carga el estado guardado de un emprendedor (o null si no existe). */
export async function loadStartup(uid) {
  if (!db || !uid) return null;
  const snap = await getDoc(doc(db, 'startups', uid));
  return snap.exists() ? (snap.data().estado || null) : null;
}

/** Guarda (merge) el estado del emprendedor + metadatos para la vista admin. */
export async function saveStartup(uid, estado, user) {
  if (!db || !uid) return;
  await setDoc(
    doc(db, 'startups', uid),
    {
      estado,
      email: user?.email || '',
      nombre: estado?.perfil?.nombre || user?.nombre || '',
      fuenteFinanciera: estado?.fuenteFinanciera || null,
      actualizado: Date.now(),
    },
    { merge: true }
  );
}

/** Lista todas las startups (para el panel de administración). */
export async function listStartups() {
  if (!db) return [];
  const q = await getDocs(collection(db, 'startups'));
  return q.docs.map((d) => ({ uid: d.id, ...d.data() }));
}
