import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { PreparacionProvider } from './context/PreparacionContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import HomePage from './pages/HomePage.jsx';
import Login from './pages/Login.jsx';
import Registro from './pages/Registro.jsx';
import Onboarding from './pages/Onboarding.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import PanelPrincipal from './pages/PanelPrincipal.jsx';
import CentroHerramientas from './pages/CentroHerramientas.jsx';
import CopilotoFinanciero from './pages/CopilotoFinanciero.jsx';
import WalkthroughFuturo from './pages/WalkthroughFuturo.jsx';
import Mentores from './pages/Mentores.jsx';
import Configuracion from './pages/Configuracion.jsx';

function Privada({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <AuthProvider>
      <PreparacionProvider>
        <Routes>
          {/* Público */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />

          {/* Privado */}
          <Route path="/onboarding" element={<Privada><Onboarding /></Privada>} />
          <Route path="/app" element={<Privada><PanelPrincipal /></Privada>} />
          <Route path="/herramientas" element={<Privada><CentroHerramientas /></Privada>} />
          <Route path="/mentores" element={<Privada><Mentores /></Privada>} />
          <Route path="/configuracion" element={<Privada><Configuracion /></Privada>} />

          {/* Copiloto Financiero IA */}
          <Route path="/copiloto" element={<Privada><CopilotoFinanciero /></Privada>} />
          <Route path="/copiloto/futuro" element={<Privada><WalkthroughFuturo /></Privada>} />
          <Route path="/copiloto/demo" element={<Privada><DashboardPage /></Privada>} />

          {/* Alias histórico de la demo financiera */}
          <Route path="/dashboard" element={<Privada><DashboardPage /></Privada>} />

          <Route path="*" element={<HomePage />} />
        </Routes>
      </PreparacionProvider>
    </AuthProvider>
  );
}
