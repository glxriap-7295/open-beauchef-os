/**
 * Proveedor Open Banking vía Fintoc.
 *
 * Producción-ready pero con degradación elegante:
 *  - Las credenciales NUNCA se hardcodean. Se leen de variables de entorno:
 *      VITE_FINTOC_PUBLIC_KEY   (public key del widget)
 *      VITE_FINTOC_ENABLED      ('true' para habilitar)
 *  - El intercambio del token de conexión por movimientos requiere un backend
 *    seguro (secret key). Ese endpoint se configura con:
 *      VITE_FINTOC_LINK_ENDPOINT  (ej. /api/fintoc/link)
 *  - Si falta cualquier credencial o el widget/endpoint no está disponible,
 *    `disponible()` devuelve false y la app usa Carga Manual sin romperse.
 *
 * El widget de Fintoc se carga on-demand desde su CDN (sin dependencia npm).
 */
const PUBLIC_KEY = import.meta.env.VITE_FINTOC_PUBLIC_KEY || '';
const ENABLED = String(import.meta.env.VITE_FINTOC_ENABLED || '') === 'true';
const LINK_ENDPOINT = import.meta.env.VITE_FINTOC_LINK_ENDPOINT || '';
const WIDGET_SRC = 'https://js.fintoc.com/v1/';

let widgetPromise = null;
function cargarWidget() {
  if (window.Fintoc) return Promise.resolve(window.Fintoc);
  if (widgetPromise) return widgetPromise;
  widgetPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = WIDGET_SRC;
    s.async = true;
    s.onload = () => resolve(window.Fintoc);
    s.onerror = () => reject(new Error('No se pudo cargar el widget de Fintoc'));
    document.head.appendChild(s);
  });
  return widgetPromise;
}

export const fintocProvider = {
  id: 'fintoc',
  nombre: 'Open Banking (Fintoc)',

  /** ¿Está configurado y utilizable? */
  disponible() {
    return ENABLED && Boolean(PUBLIC_KEY) && Boolean(LINK_ENDPOINT);
  },

  motivoNoDisponible() {
    if (!ENABLED) return 'Fintoc está deshabilitado (define VITE_FINTOC_ENABLED=true).';
    if (!PUBLIC_KEY) return 'Falta VITE_FINTOC_PUBLIC_KEY.';
    if (!LINK_ENDPOINT) return 'Falta VITE_FINTOC_LINK_ENDPOINT (backend de intercambio).';
    return '';
  },

  /**
   * Inicia el flujo de conexión. Requiere un widgetToken emitido por tu backend
   * (con la secret key de Fintoc). Devuelve una promesa que resuelve al conectar.
   * En este entorno de demo, si no hay backend, `disponible()` ya es false.
   */
  async conectar({ widgetToken, onSuccess, onExit } = {}) {
    if (!this.disponible()) throw new Error(this.motivoNoDisponible());
    const Fintoc = await cargarWidget();
    return new Promise((resolve, reject) => {
      try {
        const widget = Fintoc.create({
          publicKey: PUBLIC_KEY,
          widgetToken,
          onSuccess: (link) => { onSuccess?.(link); resolve(link); },
          onExit: () => { onExit?.(); reject(new Error('El usuario cerró el widget.')); },
        });
        widget.open();
      } catch (e) {
        reject(e);
      }
    });
  },
};
