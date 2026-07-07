import { MENTORES } from '../../data/mentores.js';

/**
 * Matching de mentores. Compara el Startup Profile con cada mentor y devuelve
 * puntaje de compatibilidad, fortalezas, riesgos y razonamiento. Heurístico y
 * determinista (no inventa datos). La decisión final SIEMPRE es del admin.
 *
 * Devuelve la lista ordenada: [{ mentor, score, fortalezas, riesgos, razones }]
 */
function norm(s) {
  return String(s || '').toLowerCase();
}

function coincide(lista, texto) {
  const t = norm(texto);
  return lista.filter((x) => t.includes(norm(x)) || norm(x).split(' ').some((w) => w.length > 3 && t.includes(w)));
}

export function matchMentores(perfil = {}, mentores = MENTORES) {
  const blob = [
    perfil.industria, perfil.problema, perfil.solucion, perfil.modeloNegocio,
    perfil.clienteObjetivo, perfil.revenueModel, perfil.metas, perfil.desafios,
    perfil.infoFinanciera, perfil.competidores,
  ].map(norm).join(' ');
  const etapa = norm(perfil.etapa);

  const resultados = mentores.map((m) => {
    const fortalezas = [];
    let score = 40; // base

    const indHit = coincide(m.industrias, blob);
    if (indHit.length) { score += 22; fortalezas.push(`Experiencia en ${indHit[0]}`); }

    const expHit = coincide(m.expertise, blob);
    if (expHit.length) { score += Math.min(20, expHit.length * 8); fortalezas.push(...expHit.slice(0, 2).map((e) => `${e}`)); }

    const etapaOk = m.etapas.some((e) => norm(e) === etapa || (etapa && norm(e).includes(etapa)));
    if (etapaOk) { score += 12; fortalezas.push(`Acompaña tu etapa (${perfil.etapa || 'actual'})`); }

    // Fundraising / internacional según señales del perfil.
    if (m.experienciaFundraising && /(ronda|inversi|capital|fundrais|levant)/.test(blob)) { score += 8; fortalezas.push('Experiencia en fundraising'); }
    if (m.expansionInternacional && /(internacional|export|latam|m[eé]xico|global)/.test(blob)) { score += 6; fortalezas.push('Expansión internacional'); }

    if (norm(m.disponibilidad).includes('este mes')) { score += 4; fortalezas.push('Disponible este mes'); }

    score = Math.max(30, Math.min(97, Math.round(score)));

    const riesgos = [];
    if (!etapaOk) riesgos.push('Su foco de etapa no calza exactamente con la tuya.');
    if (!indHit.length) riesgos.push('Sin experiencia directa en tu industria.');
    if (m.capacidadReuniones <= 2) riesgos.push('Disponibilidad acotada este período.');

    const razones = fortalezas.slice(0, 4);
    return { mentor: m, score, fortalezas: [...new Set(fortalezas)].slice(0, 5), riesgos, razones };
  });

  return resultados.sort((a, b) => b.score - a.score);
}
