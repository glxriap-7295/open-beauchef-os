/**
 * Cálculos financieros del frontend. Funciones puras y testeables.
 * Todos los montos en CLP.
 */
import { PALOMA_MESES, SALDO_INICIAL } from '../data/palomaData.js';
import { tratamiento, categoryIdDeTransaccion } from '../services/finance/accountingMap.js';

/**
 * ROAS = ventas atribuibles / inversión en marketing.
 * Misma lógica que la planilla del Copiloto Financiero (no se inventan fórmulas).
 * Devuelve null si no hay inversión (indefinido).
 */
export function roas({ ventas, inversion }) {
  const rev = Number(ventas) || 0;
  const spend = Math.abs(Number(inversion) || 0);
  if (spend === 0) return { ventas: rev, inversion: 0, roas: null, definido: false };
  return { ventas: rev, inversion: spend, roas: Math.round((rev / spend) * 100) / 100, definido: true };
}

/** Deriva las métricas de un mes a partir de su desglose. */
export function derivarMes(m) {
  const ingresos = m.ventas;
  const cogs = m.cogsProd + m.cogsEnvio + m.cogsTrans;
  const gastosOperacionales = m.empleados + m.herramientas + m.otros;
  const gastosTotales = cogs + gastosOperacionales;
  const ebitda = ingresos - gastosTotales;
  const margen = ingresos > 0 ? (ebitda / ingresos) * 100 : 0;
  return {
    key: m.key,
    nombre: m.nombre,
    corto: m.corto,
    ingresos,
    cogs,
    cogsProd: m.cogsProd,
    cogsEnvio: m.cogsEnvio,
    cogsTrans: m.cogsTrans,
    gastosOperacionales,
    empleados: m.empleados,
    herramientas: m.herramientas,
    otros: m.otros,
    gastosTotales,
    ebitda,
    margen,
  };
}

/** Lista de todos los meses ya derivados. */
export function getMesesDerivados(meses = PALOMA_MESES) {
  return meses.map(derivarMes);
}

const NOMBRE_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const CORTO_MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * Convierte transacciones reales (fecha, monto, descripción) en la misma
 * estructura de "meses derivados" que consumen el Dashboard, Estado de
 * Resultado y Flujo de Caja. Los gastos van a "otros" (categoría genérica),
 * ya que un movimiento bancario crudo no trae desglose de COGS.
 */
/** Convierte una fecha (ISO o DD/MM/YYYY, etc.) a "YYYY-MM" para agrupar. */
function anioMes(valor) {
  const s = String(valor || '').trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})/);            // YYYY-MM-...
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/); // DD/MM/YYYY (Chile)
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${String(m[2]).padStart(2, '0')}`; }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return null;
}

export function transaccionesAMeses(transacciones = []) {
  const porMes = new Map();
  const nuevoMes = (key, m, mesIdx) => ({
    key, nombre: `${NOMBRE_MES[mesIdx]} ${m[1]}`, corto: CORTO_MES[mesIdx],
    ingresos: 0, cogsProd: 0, cogsEnvio: 0, cogsTrans: 0, empleados: 0, herramientas: 0, otros: 0,
  });
  for (const t of transacciones) {
    const key = anioMes(t.fecha);
    if (!key) continue;
    const m = key.match(/^(\d{4})-(\d{2})/);
    const mesIdx = Number(m[2]) - 1;
    if (!porMes.has(key)) porMes.set(key, nuevoMes(key, m, mesIdx));
    const acc = porMes.get(key);
    const monto = Number(t.monto ?? t.amount) || 0;
    // ── Todo el ruteo contable se decide por categoryId vía ACCOUNTING_MAP ──
    const tr = tratamiento(categoryIdDeTransaccion(t));
    if (!tr.includeInPL) continue;                 // transfers/loans/owner: fuera del P&L
    if (tr.bucket === 'ingresos') acc.ingresos += monto;          // con signo (reembolsos restan)
    else if (tr.bucket) acc[tr.bucket] += Math.abs(monto);        // gastos como magnitud positiva
  }

  return [...porMes.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((mm) => {
      const cogs = mm.cogsProd + mm.cogsEnvio + mm.cogsTrans;
      const gastosOperacionales = mm.empleados + mm.herramientas + mm.otros;
      const gastosTotales = cogs + gastosOperacionales;
      const ebitda = mm.ingresos - gastosTotales;
      return {
        key: mm.key,
        nombre: mm.nombre,
        corto: mm.corto,
        ingresos: mm.ingresos,
        cogs, cogsProd: mm.cogsProd, cogsEnvio: mm.cogsEnvio, cogsTrans: mm.cogsTrans,
        gastosOperacionales, empleados: mm.empleados, herramientas: mm.herramientas, otros: mm.otros,
        gastosTotales,
        ebitda,
        margen: mm.ingresos > 0 ? (ebitda / mm.ingresos) * 100 : 0,
      };
    });
}

/** Suma consolidada de un conjunto de meses derivados. */
export function consolidar(mesesDerivados) {
  const acc = {
    ingresos: 0, cogs: 0, cogsProd: 0, cogsEnvio: 0, cogsTrans: 0,
    gastosOperacionales: 0, empleados: 0, herramientas: 0, otros: 0,
    gastosTotales: 0, ebitda: 0,
  };
  for (const m of mesesDerivados) {
    acc.ingresos += m.ingresos;
    acc.cogs += m.cogs;
    acc.cogsProd += m.cogsProd;
    acc.cogsEnvio += m.cogsEnvio;
    acc.cogsTrans += m.cogsTrans;
    acc.gastosOperacionales += m.gastosOperacionales;
    acc.empleados += m.empleados;
    acc.herramientas += m.herramientas;
    acc.otros += m.otros;
    acc.gastosTotales += m.gastosTotales;
    acc.ebitda += m.ebitda;
  }
  acc.margen = acc.ingresos > 0 ? (acc.ebitda / acc.ingresos) * 100 : 0;
  acc.nombre = 'Consolidado 6 meses';
  return acc;
}

/** Promedios mensuales sobre los meses derivados. */
export function promedios(mesesDerivados) {
  const n = mesesDerivados.length || 1;
  const con = consolidar(mesesDerivados);
  return {
    ingresos: con.ingresos / n,
    gastosTotales: con.gastosTotales / n,
    ebitda: con.ebitda / n,
    margen: con.margen,
  };
}

/**
 * Construye el histórico de flujo de caja mes a mes a partir del saldo inicial
 * y el flujo neto (EBITDA) de cada mes.
 */
export function flujoCajaHistorico(mesesDerivados, saldoInicial = SALDO_INICIAL) {
  let saldo = saldoInicial;
  return mesesDerivados.map((m) => {
    const saldoIni = saldo;
    const entra = m.ingresos;
    const sale = m.gastosTotales;
    const flujoNeto = entra - sale;
    saldo = saldoIni + flujoNeto;
    return {
      key: m.key,
      nombre: m.nombre,
      saldoInicial: saldoIni,
      entra,
      sale,
      flujoNeto,
      saldoFinal: saldo,
    };
  });
}

/** Saldo de caja actual = saldo inicial + suma de flujos netos. */
export function saldoActual(mesesDerivados, saldoInicial = SALDO_INICIAL) {
  const hist = flujoCajaHistorico(mesesDerivados, saldoInicial);
  return hist.length ? hist[hist.length - 1].saldoFinal : saldoInicial;
}

/**
 * Runway en meses = saldo actual / gasto mensual promedio (burn).
 * Si no hay gasto, runway es infinito.
 */
export function runwayMeses(saldo, gastoMensualPromedio) {
  if (!gastoMensualPromedio || gastoMensualPromedio <= 0) return Infinity;
  return saldo / gastoMensualPromedio;
}

/** Tendencia (% de cambio) del último mes respecto al anterior, sobre un campo. */
export function tendencia(mesesDerivados, campo = 'ingresos') {
  if (mesesDerivados.length < 2) return 0;
  const ult = mesesDerivados[mesesDerivados.length - 1][campo];
  const prev = mesesDerivados[mesesDerivados.length - 2][campo];
  if (!prev) return 0;
  return ((ult - prev) / Math.abs(prev)) * 100;
}

/**
 * Proyección de caja a N meses bajo un escenario.
 * @param {number} saldoActualValor  saldo de caja inicial de la proyección
 * @param {number} ingresoMensual    ingreso mensual base (promedio histórico)
 * @param {number} gastoMensual      gasto mensual base (promedio histórico)
 * @param {number} crecimientoPct    % de aumento de ingresos aplicado (slider)
 * @param {number} offsetPct         ajuste del escenario (+optimista / -pesimista)
 * @param {number} meses             horizonte (default 6)
 */
export function proyectarEscenario(saldoActualValor, ingresoMensual, gastoMensual, crecimientoPct, offsetPct = 0, meses = 6) {
  const factor = 1 + (crecimientoPct + offsetPct) / 100;
  const ingresoProyectado = Math.max(0, ingresoMensual * factor);
  const flujoMensual = ingresoProyectado - gastoMensual;

  const serie = [];
  let saldo = saldoActualValor;
  for (let i = 1; i <= meses; i += 1) {
    saldo += flujoMensual;
    serie.push({ mes: i, saldo });
  }

  const saldoFinal = saldoActualValor + flujoMensual * meses;
  const runway = flujoMensual >= 0 ? Infinity : saldoActualValor / Math.abs(flujoMensual);

  return {
    factor,
    ingresoProyectado,
    flujoMensual,
    saldoFinal,
    runwayMeses: runway,
    serie,
  };
}
