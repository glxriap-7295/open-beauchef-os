import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/os/AppLayout.jsx';
import CopilotoOnboardingModal from '../components/os/CopilotoOnboardingModal.jsx';
import PricingCopiloto from '../components/os/PricingCopiloto.jsx';

/**
 * Página del Copiloto Financiero IA. Muestra el modal premium de onboarding
 * por encima de un resumen de la herramienta + planes. NO abre directamente el
 * dashboard financiero (eso ocurre al pulsar "Abrir demostración").
 */
export default function CopilotoFinanciero() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="space-y-8 opacity-60">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Copiloto Financiero IA</h1>
          <p className="text-slate-500">Tu asistente financiero 24/7, impulsado por IA.</p>
        </header>
        <PricingCopiloto />
      </div>

      <CopilotoOnboardingModal onVolver={() => navigate('/herramientas')} />
    </AppLayout>
  );
}
