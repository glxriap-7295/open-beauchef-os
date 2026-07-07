import { Link } from 'react-router-dom';
import AppLayout from '../components/os/AppLayout.jsx';
import NivelPreparacion from '../components/os/NivelPreparacion.jsx';
import RecomendacionesIA from '../components/os/RecomendacionesIA.jsx';
import MentorBanner from '../components/os/MentorBanner.jsx';
import PlatformTour from '../components/os/PlatformTour.jsx';
import { usePreparacion } from '../context/PreparacionContext.jsx';

function Logros() {
  const { logros } = usePreparacion();
  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-extrabold text-slate-900">Logros recientes</h2>
      {logros.length === 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          <span className="text-xl">🏁</span>
          Aquí aparecerán tus logros a medida que avances.
        </div>
      )}
      <ul className="space-y-3">
        {logros.map((l) => (
          <li key={l.id} className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-xl">{l.icono}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">{l.titulo}</p>
              <p className="text-xs text-slate-500">{l.fecha}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ResumenStartup() {
  const { perfil, objetivos } = usePreparacion();
  const completos = objetivos.filter((o) => o.done).length;
  const pct = objetivos.length ? Math.round((completos / objetivos.length) * 100) : 0;

  const items = [
    { label: 'Industria', valor: perfil.industria },
    { label: 'Etapa', valor: perfil.etapa },
    { label: 'Sitio web', valor: perfil.sitioWeb },
    { label: 'Cliente objetivo', valor: perfil.clienteObjetivo },
  ];

  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">{perfil.nombre || 'Tu startup'}</h2>
          <p className="text-sm text-slate-500">Perfil de tu startup · {pct}% completo</p>
        </div>
        <Link
          to="/herramientas"
          className="shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition duration-[180ms] hover:bg-slate-50 hover:shadow-sm"
        >
          Editar Startup Card
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="rounded-2xl bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{it.label}</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">
              {it.valor ? it.valor : <span className="text-amber-500">Por completar</span>}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AccesosRapidos() {
  const accesos = [
    { to: '/herramientas', titulo: 'Centro de Herramientas', desc: 'Explora todas tus herramientas', emoji: '🧰', color: 'bg-brand-50 text-brand' },
    { to: '/copiloto', titulo: 'Copiloto Financiero IA', desc: 'Tu asistente financiero 24/7', emoji: '🤖', color: 'bg-premium-50 text-premium', badge: 'Nuevo' },
    { to: '/copiloto/futuro', titulo: 'Ver versión futura', desc: 'Así funcionará todo automático', emoji: '✨', color: 'bg-amber-50 text-amber-600' },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {accesos.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          className="group rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition duration-[180ms] hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className={`grid h-11 w-11 place-items-center rounded-2xl text-xl ${a.color}`}>{a.emoji}</span>
            {a.badge && <span className="rounded-full bg-premium px-2 py-0.5 text-[10px] font-bold text-white">{a.badge}</span>}
          </div>
          <p className="mt-3 font-bold text-slate-800">{a.titulo}</p>
          <p className="text-sm text-slate-500">{a.desc}</p>
          <span className="mt-2 inline-block text-sm font-semibold text-premium opacity-0 transition group-hover:opacity-100">Abrir →</span>
        </Link>
      ))}
    </div>
  );
}

export default function PanelPrincipal() {
  const { fundadora, empresa } = usePreparacion();

  return (
    <AppLayout>
      <PlatformTour />
      <div className="space-y-6">
        {/* Saludo */}
        <header className="animate-fadeInUp">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            ¡Hola{fundadora ? `, ${fundadora}` : ''}! 👋
          </h1>
          <p className="text-slate-500">
            {empresa ? `Así va ${empresa} hoy.` : 'Construyamos el perfil de tu startup.'} Tu plataforma está trabajando contigo.
          </p>
        </header>

        {/* Hero: Nivel de Preparación */}
        <div className="animate-fadeInUp">
          <NivelPreparacion />
        </div>

        {/* Resumen del Startup Profile (en vivo desde la Startup Card) */}
        <ResumenStartup />

        {/* Recomendaciones + Logros */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecomendacionesIA />
          </div>
          <Logros />
        </div>

        {/* Mentor Matching */}
        <MentorBanner />

        {/* Accesos rápidos */}
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Accesos rápidos</h2>
          <AccesosRapidos />
        </div>
      </div>
    </AppLayout>
  );
}
