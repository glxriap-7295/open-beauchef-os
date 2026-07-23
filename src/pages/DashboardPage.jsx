import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Dashboard from '../components/Dashboard.jsx';
import EstadoResultado from '../components/EstadoResultado.jsx';
import FlujoCaja from '../components/FlujoCaja.jsx';
import { getMesesDerivados, transaccionesAMeses, promedios, saldoActual as calcSaldoActual, runwayMeses, tendencia } from '../utils/calculations.js';
import { analizarCobertura } from '../services/finance/coverage.js';
import { computeInsights } from '../services/finance/insightEngine.js';
import { SALDO_INICIAL } from '../data/palomaData.js';
import { probarConexion } from '../api/client.js';
import ConectarDatosModal from '../components/os/ConectarDatosModal.jsx';
import FinancialConnectGate from '../components/os/FinancialConnectGate.jsx';
import { usePreparacion } from '../context/PreparacionContext.jsx';

export default function DashboardPage() {
  const [conexion, setConexion] = useState(undefined); // undefined = cargando, true/false luego
  const [aviso, setAviso] = useState(null);
  const [vista, setVista] = useState('mensual'); // 'mensual' | 'consolidado'
  const [conectarAbierto, setConectarAbierto] = useState(false);
  const [metodoInicial, setMetodoInicial] = useState(null);
  const { fuenteFinanciera, setFuenteFinanciera, transacciones, fintoc, diagnostico } = usePreparacion();
  const esDemo = fuenteFinanciera === 'demo';

  // El dataset del Copiloto: demo (Decantopia) SOLO si el usuario lo cargó;
  // en cualquier otro caso, las transacciones reales importadas del emprendedor.
  const mesesDerivados = useMemo(
    () => (esDemo ? getMesesDerivados() : transaccionesAMeses(transacciones)),
    [esDemo, transacciones]
  );
  const saldoBase = esDemo ? SALDO_INICIAL : 0;
  const prom = useMemo(() => promedios(mesesDerivados), [mesesDerivados]);
  // Motor de cobertura: confianza según meses consecutivos de historial (datos reales).
  const cobertura = useMemo(
    () => (esDemo ? null : analizarCobertura(transacciones)),
    [esDemo, transacciones],
  );
  // Insights DETERMINISTAS (calculados por el InsightEngine sobre datos reales).
  const insights = useMemo(() => (esDemo ? [] : computeInsights(transacciones)), [esDemo, transacciones]);

  const metrics = useMemo(() => {
    const saldo = calcSaldoActual(mesesDerivados, saldoBase);
    return {
      promedioIngresos: prom.ingresos,
      promedioEbitda: prom.ebitda,
      margenPromedio: prom.margen,
      saldoActual: saldo,
      runway: runwayMeses(saldo, prom.gastosTotales),
      trendIngresos: tendencia(mesesDerivados, 'ingresos'),
    };
  }, [mesesDerivados, prom, saldoBase]);

  // El badge de conexión solo aplica al dataset de demostración (backend opcional).
  useEffect(() => {
    let activo = true;
    if (!esDemo) { setConexion(true); return () => { activo = false; }; }
    (async () => {
      const res = await probarConexion();
      if (!activo) return;
      setConexion(res.conectado);
      if (!res.conectado) setAviso('Dataset de demostración cargado localmente (backend no disponible).');
    })();
    return () => { activo = false; };
  }, [esDemo]);

  return (
    <div className="min-h-screen">
      <Navbar conexion={conexion === undefined ? undefined : conexion} />

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {!fuenteFinanciera ? (
          <FinancialConnectGate
            onConectar={(metodo) => { setMetodoInicial(metodo || 'manual'); setConectarAbierto(true); }}
            onDemo={() => setFuenteFinanciera('demo')}
          />
        ) : mesesDerivados.length === 0 ? (
          <div className="rounded-3xl border border-slate-100 bg-white p-10 text-center shadow-sm">
            <p className="text-4xl">📭</p>
            <p className="mt-3 font-bold text-slate-800">Conectado, pero aún sin movimientos</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              No encontramos transacciones en el período. Importa un archivo con movimientos o carga el dataset de ejemplo.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button onClick={() => { setMetodoInicial('manual'); setConectarAbierto(true); }} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-dark">Importar datos</button>
              <button onClick={() => setFuenteFinanciera('demo')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cargar dataset de ejemplo</button>
            </div>
          </div>
        ) : (
        <>
        {esDemo ? (
          /* Banner del dataset de demostración */
          <div className="overflow-hidden rounded-2xl border border-premium-100 bg-gradient-to-r from-premium-50 to-white p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-premium text-white text-lg animate-floaty">🤖</span>
                <div>
                  <p className="flex items-center gap-2 font-extrabold text-slate-900">
                    Dataset de demostración
                    <span className="rounded-full bg-premium px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Demo</span>
                  </p>
                  <p className="text-sm text-slate-500">
                    Esta demostración utiliza información financiera histórica. Durante el piloto, la versión
                    final obtendrá y analizará tus datos automáticamente.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button onClick={() => { setMetodoInicial(null); setConectarAbierto(true); }} className="rounded-lg bg-premium px-3 py-2 text-sm font-semibold text-white transition hover:bg-premium-dark">Conectar mis datos</button>
                <Link to="/herramientas" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700">← Centro de Herramientas</Link>
              </div>
            </div>
          </div>
        ) : (
          /* Banner de datos reales conectados */
          <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white text-lg">✓</span>
                <div>
                  <p className="font-extrabold text-slate-900">
                    {fuenteFinanciera === 'fintoc' ? 'Open Banking conectado' : 'Datos importados'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {fuenteFinanciera === 'fintoc'
                      ? `${fintoc.banco || 'Banco'} · ${fintoc.cuentas || 0} cuenta(s)${fintoc.ultimaSync ? ` · última sync ${new Date(fintoc.ultimaSync).toLocaleDateString('es-CL')}` : ''}`
                      : `Carga manual · ${transacciones.length} movimiento(s) · ${mesesDerivados.length} mes(es)`}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button onClick={() => { setMetodoInicial(fuenteFinanciera === 'fintoc' ? 'fintoc' : 'manual'); setConectarAbierto(true); }} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700">
                  {fuenteFinanciera === 'fintoc' ? 'Sincronizar' : 'Importar más'}
                </button>
                <Link to="/herramientas" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700">← Centro de Herramientas</Link>
              </div>
            </div>
          </div>
        )}

        {!esDemo && cobertura && !cobertura.suficiente && cobertura.meses > 0 && (
          <div className="overflow-hidden rounded-2xl border border-amber-100 bg-amber-50/70 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400 text-white text-lg">📅</span>
              <div>
                <p className="flex items-center gap-2 font-extrabold text-slate-900">
                  Historial financiero incompleto
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                    Confianza {cobertura.nivelConfianza}
                  </span>
                </p>
                <p className="mt-1 text-sm text-slate-600">{cobertura.mensaje}</p>
              </div>
            </div>
          </div>
        )}

        {!esDemo && diagnostico?.texto && (
          <div className="overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50/60 to-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white text-lg">🧠</span>
              <div>
                <p className="flex items-center gap-2 font-extrabold text-slate-900">
                  Diagnóstico del Copiloto
                  {diagnostico.fecha && (
                    <span className="text-xs font-medium text-slate-400">
                      {new Date(diagnostico.fecha).toLocaleDateString('es-CL')}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-slate-600">{diagnostico.texto}</p>
              </div>
            </div>
          </div>
        )}

        {!esDemo && insights.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-bold text-slate-700">Insights</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {insights.slice(0, 4).map((ins) => {
                const estilo = ins.severity === 'critical'
                  ? 'border-rose-200 bg-rose-50/60'
                  : ins.severity === 'warning'
                    ? 'border-amber-200 bg-amber-50/60'
                    : 'border-slate-200 bg-white';
                const icono = ins.severity === 'critical' ? '🔴' : ins.severity === 'warning' ? '🟠' : '💡';
                return (
                  <div key={ins.id} className={`rounded-2xl border p-4 ${estilo}`}>
                    <p className="flex items-center gap-2 text-sm font-bold text-slate-800"><span>{icono}</span>{ins.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{ins.explanation}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-400">Cifras calculadas por el motor contable; la IA solo las explica.</p>
          </div>
        )}

        <Dashboard metrics={metrics} mesesDerivados={mesesDerivados} />

        <EstadoResultado mesesDerivados={mesesDerivados} vista={vista} onVistaChange={setVista} />

        <FlujoCaja
          mesesDerivados={mesesDerivados}
          saldoActual={metrics.saldoActual}
          ingresoMensual={prom.ingresos}
          gastoMensual={prom.gastosTotales}
          saldoInicial={saldoBase}
        />
        </>
        )}
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-400">
        Copiloto Financiero · Dataset de demostración · datos históricos jun–nov 2025
      </footer>

      {conectarAbierto && (
        <ConectarDatosModal
          metodoInicial={metodoInicial}
          onClose={() => { setConectarAbierto(false); setMetodoInicial(null); }}
        />
      )}
    </div>
  );
}
