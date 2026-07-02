import { useNavigate } from 'react-router-dom';
import { usePreparacion } from '../../context/PreparacionContext.jsx';

/**
 * Integra Mentor Matching: muestra felicitación cuando la preparación alcanza
 * el hito, o el progreso restante cuando aún no se desbloquea.
 */
export default function MentorBanner() {
  const navigate = useNavigate();
  const { nivel, umbralMentor, mentorDesbloqueado } = usePreparacion();

  if (mentorDesbloqueado) {
    return (
      <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-[#ECFDF3] p-6 shadow-sm">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4">
            <span className="text-4xl animate-floaty">🎉</span>
            <div>
              <h3 className="text-xl font-extrabold text-[#111827]">¡Felicidades!</h3>
              <p className="mt-1 max-w-xl text-sm text-[#4B5563]">
                Tu startup ya está lista para recibir recomendaciones de mentor. Conectamos tu perfil con
                mentores afines a tu etapa e industria.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/mentores')}
            className="shrink-0 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow transition duration-[180ms] hover:bg-emerald-700 hover:shadow-md"
          >
            Ver mentores →
          </button>
        </div>
      </section>
    );
  }

  const faltan = umbralMentor - nivel;
  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-2xl">🧭</span>
        <div className="flex-1">
          <h3 className="font-bold text-slate-800">Mentor Matching</h3>
          <p className="text-sm text-slate-500">
            Te faltan <span className="font-bold text-premium">{faltan} puntos</span> de preparación para desbloquear
            recomendaciones de mentor.
          </p>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-premium to-brand"
          style={{ width: `${(nivel / umbralMentor) * 100}%`, transition: 'width 0.9s ease' }}
        />
      </div>
    </section>
  );
}
