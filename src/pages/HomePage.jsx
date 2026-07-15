import { Navigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import LandingPage from '../components/LandingPage.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function HomePage() {
  const { autenticado, ready } = useAuth();
  // Sesión persistente: si ya hay sesión, entra directo (nunca vuelve al landing).
  if (ready && autenticado) return <Navigate to="/app" replace />;
  return (
    <>
      <Navbar />
      <LandingPage />
    </>
  );
}
