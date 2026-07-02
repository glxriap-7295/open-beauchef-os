import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCLP, formatPct } from '../utils/formatters.js';
import { consolidar } from '../utils/calculations.js';

const COLORS = ['#1F4E79', '#2E75B6', '#5B9BD5', '#9DC3E6', '#F4B183', '#C55A11', '#70AD47'];

function Fila({ label, valor, fuerte, color, indent }) {
  return (
    <div className={`flex items-center justify-between py-2 ${indent ? 'pl-4' : ''}`}>
      <span className={`text-sm ${fuerte ? 'font-bold text-slate-800' : 'text-slate-500'}`}>{label}</span>
      <span className={`tabular-nums text-sm ${fuerte ? 'font-bold' : 'font-medium'} ${color || 'text-slate-800'}`}>
        {formatCLP(valor)}
      </span>
    </div>
  );
}

export default function EstadoResultado({ mesesDerivados, vista, onVistaChange }) {
  const [mesIdx, setMesIdx] = useState(mesesDerivados.length - 1); // arranca en el último mes

  const consolidado = consolidar(mesesDerivados);
  const data = vista === 'consolidado' ? consolidado : mesesDerivados[mesIdx];

  const pieData = [
    { name: 'COGS Producción', value: data.cogsProd },
    { name: 'COGS Envío', value: data.cogsEnvio },
    { name: 'COGS Transacción', value: data.cogsTrans },
    { name: 'Empleados', value: data.empleados },
    { name: 'Herramientas', value: data.herramientas },
    { name: 'Otros', value: data.otros },
    { name: 'EBITDA', value: Math.max(0, data.ebitda) },
  ].filter((d) => d.value > 0);

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Estado de Resultado</h2>
          <p className="text-sm text-slate-500">{data.nombre}</p>
        </div>

        {/* Toggle Consolidado / Mes a Mes */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1 text-sm font-semibold">
          <button
            onClick={() => onVistaChange('consolidado')}
            className={`rounded-lg px-3 py-1.5 transition ${
              vista === 'consolidado' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Consolidado 6 meses
          </button>
          <button
            onClick={() => onVistaChange('mensual')}
            className={`rounded-lg px-3 py-1.5 transition ${
              vista === 'mensual' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Mes a Mes
          </button>
        </div>
      </div>

      {/* Selector de mes (solo en vista mensual) */}
      {vista === 'mensual' && (
        <div className="mt-4 flex flex-wrap gap-2">
          {mesesDerivados.map((m, i) => (
            <button
              key={m.key}
              onClick={() => setMesIdx(i)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                i === mesIdx ? 'bg-brand text-white shadow-sm' : 'bg-brand-50 text-brand hover:bg-brand-100'
              }`}
            >
              {m.nombre}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Desglose */}
        <div className="divide-y divide-slate-100">
          <Fila label="Ingresos Totales" valor={data.ingresos} fuerte color="text-emerald-600" />
          <Fila label="COGS (Costo de Ventas)" valor={-data.cogs} color="text-rose-500" />
          <Fila label="· Producción" valor={-data.cogsProd} indent />
          <Fila label="· Envío" valor={-data.cogsEnvio} indent />
          <Fila label="· Transacciones" valor={-data.cogsTrans} indent />
          <Fila label="Gastos Operacionales" valor={-data.gastosOperacionales} color="text-rose-500" />
          <Fila label="· Empleados" valor={-data.empleados} indent />
          <Fila label="· Herramientas" valor={-data.herramientas} indent />
          {data.otros > 0 && <Fila label="· Otros" valor={-data.otros} indent />}
          <div className="flex items-center justify-between border-t-2 border-slate-200 py-3">
            <span className="font-extrabold text-slate-900">EBITDA</span>
            <span className={`tabular-nums font-extrabold ${data.ebitda >= 0 ? 'text-brand' : 'text-rose-600'}`}>
              {formatCLP(data.ebitda)}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-slate-500">Margen EBITDA</span>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand">
              {formatPct(data.margen)}
            </span>
          </div>
        </div>

        {/* Gráfico de torta con hover */}
        <div>
          <p className="mb-2 text-center text-sm font-semibold text-slate-600">Distribución de ingresos</p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  innerRadius={50}
                  paddingAngle={2}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [formatCLP(value), name]}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
