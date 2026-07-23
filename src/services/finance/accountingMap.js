/**
 * MAPA CONTABLE CANÓNICO (ACCOUNTING_MAP).
 * ============================================================================
 * ÚNICA fuente de verdad que traduce un `categoryId` ESTABLE a su ubicación en
 * los reportes: Estado de Resultado (P&L), Flujo de Caja, KPIs y reportería
 * futura. TODA la contabilidad se maneja por ID, nunca por el nombre visible.
 *
 * Garantía contable dura (validada al cargar el módulo y en tests):
 *   · Transfers, Loans y Owner Contributions NUNCA entran a Revenue ni al P&L.
 *   · Toda categoría de CATEGORY_REGISTRY tiene exactamente una entrada aquí.
 *
 * Esquema de cada entrada:
 *   {
 *     statement:        'pl' | 'financing' | 'internal'
 *       // 'pl' = va al Estado de Resultado; 'financing' = movimiento de
 *       // financiamiento (préstamos/aportes), fuera del P&L; 'internal' =
 *       // traspaso entre cuentas propias (neutro, no es ingreso ni gasto).
 *     plSection:        'revenue' | 'cogs' | 'opex' | null
 *     plLine:           línea fina para reportería detallada (o null)
 *     bucket:           'ingresos'|'cogsProd'|'cogsEnvio'|'cogsTrans'|
 *                       'empleados'|'herramientas'|'otros'|null
 *       // agrupación que consumen HOY los componentes (EstadoResultado).
 *     cashFlow:         'operating' | 'financing' | 'investing' | 'internal'
 *     includeInRevenue: boolean   // ¿suma a Revenue?
 *     includeInPL:      boolean   // ¿aparece en el Estado de Resultado?
 *   }
 * ============================================================================
 */
import { CATEGORY_REGISTRY, NON_REVENUE, resolveCategoryId, categoryName } from './categorize.js';

// Helpers de construcción para mantener las entradas consistentes.
const pl = (plSection, plLine, bucket) => ({
  statement: 'pl', plSection, plLine, bucket, cashFlow: 'operating',
  includeInRevenue: plSection === 'revenue', includeInPL: true,
});
const financing = () => ({
  statement: 'financing', plSection: null, plLine: null, bucket: null, cashFlow: 'financing',
  includeInRevenue: false, includeInPL: false,
});
const internal = () => ({
  statement: 'internal', plSection: null, plLine: null, bucket: null, cashFlow: 'internal',
  includeInRevenue: false, includeInPL: false,
});

/** Mapa canónico categoryId → tratamiento contable. */
export const ACCOUNTING_MAP = {
  // ── Ingresos ──────────────────────────────────────────────────────
  revenue: pl('revenue', 'revenue', 'ingresos'),
  // ── Costo de ventas (COGS) ────────────────────────────────────────
  inventory: pl('cogs', 'cogs_production', 'cogsProd'),
  shipping: pl('cogs', 'cogs_shipping', 'cogsEnvio'),
  bank_fees: pl('cogs', 'cogs_transaction', 'cogsTrans'),   // comisiones/procesadores
  // ── Gastos operacionales (OPEX) ───────────────────────────────────
  payroll: pl('opex', 'opex_payroll', 'empleados'),
  software: pl('opex', 'opex_software', 'herramientas'),
  marketing: pl('opex', 'opex_marketing', 'otros'),
  rent: pl('opex', 'opex_rent', 'otros'),
  utilities: pl('opex', 'opex_utilities', 'otros'),
  taxes: pl('opex', 'opex_taxes', 'otros'),
  marketplace: pl('opex', 'opex_marketplace', 'otros'),
  other: pl('opex', 'opex_other', 'otros'),
  // ── Fuera del P&L ─────────────────────────────────────────────────
  transfers: internal(),                 // traspaso entre cuentas propias
  owner_contributions: financing(),      // aporte de capital
  loans: financing(),                    // préstamos / financiamiento
};

/** Devuelve el tratamiento contable de una categoría (por id o etiqueta legada). */
export function tratamiento(categoryId) {
  const id = ACCOUNTING_MAP[categoryId] ? categoryId : resolveCategoryId(categoryId);
  return ACCOUNTING_MAP[id] || ACCOUNTING_MAP.other;
}
/** Id de categoría robusto desde una transacción (nueva o legada). */
export function categoryIdDeTransaccion(t) {
  return t.categoryId || resolveCategoryId(t.categoria || t.category) || 'other';
}
export const esRevenue = (categoryId) => tratamiento(categoryId).includeInRevenue === true;
export const esPL = (categoryId) => tratamiento(categoryId).includeInPL === true;
export const seccionFlujo = (categoryId) => tratamiento(categoryId).cashFlow;
export const bucketDe = (categoryId) => tratamiento(categoryId).bucket;

/**
 * Validación del mapa. Garantiza cobertura total y la regla contable dura.
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateAccountingMap() {
  const errors = [];
  const ids = CATEGORY_REGISTRY.map((c) => c.id);
  // 1) Cobertura: toda categoría tiene entrada.
  for (const id of ids) {
    if (!ACCOUNTING_MAP[id]) errors.push(`Falta mapeo contable para la categoría "${id}"`);
  }
  // 2) Sin entradas huérfanas (ids que no existen en el registro).
  for (const id of Object.keys(ACCOUNTING_MAP)) {
    if (!ids.includes(id)) errors.push(`Mapeo contable "${id}" no corresponde a ninguna categoría`);
  }
  // 3) Regla dura: Transfers/Loans/Owner nunca en Revenue ni en el P&L.
  for (const id of NON_REVENUE) {
    const m = ACCOUNTING_MAP[id];
    if (!m) continue;
    if (m.includeInRevenue) errors.push(`"${id}" (${categoryName(id)}) no puede contar como Revenue`);
    if (m.includeInPL) errors.push(`"${id}" (${categoryName(id)}) no puede aparecer en el P&L`);
    if (m.plSection === 'revenue') errors.push(`"${id}" no puede mapear a la sección revenue`);
  }
  // 4) Coherencia: entradas de P&L tienen sección y bucket; revenue implica includeInRevenue.
  for (const id of ids) {
    const m = ACCOUNTING_MAP[id];
    if (!m) continue;
    if (m.includeInPL && (!m.plSection || !m.bucket)) errors.push(`"${id}" está en el P&L pero sin plSection/bucket`);
    if ((m.plSection === 'revenue') !== m.includeInRevenue) errors.push(`"${id}" incoherente: plSection revenue vs includeInRevenue`);
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Resumen contable canónico (para KPIs, insights y reportería). Todo por ID.
 * Excluye traspasos internos; separa financiamiento (préstamos/aportes) del P&L.
 * @returns {{ revenue, cogs, grossProfit, opex, ebitda, margin, financingIn, financingOut, byLine }}
 */
export function resumenContable(transacciones = []) {
  let revenue = 0; let cogs = 0; let opex = 0; let financingIn = 0; let financingOut = 0;
  const byLine = {};
  for (const t of transacciones) {
    const monto = Number(t.monto ?? t.amount) || 0;
    const tr = tratamiento(categoryIdDeTransaccion(t));
    if (tr.statement === 'internal') continue;                 // traspaso: neutro
    if (tr.statement === 'financing') { if (monto >= 0) financingIn += monto; else financingOut += Math.abs(monto); continue; }
    if (tr.plSection === 'revenue') { revenue += monto; }
    else if (tr.plSection === 'cogs') { cogs += Math.abs(monto); }
    else if (tr.plSection === 'opex') { opex += Math.abs(monto); }
    if (tr.plLine) byLine[tr.plLine] = (byLine[tr.plLine] || 0) + (tr.plSection === 'revenue' ? monto : -Math.abs(monto));
  }
  const grossProfit = revenue - cogs;
  const ebitda = grossProfit - opex;
  return { revenue, cogs, grossProfit, opex, ebitda, margin: revenue > 0 ? (ebitda / revenue) * 100 : 0, financingIn, financingOut, byLine };
}

// Auto-verificación al cargar (no rompe producción; avisa fuerte en consola).
const _v = validateAccountingMap();
if (!_v.ok && typeof console !== 'undefined') {
  console.error('[ACCOUNTING_MAP] Configuración inválida:', _v.errors);
}
