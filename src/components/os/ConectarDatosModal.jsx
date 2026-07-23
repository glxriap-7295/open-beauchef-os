import { useEffect, useMemo, useRef, useState } from 'react';
import ToolModal from './ToolModal.jsx';
import { banking } from '../../services/banking/index.js';
import { notifications, NotificationEvents } from '../../services/notifications/index.js';
import { usePreparacion } from '../../context/PreparacionContext.jsx';
import { formatCLP } from '../../utils/formatters.js';
import { analizarArchivo, UMBRAL_CONFIANZA } from '../../services/finance/importPipeline.js';
import { generarDiagnostico } from '../../services/finance/diagnosis.js';
import { CATEGORY_REGISTRY, categoryName } from '../../services/finance/categorize.js';

// Pasos del procesamiento del archivo (el pipeline llama onPaso con estas claves).
const PASOS = [
  ['detectando', 'Analizando el archivo…'],
  ['ocr', 'Reconociendo texto (OCR)'],
  ['leyendo', 'Leyendo transacciones'],
  ['entendiendo', 'Entendiendo tu negocio'],
  ['categorizando', 'Categorizando movimientos'],
  ['resumen', 'Preparando revisión'],
];

const ETIQUETA_FUENTE = { manual: 'Carga manual', fintoc: 'Open Banking', demo: 'Demo', legacy: 'Datos previos' };

export default function ConectarDatosModal({ onClose, metodoInicial = null }) {
  const {
    agregarLogro, importarTransacciones, notificacionesActivas, notifCategorias,
    categoryMappings, aprenderCategoria, setDiagnostico, registrarImportacion,
    transacciones, aprobarImportacion, eliminarImportacion, importSessions,
  } = usePreparacion();
  const [metodo, setMetodo] = useState(metodoInicial === 'fintoc' ? 'fintoc' : (metodoInicial ? 'manual' : null));
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [paso, setPaso] = useState(null);
  const [analisis, setAnalisis] = useState(null);   // DRAFT en memoria (no afecta cuentas hasta aprobar)
  const [verDuplicados, setVerDuplicados] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(null); // importId a eliminar
  const fileRef = useRef(null);
  const autoRef = useRef(false);

  const fintocOk = banking.openBankingDisponible();
  const avisar = (evento) => { if (notificacionesActivas) notifications.emitir(evento, { categorias: notifCategorias }); };

  // Totales EN VIVO del borrador (se actualizan al editar/borrar filas).
  const draft = analisis?.movimientos || [];
  const totales = useMemo(() => {
    const ingresos = draft.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0);
    const egresos = draft.filter((m) => m.amount < 0).reduce((s, m) => s + Math.abs(m.amount), 0);
    const revisar = draft.filter((m) => m.confidence < UMBRAL_CONFIANZA || m.suspicious).length;
    return { count: draft.length, ingresos, egresos, revisar };
  }, [draft]);

  const conectarFintoc = async () => {
    setError(''); setCargando(true);
    try {
      const { banco, cuentas, movimientos, ultimaSync, linkToken } = await banking.fintoc.conectarYSincronizar();
      importarTransacciones(movimientos, {
        fuente: 'fintoc',
        fintoc: { conectado: true, banco, cuentas: Array.isArray(cuentas) ? cuentas.length : (cuentas || 0), ultimaSync, linkToken },
      });
      setResultado({ tipo: 'fintoc', banco, cuentas: Array.isArray(cuentas) ? cuentas.length : (cuentas || 0), movimientos: movimientos.length });
      avisar(NotificationEvents.analisisCompleto(`Sincronización de ${banco || 'tu banco'}`));
      agregarLogro('Cuenta bancaria conectada (Open Banking)', '🏦');
    } catch (e) {
      setError(`${e.message || 'No se pudo conectar con Fintoc.'} Puedes usar Carga Manual mientras tanto.`);
      setMetodo('manual');
    } finally { setCargando(false); }
  };

  // Carga Manual → analiza el archivo y produce un BORRADOR para revisar.
  const onArchivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setAnalisis(null); setVerDuplicados(false); setCargando(true); setPaso('detectando');
    try {
      const res = await analizarArchivo(file, { mappings: categoryMappings || {}, existentes: transacciones || [], onPaso: (p) => setPaso(p) });
      if (res.error) { setError(res.error); avisar(NotificationEvents.errorProcesamiento(res.error)); }
      else setAnalisis({ ...res, nombre: file.name });
    } catch (err) {
      const msg = 'No pudimos leer el archivo. Sube un CSV / Excel válido o un PDF con texto.';
      setError(msg); console.error('[Import] Falla al analizar el archivo:', err?.message || err);
      avisar(NotificationEvents.errorProcesamiento(msg));
    } finally { setCargando(false); setPaso(null); e.target.value = ''; }
  };

  // ── Edición del borrador (en memoria; nada toca las cuentas todavía) ──
  const editarFila = (id, categoryId) => {
    if (!categoryId) return;
    setAnalisis((prev) => {
      if (!prev) return prev;
      const movimientos = prev.movimientos.map((m) => (m.id === id
        ? { ...m, categoryId, category: categoryName(categoryId), confidence: 100, source: 'user' }
        : m));
      return { ...prev, movimientos };
    });
  };
  const borrarFila = (id) => setAnalisis((prev) => (prev ? { ...prev, movimientos: prev.movimientos.filter((m) => m.id !== id) } : prev));

  // ── APROBAR: recién aquí impacta cuentas, dashboard, KPIs e insights ──
  const aprobar = async () => {
    if (!analisis || !draft.length) return;
    setCargando(true);
    try {
      const movs = analisis.movimientos;
      const importId = aprobarImportacion(movs, {
        filename: analisis.nombre, fuente: 'manual',
        institution: analisis.institucion, period: analisis.periodo, fileType: analisis.tipo,
        docHash: analisis.historial?.hash || null,
        counts: { parsed: analisis.totalExtraidas || movs.length, imported: movs.length, duplicates: analisis.duplicados?.length || 0, review: totales.revisar },
      });
      // Las correcciones del fundador alimentan la memoria (por ID estable).
      for (const m of movs) if (m.source === 'user' && m.categoryId) aprenderCategoria(m.description, m.categoryId);
      if (analisis.historial) registrarImportacion(analisis.historial);
      // Insights SOLO después de aprobar.
      const diag = await generarDiagnostico(movs, { negocio: analisis.negocio });
      setDiagnostico({ texto: diag.texto, fecha: new Date().toISOString(), stats: diag.stats });

      avisar(NotificationEvents.importacionCompleta(movs.length, analisis.institucion));
      if (totales.revisar) avisar(NotificationEvents.transaccionesPorRevisar(totales.revisar));
      avisar(NotificationEvents.nuevoDiagnostico());
      agregarLogro('Importación revisada y aprobada', '📄');

      setResultado({ tipo: 'manual', nombre: analisis.nombre, institucion: analisis.institucion, total: movs.length, ingresos: totales.ingresos, egresos: totales.egresos, diagnostico: diag.texto, importId });
      setAnalisis(null);
    } catch {
      setError('Aprobamos la importación, pero no pudimos generar el diagnóstico. Puedes verlo luego en el Copiloto.');
    } finally { setCargando(false); }
  };

  useEffect(() => {
    if (autoRef.current) return;
    if (metodoInicial === 'fintoc' && fintocOk) { autoRef.current = true; conectarFintoc(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pasoActivoIdx = PASOS.findIndex(([k]) => k === paso);
  const enChooser = !resultado && !analisis && !cargando;
  const sesiones = (importSessions || []).filter((s) => (s.counts?.imported || 0) > 0 || s.importId !== 'imp-legacy');

  return (
    <ToolModal
      icon="🔌"
      titulo="Importar movimientos"
      subtitulo="Revisa cada importación antes de aprobarla. Nada afecta tus reportes hasta que apruebas."
      onClose={onClose}
    >
      {enChooser && (
        <div className="grid gap-4 sm:grid-cols-2">
          <button onClick={() => setMetodo('fintoc')} className={`rounded-2xl border p-5 text-left transition duration-[180ms] hover:-translate-y-0.5 hover:shadow-md ${metodo === 'fintoc' ? 'border-brand bg-brand-50/40' : 'border-slate-200 bg-white'}`}>
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-xl">🏦</span>
            <p className="mt-3 font-bold text-slate-800">Open Banking</p>
            <p className="mt-1 text-sm text-slate-500">Sincroniza tus movimientos automáticamente con Fintoc.</p>
            <span className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${fintocOk ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'}`}>{fintocOk ? 'Disponible' : 'Requiere configuración'}</span>
          </button>
          <button onClick={() => setMetodo('manual')} className={`rounded-2xl border p-5 text-left transition duration-[180ms] hover:-translate-y-0.5 hover:shadow-md ${metodo === 'manual' ? 'border-brand bg-brand-50/40' : 'border-slate-200 bg-white'}`}>
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-xl">📄</span>
            <p className="mt-3 font-bold text-slate-800">Carga Manual</p>
            <p className="mt-1 text-sm text-slate-500">Sube tu cartola en CSV, Excel o PDF. La revisas antes de importar.</p>
            <span className="mt-3 inline-block rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">Siempre disponible</span>
          </button>
        </div>
      )}

      {/* Fintoc */}
      {metodo === 'fintoc' && enChooser && (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          {fintocOk ? (
            <button onClick={conectarFintoc} disabled={cargando} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark">{cargando ? 'Conectando…' : 'Conectar con Fintoc'}</button>
          ) : (
            <p className="text-sm text-slate-600">🔒 Open Banking aún no está configurado en este entorno ({banking.fintoc.motivoNoDisponible()}). Puedes usar <b>Carga Manual</b> y todo funciona igual.</p>
          )}
        </div>
      )}

      {/* Selector de archivo */}
      {metodo === 'manual' && enChooser && (
        <div className="mt-5 rounded-2xl border border-dashed border-brand-100 bg-brand-50/40 p-5 text-center">
          <p className="text-sm text-slate-600">Sube tu cartola en CSV, Excel o PDF con texto. Detectamos el banco y las columnas automáticamente.</p>
          <button onClick={() => fileRef.current?.click()} disabled={cargando} className="mt-3 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark">Seleccionar archivo</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv,.xlsx,.xls,.txt,.pdf" className="hidden" onChange={onArchivo} />
        </div>
      )}

      {/* Historial de importaciones (con eliminar) */}
      {enChooser && sesiones.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-bold text-slate-800">Importaciones anteriores</p>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100">
            {sesiones.map((s) => (
              <div key={s.importId} className="flex flex-wrap items-center justify-between gap-3 bg-white p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{s.filename}</p>
                  <p className="text-xs text-slate-500">
                    {ETIQUETA_FUENTE[s.source] || s.source} · {s.approvedAt ? new Date(s.approvedAt).toLocaleDateString('es-CL') : '—'} · {s.counts?.imported ?? s.summary?.transactions ?? 0} mov.
                  </p>
                  <p className="text-xs text-slate-400">Ingresos {formatCLP(s.summary?.income || 0)} · Egresos {formatCLP(s.summary?.expenses || 0)}</p>
                </div>
                {confirmarBorrado === s.importId ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">¿Eliminar esta importación?</span>
                    <button onClick={() => { eliminarImportacion(s.importId); setConfirmarBorrado(null); }} className="rounded-lg bg-rose-600 px-2.5 py-1 font-semibold text-white">Sí, eliminar</button>
                    <button onClick={() => setConfirmarBorrado(null)} className="rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-600">No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmarBorrado(s.importId)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50">Eliminar</button>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">Eliminar una importación quita solo sus transacciones; el resto de tus reportes no cambia.</p>
        </div>
      )}

      {/* Procesamiento */}
      {cargando && metodo === 'manual' && !analisis && (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-5">
          <p className="font-bold text-slate-800">Procesando…</p>
          <ul className="mt-3 space-y-2">
            {PASOS.map(([clave, texto], i) => {
              const hecho = pasoActivoIdx > i; const activo = pasoActivoIdx === i;
              return (
                <li key={clave} className={`flex items-center gap-2 text-sm ${hecho ? 'text-emerald-600' : activo ? 'text-slate-800' : 'text-slate-400'}`}>
                  <span className="w-5 text-center">{hecho ? '✓' : activo ? '⏳' : '•'}</span>
                  <span className={activo ? 'font-semibold' : ''}>{texto}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── BORRADOR DE REVISIÓN (estilo contable) ── */}
      {analisis && !resultado && (
        <div className="mt-5 space-y-4">
          {/* Encabezado: qué se importó */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold text-slate-800">{analisis.nombre}</p>
                <p className="text-xs text-slate-500">
                  {analisis.institucion} · {analisis.negocio?.modelo || 'Negocio general'}
                  {analisis.periodo ? ` · ${analisis.periodo.desde} → ${analisis.periodo.hasta}` : ''}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">Borrador · sin aprobar</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-xl bg-slate-50 p-2"><p className="text-xs text-slate-500">A importar</p><p className="font-bold text-slate-800">{totales.count}</p></div>
              <div className="rounded-xl bg-emerald-50 p-2"><p className="text-xs text-slate-500">Ingresos</p><p className="font-bold text-emerald-600">{formatCLP(totales.ingresos)}</p></div>
              <div className="rounded-xl bg-rose-50 p-2"><p className="text-xs text-slate-500">Egresos</p><p className="font-bold text-rose-500">{formatCLP(totales.egresos)}</p></div>
            </div>
          </div>

          {/* Qué necesita atención */}
          {totales.revisar > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-800">
              <b>{totales.revisar}</b> movimiento(s) necesitan tu atención (baja confianza). Están resaltados abajo — revisa la categoría antes de aprobar.
            </div>
          )}

          {/* Duplicados: qué se omite */}
          {analisis.duplicados?.length > 0 && (
            <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-2">
                <span>Se omitirán <b>{analisis.duplicados.length}</b> movimiento(s) que ya existen (duplicados).</span>
                <button onClick={() => setVerDuplicados((v) => !v)} className="shrink-0 text-xs font-semibold text-sky-700 underline">{verDuplicados ? 'Ocultar' : 'Ver'}</button>
              </div>
              {verDuplicados && (
                <ul className="mt-2 space-y-1">
                  {analisis.duplicados.map((d) => (
                    <li key={d.id} className="flex items-center justify-between rounded-lg bg-white/70 px-2 py-1 text-xs text-slate-500">
                      <span className="truncate">{d.date} · {d.description}</span>
                      <span className="shrink-0">{formatCLP(d.amount)} · ya existe</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Tabla de transacciones a importar */}
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="hidden grid-cols-[1fr,7rem,10rem,2rem] gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 sm:grid">
              <span>Descripción</span><span className="text-right">Monto</span><span>Categoría</span><span />
            </div>
            <div className="max-h-[22rem] divide-y divide-slate-100 overflow-y-auto">
              {draft.map((m) => {
                const low = m.confidence < UMBRAL_CONFIANZA || m.suspicious;
                const editado = m.source === 'user';
                return (
                  <div key={m.id} className={`grid grid-cols-1 items-center gap-2 px-3 py-2 sm:grid-cols-[1fr,7rem,10rem,2rem] ${low ? 'border-l-4 border-amber-400 bg-amber-50/40' : 'bg-white'}`}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{m.description}</p>
                      <p className="text-xs text-slate-400">
                        {m.date}
                        {m.original?.merchant ? ` · ${m.original.merchant}` : ''}
                        {low && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700">baja confianza</span>}
                        {editado && <span className="ml-1 rounded bg-brand-50 px-1 text-[10px] font-semibold text-brand">editado</span>}
                      </p>
                    </div>
                    <p className={`text-right text-sm font-semibold sm:text-right ${m.amount >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{formatCLP(m.amount)}</p>
                    <select value={m.categoryId || ''} onChange={(e) => editarFila(m.id, e.target.value)} className={`rounded-lg border bg-white px-2 py-1.5 text-sm ${low ? 'border-amber-300' : 'border-slate-200'}`}>
                      <option value="" disabled>Categoría…</option>
                      {CATEGORY_REGISTRY.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button onClick={() => borrarFila(m.id)} title="Eliminar transacción" className="justify-self-end text-slate-300 transition hover:text-rose-500">🗑</button>
                  </div>
                );
              })}
              {draft.length === 0 && <p className="p-4 text-center text-sm text-slate-500">No quedan movimientos por importar.</p>}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={aprobar} disabled={cargando || draft.length === 0} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-50">
              {cargando ? 'Aprobando…' : draft.length === 0 ? 'Nada para aprobar' : `Aprobar e importar ${draft.length}`}
            </button>
            <button onClick={() => setAnalisis(null)} disabled={cargando} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50">Descartar</button>
            <span className="text-xs text-slate-400">Hasta que apruebes, tus reportes no cambian.</span>
          </div>
        </div>
      )}

      {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{error}</p>}

      {/* Resultado */}
      {resultado && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
          <p className="flex items-center gap-2 font-bold text-slate-800">✅ Importación aprobada</p>
          {resultado.tipo === 'manual' ? (
            <>
              <div className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><p className="text-slate-500">Institución</p><p className="font-bold text-slate-800">{resultado.institucion || '—'}</p></div>
                <div><p className="text-slate-500">Movimientos</p><p className="font-bold text-slate-800">{resultado.total}</p></div>
                <div><p className="text-slate-500">Ingresos</p><p className="font-bold text-emerald-600">{formatCLP(resultado.ingresos)}</p></div>
                <div><p className="text-slate-500">Egresos</p><p className="font-bold text-rose-500">{formatCLP(resultado.egresos)}</p></div>
              </div>
              {resultado.diagnostico && (
                <div className="mt-3 rounded-xl bg-white p-3 text-sm text-slate-700 ring-1 ring-slate-200">
                  <p className="mb-1 font-semibold text-slate-800">🧠 Diagnóstico del Copiloto</p>{resultado.diagnostico}
                </div>
              )}
            </>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div><p className="text-slate-500">Banco</p><p className="font-bold text-slate-800">{resultado.banco || '—'}</p></div>
              <div><p className="text-slate-500">Cuentas</p><p className="font-bold text-slate-800">{resultado.cuentas}</p></div>
              <div><p className="text-slate-500">Movimientos</p><p className="font-bold text-slate-800">{resultado.movimientos}</p></div>
            </div>
          )}
          <button onClick={onClose} className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700">Ir al Copiloto Financiero</button>
        </div>
      )}
    </ToolModal>
  );
}
