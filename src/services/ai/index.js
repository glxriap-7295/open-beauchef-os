import { mockProvider } from './mockProvider.js';
import { ollamaProvider } from './ollamaProvider.js';

/**
 * Registro de proveedores de IA. Para agregar Claude / OpenAI / Gemini en el
 * futuro, basta con crear otro módulo que implemente la misma interfaz
 * (analyzeEvidence, nextQuestion, chat, disponible) y registrarlo aquí. La UI
 * nunca cambia.
 */
const PROVIDERS = {
  ollama: ollamaProvider,
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
  };
}

let instancia = null;

/** Devuelve (singleton) el proveedor de IA activo. */
export function getAIProvider() {
  if (!instancia) instancia = crearSmartProvider();
  return instancia;
}

export { PROVIDERS };
