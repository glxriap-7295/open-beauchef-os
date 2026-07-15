import { PROFILE_FIELDS, camposFaltantes } from '../../data/profileSchema.js';

/**
 * Proveedor de IA simulado (heurístico) con tono de asesor Open Beauchef.
 * Funciona 100% offline y es el fallback cuando Ollama no está disponible.
 * Misma interfaz que cualquier AIProvider real.
 */

const label = (key) => PROFILE_FIELDS.find((f) => f.key === key)?.label || key;

// Qué campos "cubre" cada tipo de evidencia (para no preguntar lo que ya está
// en los documentos). El asistente local no lee el binario, así que deja un
// placeholder editable; el proveedor real (Ollama) sí extrae el contenido.
const P = (doc) => `Detectado desde tu ${doc}. Edítalo en tu Startup Card cuando quieras.`;
const EXTRACCION = {
  'Pitch Deck': { problema: P('Pitch Deck'), solucion: P('Pitch Deck'), clienteObjetivo: P('Pitch Deck'), competidores: P('Pitch Deck'), equipo: P('Pitch Deck') },
  'Modelo Financiero': { infoFinanciera: P('Modelo Financiero'), revenueModel: P('Modelo Financiero'), pricing: P('Modelo Financiero') },
  'Modelo de Negocio': { modeloNegocio: P('Modelo de Negocio') },
  'Sitio Web': { sitioWeb: P('Sitio Web') },
};

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// Bridges conversacionales que conectan la próxima pregunta con lo anterior.
function puente(ultimoCampo, i) {
  if (ultimoCampo) {
    const l = label(ultimoCampo).toLowerCase();
    const conectores = [
      `Gracias, me quedó claro lo de ${l}. `,
      `Perfecto, anoté lo de ${l}. `,
      `Buenísimo. Ya que me contaste sobre ${l}, `,
      `Excelente. Con eso de ${l} más claro, `,
    ];
    return conectores[i % conectores.length];
  }
  return ['', 'Perfecto. ', 'Genial. ', 'Súper. '][Math.min(i, 3)];
}

export const mockProvider = {
  id: 'mock',
  nombre: 'Asesor Open Beauchef',
  disponible: async () => true,

  /** Analiza la evidencia y devuelve campos detectados + un resumen cálido. */
  async analyzeEvidence(documentos = [], perfil = {}) {
    await pausa(700);
    const detectados = {};
    for (const doc of documentos) {
      const mapa = EXTRACCION[doc.tipo];
      if (!mapa) continue;
      for (const [k, v] of Object.entries(mapa)) {
        if (!String(perfil[k] || '').trim() && !detectados[k]) detectados[k] = v;
      }
    }
    const areas = Object.keys(detectados).map(label);
    let resumen;
    if (documentos.length && areas.length) {
      const lista = areas.slice(0, 4).join(', ');
      resumen = `Perfecto. Revisé la información que compartiste y ya tengo una primera imagen de tu startup: ` +
        `identifiqué elementos como ${lista}. Con eso evito preguntarte lo que ya está en tus documentos. ` +
        `Ahora afinemos juntos lo que falta 👇`;
    } else if (documentos.length) {
      resumen = 'Gracias, revisé tus documentos. Construyamos el resto de tu perfil con un par de preguntas 👇';
    } else {
      resumen = 'Sin problema si aún no tienes documentos. Te haré algunas preguntas y armamos tu perfil juntos 👇';
    }
    return { detectados, resumen };
  },

  /** Próxima pregunta inteligente sobre información faltante, con tono cercano. */
  async nextQuestion(perfil = {}, historia = [], ultimoCampo = null) {
    await pausa(450);
    const faltantes = camposFaltantes(perfil);
    if (!faltantes.length) return null;
    const campo = faltantes[0];
    const respondidas = historia.filter((h) => h.rol === 'user').length;
    // Celebración ocasional de avance.
    const hito = respondidas > 0 && respondidas % 3 === 0 ? '¡Vas muy bien, ya casi tenemos tu perfil! ' : '';
    return { campo: campo.key, pregunta: `${hito}${puente(ultimoCampo, respondidas)}${campo.pregunta}` };
  },

  /** El asistente local no hace inferencia JSON; devuelve null -> heurística. */
  async json() { return null; },

  /** Respuesta conversacional breve para acompañar el flujo. */
  async chat(mensajes = []) {
    await pausa(300);
    const ultimo = mensajes[mensajes.length - 1]?.contenido || '';
    if (!ultimo) return 'Cuéntame más sobre tu startup y voy armando tu perfil.';
    return 'Gracias, lo incorporé a tu Startup Profile. Sigamos.';
  },
};
