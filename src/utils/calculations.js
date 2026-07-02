/**
 * Cálculos financieros del frontend. Funciones puras y testeables.
 * Todos los montos en CLP.
 */
import { PALOMA_MESES, SALDO_INICIAL } from '../data/palomaData.js';

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
