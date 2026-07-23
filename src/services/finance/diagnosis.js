/**
 * Diagnóstico financiero con IA a partir de datos REALES importados.
 * Calcula estadísticas deterministas (siempre correctas) y arma una narrativa;
 * si hay IA disponible, la mejora. Nunca inventa datos ni da consejos genéricos.
 */
import { formatCLP } from '../../utils/formatters.js';
import { tratamiento, categoryIdDeTransaccion } from './accountingMap.js';
import { categoryName } from './categorize.js';
import { computeInsights } from './insightEngine.js';
import { narrarResumen } from './insightNarrator.js';

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
  // Todas las estadísticas se rutean por categoryId vía ACCOUNTING_MAP. Los
  // traspasos, préstamos y aportes (fuera del P&L) NO cuentan como ingreso ni
  // gasto: nunca inflan el resultado. La agregación por categoría usa el ID
  // estable y solo se traduce al nombre visible para mostrar.
  let ingresos = 0; let egresos = 0; let marketing = 0;
  const porCat = {}; // keyed por categoryId
  for (const m of movimientos) {
    const monto = Number(m.amount ?? m.monto) || 0;
    const cid = categoryIdDeTransaccion(m);
    const tr = tratamiento(cid);
    if (!tr.includeInPL) continue;                       // excluye transfers/loans/owner
    if (monto >= 0 && tr.includeInRevenue) { ingresos += monto; }
    else if (monto < 0) {
      egresos += Math.abs(monto);
      porCat[cid] = (porCat[cid] || 0) + Math.abs(monto);
      if (cid === 'marketing') marketing += Math.abs(monto);
    }
  }
  // catOrden en pares [nombreVisible, monto] (compat con sanitizarDiagnostico).
  const catOrden = Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([id, v]) => [categoryName(id), v]);
  const topCategoria = catOrden[0] || null;
  const revisar = movimientos.filter((m) => (m.confidence ?? m.confianza ?? 100) < 60).length;
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
 * Genera el diagnóstico. Ahora está IMPULSADO POR EL INSIGHT ENGINE:
 * los hechos se calculan de forma determinista (computeInsights) y la IA solo
 * REESCRIBE la narrativa (narrarResumen). La IA nunca produce cifras.
 * Devuelve { texto, stats, insights } — `stats` se conserva por compatibilidad.
 * @param {Array} movimientos  transacciones (con amount/categoryId/confidence)
 * @param {object} opts { negocio }
 */
export async function generarDiagnostico(movimientos = [], { negocio } = {}) { // eslint-disable-line no-unused-vars
  const stats = estadisticas(movimientos);
  const insights = computeInsights(movimientos);
  const base = narrativa(stats);
  // La IA solo pule; si falla, queda la narrativa determinista (o los insights).
  const texto = insights.length ? await narrarResumen(insights) : base;
  return { texto: texto || base, stats, insights };
}
