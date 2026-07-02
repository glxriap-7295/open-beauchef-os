import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <main className="relative overflow-hidden">
      {/* Fondo decorativo */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute top-1/2 -left-24 h-96 w-96 rounded-full bg-brand-light/10 blur-3xl" />
      </div>

      <section className="mx-auto flex max-w-5xl flex-col items-center px-6 py-20 text-center sm:py-28">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-50 px-4 py-1.5 text-sm font-semibold text-brand">
          MVP · Decantopia
        </span>

        <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-6xl">
          Bienvenidx al MVP <br className="hidden sm:block" />
          <span className="text-brand">Financial Copilot</span> 🎉
        </h1>

        <p className="mt-6 text-xl font-semibold text-slate-700 sm:text-2xl">
          La plataforma que automatiza tu contabilidad
        </p>

        <p className="mt-4 max-w-2xl text-base text-slate-500 sm:text-lg">
          Aquí ves tus finanzas en tiempo real. Sin papeles, sin excel, sin estrés.
        </p>

        <button
          onClick={() => navigate('/app')}
          className="group mt-10 inline-flex items-center gap-2 rounded-xl bg-brand px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-brand/30 transition hover:bg-brand-dark hover:shadow-brand/40 focus:outline-none focus:ring-4 focus:ring-brand/30"
        >
          Acceder al Dashboard
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </button>

        {/* Features */}
        <div className="mt-20 grid w-full gap-5 sm:grid-cols-3">
          {[
            { icon: '📊', titulo: 'Estado de Resultado', desc: 'P&L mes a mes, en español y al instante.' },
            { icon: '💸', titulo: 'Flujo de Caja', desc: 'Histórico y proyecciones con escenarios.' },
            { icon: '🚀', titulo: 'Runway en vivo', desc: 'Sabe cuántos meses de operación tienes.' },
          ].map((f) => (
            <div key={f.titulo} className="rounded-2xl border border-slate-100 bg-white p-6 text-left shadow-sm">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-3 font-bold text-slate-800">{f.titulo}</h3>
              <p className="mt-1 text-sm text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-400">
        Financial Copilot · Hecho para Paloma (Decantopia)
      </footer>
    </main>
  );
}
