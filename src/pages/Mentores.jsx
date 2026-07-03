import AppLayout from '../components/os/AppLayout.jsx';
import { usePreparacion } from '../context/PreparacionContext.jsx';
import { completitudPerfil } from '../data/profileSchema.js';

export default function Mentores() {
  const { perfil } = usePreparacion();
  const completitud = completitudPerfil(perfil);
  const listoParaRevision = completitud >= 40;

  return (
    <AppLayout>
      <div className="space-y-6">
        <header className="animate-fadeInUp">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Mentor Matching</h1>
          <p className="text-slate-500">Open Beauchef revisa tu perfil y te asigna el mentor adecuado.</p>
        </header>

        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-premium-50 text-4xl animate-floaty">🧭</div>

          {listoParaRevision ? (
            <>
              <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-1.5 text-sm font-bold text-amber-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" /> En revisión
              </div>
              <h2 className="mt-4 text-xl font-extrabold text-slate-900">Tu perfil está siendo revisado</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
                Una vez que Open Beauchef evalúe tu Startup Profile, recibirás la asignación de tu mentor.
                Te avisaremos apenas esté listo.
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1.5 text-sm font-bold text-slate-500">
                Perfil incompleto
              </div>
              <h2 className="mt-4 text-xl font-extrabold text-slate-900">Completa tu perfil para enviarlo a revisión</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
                Mientras más completo esté tu Startup Profile, mejor será tu match. Vas en un {completitud}%.
                Usa <b>AI Discovery</b> o tu <b>Startup Card</b> para avanzar.
              </p>
              <div className="mx-auto mt-4 h-2 max-w-sm overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-premium to-brand" style={{ width: `${completitud}%`, transition: 'width 0.6s ease' }} />
              </div>
            </>
          )}
        </section>

        <p className="text-center text-xs text-slate-400">
          El match de mentores es evaluado por el equipo de Open Beauchef. No generamos asignaciones automáticas.
        </p>
      </div>
    </AppLayout>
  );
}
