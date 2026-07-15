import { camposFaltantes, PROFILE_FIELDS } from '../../data/profileSchema.js';

/**
 * EJEMPLO de proveedor Claude (Anthropic) — demuestra que agregar un modelo
 * nuevo es UN archivo + UNA línea en index.js. La UI no cambia.
 *
 * Config por entorno:
 *   VITE_AI_PROVIDER=claude
 *   VITE_ANTHROPIC_API_KEY=sk-ant-...   (en producción, proxéalo por un
 *                                        serverless para no exponer la key)
 *   VITE_CLAUDE_MODEL (opcional, default claude-3-5-sonnet)
 *
 * Si falta la key, cada método lanza y el SmartProvider hace fallback al mock.
 * Mismo contrato que ollamaProvider / mockProvider.
 */
const KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
const MODEL = import.meta.env.VITE_CLAUDE_MODEL || 'claude-3-5-sonnet-latest';
const URL = 'https://api.anthropic.com/v1/messages';

async function ask(prompt, { json = false } = {}) {
  if (!KEY) throw new Error('Claude no configurado (falta VITE_ANTHROPIC_API_KEY).');
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 700, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const data = await res.json();
  const texto = data?.content?.[0]?.text || '';
  return json ? JSON.parse(texto) : texto;
}

export const claudeProvider = {
  id: 'claude',
  nombre: `Claude (${MODEL})`,
  async disponible() { return Boolean(KEY); },

  async analyzeEvidence(documentos = [], perfil = {}) {
    const lista = documentos.map((d) => `— ${d.nombre} (${d.tipo})${d.contenido ? `\n${d.contenido}` : ''}`).join('\n\n') || '(sin documentos)';
    const campos = PROFILE_FIELDS.map((f) => `${f.key} (${f.label})`).join(', ');
    const parsed = await ask(
      `Eres un asesor cálido de Open Beauchef. Lee estos documentos:\n${lista}\n\nPerfil: ${JSON.stringify(perfil)}\n` +
      `Campos: ${campos}. Devuelve SOLO JSON {"detectados":{campo:valor},"resumen":"..."}. ` +
      `El resumen empieza con "Perfecto. Revisé la información que compartiste y entendí que...".`,
      { json: true }
    );
    return { detectados: parsed.detectados || {}, resumen: parsed.resumen || 'Análisis completado.' };
  },

  async nextQuestion(perfil = {}, historia = [], ultimoCampo = null) {
    const faltantes = camposFaltantes(perfil);
    if (!faltantes.length) return null;
    const objetivo = faltantes[0];
    const previas = historia.map((h) => `${h.rol}: ${h.contenido}`).join('\n');
    const puente = ultimoCampo ? `Conecta con lo último que te contó (sobre "${ultimoCampo}").` : '';
    const texto = await ask(
      `Asesor cercano de Open Beauchef (español chileno, cálido). Conversación:\n${previas}\n\n` +
      `Necesitas conocer "${objetivo.label}". ${puente} Escribe UNA sola pregunta humana. Solo la pregunta.`
    );
    return { campo: objetivo.key, pregunta: texto.trim() || objetivo.pregunta };
  },

  async chat(mensajes = []) {
    const conv = mensajes.map((m) => `${m.rol}: ${m.contenido}`).join('\n');
    return (await ask(`Asistente de Open Beauchef, cálido y conciso (español chileno).\n${conv}\nassistant:`)).trim();
  },

  /** Inferencia estructurada: devuelve JSON parseado (para el pipeline financiero). */
  async json(prompt) {
    return ask(prompt, { json: true });
  },
};
