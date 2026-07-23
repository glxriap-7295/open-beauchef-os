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

/**
 * Proveedor de Push (Firebase Cloud Messaging) para la PWA instalada.
 * LIMITACIÓN: FCM requiere un service worker (firebase-messaging-sw.js), una
 * VAPID key y configuración del proyecto. iOS solo entrega push a PWAs añadidas
 * a la pantalla de inicio (iOS 16.4+). Aquí queda la arquitectura lista y
 * degradada con gracia: si no hay soporte/config, no rompe y usa notificaciones
 * de escritorio. La activación real se documenta en DEPLOY.md.
 */
const fcmProvider = {
  id: 'fcm',
  soportado: () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
    && !!import.meta.env.VITE_FIREBASE_VAPID_KEY,
  permiso: browserProvider.permiso,
  solicitarPermiso: browserProvider.solicitarPermiso.bind(browserProvider),
  // El envío real de push se origina en el servidor con el token del dispositivo.
  // En cliente reutilizamos la notificación local; el token se registra aparte.
  enviar: browserProvider.enviar.bind(browserProvider),
};

const PROVIDERS = { browser: browserProvider, fcm: fcmProvider };
const activo = PROVIDERS[import.meta.env.VITE_NOTIFY_PROVIDER || 'browser'] || browserProvider;

// Categorías de notificación que el usuario puede activar/desactivar.
export const CATEGORIAS_NOTIF = {
  importacion: 'Importaciones completadas',
  revision: 'La IA necesita tu confirmación',
  diagnostico: 'Nuevos insights financieros',
  anomalia: 'Anomalías financieras',
  error: 'Errores que requieren tu intervención',
  mentor: 'Mentoría',
};

// Mapea el tag de un evento a su categoría (para respetar las preferencias).
const TAG_A_CATEGORIA = {
  importacion: 'importacion', revision: 'revision', gasto: 'revision',
  diagnostico: 'diagnostico', analisis: 'diagnostico',
  finanzas: 'anomalia', recomendacion: 'diagnostico', mentor: 'mentor',
};

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
  mentorAsignado: (nombre) => ({
    titulo: 'Te asignaron un mentor 🎉',
    cuerpo: `${nombre} acompañará a tu startup. Revisa la sección Mentores.`,
    tag: 'mentor',
  }),
  anomaliaFinanciera: (detalle) => ({
    titulo: 'Anomalía financiera detectada 📊',
    cuerpo: detalle || 'Revisa tus movimientos: hay algo fuera de lo habitual.',
    tag: 'finanzas',
  }),
  importacionCompleta: (n, institucion) => ({
    titulo: 'Importación completada 📥',
    cuerpo: `Se importaron ${n} movimientos${institucion ? ` desde ${institucion}` : ''}.`,
    tag: 'importacion', ruta: '/app',
  }),
  transaccionesPorRevisar: (n) => ({
    titulo: 'Necesitamos tu ayuda 🙋',
    cuerpo: `${n} movimiento(s) no pudimos clasificar con certeza. Revísalos para que la IA aprenda.`,
    tag: 'revision', ruta: '/app',
  }),
  nuevoDiagnostico: () => ({
    titulo: 'Nuevo diagnóstico financiero 🧠',
    cuerpo: 'El Copiloto generó un análisis de tus finanzas con tus datos reales.',
    tag: 'diagnostico', ruta: '/app',
  }),
  errorProcesamiento: (detalle) => ({
    titulo: 'La importación necesita tu atención ⚠️',
    cuerpo: detalle || 'No pudimos procesar el archivo. Revisa el detalle y vuelve a intentarlo.',
    tag: 'error', ruta: '/app',
  }),
};

export const notifications = {
  soportado: () => activo.soportado(),
  permiso: () => activo.permiso(),
  solicitarPermiso: () => activo.solicitarPermiso(),
  /**
   * Envía una notificación a partir de un evento. Respeta las preferencias de
   * categoría (si se pasan) y agrega deep-link (data.ruta) a la pantalla
   * relevante. Devuelve false si la categoría está desactivada.
   * @param {object} evento  de NotificationEvents
   * @param {object} opts { categorias } mapa { categoria: boolean }
   */
  emitir(evento, { categorias } = {}) {
    const { titulo, ruta, tag, ...opts } = evento;
    const categoria = TAG_A_CATEGORIA[tag] || 'diagnostico';
    if (categorias && categorias[categoria] === false) return false;
    return activo.enviar(titulo, { ...opts, tag, data: { ruta } });
  },
};
