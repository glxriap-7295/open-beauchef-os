/**
 * Importador universal: convierte CUALQUIER archivo financiero en filas crudas
 * + texto, sin confiar en la extensión (inspecciona el contenido).
 * Soporta CSV/TXT (auto-delimitador), XLS/XLSX (SheetJS), y PDF (pdf.js texto).
 * Los PDF escaneados se marcan para OCR (Tesseract, mejor esfuerzo).
 * Librerías pesadas se cargan on-demand desde CDN (cero dependencias npm).
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

// ── Parser delimitado con auto-detección de separador ──────────────
function detectarDelimitador(texto) {
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

// Deriva filas tabulares aproximadas desde texto de PDF (2+ espacios = columna).
function filasDesdeTexto(texto) {
  return texto.split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/\s{2,}|\t|;/).map((x) => x.trim()))
    .filter((f) => f.length >= 2);
}

async function textoDesdePDF(bytes) {
  const pdfjs = await cargarPDF();
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  let texto = '';
  for (let p = 1; p <= doc.numPages; p += 1) {
    // eslint-disable-next-line no-await-in-loop
    const page = await doc.getPage(p);
    // eslint-disable-next-line no-await-in-loop
    const content = await page.getTextContent();
    texto += content.items.map((it) => it.str).join(' ') + '\n';
  }
  return texto;
}

/**
 * Extrae un archivo a { tipo, texto, filas } (filas = matriz de celdas).
 * @param {File} file
 */
export async function extraerArchivo(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const tipo = detectarTipo(buf, file.name);

  if (tipo === 'xlsx' || tipo === 'xls') {
    const XLSX = await cargarXLSX();
    const wb = XLSX.read(buf, { type: 'array' });
    const hoja = wb.Sheets[wb.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: '' });
    const texto = XLSX.utils.sheet_to_csv(hoja);
    return { tipo: 'excel', texto, filas };
  }

  if (tipo === 'pdf') {
    let texto = '';
    try { texto = await textoDesdePDF(buf); } catch { texto = ''; }
    const filas = filasDesdeTexto(texto);
    // PDF sin texto extraíble => escaneado. Señalamos OCR (mejor esfuerzo aparte).
    return { tipo: filas.length ? 'pdf' : 'pdf-escaneado', texto, filas };
  }

  // Texto (CSV/TXT/delimitado). Decodifica UTF-8 con fallback Latin-1.
  let texto;
  try { texto = new TextDecoder('utf-8', { fatal: false }).decode(buf); }
  catch { texto = new TextDecoder('latin1').decode(buf); }
  return { tipo: 'texto', texto, filas: parseDelimitado(texto) };
}
