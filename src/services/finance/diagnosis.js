/**
 * Diagnóstico financiero con IA a partir de datos REALES importados.
 * Calcula estadísticas deterministas (siempre correctas) y arma una narrativa;
 * si hay IA disponible, la mejora. Nunca inventa datos ni da consejos genéricos.
 */
import { getAIProvider } from '../ai/index.js';
import { formatCLP } from '../../utils/formatters.js';

function mesDe(fecha) {
  const m = String(fecha || '').match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

/** Detecta suscripciones recurrentes: misma descripción base en ≥2 meses. */
function suscripcionesRecurrentes(movs) {
  const porClave = new Map();
  for (const m of movs) {
    if (m.amount >= 0) continue;
    const clave = String(m.description || '').toLowerCase().replace(/\d+/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);
    const mes = mesDe(m.date);
    if (!clave || !mes) continue;
    if (!porClave.has(clave)) porClave.set(clave, new Set());
    porClave.get(clave).add(mes);
  }
  return [...porClave.entries()].filter(([, meses]) => meses.size >= 2).length;
}

export function estadisticas(movimientos = []) {
  const ingresos = movimientos.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0);
  const egresos = movimientos.filter((m) => m.amount < 0).reduce((s, m) => s + Math.abs(m.amount), 0);
  const porCat = {};
  for (const m of movimientos) {
    if (m.amount < 0) porCat[m.category] = (porCat[m.category] || 0) + Math.abs(m.amount);
  }
  const catOrden = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  const topCategoria = catOrden[0] || null;
  const marketing = porCat.Marketing || 0;
  const revisar = movimientos.filter((m) => m.confidence < 60).length;
  return {
    total: movimientos.length,
    ingresos, egresos, neto: ingresos - egresos,
    topCategoria,
    marketingPct: egresos ? Math.round((marketing / egresos) * 100) : 0,
    suscripciones: suscripcionesRecurrentes(movimientos),
    revisar,
    catOrden,
  };
}

/** Narrativa determinista a partir de números reales (fallback sin IA). */
function narrativa(st) {
  const partes = [`Analicé ${st.total} transacciones.`];
  partes.push(`Ingresos ${formatCLP(st.ingresos)} y gastos ${formatCLP(st.egresos)} (resultado ${st.neto >= 0 ? 'positivo' : 'negativo'} de ${formatCLP(st.neto)}).`);
  if (st.topCategoria) partes.push(`Tu mayor gasto es ${st.topCategoria[0]} (${formatCLP(st.topCategoria[1])}).`);
  if (st.marketingPct) partes.push(`Marketing representa el ${st.marketingPct}% de tus gastos.`);
  if (st.suscripciones) partes.push(`Detecté ${st.suscripciones} suscripción(es) recurrente(s).`);
  if (st.revisar) partes.push(`Hay ${st.revisar} transacción(es) que requieren tu revisión.`);
  else partes.push('Clasifiqué todas las transacciones con buena confianza.');
  return partes.join(' ');
}

/**
 * Genera el diagnóstico. Devuelve { texto, stats }.
 * @param {Array} movimientos  modelo normalizado (con amount, category, confidence)
 * @param {object} opts { negocio }
 */
export async function generarDiagnostico(movimientos = [], { negocio } = {}) {
  const stats = estadisticas(movimientos);
  const base = narrativa(stats);

  // Mejora opcional con IA (mismos números; solo redacción más cercana).
  try {
    const ai = getAIProvider();
    const resumen = {
      transacciones: stats.total, ingresos: stats.ingresos, gastos: stats.egresos,
      neto: stats.neto, topGasto: stats.topCategoria, marketingPct: stats.marketingPct,
      suscripciones: stats.suscripciones, porRevisar: stats.revisar,
      negocio: negocio?.modelo || null,
    };
    const j = await ai.json(
      `Eres el Copiloto Financiero de Open Beauchef (español chileno, cálido, concreto). ` +
      `Con estos datos REALES, escribe un diagnóstico de 3-5 frases. No inventes cifras ni des consejos genéricos. ` +
      `Devuelve SOLO JSON {"texto":"..."}.\n${JSON.stringify(resumen)}`
    );
    if (j && typeof j.texto === 'string' && j.texto.length > 30) return { texto: j.texto, stats };
  } catch { /* usa narrativa base */ }

  return { texto: base, stats };
}
