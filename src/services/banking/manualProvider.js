/**
 * Proveedor de Carga Manual — MOTOR DE PARSEO UNIVERSAL DE CARTOLAS.
 * ============================================================================
 * Procesa movimientos desde CSV, Excel y tablas de PDF ya reconstruidas.
 * Funciona en el navegador; el Excel usa SheetJS cargado on-demand desde CDN.
 *
 * FILOSOFÍA DEL DISEÑO
 * --------------------
 * El parser NO asume nombres de columna, orden de columnas, ni layout de un
 * banco específico. Analiza el CONTENIDO real de cada columna para inferir su
 * rol semántico (date, description, debit, credit, amount, balance, reference,
 * type). El texto del encabezado es solo una PISTA DÉBIL; las señales de datos
 * mandan. Robusto a:
 *   · encabezados en 1, 2 o filas fusionadas,
 *   · nombres de columna inesperados o en otro idioma (Debit/Credit),
 *   · columnas en cualquier orden,
 *   · débito/crédito, monto con signo, columna "Tipo", paréntesis contables,
 *   · formatos numéricos europeo (1.234,56), US (1,234.56) y chileno (1.234),
 *   · fechas DD/MM/YYYY, DD/MM (año inferido), ISO, nombres de mes,
 *   · filas que NO son transacciones (saldos, totales, pie, avisos).
 *
 * API PÚBLICA (NO CAMBIAR): procesarCSV(), procesarFilas(), procesarArchivo().
 * Forma de salida (NO CAMBIAR):
 *   { movimientos: [{ id, fecha, descripcion, monto, sospechoso }],
 *     resumen: { total, entradas, salidas, neto } }
 * Se agrega una clave EXTRA `diagnostico` (aditiva, ignorada por consumidores).
 *
 * Módulos internos (funciones puras): parseCSV · DateParser (normalizarFecha,
 * pareceFecha, parseFecha) · AmountParser (parseAmount) · CellKind ·
 * HeaderDetector (esFilaEncabezado, detectarEncabezados) ·
 * ColumnClassifier/TableAnalyzer (statsColumna, exclusividad, clasificarColumnas)
 * · TransactionDetector (razonNoTransaccion) · Row builders.
 * ============================================================================
 */

/* ═══════════════════ CSV → matriz de celdas ═══════════════════ */
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

/* ═══════════════════ DateParser ═══════════════════ */
const MESES = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
  jan: 1, apr: 4, aug: 8, dec: 12,
};

/**
 * Normaliza una fecha a ISO `YYYY-MM-DD`. Devuelve '' si no reconoce una fecha
 * COMPLETA (con año). El respaldo con `new Date()` exige un año de 4 dígitos
 * para NO interpretar decimales como fechas (p.ej. "3.50"). EXPORTADA (estable).
 */
export function normalizarFecha(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);          // ISO
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);            // DD/MM/YYYY
  if (m) { let y = m[3]; if (y.length === 2) y = `20${y}`; return `${y}-${pad(m[2])}-${pad(m[1])}`; }
  m = s.toLowerCase().match(/(\d{1,2})\D+([a-záéíóú]{3})[a-záéíóú]*\D+(\d{4})/); // "12 jul 2025"
  if (m) { const mo = MESES[m[2].slice(0, 3)]; if (mo) return `${m[3]}-${pad(mo)}-${pad(m[1])}`; }
  if (/\d{4}/.test(s)) { const d = new Date(s); if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10); }
  return '';
}

/**
 * ¿La celda PARECE una fecha (aunque le falte el año)? Detector para clasificar.
 * Importante: los separadores '.' solo se aceptan en la forma COMPLETA
 * DD.MM.YYYY; la forma corta DD/MM se limita a '/' o '-' para no colisionar con
 * montos decimales como "3.50" o "96.50". Además valida rangos día≤31, mes≤12.
 */
function pareceFecha(v) {
  const t = String(v || '').trim();
  if (!t) return false;
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(t)) return true;                 // ISO
  const dmy = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);            // DD/MM/YYYY (cualquier sep)
  if (dmy && +dmy[1] <= 31 && +dmy[2] <= 12) return true;
  const dm = t.match(/^(\d{1,2})[-/](\d{1,2})$/);                            // DD/MM sin año (solo / o -)
  if (dm && +dm[1] <= 31 && +dm[2] <= 12) return true;
  if (/^\d{1,2}\s*(de\s+)?(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|jan|apr|aug|dec)/i.test(t)) return true;
  return false;
}

/** Parsea una fecha con inferencia de año faltante (DD/MM → usa `anioSugerido`). */
function parseFecha(raw, anioSugerido) {
  const t = String(raw || '').trim();
  const m = t.match(/^(\d{1,2})[-/.](\d{1,2})$/);                            // DD/MM sin año
  if (m && anioSugerido) return `${anioSugerido}-${pad(m[2])}-${pad(m[1])}`;
  return normalizarFecha(raw);
}

/* ═══════════════════ AmountParser (EU / US / CLP / paréntesis / OCR) ═══════════════════ */
/** Monto sospechoso: por encima de este umbral no se importa a ciegas. EXPORTADA. */
export const UMBRAL_SOSPECHOSO = 1_000_000_000; // CLP 1.000 millones

/**
 * Decide si un ÚNICO tipo de separador es decimal o de miles:
 *   · seguido de EXACTAMENTE 3 dígitos → miles (CLP 1.234 = 1234)
 *   · seguido de 1–2 dígitos → decimal (12,5 = 12.5)
 *   · varios del mismo tipo → miles (1.234.567)
 * Devuelve el carácter decimal, o null (=> separador de miles, sin decimales).
 */
function decidirDecimalUnico(s, sep) {
  const partes = s.split(sep);
  if (partes.length === 2) {
    const dec = partes[1];
    if (/^\d{3}$/.test(dec)) return null;
    if (dec.length === 1 || dec.length === 2) return sep;
    return null;
  }
  return null;
}

/** Parsea una celda a { hasDigits, magnitude(abs), negative }. No asume formato. */
function parseAmount(raw) {
  const s0 = String(raw == null ? '' : raw);
  if (!/\d/.test(s0)) return { hasDigits: false, magnitude: 0, negative: false };
  const negParen = /\(\s*[\d.,]/.test(s0) && /\)/.test(s0);
  const negMenos = /-\s*\d/.test(s0) || /\d[\s]*-\s*$/.test(s0);
  const negative = negParen || negMenos;
  let s = s0.replace(/[^\d.,]/g, '');
  if (!/\d/.test(s)) return { hasDigits: false, magnitude: 0, negative: false };
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let decimal = null;
  if (lastComma !== -1 && lastDot !== -1) decimal = lastComma > lastDot ? ',' : '.';
  else if (lastComma !== -1) decimal = decidirDecimalUnico(s, ',');
  else if (lastDot !== -1) decimal = decidirDecimalUnico(s, '.');
  if (decimal) {
    const miles = decimal === ',' ? '.' : ',';
    s = s.split(miles).join('');
    s = s.replace(decimal, '.');
  } else {
    s = s.replace(/[.,]/g, '');
  }
  s = s.replace(/^0+(?=\d)/, '');
  const n = Number(s);
  return { hasDigits: true, magnitude: Number.isFinite(n) ? Math.abs(n) : 0, negative };
}

/* ═══════════════════ CellKind ═══════════════════ */
function esTextoCelda(v) {
  const t = String(v || '').trim();
  const letras = (t.match(/[a-záéíóúñ]/gi) || []).length;
  const digitos = (t.match(/\d/g) || []).length;
  return letras >= 3 && letras > digitos;
}
function esNumeroCelda(v) {
  const t = String(v || '').trim();
  if (!t || pareceFecha(t)) return false;
  if (esTextoCelda(t)) return false;
  return parseAmount(t).hasDigits;
}
function celdaVacia(v) { return String(v == null ? '' : v).trim() === ''; }

/* ═══════════════════ Vocabularios (pistas débiles / semántica) ═══════════════════ */
const HINT = {
  date: /fecha|date|d[ií]a\b|dia\/mes|fec\b/,
  description: /glosa|detalle|descrip|concepto|movimiento|observ|transacci/,
  debit: /cargo|d[eé]bito|debito|debe\b|giro|egreso|retiro|o cargos/,
  credit: /abono|cr[eé]dito|credito|haber|dep[oó]sito|deposito|ingreso|o abonos/,
  amount: /monto|importe|valor|amount|movimiento\s*\$|cantidad/,
  balance: /saldo|balance/,
  type: /^tipo$|tipo\b|d\/c|debe\/haber|cargo\/abono|ind\b/,
  reference: /docto|documento|comprobante|folio|\brut\b|sucursal|oficina|caja|\btrn\b|n[°º]|\bnro?\b|n[uú]mero|c[oó]digo|referen|\bref\b|serie|operaci[oó]n|canal/,
};
const VALOR_TIPO = /^(cargo|abono|d[eé]bito|debito|cr[eé]dito|credito|debe|haber|ingreso|egreso|gasto|compra|pago|dep[oó]sito|deposito|retiro|giro|d|c|\+|-)$/i;
const VALOR_DEBITO = /cargo|d[eé]bito|debito|debe|giro|gasto|compra|pago|retiro|salida|egreso|^d$|^-$/i;
const VALOR_CREDITO = /abono|cr[eé]dito|credito|haber|dep[oó]sito|deposito|entrada|ingreso|^c$|^\+$/i;
const RESUMEN = /saldo\s+(inicial|final|anterior|disponible|contable|nuevo|actual)|saldo\s+total|^saldos?\b|totales?\b|subtotal|opening balance|closing balance|resumen|p[áa]gina\s*\d|\bhoja\s*\d|estimad[oa]\s+client|publicidad|cupo\s+(disponible|total|utilizado)|l[íi]nea de cr[eé]dito|tasa\s|inter[eé]s por mora|informaci[oó]n importante|no v[áa]lido como/i;
const matchHint = (texto, re) => re.test(String(texto || '').toLowerCase());

/* ═══════════════════ HeaderDetector (0, 1, 2 o filas fusionadas) ═══════════════════ */
/** ¿La fila parece ENCABEZADO (etiquetas) y no una transacción? */
function esFilaEncabezado(fila) {
  const noVacias = fila.map((c) => String(c || '').trim()).filter(Boolean);
  if (!noVacias.length) return false;
  if (noVacias.some(pareceFecha)) return false;                              // una fecha ⇒ es data
  // Un monto real (≥1000) ⇒ es data, no encabezado (evita absorber "SALDO INICIAL … 1000000").
  if (noVacias.some((x) => esNumeroCelda(x) && parseAmount(x).magnitude >= 1000)) return false;
  const conMonto = noVacias.filter((c) => esNumeroCelda(c) && /[.,]/.test(c)).length;
  if (conMonto >= 2) return false;
  const hint = noVacias.filter((c) => Object.values(HINT).some((re) => matchHint(c, re))).length;
  const texto = noVacias.filter(esTextoCelda).length;
  return hint >= 1 || texto >= Math.ceil(noVacias.length * 0.6);
}

/** Detecta filas de encabezado consecutivas y las fusiona en una sola por columna. */
function detectarEncabezados(filas) {
  const maxScan = Math.min(filas.length, 4);
  let n = 0;
  for (let i = 0; i < maxScan; i += 1) { if (esFilaEncabezado(filas[i])) n += 1; else break; }
  if (n === 0) return { nHeader: 0, mergedHeader: [] };
  const ancho = Math.max(...filas.slice(0, n).map((f) => f.length));
  const mergedHeader = [];
  for (let c = 0; c < ancho; c += 1) {
    const partes = [];
    for (let r = 0; r < n; r += 1) { const v = String((filas[r] && filas[r][c]) || '').trim(); if (v) partes.push(v); }
    mergedHeader.push(partes.join(' '));                                     // "Fecha DIA/MES", "Monto O CARGOS"
  }
  return { nHeader: n, mergedHeader };
}

/* ═══════════════════ ColumnClassifier / TableAnalyzer ═══════════════════ */
/**
 * Estadísticas por columna sobre las filas CANDIDATAS (sin encabezados ni
 * resúmenes). Los ratios se calculan sobre las celdas LLENAS, para que una
 * columna dispersa (débito/crédito, llena solo en algunas filas) siga
 * reconociéndose como numérica.
 */
function statsColumna(cuerpo, c) {
  let llenas = 0; let fechas = 0; let numeros = 0; let textos = 0; let negativos = 0; let conSep = 0; let enteroLargo = 0;
  const valores = new Set();
  for (const fila of cuerpo) {
    const v = fila[c];
    if (celdaVacia(v)) continue;
    llenas += 1;
    valores.add(String(v).trim());
    if (pareceFecha(v)) fechas += 1;
    else if (esNumeroCelda(v)) {
      numeros += 1;
      const a = parseAmount(v);
      if (a.negative) negativos += 1;
      if (/[.,]/.test(String(v))) conSep += 1;
      if (/^\d{9,}$/.test(String(v).replace(/[^\d]/g, ''))) enteroLargo += 1;
    } else if (esTextoCelda(v)) textos += 1;
  }
  const n = cuerpo.length || 1;
  const ll = Math.max(1, llenas);
  return {
    n, densidad: llenas / n,
    fechaRatio: fechas / ll, numeroRatio: numeros / ll, textoRatio: textos / ll,
    negativos, conSepRatio: numeros ? conSep / numeros : 0, enteroLargoRatio: numeros ? enteroLargo / numeros : 0,
    cardinalidad: valores.size / ll,
    tipoValorRatio: (() => {
      let t = 0; let l = 0;
      for (const fila of cuerpo) { const v = String(fila[c] || '').trim(); if (!v) continue; l += 1; if (VALOR_TIPO.test(v)) t += 1; }
      return l ? t / l : 0;
    })(),
  };
}

/** ¿Las columnas a y b son un par débito/crédito (mutuamente excluyentes)? */
function exclusividad(cuerpo, a, b) {
  let either = 0; let both = 0; let fa = 0; let fb = 0;
  for (const fila of cuerpo) {
    const va = !celdaVacia(fila[a]) && esNumeroCelda(fila[a]);
    const vb = !celdaVacia(fila[b]) && esNumeroCelda(fila[b]);
    if (va) fa += 1; if (vb) fb += 1;
    if (va || vb) either += 1;
    if (va && vb) both += 1;
  }
  if (!fa || !fb || !either) return 0;
  return 1 - both / either;
}

/**
 * Clasifica columnas combinando señales de DATOS (fuertes) + pistas de
 * encabezado (débiles). Roles: date | description | debit | credit | amount |
 * balance | reference | type | ignore.
 */
function clasificarColumnas(cuerpo, header) {
  const ancho = Math.max(cuerpo.length ? Math.max(...cuerpo.map((f) => f.length)) : 0, header.length);
  const stats = [];
  for (let c = 0; c < ancho; c += 1) stats.push(statsColumna(cuerpo, c));
  const hint = (c, re) => matchHint(header[c] || '', re);
  const roles = new Array(ancho).fill(null).map(() => ({ role: 'ignore', confidence: 0.3 }));
  const asignadas = new Set();
  const set = (c, role, confidence) => { roles[c] = { role, confidence }; asignadas.add(c); };

  // 1) FECHA — columna densa cuyas celdas llenas son mayormente fechas.
  let cFecha = -1; let mejorF = 0.5;
  for (let c = 0; c < ancho; c += 1) {
    const elig = stats[c].fechaRatio >= 0.6 && stats[c].densidad >= 0.4;
    if (!elig) continue;
    const sc = stats[c].fechaRatio + (hint(c, HINT.date) ? 0.25 : 0);
    if (sc > mejorF) { mejorF = sc; cFecha = c; }
  }
  if (cFecha !== -1) set(cFecha, 'date', Math.min(0.99, stats[cFecha].fechaRatio + (hint(cFecha, HINT.date) ? 0.15 : 0)));

  // 2) TIPO — columna de texto corto cuyos VALORES son cargo/abono/D/C…
  for (let c = 0; c < ancho; c += 1) {
    if (asignadas.has(c)) continue;
    if (stats[c].tipoValorRatio >= 0.6 && stats[c].numeroRatio < 0.5) set(c, 'type', Math.min(0.98, 0.6 + stats[c].tipoValorRatio * 0.3));
  }

  // 3) Columnas numéricas candidatas (mayoría de celdas llenas son números).
  const numericas = [];
  for (let c = 0; c < ancho; c += 1) { if (asignadas.has(c)) continue; if (stats[c].numeroRatio >= 0.7) numericas.push(c); }

  // 3a) REFERENCIA — pista de encabezado, o enteros largos (≥9) de alta
  //     cardinalidad sin formato de miles (n° de cuenta/documento/operación).
  const refs = [];
  for (const c of numericas) {
    const esRefHint = hint(c, HINT.reference) && !hint(c, HINT.amount) && !hint(c, HINT.balance) && !hint(c, HINT.debit) && !hint(c, HINT.credit);
    const esRefDato = stats[c].enteroLargoRatio >= 0.8 && stats[c].conSepRatio < 0.2 && stats[c].cardinalidad > 0.9;
    if (esRefHint || esRefDato) { set(c, 'reference', 0.8); refs.push(c); }
  }
  const movBalance = numericas.filter((c) => !refs.includes(c));

  // 3b) PAR DÉBITO/CRÉDITO — dos numéricas mutuamente excluyentes (idioma-agnóstico).
  let par = null; let mejorEx = 0.7;
  for (let i = 0; i < movBalance.length; i += 1) for (let j = i + 1; j < movBalance.length; j += 1) {
    const ex = exclusividad(cuerpo, movBalance[i], movBalance[j]);
    if (ex >= mejorEx) { mejorEx = ex; par = [movBalance[i], movBalance[j]]; }
  }
  const usadasPar = new Set();
  if (par) {
    const [a, b] = par;
    const aDeb = hint(a, HINT.debit); const aCred = hint(a, HINT.credit);
    const bDeb = hint(b, HINT.debit); const bCred = hint(b, HINT.credit);
    let debito = a; let credito = b;                                          // convención: salida izq, entrada der
    if (aCred || bDeb) { debito = b; credito = a; }
    else if (aDeb || bCred) { debito = a; credito = b; }
    set(debito, 'debit', Math.min(0.97, 0.6 + mejorEx * 0.3));
    set(credito, 'credit', Math.min(0.97, 0.6 + mejorEx * 0.3));
    usadasPar.add(a); usadasPar.add(b);
  }

  // 3c) SALDO y MONTO entre las numéricas restantes.
  const restantes = movBalance.filter((c) => !usadasPar.has(c));
  let cSaldo = -1;
  const conHintSaldo = restantes.filter((c) => hint(c, HINT.balance));
  if (conHintSaldo.length) cSaldo = conHintSaldo[conHintSaldo.length - 1];
  else if (par && restantes.length) { cSaldo = restantes.slice().sort((x, y) => (stats[y].densidad - stats[x].densidad))[0]; if (stats[cSaldo].densidad < 0.7) cSaldo = -1; }
  else if (restantes.length >= 2) cSaldo = restantes.slice().sort((x, y) => (stats[y].densidad - stats[x].densidad) || (y - x))[0];
  if (cSaldo !== -1) set(cSaldo, 'balance', Math.min(0.99, 0.6 + stats[cSaldo].densidad * 0.35));

  for (const c of restantes) {
    if (c === cSaldo || asignadas.has(c)) continue;
    const conf = 0.6 + (stats[c].negativos > 0 ? 0.2 : 0) + (hint(c, HINT.amount) ? 0.15 : 0);
    set(c, 'amount', Math.min(0.97, conf));
  }

  // 4) DESCRIPCIÓN — mayor textoRatio entre las no asignadas.
  let cDesc = -1; let mejorT = 0.35;
  for (let c = 0; c < ancho; c += 1) {
    if (asignadas.has(c)) continue;
    if (stats[c].textoRatio < 0.5 && !hint(c, HINT.description)) continue;
    const sc = stats[c].textoRatio + (hint(c, HINT.description) ? 0.3 : 0);
    if (sc > mejorT) { mejorT = sc; cDesc = c; }
  }
  if (cDesc !== -1) set(cDesc, 'description', Math.min(0.98, stats[cDesc].textoRatio + (hint(cDesc, HINT.description) ? 0.2 : 0.1)));

  return { roles, stats, ancho };
}

/* ═══════════════════ TransactionDetector ═══════════════════ */
function razonNoTransaccion(fila, mapa) {
  const noVacias = fila.map((c) => String(c || '').trim()).filter(Boolean);
  if (!noVacias.length) return 'fila vacía';
  if (RESUMEN.test(noVacias.join(' '))) return 'fila de resumen/saldo/total/pie';
  const hayFecha = mapa.date != null ? pareceFecha(fila[mapa.date]) : noVacias.some(pareceFecha);
  const hayMonto = [mapa.debit, mapa.credit, mapa.amount].filter((i) => i != null).some((i) => esNumeroCelda(fila[i]));
  const hayNumero = noVacias.some((c) => esNumeroCelda(c));
  if (!hayFecha && !hayMonto && !hayNumero) return 'metadata/pie sin fecha ni monto';
  return null;
}

/* ═══════════════════ Row builders ═══════════════════ */
function montoDeFila(fila, mapa) {
  if (mapa.debit != null && mapa.credit != null) {                           // A) Débito + Crédito separados
    const cargo = parseAmount(fila[mapa.debit]).magnitude;
    const abono = parseAmount(fila[mapa.credit]).magnitude;
    if (abono && !cargo) return abono;
    if (cargo && !abono) return -cargo;
    if (abono || cargo) return abono - cargo;
    return 0;
  }
  if (mapa.amount != null) {                                                 // B) Monto único (± o columna Tipo)
    const a = parseAmount(fila[mapa.amount]);
    let signo = a.negative ? -1 : 1;
    if (mapa.type != null) {
      const tv = String(fila[mapa.type] || '').trim();
      if (VALOR_DEBITO.test(tv)) signo = -1;
      else if (VALOR_CREDITO.test(tv)) signo = 1;
    }
    return signo * a.magnitude;
  }
  const evitar = new Set([mapa.balance, mapa.reference, mapa.date].filter((i) => i != null)); // C) Fallback
  for (let c = fila.length - 1; c >= 0; c -= 1) {
    if (evitar.has(c)) continue;
    const a = parseAmount(fila[c]);
    if (a.hasDigits && !pareceFecha(fila[c])) return (a.negative ? -1 : 1) * a.magnitude;
  }
  return 0;
}

function fechaDeFila(fila, mapa, anioSugerido) {
  if (mapa.date != null) return parseFecha(fila[mapa.date], anioSugerido);
  const cell = fila.find((c) => pareceFecha(c));
  return cell ? parseFecha(cell, anioSugerido) : '';
}

function descripcionDeFila(fila, mapa, ancho) {
  const usadas = new Set([mapa.date, mapa.debit, mapa.credit, mapa.amount, mapa.balance, mapa.reference, mapa.type].filter((i) => i != null));
  const partes = [];
  if (mapa.description != null) partes.push(String(fila[mapa.description] || '').trim());
  for (let c = 0; c < ancho; c += 1) {
    if (c === mapa.description || usadas.has(c)) continue;
    const v = String(fila[c] || '').trim();
    if (v && esTextoCelda(v)) partes.push(v);                                // une descripciones partidas de PDF
  }
  const desc = partes.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return desc || 'Movimiento';
}

/** Año más frecuente entre las fechas COMPLETAS del cuerpo (para inferir DD/MM). */
function anioDominante(cuerpo, cFecha) {
  const conteo = {};
  for (const fila of cuerpo) {
    const iso = normalizarFecha(cFecha != null ? fila[cFecha] : (fila.find(pareceFecha) || ''));
    const y = iso.slice(0, 4);
    if (y) conteo[y] = (conteo[y] || 0) + 1;
  }
  const top = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : String(new Date().getFullYear());
}

/* ═══════════════════ SheetJS on-demand ═══════════════════ */
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

/* ═══════════════════ Helpers de diagnóstico ═══════════════════ */
function mapaDeRoles(roles) {
  const mapa = { date: null, description: null, debit: null, credit: null, amount: null, balance: null, reference: null, type: null };
  roles.forEach((r, i) => { if (r.role in mapa && mapa[r.role] == null) mapa[r.role] = i; });
  return mapa;
}
function advertencias(mapa, movimientos) {
  const w = [];
  if (mapa.date == null) w.push('No se identificó columna de fecha con confianza.');
  if (mapa.debit == null && mapa.credit == null && mapa.amount == null) w.push('No se identificó columna de monto; se usó heurística de respaldo.');
  if (!movimientos.length) w.push('No se detectaron transacciones.');
  return w;
}
function logDiagnostico(d) {
  const layout = d.columnas.filter((c) => c.role !== 'ignore').map((c) => `${c.role}→col${c.index}(${c.confidence})`).join(', ');
  console.info(
    `[Import] Encabezados: ${d.headerRows} · Layout: ${layout} · Aceptadas: ${d.parsedRows} · Ignoradas: ${d.ignoredRows}` +
    (Object.keys(d.reasons).length ? ` · Motivos: ${Object.entries(d.reasons).map(([k, v]) => `${k}×${v}`).join('; ')}` : '') +
    (d.warnings.length ? ` · ⚠ ${d.warnings.join(' ')}` : ''),
  );
}

/* ═══════════════════ API PÚBLICA (firma y salida inalteradas) ═══════════════════ */
export const manualProvider = {
  id: 'manual',
  nombre: 'Carga Manual (CSV / Excel)',
  disponible() { return true; },

  /** Procesa el texto de un CSV (columnas flexibles). */
  procesarCSV(texto) {
    return this.procesarFilas(parseCSV(texto));
  },

  /**
   * Núcleo universal: analiza la tabla → clasifica columnas por contenido →
   * detecta transacciones → parsea montos/fechas/descripciones.
   * Devuelve { movimientos, resumen } (+ `diagnostico` aditivo para logging).
   */
  procesarFilas(filas) {
    if (!filas || !filas.length) {
      return { movimientos: [], resumen: { total: 0, entradas: 0, salidas: 0, neto: 0 }, diagnostico: { headerRows: 0, columnas: [], parsedRows: 0, ignoredRows: 0, reasons: {}, warnings: ['tabla vacía'] } };
    }

    // Etapa 1–2: encabezados (1/2/fusionados) → cuerpo.
    const { nHeader, mergedHeader } = detectarEncabezados(filas);
    const cuerpo = filas.slice(nHeader);

    // Pre-filtro: quita filas vacías y de resumen ANTES de clasificar, para que
    // un TOTALES (con cargo Y abono llenos) no rompa el par débito/crédito ni
    // contamine las estadísticas por columna.
    const razones = {};
    let ignoradas = 0;
    const preIgnorar = (fila) => {
      const nv = fila.map((c) => String(c || '').trim()).filter(Boolean);
      if (!nv.length) return 'fila vacía';
      if (RESUMEN.test(nv.join(' '))) return 'fila de resumen/saldo/total/pie';
      return null;
    };
    const candidatos = [];
    for (const fila of cuerpo) { const pr = preIgnorar(fila); if (pr) { ignoradas += 1; razones[pr] = (razones[pr] || 0) + 1; } else candidatos.push(fila); }

    // Etapa 3–6: clasificar columnas + construir movimientos.
    const { roles, ancho } = clasificarColumnas(candidatos, mergedHeader);
    const mapa = mapaDeRoles(roles);
    const anio = anioDominante(candidatos, mapa.date);

    const movimientos = [];
    let idx = 0;
    for (const fila of candidatos) {
      const razon = razonNoTransaccion(fila, mapa);
      if (razon) { ignoradas += 1; razones[razon] = (razones[razon] || 0) + 1; continue; }
      const monto = montoDeFila(fila, mapa);
      if (monto === 0) { ignoradas += 1; razones['monto cero (sin importe)'] = (razones['monto cero (sin importe)'] || 0) + 1; continue; }
      movimientos.push({
        id: `mov-${idx}`,
        fecha: fechaDeFila(fila, mapa, anio),
        descripcion: descripcionDeFila(fila, mapa, ancho),
        monto,
        sospechoso: Math.abs(monto) > UMBRAL_SOSPECHOSO,
      });
      idx += 1;
    }

    const entradas = movimientos.filter((m) => m.monto > 0).reduce((s, m) => s + m.monto, 0);
    const salidas = movimientos.filter((m) => m.monto < 0).reduce((s, m) => s + Math.abs(m.monto), 0);

    // Etapa 7–8: diagnósticos + logging (no afecta la API).
    const diagnostico = {
      headerRows: nHeader,
      columnas: roles.map((r, i) => ({ index: i, etiqueta: mergedHeader[i] || '', role: r.role, confidence: Number(r.confidence.toFixed(2)) })),
      layoutConfidence: Number((roles.reduce((s, r) => s + r.confidence, 0) / Math.max(1, roles.length)).toFixed(2)),
      parsedRows: movimientos.length,
      ignoredRows: ignoradas,
      reasons: razones,
      warnings: advertencias(mapa, movimientos),
    };
    logDiagnostico(diagnostico);

    return { movimientos, resumen: { total: movimientos.length, entradas, salidas, neto: entradas - salidas }, diagnostico };
  },

  /** Lee un File (CSV o Excel) y lo procesa. */
  async procesarArchivo(file) {
    const esExcel = /\.(xlsx|xls)$/i.test(file.name) || /spreadsheet|excel/i.test(file.type || '');
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
