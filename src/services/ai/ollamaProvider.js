import { camposFaltantes, PROFILE_FIELDS } from '../../data/profileSchema.js';

/**
 * Proveedor de IA basado en Ollama (local, gratuito, privado).
 * Configuración por variables de entorno (nunca hardcodear el modelo):
 *   VITE_OLLAMA_URL   (default http://localhost:11434)
 *   VITE_OLLAMA_MODEL (default llama3.2)
 *
 * Implementa la misma interfaz que mockProvider. Si Ollama no responde, cada
 * método lanza y el SmartProvider hace fallback automático al mock.
 */
const URL = (import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
const MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'llama3.2';

async function generar(prompt, { json = false, timeout = 20000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, stream: false, ...(json ? { format: 'json' } : {}) }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const data = await res.json();
    return data.response || '';
  } finally {
    clearTimeout(t);
  }
}

export const ollamaProvider = {
  id: 'ollama',
  nombre: `Ollama (${MODEL})`,

  async disponible() {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1500);
      const res = await fetch(`${URL}/api/tags`, { signal: ctrl.signal });
      clearTimeout(t);
      return res.ok;
    } catch {
      return false;
    }
  },

  async analyzeEvidence(documentos = [], perfil = {}) {
    const lista = documentos
      .map((d) => `— ${d.nombre} (${d.tipo})${d.contenido ? `\nContenido:\n${d.contenido}` : ''}`)
      .join('\n\n') || '(sin documentos)';
    const campos = PROFILE_FIELDS.map((f) => `${f.key} (${f.label})`).join(', ');
    const prompt = `Eres un asesor cercano de startups de Open Beauchef (español chileno, cálido y humano). ` +
      `Lee y entiende estos documentos:\n\n${lista}\n\nPerfil actual (JSON): ${JSON.stringify(perfil)}\n\n` +
      `Campos posibles: ${campos}.\n` +
      `Devuelve SOLO un JSON válido con la forma {"detectados": {campo: valor}, "resumen": "texto"}.\n` +
      `- "detectados": solo campos que aparezcan o se infieran claramente del contenido y que hoy estén vacíos. No inventes.\n` +
      `- "resumen": 2-3 frases cálidas que le DEVUELVAN al fundador lo que entendiste de su negocio, ` +
      `empezando con "Perfecto. Revisé la información que compartiste y entendí que...". Suena como un asesor, no como un formulario.`;
    const raw = await generar(prompt, { json: true });
    const parsed = JSON.parse(raw);
    return { detectados: parsed.detectados || {}, resumen: parsed.resumen || 'Análisis completado.' };
  },

  async nextQuestion(perfil = {}, historia = [], ultimoCampo = null) {
    const faltantes = camposFaltantes(perfil);
    if (!faltantes.length) return null;
    const objetivo = faltantes[0];
    const previas = historia.map((h) => `${h.rol}: ${h.contenido}`).join('\n');
    const puente = ultimoCampo
      ? `Conecta de forma natural con lo último que te contó (sobre "${ultimoCampo}"), por ejemplo "Como me comentaste que...".`
      : '';
    const prompt = `Eres un asesor cercano de Open Beauchef (español chileno, cálido y alentador, nunca robótico). ` +
      `Conversación previa:\n${previas}\n\n` +
      `Ahora necesitas conocer "${objetivo.label}". ${puente} ` +
      `Si el fundador va avanzando, felicítalo brevemente. Escribe UNA sola pregunta natural y humana, ` +
      `sin repetir lo ya respondido. Devuelve solo la pregunta.`;
    const texto = await generar(prompt);
    return { campo: objetivo.key, pregunta: texto.trim() || objetivo.pregunta };
  },

  async chat(mensajes = []) {
    const conv = mensajes.map((m) => `${m.rol}: ${m.contenido}`).join('\n');
    const prompt = `Eres el asistente de Open Beauchef, cálido y conciso (español chileno).\n${conv}\nassistant:`;
    return (await generar(prompt)).trim();
  },

  /** Inferencia estructurada: devuelve JSON parseado (para el pipeline financiero). */
  async json(prompt) {
    return JSON.parse(await generar(prompt, { json: true }));
  },
};
