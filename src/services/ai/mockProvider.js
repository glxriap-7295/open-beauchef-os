import { PROFILE_FIELDS, camposFaltantes } from '../../data/profileSchema.js';

/**
 * Proveedor de IA simulado (heurístico). Funciona 100% offline y sirve de
 * fallback cuando Ollama u otro proveedor no está disponible. Implementa la
 * misma interfaz que cualquier AIProvider real.
 */

// Qué campos "cubre" cada tipo de evidencia. El asistente local no lee el
// contenido real del archivo, así que marca el campo como detectado con un
// placeholder editable (genérico, sin inventar datos de negocio específicos).
// El proveedor real (Ollama) sí extrae el contenido.
const P = (doc) => `Detectado desde tu ${doc}. Edítalo en tu Startup Card cuando quieras.`;
const EXTRACCION = {
  'Pitch Deck': {
    problema: P('Pitch Deck'),
    solucion: P('Pitch Deck'),
    clienteObjetivo: P('Pitch Deck'),
    competidores: P('Pitch Deck'),
    equipo: P('Pitch Deck'),
  },
  'Modelo Financiero': {
    infoFinanciera: P('Modelo Financiero'),
    revenueModel: P('Modelo Financiero'),
    pricing: P('Modelo Financiero'),
  },
  'Modelo de Negocio': {
    modeloNegocio: P('Modelo de Negocio'),
  },
  'Sitio Web': { sitioWeb: P('Sitio Web') },
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
