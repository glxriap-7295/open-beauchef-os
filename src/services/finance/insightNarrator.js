/**
 * NARRADOR DE INSIGHTS (capa de IA — SOLO reescribe).
 * ============================================================================
 * La IA NUNCA descubre hechos ni ve transacciones crudas: recibe OBSERVACIONES
 * ya verificadas por el InsightEngine y su única tarea es redactarlas en
 * lenguaje cercano para el/la fundador/a.
 *
 * Salvaguardas (para que la IA no pueda "contaminar" la contabilidad):
 *   · Solo se acepta de la IA el campo `explanation` (texto). value, severity,
 *     metric e id se conservan del cálculo determinista.
 *   · Si la IA falla, alucina, o no está disponible → se usan las explicaciones
 *     deterministas tal cual. El sistema siempre funciona sin IA.
 * ============================================================================
 */
import { getAIProvider } from '../ai/index.js';

/**
 * Reescribe la `explanation` de cada insight. Devuelve la MISMA estructura;
 * solo cambia el texto (y marca `narrated:true` cuando la IA lo reescribió).
 * @param {Array} insights  salida de computeInsights()
 */
export async function narrarInsights(insights = []) {
  if (!insights.length) return insights;
  try {
    const ai = getAIProvider();
    const hechos = insights.map((i) => ({ id: i.id, title: i.title, explanation: i.explanation }));
    const j = await ai.json(
      'Eres el Copiloto Financiero de Open Beauchef (español chileno, cálido y concreto). '
      + 'Abajo hay OBSERVACIONES YA VERIFICADAS por el motor contable. Tu ÚNICA tarea es reescribir '
      + 'el campo "explanation" de cada una para que sea clara y accionable para un/a fundador/a. '
      + 'NO inventes cifras, NO agregues observaciones nuevas, NO cambies id. '
      + `Devuelve SOLO un array JSON [{"id":"...","explanation":"..."}].\n${JSON.stringify(hechos)}`,
    );
    if (Array.isArray(j)) {
      const byId = new Map(
        j.filter((x) => x && x.id && typeof x.explanation === 'string' && x.explanation.length > 10)
          .map((x) => [x.id, x.explanation]),
      );
      // Solo se sustituye el texto; el resto de los campos son intocables.
      return insights.map((i) => (byId.has(i.id) ? { ...i, explanation: byId.get(i.id), narrated: true } : i));
    }
  } catch { /* conserva explicaciones deterministas */ }
  return insights;
}

/**
 * Redacta un diagnóstico breve (3-4 frases) a partir de los insights TOP.
 * Determinista por defecto; la IA solo pule la redacción sobre hechos dados.
 * @param {Array} insights
 * @returns {Promise<string>}
 */
export async function narrarResumen(insights = []) {
  const top = insights.slice(0, 4);
  const base = top.map((i) => i.explanation).join(' ');
  if (!top.length) return 'Aún no hay suficientes datos para un diagnóstico.';
  try {
    const ai = getAIProvider();
    const j = await ai.json(
      'Eres el Copiloto Financiero (español chileno). Con estas observaciones YA VERIFICADAS, '
      + 'redacta un diagnóstico de 3-4 frases, cálido y accionable. NO inventes cifras ni agregues datos. '
      + `Devuelve SOLO JSON {"texto":"..."}.\n${JSON.stringify(top.map((i) => i.explanation))}`,
    );
    if (j && typeof j.texto === 'string' && j.texto.length > 30) return j.texto;
  } catch { /* usa la narrativa determinista */ }
  return base;
}
