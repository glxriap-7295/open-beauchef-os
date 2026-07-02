import ToolModal from './ToolModal.jsx';
import { usePreparacion } from '../../context/PreparacionContext.jsx';

export default function RoadmapModal({ onClose, onAbrirHerramienta }) {
  const { objetivos, alternarTarea, bonusPreparacion } = usePreparacion();
  const completados = objetivos.filter((o) => o.done).length;
  const progreso = objetivos.length ? Math.round((completados / objetivos.length) * 100) : 0;

  return (
    <ToolModal
      icon="🗺️"
      titulo="Roadmap"
      subtitulo="Tus próximos pasos, generados a partir de Gap Analysis."
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">{completados}/{objetivos.length} tareas completadas</span>
          <span className="font-bold text-emerald-600">+{bonusPreparacion}% preparación ganada</span>
        </div>
      }
    >
      {/* Progreso */}
      <div className="mb-5">
        <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500">
          <span>Progreso del roadmap</span>
          <span>{progreso}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-brand to-premium" style={{ width: `${progreso}%`, transition: 'width 0.6s ease' }} />
        </div>
      </div>

      <ul className="space-y-2">
        {objetivos.map((o) => (
          <li
            key={o.id}
            className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
              o.done ? 'border-emerald-100 bg-emerald-50/50' : 'border-slate-100'
            }`}
          >
            <button
              onClick={() => !o.auto && alternarTarea(o.id)}
              disabled={o.auto}
              title={o.auto ? 'Se completa automáticamente al cargar la información' : 'Marcar como completada'}
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs transition ${
                o.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-transparent hover:border-brand'
              } ${o.auto ? 'cursor-default' : 'cursor-pointer'}`}
            >
              ✓
            </button>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${o.done ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{o.titulo}</p>
              {o.auto && !o.done && (
                <button
                  onClick={() => onAbrirHerramienta?.(o.accion)}
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  Abrir herramienta →
                </button>
              )}
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${o.done ? 'bg-emerald-100 text-emerald-600' : 'bg-brand-50 text-brand'}`}>
              +{o.puntos}%
            </span>
          </li>
        ))}
      </ul>
    </ToolModal>
  );
}
