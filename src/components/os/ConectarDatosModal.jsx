import { useEffect, useRef, useState } from 'react';
import ToolModal from './ToolModal.jsx';
import { banking } from '../../services/banking/index.js';
import { notifications, NotificationEvents } from '../../services/notifications/index.js';
import { usePreparacion } from '../../context/PreparacionContext.jsx';
import { formatCLP } from '../../utils/formatters.js';
import { analizarArchivo, UMBRAL_CONFIANZA } from '../../services/finance/importPipeline.js';
import { generarDiagnostico } from '../../services/finance/diagnosis.js';
import { CATEGORIAS } from '../../services/finance/categorizer.js';

// Pasos de procesamiento IA (Parte 16). El pipeline llama onPaso con estas claves.
const PASOS = [
  ['detectando', 'Analizando el archivo…'],
  ['leyendo', 'Leyendo transacciones'],
  ['entendiendo', 'Entendiendo tu negocio'],
  ['categorizando', 'Categorizando movimientos'],
  ['resumen', 'Preparando resumen'],
];

export default function ConectarDatosModal({ onClose, metodoInicial = null }) {
  const {
    agregarLogro, importarTransacciones, notificacionesActivas,
    categoryMappings, aprenderCategoria, setDiagnostico,
  } = usePreparacion();
  const [metodo, setMetodo] = useState(metodoInicial === 'fintoc' ? 'fintoc' : (metodoInicial ? 'manual' : null));
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [paso, setPaso] = useState(null);        // clave del paso IA actual
  const [analisis, setAnalisis] = useState(null); // resumen pre-importación
  const fileRef = useRef(null);
  const autoRef = useRef(false);

  const fintocOk = banking.openBankingDisponible();

  const avisar = (evento) => { if (notificacionesActivas) notifications.emitir(evento); };

  const conectarFintoc = async () => {
    setError('');
    setCargando(true);
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
      // Fallback elegante: si Fintoc falla, ofrecemos Carga Manual.
      setError(`${e.message || 'No se pudo conectar con Fintoc.'} Puedes usar Carga Manual mientras tanto.`);
      setMetodo('manual');
    } finally {
      setCargando(false);
    }
  };

  // Carga Manual → pipeline AI-first: extrae, entiende el negocio, categoriza y
  // produce un RESUMEN para aprobar ANTES de importar (Parte 11).
  const onArchivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setAnalisis(null);
    setCargando(true);
    setPaso('detectando');
    try {
      const res = await analizarArchivo(file, {
        mappings: categoryMappings || {},
        onPaso: (p) => setPaso(p),
      });
      if (res.error) {
        setError(res.error);
      } else {
        setAnalisis({ ...res, nombre: file.name });
      }
    } catch {
      setError('No pudimos leer el archivo. Sube un CSV / Excel válido o un PDF con texto.');
    } finally {
      setCargando(false);
      setPaso(null);
      e.target.value = '';
    }
  };

  // El fundador aprobó el resumen → importar, aprender revisiones y diagnosticar.
  const confirmarImportacion = async () => {
    if (!analisis) return;
    setCargando(true);
    try {
      const movs = analisis.movimientos;
      importarTransacciones(movs, { fuente: 'manual' });
      // Las categorías confirmadas en la revisión alimentan la memoria (aprende para siempre).
      for (const m of movs) {
        if (m.source === 'fundador' && m.category) aprenderCategoria(m.description, m.category);
      }
      const diag = await generarDiagnostico(movs, { negocio: analisis.negocio });
      setDiagnostico({ texto: diag.texto, fecha: new Date().toISOString(), stats: diag.stats });

      avisar(NotificationEvents.importacionCompleta(movs.length, analisis.institucion));
      if (analisis.revisar.length) avisar(NotificationEvents.transaccionesPorRevisar(analisis.revisar.length));
      avisar(NotificationEvents.nuevoDiagnostico());
      agregarLogro('Cartola importada y diagnosticada por la IA', '📄');

      setResultado({
        tipo: 'manual', nombre: analisis.nombre, institucion: analisis.institucion,
        total: analisis.total, ingresos: analisis.ingresos, egresos: analisis.egresos,
        revisar: analisis.revisar.length, diagnostico: diag.texto,
      });
      setAnalisis(null);
    } catch {
      setError('Importamos los movimientos, pero no pudimos generar el diagnóstico. Puedes verlo luego en el Copiloto.');
    } finally {
      setCargando(false);
    }
  };

  // Corrección/confirmación de una transacción incierta en la revisión.
  const corregirRevision = (id, category) => {
    setAnalisis((prev) => {
      if (!prev) return prev;
      const movimientos = prev.movimientos.map((m) =>
        m.id === id ? { ...m, category, confidence: 100, source: 'fundador' } : m,
      );
      const revisar = prev.revisar
        .map((m) => (m.id === id ? { ...m, category, confidence: 100, source: 'fundador' } : m))
        .filter((m) => m.source !== 'fundador');
      return { ...prev, movimientos, revisar };
    });
  };

  // Lanzamiento directo: si se abrió eligiendo "Conectar con Fintoc", abre el
  // widget de inmediato (sin pedir de nuevo el método). Solo una vez.
  useEffect(() => {
    if (autoRef.current) return;
    if (metodoInicial === 'fintoc' && fintocOk) {
      autoRef.current = true;
      conectarFintoc();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pasoActivoIdx = PASOS.findIndex(([k]) => k === paso);

  return (
    <ToolModal
      icon="🔌"
      titulo="Conectar tus datos financieros"
      subtitulo="Elige cómo alimentar al Copiloto Financiero. Puedes cambiar de método cuando quieras."
      onClose={onClose}
    >
      {!resultado && !analisis && !cargando && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Open Banking */}
          <button
            onClick={() => setMetodo('fintoc')}
            className={`rounded-2xl border p-5 text-left transition duration-[180ms] hover:-translate-y-0.5 hover:shadow-md ${
              metodo === 'fintoc' ? 'border-brand bg-brand-50/40' : 'border-slate-200 bg-white'
            }`}
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-xl">🏦</span>
            <p className="mt-3 font-bold text-slate-800">Open Banking</p>
            <p className="mt-1 text-sm text-slate-500">Sincroniza tus movimientos automáticamente con Fintoc.</p>
            <span className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${fintocOk ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'}`}>
              {fintocOk ? 'Disponible' : 'Requiere configuración'}
            </span>
          </button>

          {/* Manual */}
          <button
            onClick={() => setMetodo('manual')}
            className={`rounded-2xl border p-5 text-left transition duration-[180ms] hover:-translate-y-0.5 hover:shadow-md ${
              metodo === 'manual' ? 'border-brand bg-brand-50/40' : 'border-slate-200 bg-white'
            }`}
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-xl">📄</span>
            <p className="mt-3 font-bold text-slate-800">Carga Manual</p>
            <p className="mt-1 text-sm text-slate-500">Sube tu cartola en CSV, Excel o PDF. La IA la entiende sola.</p>
            <span className="mt-3 inline-block rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">Siempre disponible</span>
          </button>
        </div>
      )}

      {/* Panel Fintoc */}
      {metodo === 'fintoc' && !resultado && !analisis && !cargando && (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          {fintocOk ? (
            <button
              onClick={conectarFintoc}
              disabled={cargando}
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark"
            >
              {cargando ? 'Conectando…' : 'Conectar con Fintoc'}
            </button>
          ) : (
            <p className="text-sm text-slate-600">
              🔒 Open Banking aún no está configurado en este entorno ({banking.fintoc.motivoNoDisponible()}).
              No te preocupes: puedes usar <b>Carga Manual</b> y todo funciona igual.
            </p>
          )}
        </div>
      )}

      {/* Panel Manual: selector de archivo */}
      {metodo === 'manual' && !resultado && !analisis && !cargando && (
        <div className="mt-5 rounded-2xl border border-dashed border-brand-100 bg-brand-50/40 p-5 text-center">
          <p className="text-sm text-slate-600">Sube tu cartola en CSV, Excel o PDF con texto. Detectamos el banco y las columnas automáticamente.</p>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={cargando}
            className="mt-3 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark"
          >
            Seleccionar archivo
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv,.xlsx,.xls,.txt,.pdf" className="hidden" onChange={onArchivo} />
        </div>
      )}

      {/* Experiencia de procesamiento IA (Parte 16) */}
      {cargando && metodo === 'manual' && (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-5">
          <p className="font-bold text-slate-800">Procesando con IA…</p>
          <ul className="mt-3 space-y-2">
            {PASOS.map(([clave, texto], i) => {
              const hecho = pasoActivoIdx > i;
              const activo = pasoActivoIdx === i;
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

      {/* Resumen pre-importación (Parte 11) + revisión (Parte 10) */}
      {analisis && !resultado && (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-5">
            <p className="font-bold text-slate-800">Revisa antes de importar</p>
            <p className="mt-1 text-sm text-slate-500">
              {analisis.institucion} · {analisis.negocio?.modelo || 'Negocio general'}
              {analisis.periodo ? ` · ${analisis.periodo.desde} → ${analisis.periodo.hasta}` : ''}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><p className="text-slate-500">Movimientos</p><p className="font-bold text-slate-800">{analisis.total}</p></div>
              <div><p className="text-slate-500">Ingresos</p><p className="font-bold text-emerald-600">{formatCLP(analisis.ingresos)}</p></div>
              <div><p className="text-slate-500">Egresos</p><p className="font-bold text-rose-500">{formatCLP(analisis.egresos)}</p></div>
              <div><p className="text-slate-500">Confianza prom.</p><p className="font-bold text-slate-800">{analisis.confianzaPromedio}%</p></div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(analisis.porCategoria).sort((a, b) => b[1] - a[1]).map(([cat, n]) => (
                <span key={cat} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                  {cat} · {n}
                </span>
              ))}
            </div>
          </div>

          {/* Revisión de transacciones inciertas: "Necesitamos tu ayuda" */}
          {analisis.revisar.length > 0 && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5">
              <p className="font-bold text-slate-800">🙋 Necesitamos tu ayuda ({analisis.revisar.length})</p>
              <p className="mt-1 text-sm text-slate-500">
                No pudimos clasificar estos movimientos con certeza. Elige la categoría correcta: la IA lo aprenderá para siempre.
              </p>
              <div className="mt-3 space-y-2">
                {analisis.revisar.map((m) => (
                  <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 ring-1 ring-slate-200">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{m.description}</p>
                      <p className="text-xs text-slate-500">{m.date} · {formatCLP(m.amount)}</p>
                    </div>
                    <select
                      defaultValue=""
                      onChange={(e) => e.target.value && corregirRevision(m.id, e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                    >
                      <option value="" disabled>Categoría…</option>
                      {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={confirmarImportacion}
              disabled={cargando}
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark"
            >
              {cargando ? 'Importando…' : `Importar ${analisis.total} movimientos`}
            </button>
            <button
              onClick={() => setAnalisis(null)}
              disabled={cargando}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{error}</p>}

      {/* Resultado final */}
      {resultado && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
          <p className="flex items-center gap-2 font-bold text-slate-800">✅ Datos conectados</p>
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
                  <p className="mb-1 font-semibold text-slate-800">🧠 Diagnóstico del Copiloto</p>
                  {resultado.diagnostico}
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
          <button
            onClick={onClose}
            className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700"
          >
            Ir al Copiloto Financiero
          </button>
        </div>
      )}
    </ToolModal>
  );
}
