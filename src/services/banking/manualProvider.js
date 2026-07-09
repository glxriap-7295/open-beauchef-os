/**
 * Proveedor de Carga Manual: procesa cartolas / movimientos desde CSV y Excel.
 * Funciona en el navegador; el Excel usa SheetJS cargado on-demand desde CDN
 * (sin dependencia npm). Siempre disponible (fallback de Open Banking).
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
    } else if (c === ',' || c === ';' || c === '\t') {
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

function pad(n) { return String(n).padStart(2, '0'); }

const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12, jan: 1, apr: 4, aug: 8, dec: 12 };

/**
 * Normaliza fechas a ISO YYYY-MM-DD desde múltiples formatos:
 * DD/MM/YYYY (Chile), YYYY-MM-DD, DD-MM-YY, DD.MM.YYYY, "12 jul 2025", etc.
 * Cada movimiento se parsea de forma independiente (no se asume mes calendario).
 */
export function normalizarFecha(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  // ISO: YYYY-MM-DD o YYYY/MM/DD
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  // Chileno: DD/MM/YYYY o DD-MM-YY(YY) o DD.MM.YYYY
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    let y = m[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${pad(m[2])}-${pad(m[1])}`;
  }
  // Con nombre de mes: "12 jul 2025", "12 de julio de 2025"
  m = s.toLowerCase().match(/(\d{1,2})\D+([a-záéíóú]{3})[a-záéíóú]*\D+(\d{4})/);
  if (m) {
    const mo = MESES[m[2].slice(0, 3)];
    if (mo) return `${m[3]}-${pad(mo)}-${pad(m[1])}`;
  }
  // Último recurso: Date nativo.
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
}

function normalizarMonto(v) {
  const limpio = String(v).replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Number(limpio);
  return Number.isFinite(n) ? n : 0;
}

// Carga SheetJS (XLSX) on-demand desde CDN, solo si se sube un Excel.
let xlsxPromise = null;
function cargarXLSX() {
  if (typeof window !== 'undefined' && window.XLSX) return Promise.resolve(window.XLSX);
  if (xlsxPromise) return xlsxPromise;
  xlsxPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    s.async = true;
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error('No se pudo cargar el lector de Excel.'));
    document.head.appendChild(s);
  });
  return xlsxPromise;
}

export const manualProvider = {
  id: 'manual',
  nombre: 'Carga Manual (CSV / Excel)',
  disponible() { return true; },

  /**
   * Procesa el texto de un CSV con columnas flexibles (fecha, descripción, monto).
   * Valida filas malformadas con gracia (nunca pierde datos parseables).
   */
  procesarCSV(texto) {
    const filas = parseCSV(texto);
    if (!filas.length) return { movimientos: [], resumen: { total: 0, entradas: 0, salidas: 0, neto: 0 } };

    const encabezado = filas[0].map((h) => String(h).toLowerCase().trim());
    const idxFecha = encabezado.findIndex((h) => /fecha|date/.test(h));
    const idxDesc = encabezado.findIndex((h) => /desc|glosa|detalle|concepto|referen/.test(h));
    const idxMonto = encabezado.findIndex((h) => /monto|amount|cargo|abono|valor|importe/.test(h));
    const tieneHeader = idxFecha !== -1 || idxMonto !== -1;
    const cuerpo = tieneHeader ? filas.slice(1) : filas;

    const movimientos = cuerpo
      .map((f, i) => ({
        id: `mov-${i}`,
        fecha: normalizarFecha(f[idxFecha !== -1 ? idxFecha : 0] || ''),
        descripcion: String(f[idxDesc !== -1 ? idxDesc : 1] || 'Movimiento').trim() || 'Movimiento',
        monto: normalizarMonto(f[idxMonto !== -1 ? idxMonto : 2] || 0),
      }))
      // Fila válida = tiene monto distinto de 0 (los montos son la señal principal).
      .filter((m) => m.monto !== 0);

    const entradas = movimientos.filter((m) => m.monto > 0).reduce((s, m) => s + m.monto, 0);
    const salidas = movimientos.filter((m) => m.monto < 0).reduce((s, m) => s + Math.abs(m.monto), 0);
    return { movimientos, resumen: { total: movimientos.length, entradas, salidas, neto: entradas - salidas } };
  },

  /** Lee un File (CSV o Excel) y lo procesa. */
  async procesarArchivo(file) {
    const esExcel = /\.(xlsx|xls)$/i.test(file.name) ||
      /spreadsheet|excel/i.test(file.type || '');
    if (esExcel) {
      const XLSX = await cargarXLSX();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const hoja = wb.Sheets[wb.SheetNames[0]];
      const csv = XLSX.utils.sheet_to_csv(hoja);
      return this.procesarCSV(csv);
    }
    const texto = await file.text();
    return this.procesarCSV(texto);
  },
};
