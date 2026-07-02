import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { formatCLP, formatCompactCLP, formatMeses } from '../utils/formatters.js';
import { flujoCajaHistorico, proyectarEscenario } from '../utils/calculations.js';

const ESCENARIOS = [
  { id: 'pesimista', label: 'Pesimista', offset: -15, color: '#C55A11', destacado: false },
  { id: 'realista',  label: 'Realista',  offset: 0,   color: '#2E75B6', destacado: true },
  { id: 'optimista', label: 'Optimista', offset: 15,  color: '#70AD47', destacado: false },
];

export default function FlujoCaja({ mesesDerivados, saldoActual, ingresoMensual, gastoMensual, saldoInicial }) {
  const [crecimiento, setCrecimiento] = useState(10); // % slider

  const historico = useMemo(
    () => flujoCajaHistorico(mesesDerivados, saldoInicial),
    [mesesDerivados, saldoInicial]
  );

  const proyecciones = useMemo(
    () =>
      ESCENARIOS.map((e) => ({
        ...e,
        ...proyectarEscenario(saldoActual, ingresoMensual, gastoMensual, crecimiento, e.offset, 6),
      })),
    [saldoActual, ingresoMensual, gastoMensual, crecimiento]
  );

  // Datos para el gráfico de líneas (mes 0 = hoy)
  const chartData = useMemo(() => {
    const filas = [{ mes: 'Hoy', Pesimista: saldoActual, Realista: saldoActual, Optimista: saldoActual }];
    for (let i = 0; i < 6; i += 1) {
      filas.push({
        mes: `M${i + 1}`,
        Pesimista: proyecciones[0].serie[i].saldo,
        Realista: proyecciones[1].serie[i].saldo,
        Optimista: proyecciones[2].serie[i].saldo,
      });
    }
    return filas;
  }, [proyecciones, saldoActual]);

  return (
    <section className="space-y-6">
      {/* ───── Histórico ───── */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-extrabold text-slate-900">Flujo de Caja — Histórico</h2>
        <p className="mb-4 text-sm text-slate-500">Junio – Noviembre 2025</p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4 font-semibold">Mes</th>
                <th className="py-2 px-4 text-right font-semibold">Saldo Inicial</th>
                <th className="py-2 px-4 text-right font-semibold">Dinero Entra</th>
                <th className="py-2 px-4 text-right font-semibold">Dinero Sale</th>
                <th className="py-2 px-4 text-right font-semibold">Flujo Neto</th>
                <th className="py-2 pl-4 text-right font-semibold">Saldo Final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historico.map((f) => (
                <tr key={f.key} className="hover:bg-brand-50/40">
                  <td className="py-2.5 pr-4 font-semibold text-slate-700">{f.nombre}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-slate-500">{formatCLP(f.saldoInicial)}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-emerald-600">{formatCLP(f.entra)}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-rose-500">{formatCLP(f.sale)}</td>
                  <td className={`py-2.5 px-4 text-right tabular-nums font-semibold ${f.flujoNeto >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatCLP(f.flujoNeto)}
                  </td>
                  <td className="py-2.5 pl-4 text-right tabular-nums font-bold text-slate-800">{formatCLP(f.saldoFinal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ───── Proyecciones ───── */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-extrabold text-slate-900">Proyecciones a 6 meses</h2>
        <p className="mb-4 text-sm text-slate-500">Ajusta el escenario y observa el impacto en tiempo real.</p>

        {/* Slider dinámico */}
        <div className="rounded-xl bg-brand-50 p-4">
          <div className="flex items-center justify-between">
            <label htmlFor="slider" className="text-sm font-semibold text-slate-700">
              Si los ingresos suben:
            </label>
            <span className="rounded-lg bg-brand px-3 py-1 text-sm font-bold text-white">+{crecimiento}%</span>
          </div>
          <input
            id="slider"
            type="range"
            min="0"
            max="50"
            step="1"
            value={crecimiento}
            onChange={(e) => setCrecimiento(Number(e.target.value))}
            className="mt-3 w-full cursor-pointer accent-brand"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            <span>0%</span><span>25%</span><span>50%</span>
          </div>
        </div>

        {/* 3 tarjetas escenario */}
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {proyecciones.map((p) => (
            <div
              key={p.id}
              className={`rounded-2xl border p-5 transition ${
                p.destacado
                  ? 'border-brand bg-brand text-white shadow-lg shadow-brand/30 scale-[1.02]'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-bold ${p.destacado ? 'text-white' : 'text-slate-700'}`}>{p.label}</span>
                {p.destacado && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">Recomendado</span>
                )}
              </div>
              <p className={`mt-3 text-xs ${p.destacado ? 'text-brand-50' : 'text-slate-400'}`}>Saldo en 6 meses</p>
              <p className={`text-2xl font-extrabold tabular-nums ${p.destacado ? 'text-white' : p.saldoFinal >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                {formatCompactCLP(p.saldoFinal)}
              </p>
              <div className={`mt-3 space-y-1 text-xs ${p.destacado ? 'text-brand-50' : 'text-slate-500'}`}>
                <p>Flujo mensual: <span className="font-semibold">{formatCLP(p.flujoMensual)}</span></p>
                <p>Runway: <span className="font-semibold">{p.runwayMeses === Infinity ? '∞ (positivo)' : formatMeses(p.runwayMeses)}</span></p>
              </div>
            </div>
          ))}
        </div>

        {/* Gráfico de proyección con hover */}
        <div className="mt-6 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatCompactCLP(v)}
              />
              <Tooltip
                formatter={(value, name) => [formatCLP(value), name]}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
              />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Line type="monotone" dataKey="Pesimista" stroke="#C55A11" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Realista" stroke="#2E75B6" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="Optimista" stroke="#70AD47" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
