/**
 * Dominio de SESIONES DE IMPORTACIÓN (import sessions).
 * ============================================================================
 * Funciones PURAS (sin React, sin Firebase) que implementan el modelo descrito
 * en docs/IMPORT_SESSION.md:
 *   · una importación es un draft hasta que se APRUEBA;
 *   · al aprobar se crea una ImportSession (con summary) y cada transacción
 *     queda estampada con provenance (importId/filename/source/date) y su
 *     categorización ORIGINAL inmutable;
 *   · editar categoría preserva `original` y registra `edited`;
 *   · borrar una importación elimina solo sus transacciones y su sesión;
 *   · backfill idempotente para datos previos (sin importId).
 *
 * Todo se guarda dentro del documento `estado` (aditivo). Sin arrays anidados
 * conflictivos con Firestore: `summary.byCategory` es un objeto plano.
 * ============================================================================
 */
import { categorize, legacyLabel, resolveCategoryId } from './categorize.js';

export const LEGACY_IMPORT_ID = 'imp-legacy';

/** ID de importación estable y único. */
export function newImportId() {
  return `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Resuelve el id de categoría efectivo de una transacción (nueva o legada). */
function catIdDe(t) {
  return t.categoryId || resolveCategoryId(t.categoria || t.category) || 'other';
}

/**
 * Resumen financiero denormalizado (keyed por categoryId estable).
 * @param {Array} transacciones
 * @returns {{transactions, income, expenses, net, byCategory}}
 */
export function summarize(transacciones = []) {
  let income = 0;
  let expenses = 0;
  const byCategory = {};
  for (const t of transacciones) {
    const monto = Number(t.monto ?? t.amount) || 0;
    const cid = catIdDe(t);
    byCategory[cid] = (byCategory[cid] || 0) + monto;
    if (monto >= 0) income += monto; else expenses += Math.abs(monto);
  }
  return { transactions: transacciones.length, income, expenses, net: income - expenses, byCategory };
}

/** Construye la categorización ORIGINAL (automática) de una transacción. */
function originalDe(t) {
  if (t.original) return t.original;
  const monto = Number(t.monto ?? t.amount) || 0;
  const desc = t.descripcion || t.description || 'Movimiento';
  const c = categorize(desc, monto);
  return { categoryId: c.categoryId, confidence: c.confidence, source: c.source, merchantId: c.merchantId, merchant: c.merchant, reason: c.reason };
}

/**
 * Estampa provenance + `original` inmutable sobre transacciones aprobadas.
 * Mantiene `categoria` (legado) sincronizada con el `categoryId` efectivo.
 */
export function estampar(transacciones = [], session) {
  const importedAt = session.approvedAt || new Date().toISOString();
  return transacciones.map((t, i) => {
    const monto = Number(t.monto ?? t.amount) || 0;
    const desc = t.descripcion || t.description || 'Movimiento';
    const effectiveId = catIdDe(t);
    const original = originalDe(t);
    const edited = effectiveId !== original.categoryId
      ? { fromCategoryId: original.categoryId, at: importedAt, by: 'user' }
      : t.edited;
    return {
      id: t.id || `tx-${Date.now()}-${i}`,
      fecha: t.fecha || t.date || '',
      monto,
      descripcion: desc,
      categoria: legacyLabel(effectiveId),
      categoryId: effectiveId,
      tipo: monto >= 0 ? 'ingreso' : 'egreso',
      confianza: t.confianza ?? t.confidence ?? null,
      source: t.source || 'manual',
      importId: session.importId,
      importFilename: session.filename,
      importSource: session.source,
      importedAt,
      original,
      ...(edited ? { edited } : {}),
    };
  });
}

/**
 * Crea una ImportSession aprobada a partir de la revisión y sus transacciones.
 * @returns {{session, transacciones}} listos para persistir.
 */
export function aprobar({ transacciones = [], filename = 'Importación', source = 'manual', institution = null, account = null, period = null, fileType = null, docHash = null, counts = null } = {}) {
  const now = new Date().toISOString();
  const session = {
    importId: newImportId(),
    filename,
    source,
    status: 'approved',
    createdAt: now,
    approvedAt: now,
    institution,
    account,
    period,
    fileType,
    docHash,
    counts: counts || { parsed: transacciones.length, imported: transacciones.length, duplicates: 0, review: 0 },
    summary: summarize(transacciones),
    schemaVersion: 1,
  };
  const estampadas = estampar(transacciones, session);
  session.summary = summarize(estampadas); // resumen final tras estampar categorías efectivas
  return { session, transacciones: estampadas };
}

/**
 * Edita la categoría de una transacción PRESERVANDO su `original`.
 * @param {object} t          transacción
 * @param {string} categoryId nuevo id de categoría efectivo
 */
export function editarCategoria(t, categoryId) {
  const original = t.original || {
    categoryId: catIdDe(t), confidence: t.confianza ?? null, source: t.source || 'unknown', merchantId: null, merchant: null, reason: '',
  };
  return {
    ...t,
    categoryId,
    categoria: legacyLabel(categoryId),
    confianza: 100,
    source: 'user',
    original,
    edited: { fromCategoryId: t.categoryId || original.categoryId, at: new Date().toISOString(), by: 'user' },
  };
}

/** Recalcula el summary de una sesión tras editar/borrar transacciones. */
export function recomputarSummary(session, transacciones) {
  const suyas = transacciones.filter((t) => t.importId === session.importId);
  return { ...session, summary: summarize(suyas), counts: { ...session.counts, imported: suyas.length } };
}

/**
 * Borra una importación completa: elimina sus transacciones y su sesión.
 * (No toca el resto; deja el docHash libre para re-importar.)
 */
export function eliminarImportacion(estado, importId) {
  const transacciones = (estado.transacciones || []).filter((t) => t.importId !== importId);
  const importSessions = (estado.importSessions || []).filter((s) => s.importId !== importId);
  return { ...estado, transacciones, importSessions };
}

/** Borra UNA transacción y actualiza el summary/counts de su sesión. */
export function eliminarTransaccion(estado, txId) {
  const tx = (estado.transacciones || []).find((t) => t.id === txId);
  const transacciones = (estado.transacciones || []).filter((t) => t.id !== txId);
  const importSessions = (estado.importSessions || []).map((s) => (tx && s.importId === tx.importId ? recomputarSummary(s, transacciones) : s));
  return { ...estado, transacciones, importSessions };
}

/**
 * Backfill IDEMPOTENTE para datos previos: cualquier transacción sin `importId`
 * se asigna a la sesión sintética `imp-legacy`. Re-ejecutar es no-op.
 */
export function backfillLegacy(estado) {
  const txs = estado.transacciones || [];
  if (!txs.some((t) => !t.importId)) return estado; // idempotente: nada que migrar
  const source = estado.fuenteFinanciera || 'manual';
  const transacciones = txs.map((t) => (t.importId ? t : {
    ...t,
    categoryId: catIdDe(t),
    importId: LEGACY_IMPORT_ID,
    importFilename: 'Datos previos',
    importSource: source,
    importedAt: null,
    original: t.original || {
      categoryId: catIdDe(t), confidence: t.confianza ?? null, source: t.source || 'legacy', merchantId: null, merchant: null, reason: 'Datos previos a la revisión',
    },
  }));
  const sessions = estado.importSessions || [];
  const suyas = transacciones.filter((t) => t.importId === LEGACY_IMPORT_ID);
  const legacySession = {
    importId: LEGACY_IMPORT_ID, filename: 'Datos previos', source, status: 'approved',
    createdAt: null, approvedAt: null, institution: null, account: null, period: null,
    fileType: null, docHash: null,
    counts: { parsed: suyas.length, imported: suyas.length, duplicates: 0, review: 0 },
    summary: summarize(suyas), schemaVersion: 1,
  };
  const importSessions = sessions.some((s) => s.importId === LEGACY_IMPORT_ID) ? sessions : [legacySession, ...sessions];
  return { ...estado, transacciones, importSessions };
}
