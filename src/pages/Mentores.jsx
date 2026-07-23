import { useEffect, useState } from 'react';
import AppLayout from '../components/os/AppLayout.jsx';
import { usePreparacion } from '../context/PreparacionContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { completitudPerfil } from '../data/profileSchema.js';
import { firebaseHabilitado } from '../services/firebase/app.js';
import { loadAsignacion } from '../services/firebase/data.js';

export default function Mentores() {
  const { perfil } = usePreparacion();
  const { user } = useAuth();
  const completitud = completitudPerfil(perfil);
  const listoParaRevision = completitud >= 40;
  const [asignacion, setAsignacion] = useState(null);

  useEffect(() => {
    if (!firebaseHabilitado() || !user?.id) return;
    let vivo = true;
    loadAsignacion(user.id).then((a) => { if (vivo) setAsignacion(a); })
      .catch((e) => console.warn('[Mentores] No se pudo cargar la asignación de mentor:', e?.message || e));
    return () => { vivo = false; };
  }, [user?.id]);

  if (asignacion?.mentor) {
    const m = asignacion.mentor;
    return (
      <AppLayout>
        <div className="space-y-6">
          <header className="animate-fadeInUp">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Tu mentor</h1>
            <p className="text-slate-500">El equipo de Open Beauchef revisó tu perfil y te asignó un mentor.</p>
          </header>
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-8 text-center shadow-sm">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-white text-4xl shadow-sm">{m.foto || '🧑‍🏫'}</div>
            <h2 className="mt-4 text-xl font-extrabold text-slate-900">{m.nombre}</h2>
            {m.bio && <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{m.bio}</p>}
            {m.linkedin && <a href={m.linkedin} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700">Ver perfil de LinkedIn</a>}
          </section>
        </div>
      </AppLayout>
    );
  }

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
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" /> Pending Review
              </div>
              <h2 className="mt-4 text-xl font-extrabold text-slate-900">Tu startup está siendo revisada por Open Beauchef</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
                Nuestro equipo evaluará tu Startup Profile y te asignará el mentor adecuado.
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
