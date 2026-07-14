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
   * Abre el widget oficial con el widget_token del Link Intent. Resuelve con el
   * objeto Link Intent (que trae el exchange_token) al conectar con éxito.
   */
  async abrirWidget(widgetToken) {
    const Fintoc = await cargarWidget();
    return new Promise((resolve, reject) => {
      try {
        const widget = Fintoc.create({
          publicKey: PUBLIC_KEY,
          widgetToken,
          onSuccess: (linkIntent) => resolve(linkIntent),
          onExit: () => reject(new Error('Cerraste el widget de Fintoc.')),
        });
        widget.open();
      } catch (e) {
        reject(e);
      }
    });
  },

  /**
   * Flujo de producción completo (secret key NUNCA en el front):
   *  1) backend crea Link Intent -> widget_token
   *  2) widget oficial -> exchange_token
   *  3) backend intercambia exchange_token -> link_token
   *  4) cuentas + movimientos (primera sync: 90 días; luego solo nuevos)
   */
  async conectarYSincronizar({ holderType = 'business' } = {}) {
    if (!this.disponible()) throw new Error(this.motivoNoDisponible());
    const base = LINK_ENDPOINT.replace(/\/$/, '');

    // 1) Link Intent -> widget_token
    const liRes = await fetch(`${base}/link-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holderType }),
    });
    const liData = await liRes.json().catch(() => ({}));
    if (!liRes.ok || !liData.widget_token) {
      throw new Error(liData.error || 'No se pudo iniciar la conexión con Fintoc.');
    }
    console.info('[OB-diag Fintoc] 1/5 widget_token recibido:', Boolean(liData.widget_token));

    // 2) Widget -> exchange_token
    const linkIntent = await this.abrirWidget(liData.widget_token);
    console.info('[OB-diag Fintoc] 2/5 widget creado y conexión exitosa (onSuccess)');
    const exchangeToken = linkIntent?.exchangeToken || linkIntent?.exchange_token;
    if (!exchangeToken) throw new Error('Fintoc no devolvió un exchange_token.');
    console.info('[OB-diag Fintoc] 3/5 exchange_token recibido:', Boolean(exchangeToken));

    // 3) Exchange -> link_token
    const exRes = await fetch(`${base}/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exchange_token: exchangeToken }),
    });
    const exData = await exRes.json().catch(() => ({}));
    if (!exRes.ok || !exData.link_token) {
      throw new Error(exData.error || 'No se pudo completar la conexión con Fintoc.');
    }
    const linkToken = exData.link_token;

    const accRes = await fetch(`${base}/accounts?link_token=${encodeURIComponent(linkToken)}`);
    if (!accRes.ok) {
      const t = await accRes.json().catch(() => ({}));
      throw new Error(t.error || 'No se pudieron importar las cuentas.');
    }
    const { accounts = [] } = await accRes.json();
    console.info('[OB-diag Fintoc] 4/5 cuentas encontradas:', accounts.length);

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
    console.info('[OB-diag Fintoc] 5/5 movimientos importados:', movimientos.length);

    const banco = accounts[0]?.institution?.name || accounts[0]?.holder_name || 'Tu banco';
    return { banco, cuentas: accounts, movimientos, ultimaSync, linkToken };
  },
};
