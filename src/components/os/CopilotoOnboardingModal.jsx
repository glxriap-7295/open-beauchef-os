import { useNavigate } from 'react-router-dom';

const CAPACIDADES = [
  'Conectar automáticamente cuentas bancarias',
  'Leer movimientos financieros',
  'Clasificar gastos utilizando IA',
  'Generar automáticamente Estado de Resultados',
  'Generar automáticamente Flujo de Caja',
  'Detectar gastos inusuales',
  'Generar alertas inteligentes',
  'Solicitar información adicional mediante WhatsApp cuando sea necesario',
];

export default function CopilotoOnboardingModal({ onVolver }) {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onVolver} />

      <div className="relative w-full max-w-2xl animate-fadeInUp overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Encabezado premium */}
        <div className="relative overflow-hidden border-b border-premium-100 bg-premium-50 p-8">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-premium/10 blur-2xl" />
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-premium-100 text-2xl animate-floaty">🤖</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#5B4AE6]">Copiloto Financiero IA</p>
              <h2 className="text-2xl font-extrabold text-slate-900">Tu copiloto financiero, siempre encendido</h2>
            </div>
          </div>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-gray-700">
            Esta demostración utiliza información financiera histórica de Decantopia para mostrar el
            funcionamiento del Copiloto. En la versión final, toda esta información se obtendrá automáticamente
            mediante Open Banking (Fintoc), IA y WhatsApp.
          </p>
        </div>

        {/* Capacidades */}
        <div className="max-h-[40vh] overflow-y-auto p-8">
          <p className="mb-4 text-sm font-bold text-slate-900">Esto es lo que hará por ti:</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {CAPACIDADES.map((c) => (
              <li key={c} className="flex items-start gap-2.5 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
                <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {c}
              </li>
            ))}
          </ul>
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-3 border-t border-slate-100 p-6 sm:flex-row sm:justify-end">
          <button
            onClick={onVolver}
            className="order-3 rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 sm:order-1"
          >
            Volver
          </button>
          <button
            onClick={() => navigate('/copiloto/futuro')}
            className="order-2 rounded-xl border border-premium-100 bg-premium-50 px-5 py-2.5 text-sm font-bold text-premium transition hover:bg-premium-100"
          >
            Ver versión futura
          </button>
          <button
            onClick={() => navigate('/copiloto/demo')}
            className="order-1 rounded-xl bg-premium px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-premium/30 transition hover:bg-premium-dark sm:order-3"
          >
            Abrir demostración →
          </button>
        </div>
      </div>
    </div>
  );
}
