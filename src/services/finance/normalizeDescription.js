/**
 * Normalización de descripciones bancarias.
 * ============================================================================
 * Responsabilidad ÚNICA: convertir una glosa cruda y ruidosa en formas
 * estables para (a) reconocer comercios/reglas y (b) memorizar correcciones.
 *
 * Nunca clasificamos directo desde la glosa cruda: primero la normalizamos.
 * Dos salidas, con propósitos distintos:
 *   · normalizeDescription(): mantiene las PALABRAS (quita números/símbolos/
 *     acentos) para que el reconocimiento de comercio y reglas sea estable.
 *   · stableKey(): clave agresivamente reducida (sin números ni palabras cortas
 *     variables) para MEMORIZAR la corrección de un usuario. Es idéntica a la
 *     antigua `clavePorDescripcion` para NO invalidar la memoria ya guardada.
 * ============================================================================
 */

/** Quita acentos/diacríticos manteniendo la letra base. */
function stripAccents(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Descripción normalizada para MATCH de comercios y reglas.
 * Conserva las palabras (incluidas señales como "traspaso", "aporte", "arriendo")
 * porque son justamente las que permiten clasificar; solo elimina ruido.
 * @returns {string} en minúsculas, sin números ni símbolos, espacios colapsados.
 */
export function normalizeDescription(raw) {
  return stripAccents(String(raw || '').toLowerCase())
    .replace(/[0-9]+/g, ' ')        // referencias, folios, montos embebidos
    .replace(/[^a-z\s]/g, ' ')      // símbolos, puntuación
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clave ESTABLE para memorizar una corrección por descripción. Ignora números,
 * fechas y montos variables para que "Transferencia Juan Perez 123" y
 * "Transferencia Juan Perez 987" compartan memoria. Idéntica a la histórica
 * `clavePorDescripcion` (compatibilidad de la memoria ya persistida).
 */
export function stableKey(desc) {
  return stripAccents(String(desc || '').toLowerCase())
    .replace(/\d+[\d.,/-]*/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48);
}
