/**
 * Proveedor de Carga Manual: procesa cartolas / movimientos desde CSV.
 * Funciona 100% en el navegador, sin backend ni dependencias externas.
 * Siempre disponible (es el fallback de Open Banking).
 */

/** Parser CSV mínimo que respeta comillas dobles. */
function parseCSV(texto) {
  const filas = [];
  let campo = '';
  let fila = [];
  let enComillas = false;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i += 1; }
      else if (c === '"') enComillas = false;
      else campo += c;
    } else if (c === '"') {
      enComillas = true;
    } else if (c === ',' || c === ';') {
      fila.push(campo); campo = '';
    } else if (c === '\n') {
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else if (c !== '\r') {
      campo += c;
    }
  }
  if (campo.length || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter((f) => f.some((x) => String(x).trim() !== ''));
}

function normalizarMonto(v) {
  const limpio = String(v).replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Number(limpio);
  return Number.isFinite(n) ? n : 0;
}

export const manualProvider = {
  id: 'manual',
  nombre: 'Carga Manual (CSV / Excel)',
  disponible() { return true; },

  /**
   * Procesa el texto de un CSV con columnas flexibles (fecha, descripción, monto).
   * Devuelve { movimientos, resumen }.
   */
  procesarCSV(texto) {
    const filas = parseCSV(texto);
    if (!filas.length) return { movimientos: [], resumen: 'El archivo está vacío.' };

    // Detecta encabezado
    const encabezado = filas[0].map((h) => h.toLowerCase().trim());
    const idxFecha = encabezado.findIndex((h) => /fecha|date/.test(h));
    const idxDesc = encabezado.findIndex((h) => /desc|glosa|detalle|concepto/.test(h));
    const idxMonto = encabezado.findIndex((h) => /monto|amount|cargo|abono|valor/.test(h));
    const tieneHeader = idxFecha !== -1 || idxMonto !== -1;
    const cuerpo = tieneHeader ? filas.slice(1) : filas;

    const movimientos = cuerpo.map((f, i) => ({
      id: `mov-${i}`,
      fecha: f[idxFecha !== -1 ? idxFecha : 0] || '',
      descripcion: f[idxDesc !== -1 ? idxDesc : 1] || 'Movimiento',
      monto: normalizarMonto(f[idxMonto !== -1 ? idxMonto : 2] || 0),
    })).filter((m) => m.monto !== 0 || m.descripcion);

    const entradas = movimientos.filter((m) => m.monto > 0).reduce((s, m) => s + m.monto, 0);
    const salidas = movimientos.filter((m) => m.monto < 0).reduce((s, m) => s + Math.abs(m.monto), 0);

    return {
      movimientos,
      resumen: {
        total: movimientos.length,
        entradas,
        salidas,
        neto: entradas - salidas,
      },
    };
  },

  /** Lee un File y lo procesa. */
  async procesarArchivo(file) {
    const texto = await file.text();
    return this.procesarCSV(texto);
  },
};
