/**
 * Motor de categorización determinista (reglas + memoria por startup).
 * Es la base CONFIABLE del pipeline: funciona offline, sin IA. La IA solo
 * interviene cuando la confianza es baja (ver importPipeline). Español chileno.
 */

/** Categorías canónicas del Copiloto Financiero. */
export const CATEGORIAS = [
  'Ventas', 'Marketplace', 'Marketing', 'Envíos', 'Inventario', 'Remuneraciones',
  'Arriendo', 'Servicios', 'Software', 'Impuestos', 'Comisiones bancarias', 'Otros',
];

// Reglas por categoría: palabras clave (sin acentos para robustez) + peso base.
// El orden importa: la primera categoría con match de mayor peso gana.
const REGLAS = [
  { cat: 'Marketing', peso: 94, kw: ['meta ads', 'facebook', 'instagram', 'google ads', 'googleads', 'tiktok ads', 'publicidad', 'mailchimp', 'ads '] },
  { cat: 'Envíos', peso: 94, kw: ['bluexpress', 'blue express', 'chilexpress', 'starken', 'correos de chile', 'courier', 'flete', 'despacho', 'envio', 'ultima milla'] },
  { cat: 'Marketplace', peso: 90, kw: ['mercado libre', 'mercadolibre', 'mercado pago', 'mercadopago', 'shopify', 'falabella', 'ripley', 'paris.cl', 'linio'] },
  { cat: 'Software', peso: 90, kw: ['software', 'saas', 'suscripcion', 'licencia', 'notion', 'slack', 'google workspace', 'microsoft', 'adobe', 'hosting', 'aws', 'dominio', 'zoom', 'canva', 'figma', 'github', 'openai'] },
  { cat: 'Remuneraciones', peso: 95, kw: ['sueldo', 'remuneracion', 'nomina', 'honorarios', 'finiquito', 'salario', 'previred', 'afp', 'isapre', 'planilla', 'anticipo'] },
  { cat: 'Impuestos', peso: 95, kw: ['sii', 'impuesto', 'iva', 'ppm', 'tesoreria', 'contribuciones', 'f29', 'formulario 29'] },
  { cat: 'Arriendo', peso: 92, kw: ['arriendo', 'alquiler', 'renta ', 'canon'] },
  { cat: 'Servicios', peso: 88, kw: ['internet', 'luz', 'electricidad', 'agua', 'gas', 'enel', 'cge', 'aguas andinas', 'movistar', 'entel', 'wom', 'claro', 'gtd', 'vtr', 'telefon'] },
  { cat: 'Inventario', peso: 86, kw: ['proveedor', 'mercaderia', 'insumo', 'materia prima', 'importacion', 'compra stock', 'distribuidora', 'mayorista'] },
  { cat: 'Comisiones bancarias', peso: 90, kw: ['comision', 'mantencion', 'interes', 'cargo banco', 'sobregiro', 'linea de credito', 'portes', 'transbank', 'webpay', 'getnet', 'flow ', 'fintoc'] },
  { cat: 'Ventas', peso: 80, kw: ['venta', 'ingreso', 'pago cliente', 'abono cliente', 'cobro', 'stripe', 'transferencia recibida', 'deposito', 'boleta', 'factura venta'] },
];

function normaliza(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Categoriza un movimiento con reglas + memoria del startup.
 * @param {string} descripcion
 * @param {number} monto  (signo: + ingreso, - egreso)
 * @param {object} opts   { mappings: {descNorm: categoria} }
 * @returns {{categoria, confianza, tipo, fuente}}
 */
export function categorizar(descripcion, monto, { mappings = {} } = {}) {
  const desc = normaliza(descripcion);
  const tipo = Number(monto) >= 0 ? 'ingreso' : 'egreso';

  // 1) Memoria: si el startup ya clasificó algo idéntico o muy parecido.
  const claveMem = clavePorDescripcion(descripcion);
  if (mappings[claveMem]) {
    return { categoria: mappings[claveMem], confianza: 99, tipo, fuente: 'memoria' };
  }

  // 2) Reglas por palabra clave.
  let mejor = null;
  for (const r of REGLAS) {
    for (const k of r.kw) {
      if (desc.includes(normaliza(k))) {
        const especifidad = Math.min(4, Math.floor(k.length / 4));
        const score = r.peso + especifidad;
        if (!mejor || score > mejor.confianza) mejor = { categoria: r.cat, confianza: score };
      }
    }
  }
  if (mejor) {
    // Coherencia con el signo: un egreso categorizado como Ventas baja confianza.
    if (mejor.categoria === 'Ventas' && tipo === 'egreso') mejor.confianza -= 30;
    if (mejor.categoria !== 'Ventas' && mejor.categoria !== 'Marketplace' && tipo === 'ingreso') mejor.confianza -= 10;
    return { categoria: mejor.categoria, confianza: clamp(mejor.confianza, 0, 100), tipo, fuente: 'reglas' };
  }

  // 3) Sin match: heurística por signo (baja confianza -> candidato a revisión / IA).
  if (tipo === 'ingreso') return { categoria: 'Ventas', confianza: 45, tipo, fuente: 'signo' };
  return { categoria: 'Otros', confianza: 35, tipo, fuente: 'signo' };
}

/** Clave estable para memorizar por descripción (ignora números/fechas variables). */
export function clavePorDescripcion(descripcion) {
  return normaliza(descripcion)
    .replace(/\d+[\d.,/-]*/g, ' ')     // quita números, fechas, montos
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48);
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
