import { NavLink, useNavigate } from 'react-router-dom';
import { usePreparacion } from '../../context/PreparacionContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { esAdmin, esMentor } from '../../utils/admin.js';

function Icon({ name, className = 'h-5 w-5' }) {
  const paths = {
    inicio: <path d="M3 11.5 12 4l9 7.5M5 10v10h14V10" />,
    herramientas: <path d="M4 7h6v6H4zM14 7h6v6h-6zM4 17h6v3H4zM14 17h6v3h-6z" />,
    copiloto: <path d="M12 3v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M3 12h3m12 0h3M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />,
    mentor: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20a8 8 0 0 1 16 0" />,
    reportes: <path d="M4 19V5m4 14V9m4 10V7m4 12v-6m4 6V4" />,
    settings: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 3.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 3.6h.09A1.65 1.65 0 0 0 9 2.09V2a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 16 3.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 20.4 8v.09c.2.61.76 1.02 1.42 1.02H22a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {paths[name]}
    </svg>
  );
}

const baseItem =
  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition';

function Item({ to, icon, children, badge, locked, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `${baseItem} ${
          isActive
            ? 'bg-premium-50 text-premium-dark'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
        }`
      }
    >
      <span className="text-slate-500 group-hover:text-slate-600"><Icon name={icon} /></span>
      <span className="flex-1">{children}</span>
      {badge && (
        <span className="rounded-full bg-premium px-2 py-0.5 text-[10px] font-bold text-white">{badge}</span>
      )}
      {locked && <span className="text-slate-300">🔒</span>}
    </NavLink>
  );
}

export default function Sidebar({ onNavigate }) {
  const { empresa, mentorDesbloqueado } = usePreparacion();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const cerrarSesion = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const nombreMostrado = user?.nombre || 'Fundador/a';
  const inicial = (nombreMostrado[0] || 'U').toUpperCase();

  return (
    <div className="flex h-full flex-col" onClick={onNavigate}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2 py-1">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="2.5" fill="currentColor" />
          </svg>
        </span>
        <div className="leading-tight">
          <p className="text-sm font-extrabold tracking-tight text-slate-800">Open Beauchef</p>
          <p className="-mt-0.5 text-[11px] font-semibold text-emerald-600">OS</p>
        </div>
      </div>

      {/* Navegación */}
      <nav className="mt-6 flex-1 space-y-1">
        <Item to="/app" icon="inicio" end>Inicio</Item>
        <Item to="/herramientas" icon="herramientas">Centro de Herramientas</Item>
        <Item to="/copiloto" icon="copiloto" badge="Nuevo">Copiloto Financiero IA</Item>
        <Item to="/mentores" icon="mentor" locked={!mentorDesbloqueado}>Mentores</Item>
        <Item to="/configuracion" icon="settings">Configuración</Item>
        {esAdmin(user?.email) && <Item to="/admin" icon="reportes" badge="Admin">Administración</Item>}
        {esMentor(user?.email) && <Item to="/mentor" icon="mentor" badge="Mentor">Panel de mentor</Item>}

        <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">Próximamente</p>
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300">
          <Icon name="reportes" /> <span className="flex-1">Reportes Avanzados</span> <span>🔒</span>
        </div>
      </nav>

      {/* Usuario */}
      <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-premium-100 font-bold text-premium-dark">
            {inicial}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold text-slate-800">{nombreMostrado}</p>
            <p className="truncate text-xs text-slate-500">{empresa || user?.email || ''}</p>
          </div>
        </div>
        <button
          onClick={cerrarSesion}
          className="mt-2 w-full rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
