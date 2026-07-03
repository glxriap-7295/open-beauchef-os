import { useMemo, useState } from 'react';
import ToolModal from './ToolModal.jsx';
import { usePreparacion } from '../../context/PreparacionContext.jsx';
import { roas, getMesesDerivados, consolidar } from '../../utils/calculations.js';
import { formatCLP } from '../../utils/formatters.js';
import { getAIProvider } from '../../services/ai/index.js';

function Bloque({ titulo, children, chip }) {
  return (
    <section className="rounded-2xl border border-slate-100 p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-bold text-slate-800">{titulo}</h3>
        {chip && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400">{chip}</span>}
      </div>
      {children}
    </section>
  );
}

const inputCls = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

export default function MarketingCopilotModal({ onClose }) {
  const { fuenteFinanciera, transacciones } = usePreparacion();
  const ai = getAIProvider();

  // Ventas sugeridas desde datos reales conectados (o el dataset demo).
  const ventasSugeridas = useMemo(() => {
    if (fuenteFinanciera === 'demo') return consolidar(getMesesDerivados()).ingresos;
    if (transacciones?.length) return transacciones.filter((t) => Number(t.monto) > 0).reduce((s, t) => s + Number(t.monto), 0);
    return 0;
  }, [fuenteFinanciera, transacciones]);

  const [inversion, setInversion] = useState('');
  const [ventas, setVentas] = useState(ventasSugeridas ? String(ventasSugeridas) : '');
  const [presupuesto, setPresupuesto] = useState('');
  const [insight, setInsight] = useState('');
  const [pensando, setPensando] = useState(false);

  const r = roas({ ventas: Number(ventas), inversion: Number(inversion) });

  const canales = [
    { n: 'Meta Ads', pct: 40 },
    { n: 'Google Ads', pct: 35 },
    { n: 'Contenido / Orgánico', pct: 15 },
    { n: 'Otros', pct: 10 },
  ];
  const totalPres = Number(presupuesto) || 0;

  const recomendaciones = useMemo(() => {
    const recs = [];
    if (r.definido) {
      if (r.roas < 1) recs.push('Tu ROAS es menor a 1: por ahora gastas más de lo que retorna. Pausa lo de peor rendimiento y prueba nuevas creatividades.');
      else if (r.roas < 3) recs.push('ROAS positivo pero mejorable. Optimiza segmentación y landing para subir la conversión.');
      else recs.push('ROAS saludable. Considera escalar presupuesto en tus mejores campañas gradualmente.');
    } else {
      recs.push('Ingresa tu inversión y ventas atribuibles para calcular tu ROAS.');
    }
    recs.push('Define un objetivo por canal y mide semanalmente para reaccionar rápido.');
    return recs;
  }, [r]);

  const generarInsight = async () => {
    setPensando(true);
    const txt = await ai.chat([
      { rol: 'system', contenido: 'Eres un asesor de marketing para startups, conciso y accionable.' },
      { rol: 'user', contenido: `Mi ROAS es ${r.definido ? r.roas : 'desconocido'}. Dame un insight breve de marketing.` },
    ]);
    setInsight(txt || 'Enfócate en el canal con mejor ROAS y mejora tu tasa de conversión antes de escalar el gasto.');
    setPensando(false);
  };

  return (
    <ToolModal
      icon="🎯"
      titulo="Copiloto Marketing IA"
      subtitulo="ROAS, canales y presupuesto. Reutiliza la misma lógica de planilla del Copiloto."
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* ROAS */}
        <Bloque titulo="Calculadora de ROAS">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Inversión en marketing (CLP)</label>
              <input className={inputCls} inputMode="numeric" value={inversion} onChange={(e) => setInversion(e.target.value.replace(/\D/g, ''))} placeholder="Ej: 1200000" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Ventas atribuibles (CLP)</label>
              <input className={inputCls} inputMode="numeric" value={ventas} onChange={(e) => setVentas(e.target.value.replace(/\D/g, ''))} placeholder="Ej: 6000000" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 p-3">
            <span className="text-sm text-slate-600">ROAS</span>
            <span className="text-2xl font-extrabold text-brand">{r.definido ? `${r.roas}x` : '—'}</span>
          </div>
          {ventasSugeridas > 0 && <p className="mt-2 text-xs text-slate-400">Ventas precargadas desde tus datos conectados: {formatCLP(ventasSugeridas)}.</p>}
        </Bloque>

        {/* Budget allocation */}
        <Bloque titulo="Asignación de presupuesto">
          <label className="mb-1 block text-xs font-semibold text-slate-600">Presupuesto mensual (CLP)</label>
          <input className={inputCls} inputMode="numeric" value={presupuesto} onChange={(e) => setPresupuesto(e.target.value.replace(/\D/g, ''))} placeholder="Ej: 1000000" />
          <ul className="mt-3 space-y-2">
            {canales.map((c) => (
              <li key={c.n} className="flex items-center gap-2 text-sm sm:gap-3">
                <span className="w-24 shrink-0 truncate text-slate-600 sm:w-40">{c.n}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${c.pct}%` }} />
                </div>
                <span className="w-20 shrink-0 text-right text-xs font-semibold text-slate-700 sm:w-24 sm:text-sm">{totalPres ? formatCLP(totalPres * c.pct / 100) : `${c.pct}%`}</span>
              </li>
            ))}
          </ul>
        </Bloque>

        {/* Recomendaciones */}
        <Bloque titulo="Recomendaciones de marketing">
          <ul className="space-y-2">
            {recomendaciones.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 rounded-xl bg-slate-50 p-2.5 text-sm text-slate-600"><span className="text-brand">→</span> {rec}</li>
            ))}
          </ul>
        </Bloque>

        {/* AI Insights */}
        <Bloque titulo="AI Marketing Insights">
          {insight ? (
            <p className="rounded-xl bg-premium-50/60 p-3 text-sm text-slate-700">{insight}</p>
          ) : (
            <button onClick={generarInsight} disabled={pensando} className="rounded-xl bg-premium px-4 py-2 text-sm font-bold text-white transition hover:bg-premium-dark disabled:opacity-60">
              {pensando ? 'Generando…' : 'Generar insight con IA'}
            </button>
          )}
        </Bloque>

        {/* Métricas futuras */}
        <Bloque titulo="Métricas avanzadas" chip="Se activan al conectar">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {['CAC', 'LTV', 'Meta Ads', 'Google Ads'].map((m) => (
              <div key={m} className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3 text-center">
                <p className="text-xs font-semibold text-slate-500">{m}</p>
                <p className="mt-1 text-lg font-extrabold text-slate-300">—</p>
                <p className="text-[10px] text-slate-400">Al conectar tus fuentes</p>
              </div>
            ))}
          </div>
        </Bloque>
      </div>
    </ToolModal>
  );
}
