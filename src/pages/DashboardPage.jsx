import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Dashboard from '../components/Dashboard.jsx';
import EstadoResultado from '../components/EstadoResultado.jsx';
import FlujoCaja from '../components/FlujoCaja.jsx';
import { getMesesDerivados, promedios, saldoActual as calcSaldoActual, runwayMeses, tendencia } from '../utils/calculations.js';
import { SALDO_INICIAL } from '../data/palomaData.js';
import { probarConexion, getRunway, getCashFlow } from '../api/client.js';
import ConectarDatosModal from '../components/os/ConectarDatosModal.jsx';
import { usePreparacion } from '../context/PreparacionContext.jsx';

export default function DashboardPage() {
  const [conexion, setConexion] = useState(undefined); // undefined = cargando, true/false luego
  const [aviso, setAviso] = useState(null);
  const [vista, setVista] = useState('mensual'); // 'mensual' | 'consolidado'
  const [conectarAbierto, setConectarAbierto] = useState(false);
  const { fuenteFinanciera } = usePreparacion();

  // Datos canónicos (cifras reales de Paloma). Siempre disponibles.
  const mesesDerivados = useMemo(() => getMesesDerivados(), []);
  const prom = useMemo(() => promedios(mesesDerivados), [mesesDerivados]);

  // Métricas base calculadas localmente.
  const [metrics, setMetrics] = useState(() => {
    const saldo = calcSaldoActual(mesesDerivados, SALDO_INICIAL);
    return {
      promedioIngresos: prom.ingresos,
      promedioEbitda: prom.ebitda,
      margenPromedio: prom.margen,
      saldoActual: saldo,
      runway: runwayMeses(saldo, prom.gastosTotales),
      trendIngresos: tendencia(mesesDerivados, 'ingresos'),
    };
  });

  useEffect(() => {
    let activo = true;

    (async () => {
      const res = await probarConexion();
      if (!activo) return;

      if (!res.conectado) {
        setConexion(false);
        setAviso('No se pudo conectar al backend (' + (res.error || 'sin respuesta') + '). Mostrando datos demo de Paloma.');
        return;
      }

      setConexion(true);

      // Overlay con datos en vivo cuando estén disponibles (no rompe si fallan).
      try {
        const [cf, rw] = await Promise.allSettled([getCashFlow(), getRunway()]);
        if (!activo) return;

        setMetrics((prev) => {
          const next = { ...prev };
          if (cf.status === 'fulfilled' && cf.value?.saldoFinal != null) {
            next.saldoActual = Number(cf.value.saldoFinal);
          }
          if (rw.status === 'fulfilled') {
            const r = rw.value;
            if (r?.runway_infinito || r?.runway_dias == null) next.runway = Infinity;
            else next.runway = Number(r.runway_dias) / 30; // días → meses
          }
          return next;
        });
      } catch {
        /* mantiene métricas locales */
      }
    })();

    return () => {
      activo = false;
    };
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar conexion={conexion === undefined ? undefined : conexion} />

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* Banner premium VERSIÓN DEMO (no altera el motor financiero) */}
        <div className="overflow-hidden rounded-2xl border border-premium-100 bg-gradient-to-r from-premium-50 to-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-premium text-white text-lg animate-floaty">🤖</span>
              <div>
                <p className="flex items-center gap-2 font-extrabold text-slate-900">
                  Versión Demo
                  <span className="rounded-full bg-premium px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Beta</span>
                </p>
                <p className="text-sm text-slate-500">
                  Los resultados fueron calculados utilizando cartolas bancarias históricas. En la versión final
                  este proceso será completamente automático.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                onClick={() => setConectarAbierto(true)}
                className="rounded-lg bg-premium px-3 py-2 text-sm font-semibold text-white transition hover:bg-premium-dark"
              >
                {fuenteFinanciera ? '✓ Datos conectados' : 'Conectar datos'}
              </button>
              <Link to="/copiloto/futuro" className="rounded-lg border border-premium-100 bg-white px-3 py-2 text-sm font-semibold text-premium transition hover:bg-premium-50">
                Ver versión futura
              </Link>
              <Link to="/herramientas" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700">
                ← Centro de Herramientas
              </Link>
            </div>
          </div>
        </div>

        {conexion === undefined && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
            Conectando con el backend…
          </div>
        )}


        <Dashboard metrics={metrics} mesesDerivados={mesesDerivados} />

        <EstadoResultado mesesDerivados={mesesDerivados} vista={vista} onVistaChange={setVista} />

        <FlujoCaja
          mesesDerivados={mesesDerivados}
          saldoActual={metrics.saldoActual}
          ingresoMensual={prom.ingresos}
          gastoMensual={prom.gastosTotales}
          saldoInicial={SALDO_INICIAL}
        />
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-400">
        Financial Copilot · Paloma (Decantopia) · Datos jun–nov 2025
      </footer>

      {conectarAbierto && <ConectarDatosModal onClose={() => setConectarAbierto(false)} />}
    </div>
  );
}
