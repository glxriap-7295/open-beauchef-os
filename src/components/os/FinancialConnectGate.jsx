import { banking } from '../../services/banking/index.js';

/**
 * Puerta de entrada del Copiloto Financiero: hasta que el emprendedor conecta
 * una fuente de datos, mostramos opciones claras (nunca métricas falsas).
 */
export default function FinancialConnectGate({ onConectar, onDemo }) {
  const fintocOk = banking.openBankingDisponible();

  const opciones = [
    { id: 'fintoc', icon: '🏦', titulo: 'Conectar con Fintoc', desc: fintocOk ? 'Sincroniza tu banco automáticamente (Open Banking).' : 'Open Banking. Requiere configuración en este entorno.', accion: onConectar },
    { id: 'csv', icon: '📄', titulo: 'Subir CSV', desc: 'Importa tus movimientos desde un archivo CSV.', accion: onConectar },
    { id: 'excel', icon: '📊', titulo: 'Subir Excel', desc: 'Importa una planilla de movimientos.', accion: onConectar },
    { id: 'pdf', icon: '🧾', titulo: 'Subir cartola PDF', desc: 'Lectura de cartola en PDF. Próximamente.', proximamente: true },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-premium-50 text-3xl">💳</div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">Conecta tu información financiera</h1>
        <p className="mx-auto mt-2 max-w-xl text-slate-500">
          El Copiloto Financiero se activa cuando conectas tus datos. Elige una opción para empezar.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {opciones.map((o) => (
          <button
            key={o.id}
            onClick={() => !o.proximamente && o.accion?.(o.id)}
            disabled={o.proximamente}
            className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition duration-[180ms] ${
              o.proximamente
                ? 'cursor-default border-slate-100 bg-slate-50/60'
                : o.destacado
                  ? 'border-premium-100 bg-premium-50/40 hover:-translate-y-0.5 hover:shadow-md'
                  : 'border-slate-100 bg-white hover:-translate-y-0.5 hover:shadow-md'
            }`}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-xl shadow-sm">{o.icon}</span>
            <div>
              <p className="flex items-center gap-2 font-bold text-slate-800">
                {o.titulo}
                {o.proximamente && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400">Próximamente</span>}
                {o.destacado && <span className="rounded-full bg-premium px-2 py-0.5 text-[10px] font-bold text-white">Recomendado</span>}
              </p>
              <p className="mt-1 text-sm text-slate-500">{o.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        Tus datos son privados y se usan solo para generar tus reportes.
      </p>

      {/* Acción secundaria: cargar el dataset de ejemplo solo si el usuario lo elige. */}
      <div className="mt-3 text-center">
        <button
          onClick={onDemo}
          className="text-sm font-semibold text-slate-500 underline-offset-2 transition hover:text-brand hover:underline"
        >
          Explorar ejemplo
        </button>
      </div>
    </div>
  );
}
