import { fintocProvider } from './fintocProvider.js';
import { manualProvider } from './manualProvider.js';

/**
 * Entradas de datos financieros. El emprendedor elige una:
 *  - Open Banking (Fintoc): automático, si está configurado.
 *  - Carga Manual (CSV): siempre disponible como alternativa.
 */
export const banking = {
  fintoc: fintocProvider,
  manual: manualProvider,
  /** ¿Está Open Banking configurado en este entorno? */
  openBankingDisponible: () => fintocProvider.disponible(),
};

export { fintocProvider, manualProvider };
