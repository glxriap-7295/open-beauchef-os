import { useState } from 'react';
import { usePreparacion } from '../../context/PreparacionContext.jsx';

/**
 * Tour de bienvenida (primer login). Presenta cada área con qué es, por qué
 * importa y cómo ayuda. Skip / Anterior / Siguiente / Finalizar. Se puede
 * repetir desde Configuración. Estilo Linear (limpio, con animación).
 */
const PASOS = [
  { emoji: '👋', color: 'from-brand to-brand-dark', titulo: 'Bienvenido/a a Open Beauchef OS', que: 'Tu sistema operativo para construir tu startup.', porque: 'Reúne tu perfil, tus finanzas y copilotos de IA en un solo lugar.', como: 'Te mostramos lo esencial en 1 minuto. Puedes saltarlo cuando quieras.' },
  { emoji: '🪪', color: 'from-brand to-brand-light', titulo: 'Startup Profile', que: 'El perfil vivo de tu startup: la única fuente de verdad.', porque: 'Todos los módulos (finanzas, mentores, copilotos) usan esta información.', como: 'Complétalo con AI Discovery (la IA lee tus documentos) o edítalo a mano.' },
  { emoji: '🤖', color: 'from-premium to-premium-dark', titulo: 'Copiloto Financiero', que: 'Estado de Resultados, Flujo de Caja, Runway y alertas, automáticos.', porque: 'Entiende la salud financiera de tu startup sin planillas.', como: 'Conecta tu banco (Fintoc), sube un CSV, o carga el dataset de ejemplo.' },
  { emoji: '🎯', color: 'from-premium to-brand', titulo: 'Copiloto Marketing', que: 'ROAS, presupuesto por canal e insights de marketing con IA.', porque: 'Optimiza cómo consigues clientes y cuánto te cuesta.', como: 'Ingresa tu inversión y ventas; la IA te sugiere próximos pasos.' },
  { emoji: '🗺️', color: 'from-brand to-premium', titulo: 'Roadmap & Gap Analysis', que: 'Tus brechas y próximos pasos, generados desde tu perfil.', porque: 'Sabes exactamente qué te falta para avanzar de etapa.', como: 'Cada tarea que completas sube tu Nivel de Preparación.' },
  { emoji: '⚙️', color: 'from-slate-600 to-slate-800', titulo: 'Configuración y más', que: 'Tu cuenta, equipo, integraciones, notificaciones y modo voz.', porque: 'Ajustas la plataforma a tu manera y sumas colaboradores.', como: 'Desde ahí también puedes repetir este tour cuando quieras.' },
];

export default function PlatformTour() {
  const { tourVisto, setTourVisto } = usePreparacion();
  const [i, setI] = useState(0);

  if (tourVisto) return null;
  const paso = PASOS[i];
  const ultimo = i === PASOS.length - 1;

  const cerrar = () => setTourVisto(true);
  const siguiente = () => (ultimo ? cerrar() : setI((n) => n + 1));
  const anterior = () => setI((n) => Math.max(0, n - 1));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div key={i} className="relative w-full max-w-md animate-fadeInUp overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className={`relative bg-gradient-to-br ${paso.color} p-7 text-white`}>
          <button onClick={cerrar} className="absolute right-4 top-4 text-sm font-semibold text-white/80 hover:text-white">Saltar</button>
          <div className="text-5xl animate-floaty">{paso.emoji}</div>
          <h2 className="mt-3 text-xl font-extrabold">{paso.titulo}</h2>
        </div>

        <div className="space-y-3 p-6">
          <p className="text-sm text-slate-700">{paso.que}</p>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Por qué importa</p>
            <p className="text-sm text-slate-600">{paso.porque}</p>
          </div>
          <div className="rounded-xl bg-brand-50/60 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-brand">Cómo te ayuda</p>
            <p className="text-sm text-slate-700">{paso.como}</p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 p-4">
          <div className="flex gap-1.5">
            {PASOS.map((_, idx) => (
              <span key={idx} className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-5 bg-brand' : 'w-1.5 bg-slate-200'}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button onClick={anterior} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100">Anterior</button>
            )}
            <button onClick={siguiente} className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-dark">
              {ultimo ? 'Empezar 🚀' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
