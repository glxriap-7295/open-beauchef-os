import ToolModal from './ToolModal.jsx';
import { usePreparacion } from '../../context/PreparacionContext.jsx';

const ACCION_LABEL = {
  'startup-card': 'Completar en Startup Card',
  evidence: 'Subir en Evidence Vault',
};

export default function GapAnalysisModal({ onClose, onAbrirHerramienta }) {
  const { gaps, objetivos } = usePreparacion();
  const resueltos = objetivos.length - gaps.length;

  return (
    <ToolModal
      icon="📐"
      titulo="Gap Analysis"
      subtitulo="Brechas detectadas según la información de tu startup."
      onClose={onClose}
    >
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm">
        <span className="font-semibold text-slate-700">{resueltos}/{objetivos.length} resueltos</span>
        <span className="text-slate-500">{gaps.length} brecha{gaps.length === 1 ? '' : 's'} por cerrar</span>
      </div>

      {gaps.length === 0 ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-8 text-center">
          <p className="text-3xl">🎉</p>
          <p className="mt-2 font-bold text-slate-800">¡Sin brechas pendientes!</p>
          <p className="text-sm text-slate-600">Tu información está completa. Buen trabajo.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {gaps.map((g) => (
            <li key={g.id} className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50/40 p-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-600">!</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800">{g.gap}</p>
                <p className="text-xs text-slate-500">Sugerencia: {g.titulo} · +{g.puntos}% preparación</p>
              </div>
              <button
                onClick={() => onAbrirHerramienta?.(g.accion)}
                className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition duration-[180ms] hover:bg-slate-700"
              >
                {ACCION_LABEL[g.accion] || 'Resolver'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </ToolModal>
  );
}
