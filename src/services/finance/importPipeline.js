/**
 * Pipeline de importación AI-first, en ETAPAS INDEPENDIENTES y aisladas.
 *   detectar → extraer → entender → normalizar → validar → deduplicar →
 *   categorizar → resumen
 * Cada etapa se ejecuta dentro de `etapa()`: si falla, se registra en el logger
 * y el pipeline continúa con un fallback seguro (nunca crashea). El resultado
 * incluye `warnings` (validación) y `logs` (diagnóstico accionable).
 *
 * NO toca el motor financiero: produce el modelo normalizado que ya consume el
 * dashboard (date, amount) más metadatos (category, type, confidence, source).
 * Reutiliza los servicios existentes como implementación de cada etapa.
 */
import { extraerArchivo } from './extractor.js';
import { manualProvider } from '../banking/manualProvider.js';
import { categorizar, CATEGORIAS } from './categorizer.js';
import { categorize, legacyLabel, resolveCategoryId } from './categorize.js';
import { getAIProvider } from '../ai/index.js';
import { separarDuplicados, periodoDe, registroHistorial } from './dedup.js';
import { validarMovimientos } from './validation.js';
import { createLogger } from './logger.js';

export const UMBRAL_CONFIANZA = 60; // < umbral => requiere revisión del fundador

// Instituciones financieras chilenas + pasarelas frecuentes. Si no matchea,
// continuamos igual (nunca fallamos por no reconocer el banco).
const INSTITUCIONES = [
  ['Banco de Chile', /banco de chile|bancochile|banchile|edwards/],
  ['BancoEstado', /bancoestado|banco (del )?estado|estado\.cl/],
  ['Santander', /santander/],
  ['BCI', /\bbci\b|banco de cr[eé]dito e inversiones|tbanc/],
  ['Mach', /\bmach\b/],
  ['Itaú', /ita[uú]/],
  ['Scotiabank', /scotiabank|scotia/],
  ['Banco Security', /\bsecurity\b/],
  ['Banco Falabella', /falabella/],
  ['Banco Ripley', /banco ripley/],
  ['Tenpo', /\btenpo\b/],
  ['Mercado Pago', /mercado ?pago/],
  ['Tapp Caja Los Andes', /\btapp\b|caja los andes/],
  ['Stripe', /stripe/], ['Shopify', /shopify/], ['PayPal', /paypal/],
];

function detectarInstitucion(texto = '') {
  const t = texto.toLowerCase();
  for (const [nombre, re] of INSTITUCIONES) if (re.test(t)) return nombre;
  return 'Institución no identificada';
}

function detectarCuenta(texto = '') {
  const m = String(texto).match(/cuenta\s*(?:corriente|vista|rut)?\s*[:#n°º.]*\s*(\d[\d.\-]{5,})/i);
  return m ? m[1].replace(/[.\-\s]/g, '') : null;
}

/** Ejecuta una etapa aislada: nunca lanza; registra y devuelve fallback. */
async function etapa(log, nombre, fn, fallback) {
  try {
    const r = await fn();
    return r;
  } catch (e) {
    log.error(nombre, { error: e?.message || String(e), recuperado: true });
    return fallback;
  }
}

async function entenderNegocio(base, log) {
  const cats = new Set(base.map((m) => categorizar(m.descripcion, m.monto).categoria));
  let modelo = 'General';
  if (cats.has('Marketplace') || cats.has('Envíos')) modelo = 'E-commerce';
  else if (cats.has('Software')) modelo = 'SaaS / Software';
  try {
    const ai = getAIProvider();
    const muestra = base.slice(0, 40).map((m) => m.descripcion).join('\n');
    const j = await ai.json(
      `Eres analista financiero. A partir de estas descripciones de movimientos bancarios de una startup chilena, ` +
      `infiere el negocio. Devuelve SOLO JSON {"modelo":"...","industria":"...","proveedoresRecurrentes":[],"fuentesIngreso":[]}.\n${muestra}`,
    );
    if (j && j.modelo) { log.info('entender', { fuente: 'ia', modelo: j.modelo }); return { modelo: j.modelo, industria: j.industria || '', detalle: j }; }
  } catch (e) { log.warn('entender', { fuente: 'ia', error: e?.message, fallback: 'heuristica' }); }
  log.info('entender', { fuente: 'heuristica', modelo });
  return { modelo, industria: '', detalle: null };
}

async function categorizarInciertosIA(inciertos, negocio, log) {
  if (!inciertos.length) return [];
  try {
    const ai = getAIProvider();
    const lista = inciertos.slice(0, 30).map((m) => `${m.id}: ${m.description} (${m.amount})`).join('\n');
    const j = await ai.json(
      `Contexto de negocio: ${negocio?.modelo || 'general'}. Clasifica CADA movimiento en UNA categoría de esta lista exacta: ` +
      `${CATEGORIAS.join(', ')}. No inventes categorías. Devuelve SOLO un array JSON [{"id":"...","category":"..."}].\n${lista}`,
    );
    return Array.isArray(j) ? j : [];
  } catch (e) {
    log.warn('categorizar', { fuente: 'ia', error: e?.message, fallback: 'reglas' });
    return [];
  }
}

/**
 * Analiza un archivo y devuelve el resumen para aprobar ANTES de importar.
 * @param {File} file
 * @param {object} opts { mappings, existentes, onPaso }
 * @returns resultado con { movimientos, duplicados, warnings, logs, ... } o { error }
 */
export async function analizarArchivo(file, { mappings = {}, existentes = [], onPaso } = {}) {
  const log = createLogger('Import');
  const paso = (t) => { try { onPaso?.(t); } catch { /* noop */ } };
  const salida = (extra) => ({ warnings: [], logs: log.entries, ...extra });

  // 1) DETECCIÓN + EXTRACCIÓN (aislada) ──────────────────────────────
  paso('detectando');
  const extraido = await etapa(log, 'detectar', () => extraerArchivo(file, { onPaso }), null);
  if (!extraido) return salida({ error: 'No pudimos leer este archivo. Verifica que sea un CSV, Excel o PDF válido.' });
  const { tipo, texto, filas } = extraido;
  log.info('detectar', { archivo: file?.name, tipo, filas: filas?.length || 0 });

  if (tipo === 'pdf-escaneado') {
    log.warn('extraer', { tipo, motivo: 'sin-texto-ni-ocr' });
    return salida({ error: 'Este PDF parece escaneado y no pudimos reconocer el texto (OCR). Súbelo como CSV/Excel o un PDF con texto seleccionable.', tipo });
  }

  paso('leyendo');
  const { movimientos: base } = await etapa(log, 'extraer', () => manualProvider.procesarFilas(filas), { movimientos: [] });
  log.info('extraer', { movimientosCrudos: base.length });
  if (!base.length) {
    return salida({ error: 'No pudimos identificar la tabla de movimientos. Revisa que el archivo tenga columnas de fecha, descripción y montos.', tipo });
  }

  const institucion = detectarInstitucion(texto);
  const cuenta = detectarCuenta(texto);
  log.info('detectar', { institucion, cuenta: cuenta ? '••' + String(cuenta).slice(-4) : null });

  // 2) ENTENDER NEGOCIO (aislada) ────────────────────────────────────
  paso('entendiendo');
  const negocio = await etapa(log, 'entender', () => entenderNegocio(base, log), { modelo: 'General', industria: '', detalle: null });

  // 3) NORMALIZACIÓN → esquema único ─────────────────────────────────
  const normalizados = base.map((m, i) => ({
    id: m.id || `tx-${Date.now()}-${i}`,
    date: m.fecha,
    description: m.descripcion,
    amount: m.monto,
    balance: null,
    currency: 'CLP',
    account: cuenta,
    category: null,
    type: m.monto >= 0 ? 'ingreso' : 'egreso',
    confidence: null,
    source: null,
    suspicious: !!m.sospechoso,
    sourceDocument: file?.name || null,
    rawData: m,
  }));

  // 4) VALIDACIÓN (nunca descarta en silencio) ───────────────────────
  const { warnings } = await etapa(log, 'validar', () => validarMovimientos(normalizados), { warnings: [] });
  for (const w of warnings) log[w.level === 'error' ? 'error' : w.level === 'warn' ? 'warn' : 'info']('validar', { code: w.code, count: w.count, message: w.message });

  // 5) DEDUPLICACIÓN vs historial + lote ─────────────────────────────
  const { nuevos, duplicados } = await etapa(log, 'deduplicar', () => separarDuplicados(normalizados, existentes), { nuevos: normalizados, duplicados: [] });
  log.info('deduplicar', { entrantes: normalizados.length, duplicados: duplicados.length, nuevos: nuevos.length });

  // 6) CATEGORIZACIÓN (reglas → memoria → IA) solo de los nuevos ──────
  //    Ahora usa el motor con IDs estables y adjunta `categoryId` + snapshot
  //    `original` (para preservar la categorización automática — M2, refinamiento 2).
  paso('categorizando');
  for (const m of nuevos) {
    const c = categorize(m.description, m.amount, { memory: mappings });
    m.categoryId = c.categoryId;
    m.category = legacyLabel(c.categoryId);           // etiqueta legada para la UI/engine actual
    m.type = m.amount >= 0 ? 'ingreso' : 'egreso';
    m.confidence = m.suspicious ? Math.min(c.confidence, 30) : c.confidence;
    m.source = c.source;
    m._auto = { categoryId: c.categoryId, confidence: c.confidence, source: c.source, merchantId: c.merchantId, merchant: c.merchant, reason: c.reason };
  }
  const sugerencias = await categorizarInciertosIA(nuevos.filter((m) => m.confidence < UMBRAL_CONFIANZA && !m.suspicious), negocio, log);
  for (const s of sugerencias) {
    const mv = nuevos.find((m) => m.id === s.id);
    if (mv && s.category && CATEGORIAS.includes(s.category)) {
      const cid = resolveCategoryId(s.category) || mv.categoryId;
      mv.categoryId = cid;
      mv.category = legacyLabel(cid);
      mv.confidence = Math.max(mv.confidence, 78);
      mv.source = 'ia';
      mv._auto = { categoryId: cid, confidence: mv.confidence, source: 'ai', merchantId: null, merchant: null, reason: 'Sugerido por IA con contexto del negocio' };
    }
  }
  // Congela la categorización ORIGINAL (automática) e inmutable para auditoría.
  for (const m of nuevos) { m.original = m._auto; delete m._auto; }

  // 7) RESUMEN para aprobación ───────────────────────────────────────
  paso('resumen');
  const ingresos = nuevos.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0);
  const egresos = nuevos.filter((m) => m.amount < 0).reduce((s, m) => s + Math.abs(m.amount), 0);
  const porCategoria = {};
  for (const m of nuevos) porCategoria[m.category] = (porCategoria[m.category] || 0) + 1;
  const confianzaPromedio = nuevos.length ? Math.round(nuevos.reduce((s, m) => s + m.confidence, 0) / nuevos.length) : 0;
  const revisar = nuevos.filter((m) => m.confidence < UMBRAL_CONFIANZA || m.suspicious);
  const sospechosos = nuevos.filter((m) => m.suspicious);

  log.info('resumen', { importables: nuevos.length, revisar: revisar.length, sospechosos: sospechosos.length, confianzaPromedio });

  return {
    tipo, institucion, cuenta, negocio,
    periodo: periodoDe(nuevos.length ? nuevos : normalizados),
    movimientos: nuevos,
    duplicados,
    total: nuevos.length,
    totalExtraidas: normalizados.length,
    ingresos, egresos, porCategoria, confianzaPromedio,
    revisar, sospechosos,
    warnings,
    logs: log.entries,
    historial: registroHistorial({ texto, institucion, cuenta, movimientos: normalizados }),
  };
}
