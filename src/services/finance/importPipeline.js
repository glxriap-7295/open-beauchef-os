/**
 * Pipeline de importación AI-first. La IA ORQUESTA; las reglas garantizan que
 * siempre funcione (offline / sin IA). Flujo:
 *   archivo → extracción universal → entender negocio → normalizar →
 *   reglas+memoria → IA para inciertos → resumen (para aprobar antes de importar).
 * NO toca el motor financiero; produce el modelo normalizado que ya consume el
 * dashboard (date, amount) más metadatos (category, type, confidence, source).
 */
import { extraerArchivo } from './extractor.js';
import { manualProvider } from '../banking/manualProvider.js';
import { categorizar, CATEGORIAS } from './categorizer.js';
import { getAIProvider } from '../ai/index.js';

export const UMBRAL_CONFIANZA = 60; // < umbral => requiere revisión del fundador

function detectarInstitucion(texto = '') {
  const t = texto.toLowerCase();
  const fuentes = [
    ['Banco de Chile', /banco de chile|bancochile/], ['Santander', /santander/],
    ['BCI', /\bbci\b|banco de cr[eé]dito/], ['BancoEstado', /bancoestado|banco (del )?estado/],
    ['Itaú', /ita[uú]/], ['Scotiabank', /scotiabank/], ['Banco Security', /security/],
    ['Banco Falabella', /falabella/], ['Mercado Pago', /mercado ?pago/],
    ['Stripe', /stripe/], ['Shopify', /shopify/],
  ];
  for (const [nombre, re] of fuentes) if (re.test(t)) return nombre;
  return 'Institución no identificada';
}

function periodo(movs) {
  const f = movs.map((m) => m.date).filter(Boolean).sort();
  return f.length ? { desde: f[0], hasta: f[f.length - 1] } : null;
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
 * @param {object} opts { mappings, onPaso }
 */
export async function analizarArchivo(file, { mappings = {}, onPaso } = {}) {
  const paso = (t) => { try { onPaso?.(t); } catch { /* noop */ } };

  paso('detectando');
  const { tipo, texto, filas } = await extraerArchivo(file);
  if (tipo === 'pdf-escaneado') {
    return { error: 'Este PDF parece escaneado (sin texto seleccionable). Súbelo como CSV/Excel o una versión con texto.', tipo };
  }

  paso('leyendo');
  const { movimientos: base } = manualProvider.procesarFilas(filas);
  if (!base.length) return { error: 'No pudimos identificar movimientos en el archivo. Revisa que tenga fecha, descripción y montos.', tipo };

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
      category: c.categoria,
      type: c.tipo,
      confidence: c.confianza,
      source: c.fuente,
      rawData: m,
    };
  });

  // IA solo para los inciertos.
  const sugerencias = await categorizarInciertosIA(movimientos.filter((m) => m.confidence < UMBRAL_CONFIANZA), negocio);
  for (const s of sugerencias) {
    const mv = movimientos.find((m) => m.id === s.id);
    if (mv && s.category && CATEGORIAS.includes(s.category)) {
      mv.category = s.category;
      mv.confidence = Math.max(mv.confidence, 78);
      mv.source = 'ia';
    }
  }

  paso('resumen');
  const ingresos = movimientos.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0);
  const egresos = movimientos.filter((m) => m.amount < 0).reduce((s, m) => s + Math.abs(m.amount), 0);
  const porCategoria = {};
  for (const m of movimientos) porCategoria[m.category] = (porCategoria[m.category] || 0) + 1;
  const confianzaPromedio = Math.round(movimientos.reduce((s, m) => s + m.confidence, 0) / movimientos.length);
  const revisar = movimientos.filter((m) => m.confidence < UMBRAL_CONFIANZA);

  return {
    tipo,
    institucion: detectarInstitucion(texto),
    negocio,
    periodo: periodo(movimientos),
    movimientos,
    total: movimientos.length,
    ingresos,
    egresos,
    porCategoria,
    confianzaPromedio,
    revisar,
  };
}
