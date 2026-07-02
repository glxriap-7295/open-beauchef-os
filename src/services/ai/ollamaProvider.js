import { camposFaltantes } from '../../data/profileSchema.js';

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
    const lista = documentos.map((d) => `- ${d.nombre} (${d.tipo})`).join('\n') || '(sin documentos)';
    const prompt = `Eres un analista de startups. Documentos disponibles:\n${lista}\n\n` +
      `Perfil actual (JSON): ${JSON.stringify(perfil)}\n\n` +
      `Devuelve SOLO un JSON con la forma {"detectados": {campo: valor}, "resumen": "texto breve en español"}. ` +
      `"detectados" son datos que razonablemente estarían en esos documentos y hoy faltan en el perfil.`;
    const raw = await generar(prompt, { json: true });
    const parsed = JSON.parse(raw);
    return { detectados: parsed.detectados || {}, resumen: parsed.resumen || 'Análisis completado.' };
  },

  async nextQuestion(perfil = {}, historia = []) {
    const faltantes = camposFaltantes(perfil);
    if (!faltantes.length) return null;
    const objetivo = faltantes[0];
    const previas = historia.map((h) => `${h.rol}: ${h.contenido}`).join('\n');
    const prompt = `Eres un asesor de startups conversando (estilo ChatGPT, cálido, en español chileno). ` +
      `Necesitas conocer el campo "${objetivo.label}". Conversación previa:\n${previas}\n\n` +
      `Escribe UNA sola pregunta natural para obtener ese dato, sin repetir lo ya respondido. Solo la pregunta.`;
    const texto = await generar(prompt);
    return { campo: objetivo.key, pregunta: texto.trim() || objetivo.pregunta };
  },

  async chat(mensajes = []) {
    const conv = mensajes.map((m) => `${m.rol}: ${m.contenido}`).join('\n');
    const prompt = `Eres el asistente de Open Beauchef, cálido y conciso (español chileno).\n${conv}\nassistant:`;
    return (await generar(prompt)).trim();
  },
};
