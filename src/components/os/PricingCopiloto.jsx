import { useState } from 'react';

const PLANES = [
  {
    id: 'starter',
    nombre: 'Starter',
    precio: '$19',
    periodo: '/mes',
    pie: 'Ideal para startups en etapa temprana.',
    destacado: false,
    features: [
      '1 fundador',
      '1 cuenta bancaria',
      'Hasta 300 transacciones mensuales',
      'Estado de Resultados',
      'Flujo de Caja',
      'Panel Financiero',
      'Alertas Inteligentes',
      'Clasificación IA',
      'Asistente WhatsApp',
    ],
  },
  {
    id: 'growth',
    nombre: 'Growth',
    precio: '$49',
    periodo: '/mes',
    pie: 'Ideal para startups en crecimiento.',
    destacado: true,
    extraTitulo: 'Todo lo de Starter, más:',
    features: [
      '5 cuentas bancarias',
      'Múltiples usuarios',
      'Proyecciones',
      'Runway',
      'Reportes ilimitados',
      'Tendencias',
    ],
  },
  {
    id: 'scale',
    nombre: 'Scale',
    precio: '$99',
    periodo: '/mes',
    prefijo: 'Desde',
    pie: 'Para startups escalando con necesidades avanzadas.',
    destacado: false,
    features: [
      'Todo ilimitado',
      'ERP integrado',
      'Analítica avanzada',
      'Investor reporting',
      'KPIs personalizados',
    ],
  },
];

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PricingCopiloto() {
  const [elegido, setElegido] = useState(null);
  return (
    <section>
      <div className="mb-2 text-center">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Copiloto Financiero IA</h2>
        <p className="mt-1 text-slate-500">Todo lo financiero en una sola suscripción. Sin compras sueltas.</p>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {PLANES.map((p) => (
          <div
            key={p.id}
            className={`relative flex flex-col rounded-3xl border p-6 transition ${
              p.destacado
                ? 'border-premium bg-gradient-to-b from-premium-50 to-white shadow-xl lg:-translate-y-2'
                : 'border-slate-100 bg-white shadow-sm'
            }`}
          >
            {p.destacado && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-premium px-3 py-1 text-xs font-bold text-white shadow">
                Más popular
              </span>
            )}
            <h3 className="font-extrabold text-slate-900">{p.nombre}</h3>
            <p className="mt-2 flex items-end gap-1">
              {p.prefijo && <span className="mb-1 text-xs font-semibold text-slate-500">{p.prefijo}</span>}
              <span className="text-4xl font-extrabold tracking-tight text-slate-900">{p.precio}</span>
              <span className="mb-1 text-sm text-slate-500">{p.periodo}</span>
            </p>
            <p className="mt-1 text-sm text-slate-500">{p.pie}</p>

            {p.extraTitulo && <p className="mt-4 text-xs font-bold uppercase tracking-wide text-premium">{p.extraTitulo}</p>}

            <ul className="mt-4 flex-1 space-y-2">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                  <Check /> {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => setElegido(p.id)}
              className={`mt-6 rounded-xl py-2.5 text-sm font-bold transition ${
                elegido === p.id
                  ? 'bg-emerald-600 text-white'
                  : p.destacado
                    ? 'bg-premium text-white hover:bg-premium-dark'
                    : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {elegido === p.id ? `✓ ${p.nombre} seleccionado` : `Elegir ${p.nombre}`}
            </button>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-slate-500">
        {elegido
          ? 'Plan seleccionado. Habilitaremos el pago en la versión final; por ahora es una demostración.'
          : 'Presentación de planes. El pago se habilitará en la versión final.'}
      </p>
    </section>
  );
}
