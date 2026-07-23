/**
 * Importador universal: convierte CUALQUIER archivo financiero en filas crudas
 * + texto, sin confiar en la extensión (inspecciona el contenido).
 * Soporta CSV/TXT (auto-delimitador, UTF-8/Latin-1), XLS/XLSX (SheetJS, incl.
 * exportes "texto dentro de una celda" de Banco de Chile), y PDF (pdf.js texto;
 * OCR con Tesseract si está escaneado). Librerías pesadas se cargan on-demand
 * desde CDN (cero dependencias npm).
 */

// ── Cargadores de librerías desde CDN ──────────────────────────────
const cdn = (src) => new Promise((resolve, reject) => {
  const s = document.createElement('script');
  s.src = src; s.async = true;
  s.onload = () => resolve();
  s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
  document.head.appendChild(s);
});

let xlsxP = null;
function cargarXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!xlsxP) xlsxP = cdn('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js').then(() => window.XLSX);
  return xlsxP;
}

let pdfP = null;
function cargarPDF() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfP) pdfP = cdn('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js').then(() => {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    return window.pdfjsLib;
  });
  return pdfP;
}

let tessP = null;
function cargarTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (!tessP) tessP = cdn('https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.0/tesseract.min.js').then(() => window.Tesseract);
  return tessP;
}

// ── Detección de tipo por contenido (magic bytes) ──────────────────
function detectarTipo(bytes, nombre = '') {
  const head = String.fromCharCode(...bytes.slice(0, 8));
  if (head.startsWith('%PDF')) return 'pdf';
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return 'xlsx';           // PK.. (zip → xlsx/ods)
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf) return 'xls';            // XLS binario antiguo
  if (/\.(xlsx|xls)$/i.test(nombre)) return 'xlsx';
  if (/\.pdf$/i.test(nombre)) return 'pdf';
  return 'text';                                                       // CSV / TXT / delimitado
}

// ── Decodificación de texto UTF-8 con fallback Latin-1 ─────────────
// TextDecoder utf-8 no lanza en bytes inválidos: inserta  (U+FFFD).
// Si aparecen esos caracteres de reemplazo, reintentamos con Latin-1
// (windows-1252), común en exportes bancarios chilenos antiguos.
export function decodificarTexto(bytes) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (!utf8.includes('�')) return utf8;
  try { return new TextDecoder('windows-1252').decode(bytes); }
  catch { return new TextDecoder('latin1').decode(bytes); }
}

// ── Parser delimitado con auto-detección de separador ──────────────
export function detectarDelimitador(texto) {
  const linea = (texto.split('\n').find((l) => l.trim()) || '');
  const cont = (ch) => (linea.match(new RegExp(`\\${ch}`, 'g')) || []).length;
  const cand = [[';', cont(';')], [',', cont(',')], ['\t', cont('\t')], ['|', cont('|')]];
  cand.sort((a, b) => b[1] - a[1]);
  return cand[0][1] > 0 ? cand[0][0] : ',';
}

export function parseDelimitado(texto, delim) {
  const d = delim || detectarDelimitador(texto);
  const filas = [];
  let campo = '', fila = [], q = false;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    if (q) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i += 1; }
      else if (c === '"') q = false;
      else campo += c;
    } else if (c === '"') q = true;
    else if (c === d) { fila.push(campo); campo = ''; }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  if (campo.length || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter((f) => f.some((x) => String(x).trim() !== ''));
}

// ── Exportes "texto dentro de una celda" (Banco de Chile legacy) ────
// Algunos Excel guardan la fila completa "Fecha;Detalle;Cargo;Abono;Saldo"
// dentro de UNA sola celda. Nunca asumir 1 celda = 1 campo: si la mayoría de
// las filas tienen 1 columna útil pero contienen un delimitador, re-partir.
export function repartirFilasEmpaquetadas(filas) {
  if (!filas || !filas.length) return filas;
  const utilCount = (f) => f.filter((x) => String(x).trim() !== '').length;
  const empaquetadas = filas.filter((f) => utilCount(f) === 1);
  // ¿La mayoría es de una sola celda?
  if (empaquetadas.length < Math.max(2, filas.length * 0.6)) return filas;
  // Texto de la única celda no vacía.
  const soloCelda = (f) => String(f.find((x) => String(x).trim() !== '') || '');
  const muestra = empaquetadas.map(soloCelda).join('\n');
  const delim = detectarDelimitador(muestra);
  if (!/[;,\t|]/.test(muestra)) return filas; // no hay nada que re-partir
  return filas.map((f) => {
    if (utilCount(f) !== 1) return f;
    return parseDelimitado(soloCelda(f), delim)[0] || f;
  });
}

// Deriva filas tabulares aproximadas desde texto de PDF (2+ espacios = columna).
function filasDesdeTexto(texto) {
  return texto.split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/\s{2,}|\t|;/).map((x) => x.trim()))
    .filter((f) => f.length >= 2);
}

// ── Reconstrucción tabular de PDFs por POSICIÓN ────────────────────
// pdf.js entrega ítems de texto con coordenadas; si sólo los unimos con
// espacios, TODA la página queda en una sola "línea" y no hay filas por
// transacción (bug: el importador recibía 1 fila que se consumía como
// encabezado → 0 movimientos). Aquí agrupamos ítems en líneas por su Y y en
// columnas por su X, usando el encabezado como anclas de columna.

// Mapea una palabra del encabezado a su columna canónica.
function bucketColumna(t) {
  const s = String(t).toLowerCase();
  if (/fecha|date/.test(s)) return 'Fecha';
  if (/detalle|movimiento|glosa|descrip|concepto/.test(s)) return 'Detalle';
  if (/cargo|d[eé]bito|debe|giro/.test(s)) return 'Cargo';
  if (/abono|cr[eé]dito|haber|dep[oó]sito/.test(s)) return 'Abono';
  if (/monto|importe|valor|amount/.test(s)) return 'Monto';
  if (/saldo|balance/.test(s)) return 'Saldo';
  return null;
}

// Agrupa los ítems de UNA página en líneas (por Y) y las ordena de arriba a
// abajo; dentro de cada línea, ordena por X.
function agruparLineas(items) {
  const its = (items || [])
    .filter((it) => typeof it.str === 'string' && it.str.trim() !== '')
    .map((it) => ({ str: it.str.trim(), x: it.transform[4], y: it.transform[5], h: it.height || 10 }));
  const lineas = [];
  for (const it of its) {
    let L = lineas.find((l) => Math.abs(l.y - it.y) <= Math.max(2, it.h * 0.5));
    if (!L) { L = { y: it.y, items: [] }; lineas.push(L); }
    L.items.push(it);
  }
  lineas.sort((a, b) => b.y - a.y);            // PDF: Y crece hacia arriba
  for (const L of lineas) L.items.sort((a, b) => a.x - b.x);
  return lineas;
}

// Reconstruye una tabla a partir de las líneas de cada página. Detecta la fila
// de encabezado (≥2 columnas reconocidas + una de monto), fija las anclas de
// columna por X y asigna cada token de las filas siguientes a su columna por
// rango. Descarta líneas de título/metadata previas al encabezado.
// Devuelve una matriz de filas (encabezado incluido) o null si no hay tabla.
function reconstruirTablaPDF(paginas) {
  let labels = null;
  let xs = null;
  const filas = [];

  const aFila = (L) => {
    const cells = labels.map(() => '');
    for (const it of L.items) {
      let j = 0;
      for (let k = 0; k < xs.length; k += 1) if (it.x >= xs[k] - 3) j = k;
      cells[j] = (cells[j] ? `${cells[j]} ${it.str}` : it.str).trim();
    }
    return cells;
  };

  for (const lineas of paginas) {
    let hidx = -1;
    for (let i = 0; i < lineas.length; i += 1) {
      const bs = lineas[i].items.map((it) => bucketColumna(it.str)).filter(Boolean);
      const set = new Set(bs);
      if (set.size >= 2 && (set.has('Cargo') || set.has('Abono') || set.has('Monto') || set.has('Saldo'))) { hidx = i; break; }
    }
    if (hidx !== -1) {
      const cols = new Map();
      for (const it of lineas[hidx].items) {
        const b = bucketColumna(it.str);
        if (b && (!cols.has(b) || it.x < cols.get(b))) cols.set(b, it.x);
      }
      const ordenadas = [...cols.entries()].sort((a, b) => a[1] - b[1]);
      labels = ordenadas.map((e) => e[0]);
      xs = ordenadas.map((e) => e[1]);
      if (!filas.length) filas.push(labels);
      for (const L of lineas.slice(hidx + 1)) filas.push(aFila(L));
    } else if (labels) {
      // Página sin su propio encabezado: reutiliza las anclas anteriores.
      for (const L of lineas) filas.push(aFila(L));
    }
  }
  return labels ? filas : null;
}

// Renderiza cada página del PDF a canvas y aplica OCR (Tesseract, español).
async function ocrDesdePDF(pdfjs, doc, onPaso) {
  const Tesseract = await cargarTesseract();
  let texto = '';
  const maxPag = Math.min(doc.numPages, 10); // límite razonable de OCR
  for (let p = 1; p <= maxPag; p += 1) {
    // eslint-disable-next-line no-await-in-loop
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    // eslint-disable-next-line no-await-in-loop
    await page.render({ canvasContext: ctx, viewport }).promise;
    try { onPaso?.('ocr'); } catch { /* noop */ }
    // eslint-disable-next-line no-await-in-loop
    const { data } = await Tesseract.recognize(canvas, 'spa');
    texto += (data?.text || '') + '\n';
  }
  return texto;
}

/**
 * Extrae un archivo a { tipo, texto, filas } (filas = matriz de celdas).
 * @param {File} file
 * @param {object} opts { onPaso, ocr }  ocr=true habilita OCR de PDFs escaneados
 */
export async function extraerArchivo(file, { onPaso, ocr = true } = {}) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const tipo = detectarTipo(buf, file.name);

  if (tipo === 'xlsx' || tipo === 'xls') {
    const XLSX = await cargarXLSX();
    const wb = XLSX.read(buf, { type: 'array' });
    const hoja = wb.Sheets[wb.SheetNames[0]];
    let filas = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: '' });
    filas = repartirFilasEmpaquetadas(filas); // Banco de Chile legacy
    const texto = XLSX.utils.sheet_to_csv(hoja);
    return { tipo: 'excel', texto, filas };
  }

  if (tipo === 'pdf') {
    const pdfjs = await cargarPDF();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    let texto = '';
    const paginas = [];
    try {
      for (let p = 1; p <= doc.numPages; p += 1) {
        // eslint-disable-next-line no-await-in-loop
        const page = await doc.getPage(p);
        // eslint-disable-next-line no-await-in-loop
        const content = await page.getTextContent();
        const lineas = agruparLineas(content.items);
        paginas.push(lineas);
        // Texto plano (una línea por fila visual) para detectar el banco.
        texto += lineas.map((L) => L.items.map((it) => it.str).join(' ')).join('\n') + '\n';
      }
    } catch { texto = ''; }
    // Reconstrucción tabular por posición; si no hay tabla reconocible, fallback
    // al parser por espacios sobre el texto plano (ya con saltos de línea reales).
    let filas = reconstruirTablaPDF(paginas) || filasDesdeTexto(texto);
    // PDF sin texto extraíble => escaneado. Intentamos OCR (mejor esfuerzo).
    if (!filas.length && ocr) {
      try {
        texto = await ocrDesdePDF(pdfjs, doc, onPaso);
        filas = filasDesdeTexto(texto);
      } catch { /* OCR falló: se marca escaneado abajo */ }
    }
    return { tipo: filas.length ? 'pdf' : 'pdf-escaneado', texto, filas };
  }

  // Texto (CSV/TXT/delimitado). UTF-8 con fallback Latin-1.
  const texto = decodificarTexto(buf);
  return { tipo: 'texto', texto, filas: parseDelimitado(texto) };
}
