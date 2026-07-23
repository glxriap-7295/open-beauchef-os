/**
 * Motor de categorización determinista (rule engine + merchant recognition).
 * ============================================================================
 * Responsabilidad ÚNICA: dado una descripción y un monto, devolver una
 * categoría contable EXPLICABLE con confianza, IDs estables y trazabilidad.
 *
 * Orden de autoridad (determinista primero; la IA vive fuera de este módulo y
 * solo se invoca aguas arriba cuando la confianza es baja):
 *   1. USER MEMORY   — una corrección del usuario manda sobre todo.
 *   2. MERCHANT      — reconocimiento de comercio (aliases) → categoría.
 *   3. RULES         — reglas por palabra clave, data-driven.
 *   4. SIGN FALLBACK — sin evidencia: ingreso→revenue / egreso→other, conf baja.
 *
 * IDs ESTABLES: la categoría se identifica por un `categoryId` inmutable (slug);
 * el nombre visible (`category`) puede cambiar/traducirse sin migrar datos.
 * Lo mismo para comercios (`merchantId` vs `merchant`).
 *
 * GARANTÍA CONTABLE: transfers, loans y owner_contributions NUNCA se clasifican
 * como revenue, aunque sean ingresos (guardarraíl explícito).
 *
 * Salida (contrato estable para el resto del pipeline):
 *   { categoryId, category, confidence, reason, merchant, merchantId, rule, source, type }
 * ============================================================================
 */
import { MERCHANTS } from './merchants.js';
import { normalizeDescription, stableKey } from './normalizeDescription.js';

/**
 * Registro de categorías: la ÚNICA fuente de verdad. `id` es estable (se guarda
 * en la data); `name` es el nombre visible (puede cambiar sin migración).
 */
export const CATEGORY_REGISTRY = [
  { id: 'revenue', name: 'Revenue' },
  { id: 'marketplace', name: 'Marketplace' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'shipping', name: 'Shipping' },
  { id: 'inventory', name: 'Inventory' },
  { id: 'payroll', name: 'Payroll' },
  { id: 'rent', name: 'Rent' },
  { id: 'utilities', name: 'Utilities' },
  { id: 'software', name: 'Software' },
  { id: 'taxes', name: 'Taxes' },
  { id: 'bank_fees', name: 'Bank Fees' },
  { id: 'transfers', name: 'Transfers' },
  { id: 'owner_contributions', name: 'Owner Contributions' },
  { id: 'loans', name: 'Loans' },
  { id: 'other', name: 'Other' },
];

const NAME_BY_ID = Object.fromEntries(CATEGORY_REGISTRY.map((c) => [c.id, c.name]));

/** Lista de nombres visibles (compat con consumidores que usaban CATEGORIES). */
export const CATEGORIES = CATEGORY_REGISTRY.map((c) => c.name);
/** Lista de IDs canónicos. */
export const CATEGORY_IDS = CATEGORY_REGISTRY.map((c) => c.id);
/** Nombre visible desde un id estable (fallback: el id mismo). */
export function categoryName(id) { return NAME_BY_ID[id] || id; }

/** Categorías que jamás pueden ser ingreso operacional (revenue). */
export const NON_REVENUE = new Set(['transfers', 'loans', 'owner_contributions']);

// Resolución de etiquetas legadas → id estable (memoria/valores históricos).
const ID_LOOKUP = {};
CATEGORY_REGISTRY.forEach((c) => { ID_LOOKUP[c.id] = c.id; ID_LOOKUP[c.name.toLowerCase()] = c.id; });
Object.entries({
  ventas: 'revenue', marketplace: 'marketplace', marketing: 'marketing', 'envíos': 'shipping', envios: 'shipping',
  inventario: 'inventory', remuneraciones: 'payroll', arriendo: 'rent', servicios: 'utilities', software: 'software',
  impuestos: 'taxes', 'comisiones bancarias': 'bank_fees', otros: 'other',
}).forEach(([k, v]) => { ID_LOOKUP[k] = v; });
/** Mapea cualquier etiqueta histórica (id, nombre EN, o legado ES) → id, o null. */
export function resolveCategoryId(value) {
  if (!value) return null;
  return ID_LOOKUP[String(value).toLowerCase().trim()] || null;
}

/**
 * Reglas por palabra clave para conceptos SIN comercio específico. Data-driven.
 * El orden importa: lo más sensible contablemente (traspasos/aportes/préstamos)
 * va primero. `categoryId` es el id estable.
 */
export const RULES = [
  { rule: 'transfer', categoryId: 'transfers', keywords: ['traspaso', 'transferencia', 'transf a', 'transf de', 'trf ', 'traspaso a cuenta', 'transferencia entre cuentas'] },
  { rule: 'owner-contribution', categoryId: 'owner_contributions', keywords: ['aporte socio', 'aporte de capital', 'aporte capital', 'capital socio', 'aumento de capital'] },
  { rule: 'loan', categoryId: 'loans', keywords: ['prestamo', 'mutuo', 'financiamiento', 'cuota credito', 'credito comercial', 'linea de credito', 'desembolso credito'] },
  { rule: 'payroll', categoryId: 'payroll', keywords: ['sueldo', 'remuneracion', 'nomina', 'honorarios', 'finiquito', 'anticipo sueldo', 'liquidacion sueldo'] },
  { rule: 'taxes', categoryId: 'taxes', keywords: ['iva', 'ppm', 'f29', 'formulario 29', 'impuesto', 'contribuciones', 'pago tesoreria'] },
  { rule: 'rent', categoryId: 'rent', keywords: ['arriendo', 'alquiler', 'canon arriendo', 'renta oficina', 'renta local'] },
  { rule: 'utilities', categoryId: 'utilities', keywords: ['internet', 'telefon', 'electricidad', 'suministro', 'cuenta de luz', 'cuenta de agua', 'plan movil'] },
  { rule: 'bank-fee', categoryId: 'bank_fees', keywords: ['comision', 'mantencion', 'interes', 'sobregiro', 'portes', 'cargo por servicio', 'gasto notarial banco'] },
  { rule: 'shipping', categoryId: 'shipping', keywords: ['envio', 'despacho', 'flete', 'courier', 'ultima milla', 'reparto'] },
  { rule: 'marketing', categoryId: 'marketing', keywords: ['ads', 'publicidad', 'campana', 'marketing'] },
  { rule: 'inventory', categoryId: 'inventory', keywords: ['proveedor', 'mercaderia', 'insumo', 'materia prima', 'distribuidora', 'mayorista', 'importacion'] },
  { rule: 'revenue', categoryId: 'revenue', keywords: ['venta', 'pago cliente', 'cobro', 'boleta', 'factura venta', 'abono cliente'] },
];

/** Guardarraíl contable: una glosa de traspaso/aporte/préstamo nunca es revenue. */
const BLOQUEADORES_REVENUE = [
  { re: /traspaso|transferencia|\btransf\b|\btrf\b/, categoryId: 'transfers' },
  { re: /aporte (socio|de capital|capital)|capital socio|aumento de capital/, categoryId: 'owner_contributions' },
  { re: /prestamo|mutuo|financiamiento|cuota credito|linea de credito|desembolso credito/, categoryId: 'loans' },
];

/**
 * Categoriza una transacción de forma determinista y explicable.
 * @param {string} descripcion  glosa cruda del banco
 * @param {number} amount       monto con signo (+ ingreso, − egreso)
 * @param {object} opts { memory: { [stableKey]: categoryId|label } }
 * @returns {{categoryId,category,confidence,reason,merchant,merchantId,rule,source,type}}
 */
export function categorize(descripcion, amount, { memory = {} } = {}) {
  const lower = normalizeDescription(descripcion);
  const enEntrada = Number(amount) >= 0;
  const type = enEntrada ? 'inflow' : 'outflow';

  // Empaqueta el resultado aplicando el guardarraíl anti-revenue.
  const armar = (categoryId, confidence, reason, merchant, merchantId, rule, source) => {
    let cid = categoryId;
    let why = reason;
    if (cid === 'revenue') {
      for (const b of BLOQUEADORES_REVENUE) {
        if (b.re.test(lower)) { cid = b.categoryId; why = `Guardarraíl contable: la glosa indica ${categoryName(cid).toLowerCase()}, no ingreso`; break; }
      }
    }
    return { categoryId: cid, category: categoryName(cid), confidence, reason: why, merchant: merchant || null, merchantId: merchantId || null, rule: rule || null, source, type };
  };

  // 1) USER MEMORY — máxima autoridad, antes que reglas o IA.
  const key = stableKey(descripcion);
  if (memory && memory[key]) {
    const cid = resolveCategoryId(memory[key]) || 'other';
    return armar(cid, 100, 'Aprendido de una corrección tuya anterior', null, null, 'memory', 'memory');
  }

  // 2) MERCHANT RECOGNITION — nunca clasificamos desde la glosa cruda.
  for (const m of MERCHANTS) {
    const alias = (m.aliases || []).find((a) => lower.includes(a));
    const patron = !alias && (m.patterns || []).find((p) => new RegExp(p, 'i').test(lower));
    if (alias || patron) {
      let cid = m.categoryId;
      if (m.categoryBySign) cid = enEntrada ? m.categoryBySign.in : m.categoryBySign.out;
      return armar(cid, 96, `Comercio reconocido: ${m.merchant}`, m.merchant, m.id, alias || patron, 'merchant');
    }
  }

  // 3) RULE ENGINE — reglas por palabra clave (data-driven).
  for (const r of RULES) {
    const hit = r.keywords.find((k) => lower.includes(k));
    if (hit) {
      const conf = (r.categoryId === 'revenue' && !enEntrada) ? 50 : 84;
      return armar(r.categoryId, conf, `Regla "${r.rule}" (coincide con "${hit.trim()}")`, null, null, r.rule, 'rules');
    }
  }

  // 4) SIGN FALLBACK — sin evidencia → baja confianza (irá a revisión / IA).
  if (enEntrada) return armar('revenue', 45, 'Ingreso sin comercio ni regla reconocidos; requiere revisión', null, null, null, 'sign');
  return armar('other', 35, 'Egreso sin comercio ni regla reconocidos; requiere revisión', null, null, null, 'sign');
}

/** Mapa de id canónico → etiqueta legada en español (para consumidores viejos). */
const A_LEGADO = {
  revenue: 'Ventas', marketplace: 'Marketplace', marketing: 'Marketing', shipping: 'Envíos',
  inventory: 'Inventario', payroll: 'Remuneraciones', rent: 'Arriendo', utilities: 'Servicios',
  software: 'Software', taxes: 'Impuestos', bank_fees: 'Comisiones bancarias',
  transfers: 'Otros', owner_contributions: 'Otros', loans: 'Otros', other: 'Otros',
};
/** Traduce un id a la etiqueta legada; deja pasar valores desconocidos. */
export function legacyLabel(categoryId) {
  return A_LEGADO[categoryId] || categoryName(categoryId) || categoryId;
}
