/**
 * Pipeline de importación AI-first. La IA ORQUESTA; las reglas garantizan que
 * siempre funcione (offline / sin IA). Flujo:
 *   archivo → extracción universal → entender negocio → normalizar →
 *   reglas+memoria → IA para inciertos → dedup vs historial → resumen (aprobar).
 * NO toca el motor financiero; produce el modelo normalizado que ya consume el
 * dashboard (date, amount) más metadatos (category, type, confidence, source).
 */
import { extraerArchivo } from './extractor.js';
import { manualProvider } from '../banking/manualProvider.js';
import { categorizar, CATEGORIAS } from './categorizer.js';
import { getAIProvider } from '../ai/index.js';
import { separarDuplicados, periodoDe, registroHistorial } from './dedup.js';

export const UMBRAL_CONFIANZA = 60; // < umbral => requiere revisión del fundador

// Instituciones financieras chilenas + pasarelas frecuentes. Si no matchea,
// continuamos igual (nunca fallamos por no reconocer el banco).
const INSTITUCIONES = [
  ['Banco de Chile', /banco de chile|bancochile|banchile|edwards/],
  ['BancoEstado', /bancoestado|banco (del )?estado|estado\.cl/],
  ['Santander', /santander/],
  ['BCI', /\bbci\b|banco de cr[eé]dito e inversiones|tbanc|mach/],
  ['Mach', /\bmach\b/],
  ['Itaú', /ita[uú]/],
  ['Scotiabank', /scotiabank|scotia/],
  ['Banco Security', /\bsecurity\b/],
  ['Banco Falabella', /falabella/],
  ['Banco Ripley', /banco ripley/],
  ['Tenpo', /\btenpo\b/],
  ['Mercado Pago', /mercado ?pago/],
  ['Tapp Caja Los Andes', /\btapp\b|caja los andes/],
  ['Stripe', /stripe/],
  ['Shopify', /shopify/],
  ['PayPal', /paypal/],
];

function detectarInstitucion(texto = '') {
  const t = texto.toLowerCase();
  for (const [nombre, re] of INSTITUCIONES) if (re.test(t)) return nombre;
  return 'Institución no identificada';
}

// Intenta ubicar el número de cuenta (evidencia para dedup y para el historial).
function detectarCuenta(texto = '') {
  const m = String(texto).match(/cuenta\s*(?:corriente|vista|rut)?\s*[:#n°º.]*\s*(\d[\d.\-]{5,})/i);
  return m ? m[1].replace(/[.\-\s]/g, '') : null;
}

async function entenderNegocio(base) {
  // Heurística determinista (siempre disponible).
  const cats = new Set(base.map((m) => categorizar(m.descripcion, m.monto).categoria));
  let modelo = 'General';
  if (cats.has('Marketplace') || cats.has('Envíos')) modelo = 'E-commerce';
  else if (cats.has('Software')) modelo = 'SaaS / Software';

  // Enriquecimiento con IA (opcional; null => se queda con la heurística).
  try {
    const ai = getAIProvider();
    const muestra = base.slice(0, 40).map((m) => m.descripcion).join('\n');
    const j = await ai.json(
      `Eres analista financiero. A partir de estas descripciones de movimientos bancarios de una startup chilena, ` +
      `infiere el negocio. Devuelve SOLO JSON {"modelo":"...","industria":"...","proveedoresRecurrentes":[],"fuentesIngreso":[]}.\n${muestra}`
    );
    if (j && j.modelo) return { modelo: j.modelo, industria: j.industria || '', detalle: j };
  } catch { /* heurística */ }
  return { modelo, industria: '', detalle: null };
}

async function categorizarInciertosIA(inciertos, negocio) {
  if (!inciertos.length) return [];
  try {
    const ai = getAIProvider();
    const lista = inciertos.slice(0, 30).map((m) => `${m.id}: ${m.description} (${m.amount})`).join('\n');
    const j = await ai.json(
      `Contexto de negocio: ${negocio?.modelo || 'general'}. Clasifica CADA movimiento en UNA categoría de esta lista exacta: ` +
      `${CATEGORIAS.join(', ')}. No inventes categorías. Devuelve SOLO un array JSON [{"id":"...","category":"..."}].\n${lista}`
    );
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

/**
 * Analiza un archivo y devuelve el resumen para aprobar ANTES de importar.
 * @param {File} file
 * @param {object} opts { mappings, existentes, onPaso }
 *   - existentes: transacciones ya guardadas (para no duplicar CSV+PDF del mismo extracto)
 */
export async function analizarArchivo(file, { mappings = {}, existentes = [], onPaso } = {}) {
  const paso = (t) => { try { onPaso?.(t); } catch { /* noop */ } };
  const diag = { archivo: file?.name, tipo: null, banco: null, extraidas: 0, duplicados: 0, nuevos: 0, revisar: 0, sospechosos: 0 };

  paso('detectando');
  let extraido;
  try {
    extraido = await extraerArchivo(file, { onPaso });
  } catch {
    console.info('[OB-diag Import]', { ...diag, error: 'extracción' });
    return { error: 'No pudimos leer este archivo. Verifica que sea un CSV, Excel o PDF válido.' };
  }
  const { tipo, texto, filas } = extraido;
  diag.tipo = tipo;

  if (tipo === 'pdf-escaneado') {
    console.info('[OB-diag Import]', { ...diag, error: 'pdf-escaneado' });
    return { error: 'Este PDF parece escaneado y no pudimos reconocer el texto (OCR). Súbelo como CSV/Excel o un PDF con texto seleccionable.', tipo };
  }

  paso('leyendo');
  const { movimientos: base } = manualProvider.procesarFilas(filas);
  diag.extraidas = base.length;
  if (!base.length) {
    console.info('[OB-diag Import]', { ...diag, error: 'sin-tabla' });
    return { error: 'No pudimos identificar la tabla de movimientos. Revisa que el archivo tenga columnas de fecha, descripción y montos.', tipo };
  }

  const institucion = detectarInstitucion(texto);
  const cuenta = detectarCuenta(texto);
  diag.banco = institucion;

  paso('entendiendo');
  const negocio = await entenderNegocio(base);

  paso('categorizando');
  const movimientos = base.map((m, i) => {
    const c = categorizar(m.descripcion, m.monto, { mappings });
    return {
      id: m.id || `tx-${Date.now()}-${i}`,
      date: m.fecha,
      description: m.descripcion,
      amount: m.monto,
      balance: null,
      account: cuenta,
      category: c.categoria,
      type: c.tipo,
      confidence: m.sospechoso ? Math.min(c.confianza, 30) : c.confianza,
      source: c.fuente,
      suspicious: !!m.sospechoso,
      rawData: m,
    };
  });

  // IA solo para los inciertos (excluye sospechosos: esos van a revisión humana).
  const sugerencias = await categorizarInciertosIA(
    movimientos.filter((m) => m.confidence < UMBRAL_CONFIANZA && !m.suspicious), negocio,
  );
  for (const s of sugerencias) {
    const mv = movimientos.find((m) => m.id === s.id);
    if (mv && s.category && CATEGORIAS.includes(s.category)) {
      mv.category = s.category;
      mv.confidence = Math.max(mv.confidence, 78);
      mv.source = 'ia';
    }
  }

  // Dedup: separa lo nuevo de lo ya existente (CSV + PDF del mismo extracto).
  const { nuevos, duplicados } = separarDuplicados(movimientos, existentes);
  diag.duplicados = duplicados.length;
  diag.nuevos = nuevos.length;

  paso('resumen');
  const ingresos = nuevos.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0);
  const egresos = nuevos.filter((m) => m.amount < 0).reduce((s, m) => s + Math.abs(m.amount), 0);
  const porCategoria = {};
  for (const m of nuevos) porCategoria[m.category] = (porCategoria[m.category] || 0) + 1;
  const confianzaPromedio = nuevos.length
    ? Math.round(nuevos.reduce((s, m) => s + m.confidence, 0) / nuevos.length) : 0;
  const revisar = nuevos.filter((m) => m.confidence < UMBRAL_CONFIANZA || m.suspicious);
  const sospechosos = nuevos.filter((m) => m.suspicious);
  diag.revisar = revisar.length;
  diag.sospechosos = sospechosos.length;

  console.info('[OB-diag Import]', diag);

  return {
    tipo,
    institucion,
    cuenta,
    negocio,
    periodo: periodoDe(nuevos.length ? nuevos : movimientos),
    movimientos: nuevos,          // lo que realmente se importará
    duplicados,                   // lo que se omite (ya existía)
    total: nuevos.length,
    totalExtraidas: movimientos.length,
    ingresos,
    egresos,
    porCategoria,
    confianzaPromedio,
    revisar,
    sospechosos,
    historial: registroHistorial({ texto, institucion, cuenta, movimientos }),
  };
}
