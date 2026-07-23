/**
 * Etapa de validación del pipeline. Detecta problemas SIN descartar datos en
 * silencio: devuelve advertencias estructuradas que la UI puede mostrar y el
 * fundador puede resolver. Cada advertencia incluye código, nivel, mensaje y los
 * ids afectados para poder enlazar a la revisión.
 */

const HOY = () => new Date();

function esFechaValida(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return false;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime());
}

/**
 * Valida el lote normalizado. No muta los movimientos.
 * @param {Array} movimientos  modelo normalizado { id, date, amount, balance, currency, ... }
 * @returns {{ warnings: Array, ok: boolean }}
 */
export function validarMovimientos(movimientos = []) {
  const warnings = [];
  const add = (code, level, message, ids = []) => warnings.push({ code, level, message, ids, count: ids.length });

  if (!movimientos.length) {
    add('sin_movimientos', 'error', 'No se identificaron movimientos válidos en el documento.');
    return { warnings, ok: false };
  }

  const futuras = [];
  const invalidas = [];
  const sospechosos = [];
  const monedas = new Set();
  let conBalance = 0;
  const mañana = new Date(HOY().getTime() + 86400000);

  for (const m of movimientos) {
    if (!esFechaValida(m.date)) invalidas.push(m.id);
    else if (new Date(m.date) > mañana) futuras.push(m.id);
    if (m.suspicious) sospechosos.push(m.id);
    if (m.currency) monedas.add(String(m.currency).toUpperCase());
    if (m.balance != null && m.balance !== '') conBalance += 1;
  }

  if (invalidas.length) add('fecha_invalida', 'warn', `${invalidas.length} movimiento(s) con fecha no reconocible.`, invalidas);
  if (futuras.length) add('fecha_futura', 'warn', `${futuras.length} movimiento(s) con fecha en el futuro.`, futuras);
  if (sospechosos.length) add('monto_sospechoso', 'warn', `${sospechosos.length} monto(s) inusualmente grande(s); revisa que no sean números de cuenta o referencias.`, sospechosos);
  if (monedas.size > 1) add('monedas_inconsistentes', 'warn', `Se detectaron múltiples monedas (${[...monedas].join(', ')}). Verifica que correspondan a la misma cuenta.`);
  if (conBalance === 0) add('sin_saldo', 'info', 'El documento no incluye columna de saldo; se calcularán los totales sin conciliación de saldo.');

  // Corrupción de OCR: descripciones con proporción alta de caracteres no-palabra.
  const corruptas = movimientos.filter((m) => {
    const d = String(m.description || '');
    if (d.length < 4) return false;
    const raros = (d.match(/[^\p{L}\p{N}\s.,\-/#°ºª&()]/gu) || []).length;
    return raros / d.length > 0.4;
  }).map((m) => m.id);
  if (corruptas.length) add('ocr_corrupto', 'warn', `${corruptas.length} descripción(es) podrían estar mal reconocidas (OCR). Revísalas antes de confiar en su categoría.`, corruptas);

  const ok = !warnings.some((w) => w.level === 'error');
  return { warnings, ok };
}
