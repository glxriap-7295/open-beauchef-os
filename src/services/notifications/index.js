/**
 * Capa de notificaciones. Hoy soporta notificaciones de escritorio del
 * navegador. La arquitectura permite agregar proveedores futuros (WhatsApp,
 * email, push) implementando la misma interfaz `enviar(titulo, opciones)`.
 *
 * No incluye WhatsApp todavía (iteración futura).
 */

const browserProvider = {
  id: 'browser',
  soportado: () => typeof window !== 'undefined' && 'Notification' in window,
  permiso: () => (typeof Notification !== 'undefined' ? Notification.permission : 'denied'),

  async solicitarPermiso() {
    if (!this.soportado()) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    try {
      return await Notification.requestPermission();
    } catch {
      return 'denied';
    }
  },

  enviar(titulo, { cuerpo, icon, tag } = {}) {
    if (!this.soportado() || Notification.permission !== 'granted') return false;
    try {
      // eslint-disable-next-line no-new
      new Notification(titulo, { body: cuerpo, icon: icon || '/favicon.svg', tag });
      return true;
    } catch {
      return false;
    }
  },
};

const PROVIDERS = { browser: browserProvider };
const activo = PROVIDERS[import.meta.env.VITE_NOTIFY_PROVIDER || 'browser'] || browserProvider;

/** Eventos tipados del OS -> notificación. */
export const NotificationEvents = {
  analisisCompleto: (nombre) => ({
    titulo: 'Análisis completado ✅',
    cuerpo: `${nombre} ya fue analizado por la IA.`,
    tag: 'analisis',
  }),
  nuevaRecomendacion: (texto) => ({
    titulo: 'Nueva recomendación 💡',
    cuerpo: texto,
    tag: 'recomendacion',
  }),
  gastoPorCategorizar: (monto) => ({
    titulo: 'Un gasto necesita tu categoría 🧾',
    cuerpo: `Detectamos un movimiento por ${monto} que requiere clasificación.`,
    tag: 'gasto',
  }),
};

export const notifications = {
  soportado: () => activo.soportado(),
  permiso: () => activo.permiso(),
  solicitarPermiso: () => activo.solicitarPermiso(),
  /** Envía una notificación a partir de un evento de NotificationEvents. */
  emitir(evento) {
    const { titulo, ...opts } = evento;
    return activo.enviar(titulo, opts);
  },
};
