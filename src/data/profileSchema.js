/**
 * Esquema del Startup Profile — la única fuente de verdad del OS.
 * Todos los módulos (AI Discovery, Gap Analysis, Roadmap, Dashboard,
 * Financial Copilot) consumen este mismo perfil.
 *
 * Cada campo declara:
 *  - key: nombre en el objeto `perfil`
 *  - label: etiqueta visible (español)
 *  - grupo: sección lógica
 *  - pregunta: cómo la IA lo consulta si falta (tono ChatGPT, no formulario)
 *  - evidencias: tipos de documento que normalmente ya contienen este dato
 *  - tipo: 'texto' | 'area' | 'select'
 */
export const PROFILE_FIELDS = [
  { key: 'nombre', label: 'Nombre', grupo: 'General', tipo: 'texto', pregunta: '¿Cómo se llama tu startup?', evidencias: ['Pitch Deck'] },
  { key: 'industria', label: 'Industria', grupo: 'General', tipo: 'texto', pregunta: '¿En qué industria operas?', evidencias: ['Pitch Deck'] },
  { key: 'etapa', label: 'Etapa', grupo: 'General', tipo: 'select', opciones: ['Idea', 'Validando Mercado', 'Preparándose para Escalar', 'Escalando'], pregunta: '¿En qué etapa dirías que está tu startup hoy?', evidencias: [] },
  { key: 'sitioWeb', label: 'Sitio web', grupo: 'General', tipo: 'texto', pregunta: '¿Cuál es el sitio web de tu startup? Si aún no tienes, cuéntame.', evidencias: ['Sitio Web'] },

  { key: 'problema', label: 'Problema', grupo: 'Producto', tipo: 'area', pregunta: '¿Qué problema concreto resuelves para tus clientes?', evidencias: ['Pitch Deck'] },
  { key: 'solucion', label: 'Solución', grupo: 'Producto', tipo: 'area', pregunta: '¿Cómo resuelves ese problema? ¿Qué hace tu producto?', evidencias: ['Pitch Deck'] },
  { key: 'clienteObjetivo', label: 'Cliente objetivo (ICP)', grupo: 'Mercado', tipo: 'area', pregunta: '¿Quién es tu cliente ideal? Descríbeme a tu ICP.', evidencias: ['Pitch Deck'] },
  { key: 'competidores', label: 'Competencia', grupo: 'Mercado', tipo: 'area', pregunta: '¿Quiénes son tus principales competidores y en qué te diferencias?', evidencias: ['Pitch Deck'] },

  { key: 'modeloNegocio', label: 'Modelo de negocio', grupo: 'Negocio', tipo: 'area', pregunta: '¿Cómo funciona tu modelo de negocio?', evidencias: ['Modelo de Negocio', 'Pitch Deck'] },
  { key: 'pricing', label: 'Pricing', grupo: 'Negocio', tipo: 'area', pregunta: '¿Cómo cobras? Cuéntame de tu pricing.', evidencias: ['Modelo de Negocio', 'Modelo Financiero'] },
  { key: 'revenueModel', label: 'Modelo de ingresos', grupo: 'Negocio', tipo: 'area', pregunta: '¿De dónde vienen tus ingresos principales?', evidencias: ['Modelo Financiero'] },

  { key: 'trl', label: 'TRL — Madurez tecnológica', grupo: 'Madurez', tipo: 'select', opciones: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], pregunta: 'En una escala TRL de 1 a 9, ¿qué tan madura está tu tecnología?', evidencias: [] },
  { key: 'brl', label: 'BRL — Madurez de negocio', grupo: 'Madurez', tipo: 'select', opciones: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], pregunta: 'En BRL de 1 a 9, ¿qué tan validado está tu modelo de negocio?', evidencias: [] },
  { key: 'crl', label: 'CRL — Madurez comercial', grupo: 'Madurez', tipo: 'select', opciones: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], pregunta: 'En CRL de 1 a 9, ¿qué tan avanzada está tu tracción comercial?', evidencias: [] },
  { key: 'iprl', label: 'IPRL — Madurez de propiedad intelectual', grupo: 'Madurez', tipo: 'select', opciones: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], pregunta: 'En IPRL de 1 a 9, ¿cómo está tu propiedad intelectual?', evidencias: ['Legal'] },

  { key: 'equipo', label: 'Equipo', grupo: 'Equipo', tipo: 'area', pregunta: '¿Quiénes forman el equipo fundador y qué roles cubren?', evidencias: ['Pitch Deck'] },
  { key: 'infoFinanciera', label: 'Información financiera', grupo: 'Finanzas', tipo: 'area', pregunta: '¿Cómo estás financieramente? Ingresos, gastos, runway aproximado.', evidencias: ['Modelo Financiero', 'Cartola Bancaria'] },
  { key: 'desafios', label: 'Desafíos actuales', grupo: 'Estrategia', tipo: 'area', pregunta: '¿Cuál es tu mayor desafío en este momento?', evidencias: [] },
  { key: 'metas', label: 'Objetivos', grupo: 'Estrategia', tipo: 'area', pregunta: '¿Qué quieres lograr en los próximos 6 meses?', evidencias: [] },
];

/** Campos vacíos por defecto para inicializar el perfil. */
export function perfilVacio() {
  return PROFILE_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {});
}

/** Devuelve los campos que aún faltan (vacíos) en un perfil. */
export function camposFaltantes(perfil = {}) {
  return PROFILE_FIELDS.filter((f) => !String(perfil[f.key] || '').trim());
}

/** % de completitud del perfil. */
export function completitudPerfil(perfil = {}) {
  const total = PROFILE_FIELDS.length;
  const llenos = PROFILE_FIELDS.filter((f) => String(perfil[f.key] || '').trim()).length;
  return total ? Math.round((llenos / total) * 100) : 0;
}

/** Tipos de documento que el Evidence Vault reconoce. */
export const TIPOS_EVIDENCIA = [
  'Pitch Deck',
  'Modelo de Negocio',
  'Modelo Financiero',
  'Sitio Web',
  'LinkedIn',
  'Figma',
  'Cartola Bancaria',
  'Legal',
  'Otro',
];
