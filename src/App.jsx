import { Routes, Route } from 'react-router-dom';
import { PreparacionProvider } from './context/PreparacionContext.jsx';
import HomePage from './pages/HomePage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import PanelPrincipal from './pages/PanelPrincipal.jsx';
import CentroHerramientas from './pages/CentroHerramientas.jsx';
import CopilotoFinanciero from './pages/CopilotoFinanciero.jsx';
import WalkthroughFuturo from './pages/WalkthroughFuturo.jsx';
import Mentores from './pages/Mentores.jsx';

export default function App() {
  return (
    <PreparacionProvider>
      <Routes>
        {/* Público */}
        <Route path="/" element={<HomePage />} />

        {/* Sistema operativo del emprendedor */}
        <Route path="/app" element={<PanelPrincipal />} />
        <Route path="/herramientas" element={<CentroHerramientas />} />
        <Route path="/mentores" element={<Mentores />} />

        {/* Copiloto Financiero IA */}
        <Route path="/copiloto" element={<CopilotoFinanciero />} />
        <Route path="/copiloto/futuro" element={<WalkthroughFuturo />} />
        <Route path="/copiloto/demo" element={<DashboardPage />} />

        {/* Alias histórico: la demo financiera sigue accesible aquí */}
        <Route path="/dashboard" element={<DashboardPage />} />

        <Route path="*" element={<HomePage />} />
      </Routes>
    </PreparacionProvider>
  );
}
