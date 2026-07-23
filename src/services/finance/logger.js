/**
 * Logger estructurado para el pipeline de importación y otros servicios.
 * Reemplaza los `catch(() => {})` silenciosos: cada evento queda registrado con
 * ámbito, nivel y campos, y puede recuperarse para diagnósticos accionables.
 *
 * No depende del entorno: en el navegador imprime en consola de forma legible;
 * el arreglo `entries` permite adjuntar el log a un resultado o a Firestore.
 */

export const NIVEL = { debug: 10, info: 20, warn: 30, error: 40 };

const ICONO = { debug: '·', info: 'ℹ', warn: '⚠', error: '✖' };

/**
 * Crea un logger con ámbito (p.ej. "Import", "AI", "Validation").
 * @param {string} scope
 * @param {object} opts { nivelMinimo, onEntry }
 */
export function createLogger(scope = 'App', { nivelMinimo = NIVEL.debug, onEntry } = {}) {
  const entries = [];

  const registrar = (nivel, stage, fields = {}) => {
    const entry = { ts: Date.now(), scope, nivel, stage, ...fields };
    entries.push(entry);
    if (NIVEL[nivel] >= nivelMinimo && typeof console !== 'undefined') {
      const linea = `[${scope}] ${ICONO[nivel] || ''} ${stage}`;
      const salida = console[nivel === 'debug' ? 'log' : nivel] || console.log;
      // Un solo objeto por entrada: fácil de leer y de filtrar en la consola.
      salida.call(console, linea, fields);
    }
    try { onEntry?.(entry); } catch { /* el logger nunca debe romper al llamador */ }
    return entry;
  };

  return {
    scope,
    entries,
    debug: (stage, fields) => registrar('debug', stage, fields),
    info: (stage, fields) => registrar('info', stage, fields),
    warn: (stage, fields) => registrar('warn', stage, fields),
    error: (stage, fields) => registrar('error', stage, fields),
    /** Resumen compacto (para adjuntar a resultados o telemetría). */
    resumen() {
      return {
        scope,
        total: entries.length,
        warnings: entries.filter((e) => e.nivel === 'warn').length,
        errors: entries.filter((e) => e.nivel === 'error').length,
        stages: entries.map((e) => e.stage),
      };
    },
  };
}
