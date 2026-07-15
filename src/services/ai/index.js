import { mockProvider } from './mockProvider.js';
import { ollamaProvider } from './ollamaProvider.js';
import { claudeProvider } from './claudeProvider.js';

/**
 * Registro de proveedores de IA. Para agregar OpenAI / Gemini / DeepSeek /
 * Mistral, crea un módulo con la misma interfaz (analyzeEvidence, nextQuestion,
 * chat, disponible) y añádelo a este objeto: una línea, sin tocar la UI.
 * Se elige con VITE_AI_PROVIDER; si falla, el SmartProvider cae al mock.
 */
const PROVIDERS = {
  ollama: ollamaProvider,
  claude: claudeProvider,
  mock: mockProvider,
};

const PREFERIDO = import.meta.env.VITE_AI_PROVIDER || 'ollama';

/**
 * SmartProvider: usa el proveedor preferido y hace fallback automático al mock
 * ante cualquier error o indisponibilidad. Así la experiencia nunca se rompe.
 */
function crearSmartProvider() {
  const primario = PROVIDERS[PREFERIDO] || ollamaProvider;

  const conFallback = (metodo) => async (...args) => {
    try {
      return await primario[metodo](...args);
    } catch {
      return mockProvider[metodo](...args);
    }
  };

  return {
    id: primario.id,
    nombre: primario.nombre,
    esFallback: primario.id === 'mock',
    disponible: primario.disponible,
    analyzeEvidence: conFallback('analyzeEvidence'),
    nextQuestion: conFallback('nextQuestion'),
    chat: conFallback('chat'),
    // Inferencia JSON para el pipeline financiero. Si el proveedor falla o no
    // soporta JSON (mock), devuelve null y el pipeline usa heurísticas.
    async json(prompt) {
      try {
        const r = await primario.json?.(prompt);
        return r ?? null;
      } catch {
        return null;
      }
    },
  };
}

let instancia = null;

/** Devuelve (singleton) el proveedor de IA activo. */
export function getAIProvider() {
  if (!instancia) instancia = crearSmartProvider();
  return instancia;
}

export { PROVIDERS };
