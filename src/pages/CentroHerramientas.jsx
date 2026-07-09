import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/os/AppLayout.jsx';
import PricingCopiloto from '../components/os/PricingCopiloto.jsx';
import StartupCardModal from '../components/os/StartupCardModal.jsx';
import EvidenceVaultModal from '../components/os/EvidenceVaultModal.jsx';
import GapAnalysisModal from '../components/os/GapAnalysisModal.jsx';
import RoadmapModal from '../components/os/RoadmapModal.jsx';
import AIDiscoveryModal from '../components/os/AIDiscoveryModal.jsx';
import MarketingCopilotModal from '../components/os/MarketingCopilotModal.jsx';

const GRATUITAS = [
  { id: 'ai-discovery', nombre: 'AI Discovery', emoji: '🧠', estado: 'Nuevo', desc: 'La IA analiza tu evidencia y arma tu perfil conversando contigo.', accion: 'ai-discovery' },
  { id: 'startup-card', nombre: 'Startup Card', emoji: '🪪', estado: 'Activa', desc: 'El perfil vivo de tu startup: equipo, problema, solución y tracción.', accion: 'startup-card' },
  { id: 'mentor', nombre: 'Mentor Matching', emoji: '🤝', estado: 'Disponible', desc: 'Conecta con mentores afines a tu etapa e industria.', ruta: '/mentores' },
  { id: 'evidence', nombre: 'Evidence Vault', emoji: '🗂️', estado: 'Disponible', desc: 'Centraliza la evidencia y documentos clave de tu startup.', accion: 'evidence' },
  { id: 'gap', nombre: 'Gap Analysis', emoji: '📐', estado: 'Disponible', desc: 'Detecta brechas entre tu etapa actual y la siguiente.', accion: 'gap' },
  { id: 'roadmap', nombre: 'Roadmap', emoji: '🗺️', estado: 'Disponible', desc: 'Tu plan de hitos para avanzar de etapa con foco.', accion: 'roadmap' },
];

const PREMIUM = [
  { id: 'fin', nombre: 'Copiloto Financiero IA', emoji: '🤖', desc: 'Visibilidad financiera automática, alertas inteligentes y proyecciones.', mejora: 18, badge: 'Piloto gratis', proximamente: false, ruta: '/dashboard' },
  { id: 'com', nombre: 'Copiloto Comercial IA', emoji: '📈', desc: 'Optimiza tu pipeline, conversión y estrategia de ventas con IA.', mejora: 12, badge: 'Suscripción', proximamente: true },
  { id: 'mkt', nombre: 'Copiloto Marketing IA', emoji: '🎯', desc: 'ROAS, canales, presupuesto e insights de marketing con IA.', mejora: 10, badge: 'Piloto gratis', proximamente: false, accion: 'marketing' },
  { id: 'inv', nombre: 'Copiloto Inversión IA', emoji: '💼', desc: 'Prepara tu ronda con métricas y reportes listos para inversionistas.', mejora: 14, badge: 'Suscripción', proximamente: true },
  { id: 'ops', nombre: 'Copiloto Operaciones IA', emoji: '⚙️', desc: 'Automatiza procesos operativos y reduce trabajo administrativo.', mejora: 9, badge: 'Suscripción', proximamente: true },
];

function ToolGratuita({ t, onOpen }) {
  const navigate = useNavigate();
  const activable = Boolean(t.ruta) || Boolean(t.accion);
  const abrir = () => {
    if (t.accion) onOpen(t.accion);
    else if (t.ruta) navigate(t.ruta);
  };
  return (
    <div className="flex flex-col rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition duration-[180ms] hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-center justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-50 text-xl">{t.emoji}</span>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">{t.estado}</span>
      </div>
      <p className="mt-3 font-bold text-slate-800">{t.nombre}</p>
      <p className="mt-1 flex-1 text-sm text-slate-500">{t.desc}</p>
      <button
        onClick={abrir}
        disabled={!activable}
        className={`mt-4 rounded-xl py-2 text-sm font-semibold transition ${
          activable ? 'bg-slate-900 text-white hover:bg-slate-700 hover:shadow-md' : 'cursor-default bg-slate-100 text-slate-500'
        }`}
      >
        {activable ? 'Abrir' : 'Próximamente'}
      </button>
    </div>
  );
}

function ToolPremium({ t, onOpen }) {
  const navigate = useNavigate();
  const disponible = !t.proximamente;
  const abrir = () => {
    if (!disponible) return;
    if (t.accion) onOpen(t.accion);
    else if (t.ruta) navigate(t.ruta);
  };
  return (
    <div
      className={`premium-glow group relative flex flex-col rounded-3xl border p-5 transition ${
        disponible
          ? 'cursor-pointer border-premium-100 bg-gradient-to-b from-premium-50/60 to-white duration-[180ms] hover:-translate-y-0.5 hover:shadow-xl animate-glowPulse'
          : 'border-slate-100 bg-white'
      }`}
      onClick={abrir}
    >
      <div className="flex items-center justify-between">
        <span className={`grid h-11 w-11 place-items-center rounded-2xl text-xl ${disponible ? 'bg-premium-100' : 'bg-slate-50'}`}>{t.emoji}</span>
        <span className="text-slate-300 transition group-hover:text-premium">{disponible ? '✨' : '🔒'}</span>
      </div>
      <p className="mt-3 flex items-center gap-2 font-bold text-slate-800">
        {t.nombre}
        {t.proximamente && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Próximamente</span>}
      </p>
      <p className="mt-1 flex-1 text-sm text-slate-500">{t.desc}</p>

      <div className="mt-4 flex items-center justify-between">
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600">+{t.mejora}% preparación</span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${disponible ? 'bg-premium text-white shimmer' : 'bg-slate-100 text-slate-500'}`}>
          {t.badge}
        </span>
      </div>

      {disponible && (
        <button className="mt-4 rounded-xl bg-premium py-2 text-sm font-bold text-white transition group-hover:bg-premium-dark">
          Conocer más →
        </button>
      )}
    </div>
  );
}

export default function CentroHerramientas() {
  const [modal, setModal] = useState(null);

  return (
    <AppLayout>
      <div className="space-y-10">
        <header className="animate-fadeInUp">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Centro de Herramientas</h1>
          <p className="text-slate-500">Todo lo que tu startup necesita, en un solo lugar.</p>
        </header>

        {/* Gratuitas */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-lg font-extrabold text-slate-900">Herramientas gratuitas</h2>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">Incluidas</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GRATUITAS.map((t) => <ToolGratuita key={t.id} t={t} onOpen={setModal} />)}
          </div>
        </section>

        {/* Premium */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-lg font-extrabold text-slate-900">Herramientas premium</h2>
            <span className="rounded-full bg-premium-50 px-2.5 py-0.5 text-xs font-semibold text-premium">Copilotos IA</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PREMIUM.map((t) => <ToolPremium key={t.id} t={t} onOpen={setModal} />)}
          </div>
        </section>

        {/* Pricing del Copiloto Financiero */}
        <PricingCopiloto />
      </div>

      {/* Modales de herramientas gratuitas (mismo OS, sin nuevas páginas) */}
      {modal === 'ai-discovery' && <AIDiscoveryModal onClose={() => setModal(null)} />}
      {modal === 'startup-card' && <StartupCardModal onClose={() => setModal(null)} />}
      {modal === 'evidence' && <EvidenceVaultModal onClose={() => setModal(null)} />}
      {modal === 'gap' && <GapAnalysisModal onClose={() => setModal(null)} onAbrirHerramienta={(a) => setModal(a)} />}
      {modal === 'roadmap' && <RoadmapModal onClose={() => setModal(null)} onAbrirHerramienta={(a) => setModal(a)} />}
      {modal === 'marketing' && <MarketingCopilotModal onClose={() => setModal(null)} />}
    </AppLayout>
  );
}
