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
// Por defecto usa las funciones serverless incluidas en /api/fintoc.
const LINK_ENDPOINT = import.meta.env.VITE_FINTOC_LINK_ENDPOINT || '/api/fintoc';
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
          holderType: 'business',
          product: 'movements',
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

  /**
   * Flujo completo real: abre el widget oficial, obtiene el link_token, y a
   * través del backend serverless (secret key nunca en el front) importa
   * cuentas + movimientos. Primera sync: últimos 90 días. Siguientes: solo
   * nuevos desde la última sincronización (guardada por link).
   */
  async conectarYSincronizar() {
    if (!this.disponible()) throw new Error(this.motivoNoDisponible());
    const link = await this.conectar({});
    const linkToken = link?.id || link?.link_token || link;
    if (!linkToken) throw new Error('Fintoc no devolvió un link válido.');

    const base = LINK_ENDPOINT.replace(/\/$/, '');
    const accRes = await fetch(`${base}/accounts?link_token=${encodeURIComponent(linkToken)}`);
    if (!accRes.ok) {
      const t = await accRes.json().catch(() => ({}));
      throw new Error(t.error || 'No se pudieron importar las cuentas.');
    }
    const { accounts = [] } = await accRes.json();

    // Sincronización incremental: recupera la última fecha guardada por link.
    const syncKey = `ob_fintoc_sync_${linkToken}`;
    let ultimaGuardada = null;
    try { ultimaGuardada = JSON.parse(localStorage.getItem(syncKey) || 'null'); } catch { /* noop */ }
    const since = ultimaGuardada?.lastSync || null; // null => backend usa 90 días

    const movimientos = [];
    for (const acc of accounts) {
      const q = new URLSearchParams({ link_token: linkToken, account_id: acc.id });
      if (since) q.set('since', since);
      const mvRes = await fetch(`${base}/movements?${q.toString()}`);
      if (!mvRes.ok) continue;
      const { movimientos: ms = [] } = await mvRes.json();
      for (const m of ms) {
        movimientos.push({
          fecha: (m.transaction_date || m.post_date || '').slice(0, 10),
          monto: Number(m.amount) || 0,
          descripcion: m.description || m.reference || 'Movimiento',
        });
      }
    }

    const ultimaSync = new Date().toISOString();
    try { localStorage.setItem(syncKey, JSON.stringify({ lastSync: ultimaSync.slice(0, 10), linkToken })); } catch { /* noop */ }

    const banco = accounts[0]?.institution?.name || accounts[0]?.holder_name || 'Tu banco';
    return { banco, cuentas: accounts, movimientos, ultimaSync, linkToken };
  },
};
