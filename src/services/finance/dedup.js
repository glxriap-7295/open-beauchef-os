/**
 * Detección de duplicados e historial de importaciones.
 * Un fundador suele subir el MISMO extracto en CSV y en PDF: nunca debemos
 * duplicar movimientos. Comparamos por similitud (fecha ±1 día, mismo monto,
 * descripción muy parecida, misma cuenta) ignorando diferencias de formato.
 * No toca el motor financiero: solo separa "nuevos" de "ya existentes".
 */

/** Normaliza una descripción para comparar: sin acentos, sin números, sin ruido. */
export function normalizarDescripcion(desc) {
  return String(desc || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\d+/g, ' ')            // ignora números (refs, montos embebidos)
    .replace(/[^a-z\s]/g, ' ')       // solo letras
    .replace(/\b(app|cta|cuenta|traspaso|transferencia|transf|pago|abono|cargo|de|a|el|la|los|las)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Similitud de tokens (Jaccard) entre dos descripciones normalizadas. 0..1. */
export function similitudDescripcion(a, b) {
  const ta = new Set(normalizarDescripcion(a).split(' ').filter(Boolean));
  const tb = new Set(normalizarDescripcion(b).split(' ').filter(Boolean));
  if (!ta.size && !tb.size) return 1;
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / (ta.size + tb.size - inter);
}

function diasEntre(a, b) {
  const da = new Date(a), db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return Infinity;
  return Math.abs(da - db) / 86400000;
}

/** Clave de monto: valor absoluto redondeado (ignora ±0.5 por decimales/OCR). */
function montoKey(m) { return Math.round(Math.abs(Number(m) || 0)); }

/**
 * Puntaje de similitud 0..1 entre dos movimientos (modelo normalizado con
 * {date/fecha, amount/monto, description/descripcion, account?, reference?}).
 */
export function scoreDuplicado(x, y) {
  const ax = montoKey(x.amount ?? x.monto);
  const ay = montoKey(y.amount ?? y.monto);
  if (ax !== ay) return 0;                                   // distinto monto => no es duplicado
  const dias = diasEntre(x.date ?? x.fecha, y.date ?? y.fecha);
  if (dias > 1) return 0;                                    // más de ±1 día => no
  // Referencia idéntica (si ambas existen) es evidencia fuerte.
  const rx = String(x.reference ?? x.referencia ?? '').trim();
  const ry = String(y.reference ?? y.referencia ?? '').trim();
  if (rx && ry && rx === ry) return 1;
  // Misma cuenta suma evidencia (si ambas la traen).
  const cx = String(x.account ?? x.cuenta ?? '').trim();
  const cy = String(y.account ?? y.cuenta ?? '').trim();
  const cuentaOk = !cx || !cy || cx === cy;
  if (!cuentaOk) return 0;
  const sim = similitudDescripcion(x.description ?? x.descripcion, y.description ?? y.descripcion);
  // Combina cercanía de fecha (0..0.2) + similitud de descripción (0..0.8).
  const fechaScore = dias === 0 ? 0.2 : 0.1;
  return Math.min(1, fechaScore + sim * 0.8);
}

export const UMBRAL_DUPLICADO = 0.72;

/**
 * Separa movimientos nuevos de los que ya existen (contra transacciones previas
 * y/o el propio lote, evitando duplicados internos).
 * @param {Array} entrantes  modelo normalizado del pipeline
 * @param {Array} existentes transacciones ya guardadas (context.transacciones)
 * @returns {{ nuevos, duplicados }}
 */
export function separarDuplicados(entrantes = [], existentes = []) {
  const nuevos = [];
  const duplicados = [];
  // Clave EXACTA (fecha + monto + glosa cruda) para no perder movimientos
  // recurrentes legítimos dentro de un mismo archivo (misma cuota varios días,
  // transferencias iguales, etc.). El match difuso (±1 día + descripción
  // parecida) solo se aplica contra lo YA IMPORTADO, para atrapar el caso de
  // subir el MISMO extracto como CSV y como PDF sin duplicar.
  const claveExacta = (m) =>
    `${m.date ?? m.fecha}|${Math.round(Math.abs(Number(m.amount ?? m.monto) || 0))}|${String(m.description ?? m.descripcion ?? '').trim().toLowerCase()}`;
  const vistosExactos = new Set();
  for (const m of entrantes) {
    const dupExistente = existentes.some((e) => scoreDuplicado(m, e) >= UMBRAL_DUPLICADO);
    const k = claveExacta(m);
    const dupInterno = vistosExactos.has(k); // solo repeticiones IDÉNTICAS del propio archivo
    if (dupExistente || dupInterno) duplicados.push(m);
    else { nuevos.push(m); vistosExactos.add(k); }
  }
  return { nuevos, duplicados };
}

/** Hash estable (djb2) del contenido de un documento, para el historial. */
export function hashDocumento(texto = '') {
  let h = 5381;
  const s = String(texto);
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `doc-${h.toString(16)}`;
}

/** Período cubierto (min/max fecha) de un conjunto de movimientos. */
export function periodoDe(movs = []) {
  const f = movs.map((m) => m.date ?? m.fecha).filter(Boolean).sort();
  return f.length ? { desde: f[0], hasta: f[f.length - 1] } : null;
}

/** Construye un registro de historial para una importación. */
export function registroHistorial({ texto, institucion, cuenta, movimientos }) {
  return {
    hash: hashDocumento(texto),
    importadoEl: new Date().toISOString(),
    institucion: institucion || 'Desconocida',
    cuenta: cuenta || null,
    periodo: periodoDe(movimientos),
    transacciones: movimientos.length,
  };
}
