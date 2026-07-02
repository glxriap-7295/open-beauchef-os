import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { formatCLP, formatCompactCLP, formatPct, formatMeses } from '../utils/formatters.js';

function MetricCard({ titulo, valor, sub, trend, acento }) {
  const trendUp = trend > 0;
  const trendDown = trend < 0;
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{titulo}</p>
        {trend !== undefined && trend !== null && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
              trendUp ? 'bg-emerald-50 text-emerald-600' : trendDown ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {trendUp ? '↑' : trendDown ? '↓' : '→'} {formatPct(Math.abs(trend))}
          </span>
        )}
      </div>
      <p className={`mt-2 text-3xl font-extrabold tracking-tight ${acento || 'text-slate-900'}`}>{valor}</p>
      {sub && <p className="mt-1 text-sm text-slate-400">{sub}</p>}
    </div>
  );
}

export default function Dashboard({ metrics, mesesDerivados }) {
  const chartData = mesesDerivados.map((m) => ({
    mes: m.corto,
    Ingresos: m.ingresos,
    EBITDA: m.ebitda,
  }));

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Resumen financiero · junio – noviembre 2025</p>
      </div>

      {/* 4 métricas clave */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          titulo="Promedio Mensual"
          valor={formatCompactCLP(metrics.promedioIngresos)}
          sub="Ingresos promedio / mes"
          trend={metrics.trendIngresos}
        />
        <MetricCard
          titulo="EBITDA Promedio"
          valor={formatCompactCLP(metrics.promedioEbitda)}
          sub={`${formatPct(metrics.margenPromedio)} de margen`}
          acento="text-brand"
        />
        <MetricCard
          titulo="Runway Estimado"
          valor={metrics.runway === Infinity ? '∞' : formatMeses(metrics.runway)}
          sub={metrics.runway === Infinity ? 'Flujo de caja positivo' : 'A burn promedio actual'}
          acento="text-emerald-600"
        />
        <MetricCard
          titulo="Saldo Actual"
          valor={formatCompactCLP(metrics.saldoActual)}
          sub="Caja disponible hoy"
        />
      </div>

      {/* Gráfico de barras Ingresos vs EBITDA con hover */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-bold text-slate-800">Ingresos vs EBITDA por mes</h2>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
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
                labelFormatter={(l) => `Mes: ${l}`}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
              />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="Ingresos" fill="#5B9BD5" radius={[6, 6, 0, 0]} />
              <Bar dataKey="EBITDA" fill="#2E75B6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
