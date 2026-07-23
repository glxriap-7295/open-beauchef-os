/**
 * INSIGHT ENGINE — observaciones financieras DETERMINISTAS.
 * ============================================================================
 * Regla de oro (arquitectura AI-sobre-contabilidad):
 *   La IA NUNCA descubre hechos financieros. El motor contable los calcula de
 *   forma determinista; este módulo deriva OBSERVACIONES estructuradas a partir
 *   de esos hechos verificados. La IA (insightNarrator) solo REESCRIBE el texto.
 *
 * Flujo: Transacciones → Accounting Engine (transaccionesAMeses / resumenContable
 *        vía ACCOUNTING_MAP) → InsightEngine (aquí) → Insight[] estructurados.
 *
 * Cada Insight:
 *   { id, severity: 'info'|'warning'|'critical', metric, value, title,
 *     explanation, data? }
 * `explanation` es una frase en español, con números reales, lista para mostrar
 * incluso SIN IA (la IA solo la pule). Nunca inventamos cifras.
 * ============================================================================
 */
import { transaccionesAMeses } from '../../utils/calculations.js';
import { resumenContable, tratamiento, categoryIdDeTransaccion } from './accountingMap.js';
import { categoryName } from './categorize.js';
import { formatCLP } from '../../utils/formatters.js';

const pct = (x) => Math.round(x * 100);
const abs = (n) => Math.abs(Number(n) || 0);

/** Totales de gasto por categoría (id) y por mes, desde transacciones. */
function gastoPorCategoria(transacciones) {
  const total = {};
  const porMes = {}; // { 'YYYY-MM': { catId: monto } }
  for (const t of transacciones) {
    const monto = Number(t.monto ?? t.amount) || 0;
    if (monto >= 0) continue;
    const cid = categoryIdDeTransaccion(t);
    if (!tratamiento(cid).includeInPL) continue;         // ignora transfers/loans/owner
    total[cid] = (total[cid] || 0) + abs(monto);
    const mes = String(t.fecha ?? t.date ?? '').slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(mes)) { (porMes[mes] ||= {})[cid] = (porMes[mes][cid] || 0) + abs(monto); }
  }
  return { total, porMes };
}

/** Comercios más grandes por gasto (usa el merchant original si existe). */
function topMerchants(transacciones, n = 3) {
  const agg = {};
  for (const t of transacciones) {
    const monto = Number(t.monto ?? t.amount) || 0;
    if (monto >= 0) continue;
    const cid = categoryIdDeTransaccion(t);
    if (!tratamiento(cid).includeInPL) continue;
    const id = t.original?.merchantId || (t.original?.merchant || t.descripcion || t.description || 'Otros');
    const nombre = t.original?.merchant || (t.descripcion || t.description || 'Movimiento');
    if (!agg[id]) agg[id] = { merchantId: t.original?.merchantId || null, merchant: nombre, monto: 0 };
    agg[id].monto += abs(monto);
  }
  return Object.values(agg).sort((a, b) => b.monto - a.monto).slice(0, n);
}

/** Suscripciones recurrentes: misma glosa base en ≥2 meses (gastos). */
function suscripciones(transacciones) {
  const porClave = new Map();
  for (const t of transacciones) {
    const monto = Number(t.monto ?? t.amount) || 0;
    if (monto >= 0) continue;
    const clave = String(t.descripcion ?? t.description ?? '').toLowerCase().replace(/\d+/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);
    const mes = String(t.fecha ?? t.date ?? '').slice(0, 7);
    if (!clave || !/^\d{4}-\d{2}$/.test(mes)) continue;
    if (!porClave.has(clave)) porClave.set(clave, { meses: new Set(), monto: 0, ejemplo: t.original?.merchant || t.descripcion || t.description });
    const e = porClave.get(clave); e.meses.add(mes); e.monto += abs(monto);
  }
  return [...porClave.values()].filter((e) => e.meses.size >= 2).map((e) => ({ merchant: e.ejemplo, meses: e.meses.size, monto: e.monto }));
}

function mediana(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Calcula todas las observaciones deterministas.
 * @param {Array} transacciones  transacciones APROBADAS (con categoryId)
 * @returns {Array} Insight[] ordenados por severidad e impacto.
 */
export function computeInsights(transacciones = []) {
  const insights = [];
  if (!transacciones.length) return insights;

  const meses = transaccionesAMeses(transacciones);       // P&L mensual (ya excluye no-P&L)
  const resumen = resumenContable(transacciones);          // totales verificados
  const push = (o) => insights.push(o);

  // 1) Ingresos vs mes anterior
  if (meses.length >= 2) {
    const a = meses[meses.length - 2].ingresos; const b = meses[meses.length - 1].ingresos;
    if (a > 0) {
      const d = (b - a) / a;
      push({ id: 'revenue_mom', severity: d < -0.1 ? 'warning' : 'info', metric: 'revenue', value: Number(d.toFixed(4)),
        title: d >= 0 ? 'Ingresos al alza' : 'Ingresos a la baja',
        explanation: `Tus ingresos ${d >= 0 ? 'subieron' : 'bajaron'} ${Math.abs(pct(d))}% respecto al mes anterior (${formatCLP(a)} → ${formatCLP(b)}).`,
        data: { from: a, to: b } });
    }
  }

  // 2) Margen bruto
  if (resumen.revenue > 0) {
    const gm = resumen.grossProfit / resumen.revenue;
    push({ id: 'gross_margin', severity: gm < 0.2 ? 'warning' : 'info', metric: 'gross_margin', value: Number(gm.toFixed(4)),
      title: 'Margen bruto', explanation: `Tu margen bruto es ${pct(gm)}% (ingresos ${formatCLP(resumen.revenue)} − costo de ventas ${formatCLP(resumen.cogs)}).` });
  }

  // 3) EBITDA + tendencia
  push({ id: 'ebitda', severity: resumen.ebitda < 0 ? 'warning' : 'info', metric: 'ebitda', value: resumen.ebitda,
    title: resumen.ebitda >= 0 ? 'EBITDA positivo' : 'EBITDA negativo',
    explanation: `Tu EBITDA acumulado es ${formatCLP(resumen.ebitda)} (margen ${pct((resumen.margin || 0) / 100)}%).` });
  if (meses.length >= 3) {
    const e = meses.map((m) => m.ebitda); const subiendo = e[e.length - 1] > e[e.length - 2] && e[e.length - 2] >= e[e.length - 3];
    push({ id: 'ebitda_trend', severity: 'info', metric: 'ebitda_trend', value: e[e.length - 1] - e[0],
      title: subiendo ? 'EBITDA mejorando' : 'EBITDA variable',
      explanation: `Tu EBITDA pasó de ${formatCLP(e[0])} a ${formatCLP(e[e.length - 1])} en ${meses.length} meses.` });
  }

  // 4) Cash burn (meses con resultado operativo negativo)
  const netos = meses.map((m) => m.ingresos - m.gastosTotales);
  const burnMeses = netos.filter((n) => n < 0);
  if (burnMeses.length) {
    const promedio = burnMeses.reduce((s, n) => s + n, 0) / burnMeses.length;
    push({ id: 'cash_burn', severity: 'warning', metric: 'cash_burn', value: promedio,
      title: 'Estás quemando caja', explanation: `En ${burnMeses.length} de ${meses.length} mes(es) gastaste más de lo que ingresaste. Quema promedio: ${formatCLP(Math.abs(promedio))}/mes.` });
  }

  // 5) Mayores categorías de gasto
  const { total: gastoCat, porMes } = gastoPorCategoria(transacciones);
  const totalGasto = Object.values(gastoCat).reduce((s, v) => s + v, 0);
  const topCats = Object.entries(gastoCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (topCats.length) {
    push({ id: 'top_expense_categories', severity: 'info', metric: 'expenses', value: totalGasto,
      title: 'Tus mayores gastos',
      explanation: `Tus mayores gastos son ${topCats.map(([id, v]) => `${categoryName(id)} (${totalGasto ? pct(v / totalGasto) : 0}%)`).join(', ')}.`,
      data: topCats.map(([id, v]) => ({ categoryId: id, name: categoryName(id), amount: v, pct: totalGasto ? v / totalGasto : 0 })) });
  }

  // 6) Mayor aumento de gasto por categoría (MoM)
  const clavesMes = Object.keys(porMes).sort();
  if (clavesMes.length >= 2) {
    const prev = porMes[clavesMes[clavesMes.length - 2]]; const cur = porMes[clavesMes[clavesMes.length - 1]];
    let mejor = null;
    for (const cid of Object.keys(cur)) {
      const a = prev[cid] || 0; const b = cur[cid];
      if (a > 0 && b > a) { const d = (b - a) / a; if (!mejor || d > mejor.d) mejor = { cid, a, b, d }; }
    }
    if (mejor && mejor.d >= 0.15) {
      push({ id: `expense_growth:${mejor.cid}`, severity: mejor.d >= 0.5 ? 'warning' : 'info', metric: `${mejor.cid}_expense`, value: Number(mejor.d.toFixed(4)),
        title: `Aumentó ${categoryName(mejor.cid)}`,
        explanation: `Tu gasto en ${categoryName(mejor.cid)} aumentó ${pct(mejor.d)}% respecto al mes anterior (${formatCLP(mejor.a)} → ${formatCLP(mejor.b)}).`,
        data: { categoryId: mejor.cid, from: mejor.a, to: mejor.b } });
    }
  }

  // 7) Comercios más grandes
  const merchants = topMerchants(transacciones);
  if (merchants.length) {
    push({ id: 'top_merchants', severity: 'info', metric: 'merchants', value: merchants[0].monto,
      title: 'Comercios con mayor gasto',
      explanation: `Donde más gastas: ${merchants.map((m) => `${m.merchant} (${formatCLP(m.monto)})`).join(', ')}.`, data: merchants });
  }

  // 8) Suscripciones recurrentes
  const subs = suscripciones(transacciones);
  if (subs.length) {
    const totalSubs = subs.reduce((s, x) => s + x.monto, 0);
    push({ id: 'recurring_subscriptions', severity: 'info', metric: 'subscriptions', value: subs.length,
      title: 'Suscripciones recurrentes', explanation: `Detectamos ${subs.length} gasto(s) recurrente(s) (${formatCLP(totalSubs)} en total). Revisa si sigues usando todos.`, data: subs });
  }

  // 9) Transacciones inusuales (montos atípicos o marcados sospechosos)
  const gastos = transacciones.filter((t) => (Number(t.monto ?? t.amount) || 0) < 0).map((t) => abs(t.monto ?? t.amount));
  const med = mediana(gastos);
  const unusual = transacciones.filter((t) => {
    const m = Number(t.monto ?? t.amount) || 0;
    return t.sospechoso || (m < 0 && med > 0 && abs(m) > med * 5);
  }).map((t) => ({ descripcion: t.descripcion || t.description, monto: Number(t.monto ?? t.amount) || 0, fecha: t.fecha || t.date }));
  if (unusual.length) {
    push({ id: 'unusual_transactions', severity: 'warning', metric: 'unusual', value: unusual.length,
      title: 'Movimientos inusuales', explanation: `Hay ${unusual.length} movimiento(s) fuera de lo habitual por su monto. Confirma que sean correctos.`, data: unusual.slice(0, 5) });
  }

  // 10) Categorización faltante / baja confianza
  const sinCat = transacciones.filter((t) => {
    const cid = categoryIdDeTransaccion(t); return cid === 'other' || (t.confianza ?? t.confidence ?? 100) < 60;
  });
  if (sinCat.length) {
    push({ id: 'missing_categorization', severity: sinCat.length > transacciones.length * 0.2 ? 'warning' : 'info', metric: 'uncategorized', value: sinCat.length,
      title: 'Movimientos por revisar', explanation: `${sinCat.length} movimiento(s) quedaron en “Otros” o con baja confianza. Categorízalos para reportes más precisos.` });
  }

  // 11) Uso excesivo de "Other"
  const otros = gastoCat.other || 0;
  if (totalGasto > 0 && otros / totalGasto > 0.2) {
    push({ id: 'excessive_other', severity: 'warning', metric: 'other_share', value: Number((otros / totalGasto).toFixed(4)),
      title: 'Demasiado en “Otros”', explanation: `El ${pct(otros / totalGasto)}% de tus gastos está en “Otros”. Reclasifícalos para entender mejor en qué se va tu plata.` });
  }

  // 12) Calidad de datos (fechas faltantes)
  const sinFecha = transacciones.filter((t) => !String(t.fecha ?? t.date ?? '').trim()).length;
  if (sinFecha) {
    push({ id: 'data_quality', severity: 'warning', metric: 'missing_dates', value: sinFecha,
      title: 'Datos incompletos', explanation: `${sinFecha} movimiento(s) no tienen fecha; podrían no aparecer en los reportes mensuales.` });
  }

  const orden = { critical: 0, warning: 1, info: 2 };
  return insights.sort((a, b) => (orden[a.severity] - orden[b.severity]) || (abs(b.value) - abs(a.value)));
}
