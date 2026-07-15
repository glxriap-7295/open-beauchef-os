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

/** Monto sospechoso: por encima de este umbral no se importa a ciegas. */
export const UMBRAL_SOSPECHOSO = 1_000_000_000; // CLP 1.000 millones

/** Magnitud absoluta de un monto en formato chileno (miles con punto, decimal con coma). */
function magnitud(v) {
  let s = String(v == null ? '' : v).replace(/[^0-9.,]/g, '');
  if (!s) return 0;
  s = s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  // Ignora ceros a la izquierda (p.ej. +0000264251 → 264251) sin perder decimales.
  s = s.replace(/^0+(?=\d)/, '');
  const n = Number(s);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

/** ¿La celda representa un negativo? (signo menos o paréntesis contables). */
function esNegativo(v) {
  const s = String(v == null ? '' : v);
  return /\(/.test(s) || /-/.test(s);
}

/** Monto con signo desde una sola celda (respeta -, (), y monto- final). */
function montoConSigno(v) {
  const mag = magnitud(v);
  return esNegativo(v) ? -mag : mag;
}

// Compat: se mantiene el nombre por si algo lo referencia.
function normalizarMonto(v) { return montoConSigno(v); }

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
    return this.procesarFilas(parseCSV(texto));
  },

  /** Núcleo del clasificador: procesa una matriz de filas ya extraída
   *  (desde CSV, Excel o PDF). Reutilizado por el pipeline universal. */
  procesarFilas(filas) {
    if (!filas || !filas.length) return { movimientos: [], resumen: { total: 0, entradas: 0, salidas: 0, neto: 0 } };

    const enc = filas[0].map((h) => String(h).toLowerCase().trim());
    const buscar = (re) => enc.findIndex((h) => re.test(h));

    // Columnas que NUNCA son montos de movimiento (saldo acumulado, números de
    // cuenta, documento, referencia, rut, sucursal, caja, id de transacción…).
    const esRef = (h) => /saldo|balance|n[°º.]?\s*cuenta|cuenta|account|docto|documento|comprobante|referen|folio|\brut\b|sucursal|oficina|caja|\btrn\b|\bnro?\b|n[uú]mero|codigo|c[oó]d\b/.test(h);

    const idxFecha = buscar(/fecha|date|d[ií]a/);
    const idxDesc = buscar(/glosa|detalle|descrip|concepto|movimiento/);
    // Columnas separadas de egreso (cargo/débito) e ingreso (abono/crédito).
    const idxCargo = buscar(/cargo|d[eé]bito|debe|giro|egreso|retiro/);
    const idxAbono = buscar(/abono|cr[eé]dito|haber|dep[oó]sito|ingreso/);
    // Columna de tipo (Ingreso/Egreso, Cargo/Abono, D/C).
    const idxTipo = buscar(/^tipo|tipo\b|d\/c|debe\/haber/);
    // Monto único (excluye saldo, cuenta, documento, referencia, etc.).
    const idxMonto = enc.findIndex((h) => /monto|importe|valor|amount|total/.test(h) && !esRef(h));

    const tieneHeader = [idxFecha, idxDesc, idxCargo, idxAbono, idxTipo, idxMonto].some((i) => i !== -1);
    const cuerpo = tieneHeader ? filas.slice(1) : filas;

    // Clasificador robusto: decide el signo (ingreso/egreso) según el formato.
    const montoDeFila = (f) => {
      // 1) Columnas Cargo + Abono separadas (formato más común en Chile).
      if (idxCargo !== -1 && idxAbono !== -1) {
        const cargo = magnitud(f[idxCargo]);
        const abono = magnitud(f[idxAbono]);
        if (abono && !cargo) return abono;      // ingreso
        if (cargo && !abono) return -cargo;     // egreso
        if (abono || cargo) return abono - cargo; // ambos con valor -> neto
        return 0;
      }
      // 2) Columna "Tipo" + un monto: el tipo define el signo.
      if (idxTipo !== -1 && idxMonto !== -1) {
        const mag = magnitud(f[idxMonto]);
        const tipo = String(f[idxTipo] || '').toLowerCase();
        if (/egreso|cargo|d[eé]bito|debe|giro|gasto|compra|pago|retiro|salida|^d$|^-/.test(tipo)) return -mag;
        if (/ingreso|abono|cr[eé]dito|haber|dep[oó]sito|entrada|^c$|^\+/.test(tipo)) return mag;
        return montoConSigno(f[idxMonto]); // tipo poco claro -> usa el signo del monto
      }
      // 3) Solo columna Cargo (egresos) o solo Abono (ingresos).
      if (idxCargo !== -1 && idxAbono === -1) return -magnitud(f[idxCargo]);
      if (idxAbono !== -1 && idxCargo === -1) return magnitud(f[idxAbono]);
      // 4) Monto único con signo (negativo = egreso, positivo = ingreso).
      if (idxMonto !== -1) return montoConSigno(f[idxMonto]);
      // 5) Sin encabezado: última celda numérica de la fila (saltando columnas
      //    de referencia/saldo conocidas), con su signo.
      for (let c = f.length - 1; c >= 0; c -= 1) {
        if (esRef(enc[c] || '')) continue;
        if (magnitud(f[c])) return montoConSigno(f[c]);
      }
      return 0;
    };

    const movimientos = cuerpo
      .map((f, i) => {
        const monto = montoDeFila(f);
        return {
          id: `mov-${i}`,
          fecha: normalizarFecha(f[idxFecha !== -1 ? idxFecha : 0] || ''),
          descripcion: String(f[idxDesc !== -1 ? idxDesc : 1] || 'Movimiento').trim() || 'Movimiento',
          monto,
          // Monto irrealmente grande → sospechoso (posible n° de cuenta/ref mal leído).
          sospechoso: Math.abs(monto) > UMBRAL_SOSPECHOSO,
        };
      })
      .filter((m) => m.monto !== 0);

    const entradas = movimientos.filter((m) => m.monto > 0).reduce((s, m) => s + m.monto, 0);
    const salidas = movimientos.filter((m) => m.monto < 0).reduce((s, m) => s + Math.abs(m.monto), 0);
    // [OB-diag] temporal: columnas detectadas y clasificación.
    console.info('[OB-diag] procesarCSV — cols {fecha,desc,cargo,abono,tipo,monto}:', [idxFecha, idxDesc, idxCargo, idxAbono, idxTipo, idxMonto],
      '· movimientos:', movimientos.length, '· ingresos:', movimientos.filter((m) => m.monto > 0).length, '· egresos:', movimientos.filter((m) => m.monto < 0).length);
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
