/**
 * ADAPTADOR DE COMPATIBILIDAD (categorizer.js).
 * ============================================================================
 * El motor real de categorización vive ahora en:
 *   · merchants.js            (base de conocimiento de comercios — solo datos)
 *   · normalizeDescription.js (normalización + clave estable de memoria)
 *   · categorize.js           (rule engine + merchant recognition + guardarraíles)
 *
 * Este archivo se mantiene SOLO para no romper a los consumidores existentes
 * (importPipeline.js, ConectarDatosModal.jsx, PreparacionContext.jsx y la suite
 * de pruebas), que esperan la firma histórica:
 *   categorizar(descripcion, monto, { mappings }) → { categoria, confianza, tipo, fuente }
 *   CATEGORIAS  (etiquetas en español para el selector de revisión)
 *   clavePorDescripcion(desc)
 *
 * A medida que M2/M3 migren la UI y el pipeline al modelo canónico en inglés,
 * este adaptador puede eliminarse. NO agregar lógica de negocio aquí.
 * ============================================================================
 */
import { categorize, legacyLabel } from './categorize.js';
import { stableKey } from './normalizeDescription.js';

/** Etiquetas legadas en español (las que muestra hoy el selector de revisión). */
export const CATEGORIAS = [
  'Ventas', 'Marketplace', 'Marketing', 'Envíos', 'Inventario', 'Remuneraciones',
  'Arriendo', 'Servicios', 'Software', 'Impuestos', 'Comisiones bancarias', 'Otros',
];

/** Clave estable de memoria (idéntica a la histórica). Re-exportada por compat. */
export const clavePorDescripcion = stableKey;

/** Traduce la `source` canónica a la histórica ('reglas' | 'memoria' | 'signo'). */
function fuenteLegada(source) {
  if (source === 'memory') return 'memoria';
  if (source === 'merchant' || source === 'rules') return 'reglas';
  return 'signo';
}

/**
 * API histórica: delega en el motor nuevo y traduce la salida al formato legado.
 * @returns {{ categoria, confianza, tipo, fuente }}
 */
export function categorizar(descripcion, monto, { mappings = {} } = {}) {
  const r = categorize(descripcion, monto, { memory: mappings });
  return {
    categoria: legacyLabel(r.categoryId),
    confianza: r.confidence,
    tipo: Number(monto) >= 0 ? 'ingreso' : 'egreso',
    fuente: fuenteLegada(r.source),
  };
}
