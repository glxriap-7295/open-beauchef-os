/**
 * Motor de cobertura/confianza de datos (Parte 3).
 * Los insights financieros deben reflejar cuán completa es la información
 * disponible. No bloquea nada: reduce la confianza y explica la incertidumbre,
 * y la confianza sube automáticamente a medida que se sube más historial.
 *
 * Puro y testeable: recibe transacciones ({ fecha|date, monto|amount }) y
 * devuelve métricas + un mensaje accionable.
 */

export const MESES_RECOMENDADOS = 6;

function claveMes(t) {
  const v = String(t.fecha || t.date || '');
  const m = v.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

/** Suma 1 mes a "YYYY-MM". */
function siguienteMes(ym) {
  let [y, m] = ym.split('-').map(Number);
  m += 1; if (m > 12) { m = 1; y += 1; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

/** Distancia en meses entre dos claves "YYYY-MM" (a <= b). */
function mesesEntre(a, b) {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

/**
 * Analiza la cobertura del historial financiero.
 * @param {Array} transacciones
 * @returns {{
 *   meses, consecutivos, faltantes, densidad, cuentas,
 *   cobertura, suficiente, nivelConfianza, mensaje
 * }}
 */
export function analizarCobertura(transacciones = []) {
  const claves = [...new Set(transacciones.map(claveMes).filter(Boolean))].sort();
  const meses = claves.length;

  if (!meses) {
    return {
      meses: 0, consecutivos: 0, faltantes: [], densidad: 0, cuentas: 0,
      cobertura: 0, suficiente: false, nivelConfianza: 'sin-datos',
      mensaje: 'Aún no hay historial financiero. Sube tus cartolas para comenzar a generar insights.',
    };
  }

  // Racha consecutiva más larga + meses faltantes dentro del rango cubierto.
  let mejorRacha = 1, racha = 1;
  const faltantes = [];
  for (let i = 1; i < claves.length; i += 1) {
    const salto = mesesEntre(claves[i - 1], claves[i]);
    if (salto === 1) { racha += 1; mejorRacha = Math.max(mejorRacha, racha); }
    else {
      racha = 1;
      let cursor = siguienteMes(claves[i - 1]);
      while (cursor !== claves[i]) { faltantes.push(cursor); cursor = siguienteMes(cursor); }
    }
  }

  const cuentas = new Set(transacciones.map((t) => t.account ?? t.cuenta).filter(Boolean)).size;
  const densidad = Math.round((transacciones.length / meses) * 10) / 10; // tx por mes

  // Cobertura 0..100: dominada por meses consecutivos, con aporte de densidad.
  const factorMeses = Math.min(1, mejorRacha / MESES_RECOMENDADOS);
  const factorDensidad = Math.min(1, densidad / 10);
  const cobertura = Math.round((factorMeses * 0.8 + factorDensidad * 0.2) * 100);
  const suficiente = mejorRacha >= MESES_RECOMENDADOS;

  const nivelConfianza = suficiente ? 'alta' : mejorRacha >= 3 ? 'media' : 'baja';

  const mensaje = suficiente
    ? `Historial sólido: ${mejorRacha} meses consecutivos. Los insights usan datos completos.`
    : `Tu historial financiero está incompleto (${mejorRacha} mes(es) consecutivo(s)). ` +
      `Los insights actuales se basan en datos limitados y pueden ser menos precisos. ` +
      `Sube al menos ${MESES_RECOMENDADOS} meses consecutivos para tendencias y recomendaciones más confiables.` +
      (faltantes.length ? ` Faltan estos meses: ${faltantes.join(', ')}.` : '');

  return { meses, consecutivos: mejorRacha, faltantes, densidad, cuentas, cobertura, suficiente, nivelConfianza, mensaje };
}
