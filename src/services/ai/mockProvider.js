import { PROFILE_FIELDS, camposFaltantes } from '../../data/profileSchema.js';

/**
 * Proveedor de IA simulado (heurístico). Funciona 100% offline y sirve de
 * fallback cuando Ollama u otro proveedor no está disponible. Implementa la
 * misma interfaz que cualquier AIProvider real.
 */

// Qué campos "extrae" cada tipo de evidencia (para no preguntar lo que ya
// está en los documentos). Valores plausibles para Decantopia.
const EXTRACCION = {
  'Pitch Deck': {
    problema: 'Comprar buen vino y destilados es confuso: mucha oferta, poca guía y precios opacos.',
    solucion: 'Curamos y vendemos vinos y destilados online con recomendaciones personalizadas y despacho rápido.',
    clienteObjetivo: 'Profesionales 28-45 en Chile que disfrutan el buen beber y compran online.',
    competidores: 'Tiendas tradicionales, La Vinoteca y marketplaces generalistas; nos diferenciamos por curaduría e IA.',
    equipo: 'Paloma (CEO) y equipo de operaciones y growth.',
  },
  'Modelo Financiero': {
    infoFinanciera: 'Ventas ~CLP 9,5M/mes, margen EBITDA ~31%, caja saludable con flujo positivo.',
    revenueModel: 'Venta directa (DTC) por transacción, con foco en recompra y ticket promedio.',
    pricing: 'Precio por producto con packs y suscripción de degustación mensual.',
  },
  'Modelo de Negocio': {
    modeloNegocio: 'E-commerce DTC de vinos y destilados curados, con logística propia de última milla.',
  },
  'Sitio Web': { sitioWeb: 'https://decantopia.cl' },
  Legal: { iprl: '4' },
};

function pausa(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export const mockProvider = {
  id: 'mock',
  nombre: 'Asistente Open Beauchef',
  disponible: async () => true,

  /** Analiza la evidencia y devuelve campos detectados + resumen. */
  async analyzeEvidence(documentos = [], perfil = {}) {
    await pausa(600);
    const detectados = {};
    for (const doc of documentos) {
      const mapa = EXTRACCION[doc.tipo];
      if (!mapa) continue;
      for (const [k, v] of Object.entries(mapa)) {
        if (!String(perfil[k] || '').trim() && !detectados[k]) detectados[k] = v;
      }
    }
    const nDet = Object.keys(detectados).length;
    const resumen = documentos.length
      ? `Analicé ${documentos.length} documento(s) y extraje ${nDet} dato(s) clave de tu startup. Con eso evito preguntarte lo que ya está en tu evidencia.`
      : 'Aún no subiste evidencia. Puedo guiarte igual con algunas preguntas para construir tu perfil.';
    return { detectados, resumen };
  },

  /** Devuelve la próxima pregunta inteligente sobre información faltante. */
  async nextQuestion(perfil = {}, historia = []) {
    await pausa(400);
    const faltantes = camposFaltantes(perfil);
    if (!faltantes.length) return null;
    const campo = faltantes[0];
    const yaPreguntado = historia.filter((h) => h.rol === 'assistant').length;
    const conectores = ['', 'Perfecto. ', 'Genial, gracias. ', 'Anotado. ', 'Súper. '];
    const prefijo = conectores[Math.min(yaPreguntado, conectores.length - 1)];
    return { campo: campo.key, pregunta: `${prefijo}${campo.pregunta}` };
  },

  /** Respuesta conversacional breve para acompañar el flujo. */
  async chat(mensajes = []) {
    await pausa(300);
    const ultimo = mensajes[mensajes.length - 1]?.contenido || '';
    if (!ultimo) return 'Cuéntame más sobre tu startup y voy armando tu perfil.';
    return 'Gracias, lo incorporé a tu Startup Profile. Sigamos.';
  },
};
