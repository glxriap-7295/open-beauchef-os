import AppLayout from '../components/os/AppLayout.jsx';
import MentorBanner from '../components/os/MentorBanner.jsx';
import { usePreparacion } from '../context/PreparacionContext.jsx';

const MENTORES = [
  { id: 'm1', nombre: 'Andrea Soto', rol: 'Ex-CFO, fintech', match: 94, tags: ['Finanzas', 'Fundraising'], emoji: '👩‍💼' },
  { id: 'm2', nombre: 'Cristóbal Reyes', rol: 'Founder e-commerce', match: 91, tags: ['Go-to-market', 'Retail / DTC'], emoji: '🍷' },
  { id: 'm3', nombre: 'María José Lillo', rol: 'Head of Growth', match: 88, tags: ['Comercial', 'Escalamiento'], emoji: '🚀' },
];

export default function Mentores() {
  const { mentorDesbloqueado, empresa } = usePreparacion();

  return (
    <AppLayout>
      <div className="space-y-6">
        <header className="animate-fadeInUp">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Mentores</h1>
          <p className="text-slate-500">Conecta con mentores afines a la etapa de {empresa}.</p>
        </header>

        <MentorBanner />

        {mentorDesbloqueado ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {MENTORES.map((m) => (
              <div key={m.id} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition duration-[180ms] hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-50 text-2xl">{m.emoji}</span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600">{m.match}% match</span>
                </div>
                <p className="mt-3 font-bold text-slate-800">{m.nombre}</p>
                <p className="text-sm text-slate-500">{m.rol}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {m.tags.map((t) => (
                    <span key={t} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand">{t}</span>
                  ))}
                </div>
                <button className="mt-4 w-full rounded-xl bg-slate-900 py-2 text-sm font-semibold text-white transition hover:bg-slate-700">
                  Solicitar reunión
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
            <p className="text-4xl">🔒</p>
            <p className="mt-3 font-bold text-slate-800">Aquí aparecerán tus próximos mentores</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
              Sigue sumando puntos a tu Nivel de Preparación. Cuando llegues al hito, te presentamos mentores
              elegidos por IA según la etapa y la industria de Decantopia.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
