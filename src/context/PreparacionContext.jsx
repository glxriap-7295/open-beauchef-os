import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { perfilVacio } from '../data/profileSchema.js';
import { persistence } from '../services/persistence/index.js';
import { clavePorDescripcion } from '../services/finance/categorizer.js';

/**
 * Estado global del emprendedor. El Startup Profile es la única fuente de verdad;
 * el Nivel de Preparación y sus dimensiones se DERIVAN de datos reales del perfil
 * (nunca métricas inventadas). Un startup nuevo parte con el perfil vacío y el
 * puntaje en 0, y sube a medida que se completa la información.
 */
const PreparacionContext = createContext(null);
const STORAGE_KEY = 'ob_preparacion_v5';

const ESTADO_INICIAL = {
  fundadora: '',
  etapaActual: 'Descubrimiento',
  proximaEtapa: 'Validando Mercado',
  // Perfil vacío: se llena con AI Discovery / edición manual.
  perfil: { ...perfilVacio() },
  documentos: [],
  tareasManuales: [],
  recomendaciones: [
    { id: 'ai-discovery', titulo: 'Ejecutar AI Discovery', mejora: 15, hecho: false, tipo: 'gratuita', ruta: '/herramientas' },
    { id: 'startup-card', titulo: 'Completar tu Startup Card', mejora: 8, hecho: false, tipo: 'gratuita', ruta: '/herramientas' },
    { id: 'finanzas', titulo: 'Conectar tus finanzas', mejora: 12, hecho: false, tipo: 'copiloto', ruta: '/copiloto' },
    { id: 'mentor', titulo: 'Solicitar Mentor', mejora: 8, hecho: false, tipo: 'mentor', ruta: '/mentores' },
    { id: 'fuentes', titulo: 'Explorar la versión futura', mejora: 6, hecho: false, tipo: 'copiloto', ruta: '/copiloto/futuro' },
  ],
  logros: [],
  // Equipo (colaboración). El owner se agrega al completar el onboarding.
  miembros: [],
  invitaciones: [],
  // Preferencias
  notificacionesActivas: false,
  // Fuente de datos financieros: null | 'fintoc' | 'manual' | 'demo'
  fuenteFinanciera: null,
  // Datos financieros reales importados (CSV/Excel/Fintoc).
  transacciones: [],
  cuentasBancarias: [],
  fintoc: { conectado: false, banco: '', cuentas: 0, ultimaSync: null, linkToken: null },
  // Aprendizaje: memoria de categorías del startup { claveDescripcion: categoria }.
  categoryMappings: {},
  // Último diagnóstico financiero de IA { texto, stats, fecha }.
  diagnostico: null,
  copilotoActivado: false,
  umbralMentor: 70,
  // Preferencias de experiencia
  voiceMode: true,
  tourVisto: false,
  // Mentor Matching (lo asigna el equipo admin)
  mentorAsignado: null, // { nombre, foto, asignadoEl }
};

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function pctLlenos(keys, perfil) {
  if (!keys.length) return 0;
  const llenos = keys.filter((k) => String(perfil[k] || '').trim()).length;
  return Math.round((llenos / keys.length) * 100);
}

/**
 * Deriva las 5 dimensiones del Nivel de Preparación a partir de datos reales
 * del perfil, la evidencia y la conexión financiera. Sin valores inventados.
 */
function calcularDimensiones(perfil = {}, documentos = [], fuente = null) {
  const finBase = pctLlenos(['infoFinanciera', 'revenueModel', 'pricing'], perfil);
  const finanzas = clamp(Math.round(finBase * 0.5) + (fuente ? 50 : 0), 0, 100);
  return {
    Comercial: pctLlenos(['clienteObjetivo', 'competidores', 'modeloNegocio'], perfil),
    Finanzas: finanzas,
    Tecnología: pctLlenos(['trl', 'solucion', 'sitioWeb'], perfil),
    Validación: pctLlenos(['problema', 'brl', 'crl'], perfil),
    Equipo: pctLlenos(['equipo', 'iprl'], perfil),
  };
}

/**
 * Objetivos derivados del perfil + documentos (motor de Gap Analysis / Roadmap).
 * `auto` = ya resuelto por datos reales; el usuario puede además marcar manual.
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
    return { ...ESTADO_INICIAL, ...saved, perfil: { ...ESTADO_INICIAL.perfil, ...(saved.perfil || {}) } };
  }
  return ESTADO_INICIAL;
}

export function PreparacionProvider({ children }) {
  const [estado, setEstado] = useState(cargarEstado);

  useEffect(() => {
    persistence.set(STORAGE_KEY, estado);
  }, [estado]);

  const dimensiones = useMemo(
    () => calcularDimensiones(estado.perfil, estado.documentos, estado.fuenteFinanciera),
    [estado.perfil, estado.documentos, estado.fuenteFinanciera]
  );
  const objetivos = useMemo(
    () => calcularObjetivos(estado.perfil, estado.documentos, estado.tareasManuales),
    [estado.perfil, estado.documentos, estado.tareasManuales]
  );
  const gaps = useMemo(() => objetivos.filter((o) => !o.done), [objetivos]);
  // Bonus por tareas marcadas manualmente (no resueltas por datos).
  const bonusPreparacion = useMemo(
    () => objetivos.filter((o) => o.done && !o.auto).reduce((s, o) => s + o.puntos, 0),
    [objetivos]
  );

  const nivel = useMemo(() => {
    const vals = Object.values(dimensiones);
    const base = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    return clamp(base + bonusPreparacion, 0, 100);
  }, [dimensiones, bonusPreparacion]);

  const mentorDesbloqueado = nivel >= estado.umbralMentor;

  const completarRecomendacion = useCallback((id) => {
    setEstado((prev) => ({
      ...prev,
      recomendaciones: prev.recomendaciones.map((r) => (r.id === id ? { ...r, hecho: true } : r)),
    }));
  }, []);

  /**
   * Marca como visto el recorrido del Copiloto Financiero (walkthrough).
   * NO conecta datos: nunca carga automáticamente el dataset de ejemplo. La
   * fuente financiera solo se establece cuando el fundador elige explícitamente
   * conectar Fintoc / subir un archivo / ver la demostración.
   */
  const completarDemoFinanciera = useCallback(() => {
    setEstado((prev) => ({
      ...prev,
      copilotoActivado: true,
      recomendaciones: prev.recomendaciones.map((r) =>
        r.id === 'finanzas' || r.id === 'fuentes' ? { ...r, hecho: true } : r
      ),
      logros: prev.copilotoActivado
        ? prev.logros
        : [{ id: 'l-fin', titulo: 'Copiloto Financiero activado', fecha: 'Ahora', icono: '🤖' }, ...prev.logros].slice(0, 8),
    }));
  }, []);

  const actualizarPerfil = useCallback((patch) => {
    setEstado((prev) => {
      const nombre = patch.nombre !== undefined ? patch.nombre || prev.perfil.nombre : prev.perfil.nombre;
      return {
        ...prev,
        etapaActual: patch.etapa || prev.etapaActual,
        perfil: { ...prev.perfil, ...patch, nombre },
        recomendaciones: prev.recomendaciones.map((r) =>
          r.id === 'startup-card' ? { ...r, hecho: true } : r
        ),
      };
    });
  }, []);

  const setFundadora = useCallback((nombre) => {
    setEstado((prev) => ({ ...prev, fundadora: nombre }));
  }, []);

  const subirDocumento = useCallback((doc) => {
    const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setEstado((prev) => ({
      ...prev,
      documentos: [{ id, nombre: doc.nombre, tipo: doc.tipo || 'Otro', estado: 'Pendiente' }, ...prev.documentos],
    }));
    return id;
  }, []);

  const setEstadoDocumento = useCallback((id, estadoDoc) => {
    setEstado((prev) => ({
      ...prev,
      documentos: prev.documentos.map((d) => (d.id === id ? { ...d, estado: estadoDoc } : d)),
    }));
  }, []);

  const renombrarDocumento = useCallback((id, nombre) => {
    setEstado((prev) => ({
      ...prev,
      documentos: prev.documentos.map((d) => (d.id === id ? { ...d, nombre } : d)),
    }));
  }, []);

  const eliminarDocumento = useCallback((id) => {
    setEstado((prev) => ({ ...prev, documentos: prev.documentos.filter((d) => d.id !== id) }));
  }, []);

  const alternarTarea = useCallback((id) => {
    setEstado((prev) => {
      const ya = prev.tareasManuales.includes(id);
      return {
        ...prev,
        tareasManuales: ya ? prev.tareasManuales.filter((t) => t !== id) : [...prev.tareasManuales, id],
      };
    });
  }, []);

  const setFuenteFinanciera = useCallback((fuente) => {
    setEstado((prev) => ({ ...prev, fuenteFinanciera: fuente }));
  }, []);

  /**
   * Importa transacciones reales (CSV/Excel/Fintoc) al Copiloto Financiero.
   * Deduplica por fecha+monto+descripción y actualiza la fuente y el estado.
   */
  const importarTransacciones = useCallback((nuevas = [], meta = {}) => {
    setEstado((prev) => {
      // Normaliza aceptando el modelo simple {fecha,monto,descripcion} y el
      // modelo del pipeline {date,amount,description,category,type,confidence,source}.
      const norm = (t, i) => ({
        id: t.id || `tx-${Date.now()}-${i}`,
        fecha: t.fecha || t.date || '',
        monto: Number(t.monto ?? t.amount) || 0,
        descripcion: t.descripcion || t.description || 'Movimiento',
        categoria: t.categoria || t.category || null,
        tipo: t.tipo || t.type || (Number(t.monto ?? t.amount) >= 0 ? 'ingreso' : 'egreso'),
        confianza: t.confianza ?? t.confidence ?? null,
        source: t.source || meta.fuente || null,
      });
      const clave = (t) => `${t.fecha}|${t.monto}|${(t.descripcion || '').slice(0, 40)}`;
      const existentes = new Set(prev.transacciones.map(clave));
      const agregadas = nuevas.map(norm).filter((t) => !existentes.has(clave(t)));
      const total = prev.transacciones.length + agregadas.length;
      // [OB-diag] temporal: recibidas vs agregadas vs total almacenado.
      console.info('[OB-diag] importarTransacciones — recibidas:', nuevas.length, '· nuevas:', agregadas.length, '· total almacenado:', total);
      return {
        ...prev,
        transacciones: [...prev.transacciones, ...agregadas],
        fuenteFinanciera: meta.fuente || prev.fuenteFinanciera || 'manual',
        cuentasBancarias: meta.cuentas || prev.cuentasBancarias,
        fintoc: meta.fintoc ? { ...prev.fintoc, ...meta.fintoc } : prev.fintoc,
      };
    });
  }, []);

  const setFintoc = useCallback((patch) => {
    setEstado((prev) => ({ ...prev, fintoc: { ...prev.fintoc, ...patch } }));
  }, []);

  /** Desconecta la fuente financiera y limpia los datos importados. */
  const limpiarFinanzas = useCallback(() => {
    setEstado((prev) => ({
      ...prev,
      fuenteFinanciera: null,
      transacciones: [],
      cuentasBancarias: [],
      fintoc: { conectado: false, banco: '', cuentas: 0, ultimaSync: null, linkToken: null },
    }));
  }, []);

  /**
   * Sistema de aprendizaje: cuando el fundador corrige (o confirma) la categoría
   * de una transacción, se guarda en categoryMappings (clave estable por
   * descripción) para reutilizarla en futuras importaciones SIN llamar a la IA, y
   * se re-etiquetan todas las transacciones actuales que compartan esa clave.
   * La corrección del fundador es la fuente de verdad → confianza 100.
   */
  const aprenderCategoria = useCallback((descripcion, categoria) => {
    if (!descripcion || !categoria) return;
    const clave = clavePorDescripcion(descripcion);
    if (!clave) return;
    setEstado((prev) => {
      const categoryMappings = { ...(prev.categoryMappings || {}), [clave]: categoria };
      const transacciones = prev.transacciones.map((t) =>
        clavePorDescripcion(t.descripcion) === clave
          ? { ...t, categoria, confianza: 100, source: 'fundador' }
          : t,
      );
      return { ...prev, categoryMappings, transacciones };
    });
  }, []);

  /** Guarda el último diagnóstico financiero generado por la IA. */
  const setDiagnostico = useCallback((diag) => {
    setEstado((prev) => ({ ...prev, diagnostico: diag || null }));
  }, []);

  const agregarLogro = useCallback((titulo, icono = '✨') => {
    setEstado((prev) => ({
      ...prev,
      logros: [{ id: `l-${Date.now()}`, titulo, fecha: 'Ahora', icono }, ...prev.logros].slice(0, 8),
    }));
  }, []);

  // ── Equipo ──────────────────────────────────────────────
  const asegurarOwner = useCallback((nombre, email) => {
    setEstado((prev) => {
      if (prev.miembros.some((m) => m.rol === 'Owner')) return prev;
      return {
        ...prev,
        miembros: [{ id: 'owner', nombre: nombre || 'Fundador/a', email: email || '', rol: 'Owner', estado: 'activo' }, ...prev.miembros],
      };
    });
  }, []);

  const invitarMiembro = useCallback((email, rol = 'Employee') => {
    setEstado((prev) => ({
      ...prev,
      invitaciones: [{ id: `inv-${Date.now()}`, email, rol, estado: 'pendiente' }, ...prev.invitaciones],
    }));
  }, []);

  const cancelarInvitacion = useCallback((id) => {
    setEstado((prev) => ({ ...prev, invitaciones: prev.invitaciones.filter((i) => i.id !== id) }));
  }, []);

  const eliminarMiembro = useCallback((id) => {
    setEstado((prev) => ({ ...prev, miembros: prev.miembros.filter((m) => m.id !== id || m.rol === 'Owner') }));
  }, []);

  const setNotificaciones = useCallback((activas) => {
    setEstado((prev) => ({ ...prev, notificacionesActivas: activas }));
  }, []);

  const setVoiceMode = useCallback((v) => setEstado((prev) => ({ ...prev, voiceMode: v })), []);
  const setTourVisto = useCallback((v) => setEstado((prev) => ({ ...prev, tourVisto: v })), []);
  const setMentorAsignado = useCallback((mentor) => setEstado((prev) => ({ ...prev, mentorAsignado: mentor })), []);

  /**
   * Fusiona el estado traído de la nube (Firestore) con el local. Importante:
   * NO pisa datos recién importados en este dispositivo. Las transacciones y los
   * documentos se UNEN por clave (dedup), así una carga de la nube vacía o más
   * antigua nunca borra lo que el fundador acaba de importar (bug de carrera
   * entre importar y la hidratación asíncrona).
   */
  const hidratar = useCallback((nuevo) => {
    if (!nuevo || typeof nuevo !== 'object') return;
    const unir = (a = [], b = [], clave) => {
      const mapa = new Map();
      for (const x of [...(a || []), ...(b || [])]) mapa.set(clave(x), x);
      return [...mapa.values()];
    };
    setEstado((prev) => {
      const merged = {
        ...ESTADO_INICIAL,
        ...prev,
        ...nuevo,
        perfil: { ...ESTADO_INICIAL.perfil, ...(nuevo.perfil || {}) },
      };
      merged.transacciones = unir(prev.transacciones, nuevo.transacciones, (t) => `${t.fecha}|${t.monto}|${(t.descripcion || '').slice(0, 40)}`);
      merged.documentos = unir(prev.documentos, nuevo.documentos, (d) => d.id || `${d.nombre}|${d.tipo}`);
      // Si el local ya tiene fuente financiera y la nube no, conservar la local.
      merged.fuenteFinanciera = nuevo.fuenteFinanciera || prev.fuenteFinanciera || null;
      // [OB-diag] temporal: local vs nube vs fusionado (no debe perder locales).
      console.info('[OB-diag] hidratar — local:', prev.transacciones.length, '· nube:', (nuevo.transacciones || []).length, '· fusionado:', merged.transacciones.length);
      return merged;
    });
  }, []);

  const reiniciar = useCallback(() => setEstado(ESTADO_INICIAL), []);

  const value = useMemo(
    () => ({
      ...estado,
      empresa: estado.perfil?.nombre || '',
      dimensiones,
      nivel,
      mentorDesbloqueado,
      objetivos,
      gaps,
      bonusPreparacion,
      completarRecomendacion,
      completarDemoFinanciera,
      actualizarPerfil,
      setFundadora,
      subirDocumento,
      setEstadoDocumento,
      renombrarDocumento,
      eliminarDocumento,
      alternarTarea,
      setFuenteFinanciera,
      importarTransacciones,
      aprenderCategoria,
      setDiagnostico,
      setFintoc,
      limpiarFinanzas,
      agregarLogro,
      asegurarOwner,
      invitarMiembro,
      cancelarInvitacion,
      eliminarMiembro,
      setNotificaciones,
      setVoiceMode,
      setTourVisto,
      setMentorAsignado,
      hidratar,
      estadoRaw: estado,
      reiniciar,
    }),
    [
      estado, dimensiones, nivel, mentorDesbloqueado, objetivos, gaps, bonusPreparacion,
      completarRecomendacion, completarDemoFinanciera, actualizarPerfil, setFundadora,
      subirDocumento, setEstadoDocumento, renombrarDocumento, eliminarDocumento,
      alternarTarea, setFuenteFinanciera, importarTransacciones, aprenderCategoria, setDiagnostico, setFintoc, limpiarFinanzas,
      agregarLogro, asegurarOwner, invitarMiembro,
      cancelarInvitacion, eliminarMiembro, setNotificaciones, setVoiceMode, setTourVisto,
      setMentorAsignado, hidratar, reiniciar,
    ]
  );

  return <PreparacionContext.Provider value={value}>{children}</PreparacionContext.Provider>;
}

export function usePreparacion() {
  const ctx = useContext(PreparacionContext);
  if (!ctx) throw new Error('usePreparacion debe usarse dentro de <PreparacionProvider>');
  return ctx;
}
