import { useNavigate } from 'react-router-dom';
import { usePreparacion } from '../../context/PreparacionContext.jsx';

export default function RecomendacionesIA({ compacto = false }) {
  const navigate = useNavigate();
  const { recomendaciones } = usePreparacion();

  const lista = compacto ? recomendaciones.slice(0, 5) : recomendaciones;
  const todoListo = lista.length > 0 && lista.every((r) => r.hecho);

  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-premium-50 text-premium">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v3m6.36.64-2.12 2.12M21 12h-3M4.93 19.07l2.12-2.12M12 21v-3m-6.36-.64 2.12-2.12M3 12h3M4.93 4.93l2.12 2.12" /></svg>
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Recomendaciones IA</h2>
          <p className="text-xs text-slate-500">Acciones sugeridas para subir tu preparación</p>
        </div>
      </div>

      <ul className="space-y-2">
        {lista.map((r) => (
          <li
            key={r.id}
            className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
              r.hecho ? 'border-emerald-100 bg-emerald-50/50' : 'border-slate-100 hover:border-premium-100 hover:bg-premium-50/40'
            }`}
          >
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs ${
                r.hecho ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-transparent'
              }`}
            >
              ✓
            </span>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${r.hecho ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{r.titulo}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${r.hecho ? 'bg-emerald-100 text-emerald-600' : 'bg-premium-50 text-premium'}`}>
              +{r.mejora}%
            </span>
            {!r.hecho && r.ruta && (
              <button
                onClick={() => navigate(r.ruta)}
                className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
              >
                Ir
              </button>
            )}
          </li>
        ))}
      </ul>

      {todoListo && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          <span className="text-xl">🌱</span>
          <p className="text-sm text-slate-600">
            ¡Vas al día! Completa más pasos para desbloquear nuevas recomendaciones.
          </p>
        </div>
      )}
    </section>
  );
}
