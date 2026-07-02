import { usePreparacion } from '../../context/PreparacionContext.jsx';

const COLORES_DIM = {
  Comercial: '#2E75B6',
  Finanzas: '#6D5BD0',
  Tecnología: '#0EA5E9',
  Validación: '#10B981',
  Equipo: '#F59E0B',
};

function Donut({ valor }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - valor / 100);
  return (
    <div className="relative grid h-48 w-48 place-items-center">
      <svg viewBox="0 0 180 180" className="h-48 w-48 -rotate-90">
        <circle cx="90" cy="90" r={r} fill="none" stroke="#EDF1F7" strokeWidth="14" />
        <circle
          cx="90"
          cy="90"
          r={r}
          fill="none"
          stroke="url(#grad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)' }}
        />
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6D5BD0" />
            <stop offset="100%" stopColor="#2E75B6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center">
        <p className="text-4xl font-extrabold tracking-tight text-slate-900">{valor}%</p>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preparación</p>
      </div>
    </div>
  );
}

function Sparkline({ data }) {
  const w = 120;
  const h = 36;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / span) * h}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-32">
      <polyline points={pts} fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function NivelPreparacion() {
  const { nivel, etapaActual, proximaEtapa, dimensiones, tendencia } = usePreparacion();
  const delta = tendencia.length >= 2 ? tendencia[tendencia.length - 1] - tendencia[tendencia.length - 2] : 0;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
        {/* Gauge + etapas */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
          <Donut valor={nivel} />
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Etapa actual</p>
              <p className="text-lg font-extrabold text-slate-900">{etapaActual}</p>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14m0 0 5-5m-5 5-5-5" /></svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Próxima etapa</p>
              <p className="text-lg font-bold text-premium-dark">{proximaEtapa}</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2">
              <Sparkline data={tendencia} />
              <div className="leading-tight">
                <p className="text-xs text-emerald-700">Tendencia</p>
                <p className="text-sm font-bold text-emerald-700">{delta >= 0 ? '↑' : '↓'} {Math.abs(delta)} pts esta semana</p>
              </div>
            </div>
          </div>
        </div>

        {/* Dimensiones */}
        <div className="flex-1 space-y-3 lg:border-l lg:border-slate-100 lg:pl-8">
          <p className="text-sm font-bold text-slate-800">Dimensiones</p>
          {Object.entries(dimensiones).map(([dim, val]) => (
            <div key={dim}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-600">{dim}</span>
                <span className="font-semibold tabular-nums text-slate-500">{val}/100</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${val}%`, backgroundColor: COLORES_DIM[dim] || '#2E75B6', transition: 'width 0.9s cubic-bezier(.22,1,.36,1)' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
