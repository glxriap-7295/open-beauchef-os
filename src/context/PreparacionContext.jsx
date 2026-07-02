import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { perfilVacio } from '../data/profileSchema.js';
import { persistence } from '../services/persistence/index.js';

/**
 * Estado global de "Nivel de Preparación" del emprendedor.
 * Se comparte entre el Panel Principal, Recomendaciones IA, Centro de
 * Herramientas, el Copiloto Financiero y el walkthrough futuro.
 *
 * El nivel global se deriva del promedio de las dimensiones, de modo que
 * cuando una dimensión mejora (p. ej. al completar la demo financiera), el
 * nivel sube de forma coherente.
 */

const PreparacionContext = createContext(null);
const STORAGE_KEY = 'ob_preparacion_v4';

const ESTADO_INICIAL = {
  empresa: 'Decantopia',
  fundadora: 'Paloma',
  etapaActual: 'Validando Mercado',
  proximaEtapa: 'Preparándose para Escalar',
  // Perfil de la startup — única fuente de verdad del OS. Varios campos parten
  // vacíos a propósito, para que AI Discovery, Gap Analysis y Roadmap tengan
  // acciones reales que resolver.
  perfil: {
    ...perfilVacio(),
    nombre: 'Decantopia',
    industria: 'E-commerce de vinos y destilados',
    etapa: 'Validando Mercado',
  },
  // Método de datos financieros elegido: null | 'fintoc' | 'manual'
  fuenteFinanciera: null,
  // Evidence Vault: documentos cargados con su estado de análisis.
  documentos: [],
  // Tareas del Roadmap marcadas manualmente como completadas (por id).
  tareasManuales: [],
  dimensiones: {
    Comercial: 84,
    Finanzas: 46,
    Tecnología: 78,
    Validación: 62,
    Equipo: 70,
  },
  // Serie de tendencia (últimas semanas) del nivel de preparación.
  tendencia: [52, 55, 58, 60, 63, 66, 68],
  recomendaciones: [
    { id: 'startup-card', titulo: 'Completar Startup Card', mejora: 6, hecho: true,  tipo: 'gratuita' },
    { id: 'pitch-deck',   titulo: 'Subir Pitch Deck',       mejora: 5, hecho: true,  tipo: 'gratuita' },
    { id: 'finanzas',     titulo: 'Analizar Finanzas',      mejora: 12, hecho: false, tipo: 'copiloto', ruta: '/copiloto' },
    { id: 'mentor',       titulo: 'Solicitar Mentor',       mejora: 8, hecho: false, tipo: 'mentor',   ruta: '/mentores' },
    { id: 'fuentes',      titulo: 'Conectar futuras fuentes de datos', mejora: 9, hecho: false, tipo: 'copiloto', ruta: '/copiloto/futuro' },
  ],
  logros: [
    { id: 'l1', titulo: 'Startup Card completada', fecha: 'Hace 2 días', icono: '🎯' },
    { id: 'l2', titulo: 'Pitch Deck cargado', fecha: 'Hace 4 días', icono: '📊' },
    { id: 'l3', titulo: 'Primer hito de validación', fecha: 'Hace 1 semana', icono: '✅' },
  ],
  // Hito que habilita Mentor Matching.
  umbralMentor: 70,
  copilotoActivado: false,
};

function calcularNivel(dimensiones) {
  const vals = Object.values(dimensiones);
  if (!vals.length) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Deriva los objetivos de preparación a partir del Startup Profile y los
 * documentos del Evidence Vault. Cada objetivo "done" suma puntos al Nivel de
 * Preparación. Gap Analysis usa los no completados; el Roadmap usa todos.
 * `accion` indica qué herramienta abrir para resolverlo.
 */
function calcularObjetivos(perfil = {}, documentos = [], tareasManuales = []) {
  const tieneDoc = (tipo) => documentos.some((d) => d.tipo === tipo);
  const base = [
    { id: 'web', titulo: 'Agrega el sitio web de tu startup', gap: 'No tienes un sitio web definido', puntos: 3, auto: !!perfil.sitioWeb, accion: 'startup-card' },
    { id: 'problema', titulo: 'Describe el problema que resuelves', gap: 'Falta describir el problema', puntos: 3, auto: !!perfil.problema, accion: 'startup-card' },
    { id: 'solucion', titulo: 'Describe tu solución', gap: 'Falta describir la solución', puntos: 3, auto: !!perfil.solucion, accion: 'startup-card' },
    { id: 'modelo', titulo: 'Define tu modelo de negocio y pricing', gap: 'No definiste tu modelo de negocio', puntos: 4, auto: !!perfil.modeloNegocio, accion: 'startup-card' },
    { id: 'icp', titulo: 'Define tu cliente objetivo (ICP)', gap: 'Falta definir tu cliente objetivo', puntos: 4, auto: !!perfil.clienteObjetivo, accion: 'startup-card' },
    { id: 'pitch', titulo: 'Sube tu Pitch Deck', gap: 'No has subido un Pitch Deck', puntos: 5, auto: tieneDoc('Pitch Deck'), accion: 'evidence' },
    { id: 'financiero', titulo: 'Sube tu modelo financiero', gap: 'No has subido un modelo financiero', puntos: 5, auto: tieneDoc('Modelo Financiero'), accion: 'evidence' },
  ];
  return base.map((o) => ({ ...o, done: o.auto || tareasManuales.includes(o.id) }));
}

function cargarEstado() {
  const saved = persistence.get(STORAGE_KEY);
  if (saved) {
    // Fusiona perfil por si el esquema creció entre versiones.
    return { ...ESTADO_INICIAL, ...saved, perfil: { ...ESTADO_INICIAL.perfil, ...(saved.perfil || {}) } };
  }
  return ESTADO_INICIAL;
}

export function PreparacionProvider({ children }) {
  const [estado, setEstado] = useState(cargarEstado);

  useEffect(() => {
    persistence.set(STORAGE_KEY, estado);
  }, [estado]);

  // Objetivos derivados del perfil + documentos (motor de Gap Analysis / Roadmap).
  const objetivos = useMemo(
    () => calcularObjetivos(estado.perfil, estado.documentos, estado.tareasManuales),
    [estado.perfil, estado.documentos, estado.tareasManuales]
  );
  const gaps = useMemo(() => objetivos.filter((o) => !o.done), [objetivos]);
  const bonusPreparacion = useMemo(
    () => objetivos.reduce((s, o) => s + (o.done ? o.puntos : 0), 0),
    [objetivos]
  );

  // El nivel base (promedio de dimensiones) + el bonus por objetivos completados.
  const nivel = useMemo(
    () => clamp(calcularNivel(estado.dimensiones) + bonusPreparacion, 0, 100),
    [estado.dimensiones, bonusPreparacion]
  );
  const mentorDesbloqueado = nivel >= estado.umbralMentor;

  /** Marca una recomendación como completada (idempotente). */
  const completarRecomendacion = useCallback((id) => {
    setEstado((prev) => ({
      ...prev,
      recomendaciones: prev.recomendaciones.map((r) => (r.id === id ? { ...r, hecho: true } : r)),
    }));
  }, []);

  /**
   * Acción central: al terminar la demo / walkthrough del Copiloto Financiero,
   * sube la dimensión Finanzas, registra logro, actualiza recomendaciones y
   * agrega un punto de tendencia.
   */
  const completarDemoFinanciera = useCallback(() => {
    setEstado((prev) => {
      const nuevasDim = { ...prev.dimensiones, Finanzas: Math.max(prev.dimensiones.Finanzas, 74) };
      const nuevoNivel = calcularNivel(nuevasDim);
      const yaRegistrado = prev.copilotoActivado;
      return {
        ...prev,
        copilotoActivado: true,
        dimensiones: nuevasDim,
        etapaActual: nuevoNivel >= 70 ? 'Preparándose para Escalar' : prev.etapaActual,
        proximaEtapa: nuevoNivel >= 70 ? 'Lista para Inversión' : prev.proximaEtapa,
        recomendaciones: prev.recomendaciones.map((r) =>
          r.id === 'finanzas' || r.id === 'fuentes' ? { ...r, hecho: true } : r
        ),
        logros: yaRegistrado
          ? prev.logros
          : [{ id: 'l-fin', titulo: 'Copiloto Financiero activado', fecha: 'Ahora', icono: '🤖' }, ...prev.logros],
        tendencia: yaRegistrado ? prev.tendencia : [...prev.tendencia, nuevoNivel],
      };
    });
  }, []);

  /** Startup Card: actualiza uno o más campos del perfil. */
  const actualizarPerfil = useCallback((patch) => {
    setEstado((prev) => {
      const nombre = patch.nombre !== undefined ? patch.nombre || prev.perfil.nombre : prev.perfil.nombre;
      return {
        ...prev,
        empresa: nombre,
        etapaActual: patch.etapa || prev.etapaActual,
        perfil: { ...prev.perfil, ...patch },
        recomendaciones: prev.recomendaciones.map((r) =>
          r.id === 'startup-card' ? { ...r, hecho: true } : r
        ),
      };
    });
  }, []);

  /** Evidence Vault: agrega un documento (estado inicial "Pendiente"). */
  const subirDocumento = useCallback((doc) => {
    const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setEstado((prev) => ({
      ...prev,
      documentos: [{ id, nombre: doc.nombre, tipo: doc.tipo || 'Otro', estado: 'Pendiente' }, ...prev.documentos],
    }));
    return id;
  }, []);

  /** Evidence Vault: cambia el estado de análisis de un documento. */
  const setEstadoDocumento = useCallback((id, estadoDoc) => {
    setEstado((prev) => ({
      ...prev,
      documentos: prev.documentos.map((d) => (d.id === id ? { ...d, estado: estadoDoc } : d)),
    }));
  }, []);

  /** Evidence Vault: renombra un documento. */
  const renombrarDocumento = useCallback((id, nombre) => {
    setEstado((prev) => ({
      ...prev,
      documentos: prev.documentos.map((d) => (d.id === id ? { ...d, nombre } : d)),
    }));
  }, []);

  /** Evidence Vault: elimina un documento. */
  const eliminarDocumento = useCallback((id) => {
    setEstado((prev) => ({ ...prev, documentos: prev.documentos.filter((d) => d.id !== id) }));
  }, []);

  /** Roadmap: marca/desmarca manualmente una tarea (objetivo) como completada. */
  const alternarTarea = useCallback((id) => {
    setEstado((prev) => {
      const ya = prev.tareasManuales.includes(id);
      return {
        ...prev,
        tareasManuales: ya ? prev.tareasManuales.filter((t) => t !== id) : [...prev.tareasManuales, id],
      };
    });
  }, []);

  /** Financial Copilot: registra el método de conexión de datos elegido. */
  const setFuenteFinanciera = useCallback((fuente) => {
    setEstado((prev) => ({ ...prev, fuenteFinanciera: fuente }));
  }, []);

  /** Agrega un logro reciente al inicio de la lista (para eventos del OS). */
  const agregarLogro = useCallback((titulo, icono = '✨') => {
    setEstado((prev) => ({
      ...prev,
      logros: [{ id: `l-${Date.now()}`, titulo, fecha: 'Ahora', icono }, ...prev.logros].slice(0, 8),
    }));
  }, []);

  /** Reinicia el estado a los valores de fábrica (útil para la demo en vivo). */
  const reiniciar = useCallback(() => setEstado(ESTADO_INICIAL), []);

  const value = useMemo(
    () => ({
      ...estado,
      empresa: estado.perfil?.nombre || estado.empresa,
      nivel,
      mentorDesbloqueado,
      objetivos,
      gaps,
      bonusPreparacion,
      completarRecomendacion,
      completarDemoFinanciera,
      actualizarPerfil,
      subirDocumento,
      setEstadoDocumento,
      renombrarDocumento,
      eliminarDocumento,
      alternarTarea,
      setFuenteFinanciera,
      agregarLogro,
      reiniciar,
    }),
    [
      estado, nivel, mentorDesbloqueado, objetivos, gaps, bonusPreparacion,
      completarRecomendacion, completarDemoFinanciera, actualizarPerfil,
      subirDocumento, setEstadoDocumento, renombrarDocumento, eliminarDocumento,
      alternarTarea, setFuenteFinanciera, agregarLogro, reiniciar,
    ]
  );

  return <PreparacionContext.Provider value={value}>{children}</PreparacionContext.Provider>;
}

export function usePreparacion() {
  const ctx = useContext(PreparacionContext);
  if (!ctx) throw new Error('usePreparacion debe usarse dentro de <PreparacionProvider>');
  return ctx;
}
