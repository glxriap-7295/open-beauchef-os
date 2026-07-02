import { NavLink } from 'react-router-dom';
import { usePreparacion } from '../../context/PreparacionContext.jsx';

function Icon({ name, className = 'h-5 w-5' }) {
  const paths = {
    inicio: <path d="M3 11.5 12 4l9 7.5M5 10v10h14V10" />,
    herramientas: <path d="M4 7h6v6H4zM14 7h6v6h-6zM4 17h6v3H4zM14 17h6v3h-6z" />,
    copiloto: <path d="M12 3v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M3 12h3m12 0h3M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />,
    mentor: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20a8 8 0 0 1 16 0" />,
    reportes: <path d="M4 19V5m4 14V9m4 10V7m4 12v-6m4 6V4" />,
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
  const { empresa, fundadora, mentorDesbloqueado } = usePreparacion();

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

        <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">Próximamente</p>
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300">
          <Icon name="reportes" /> <span className="flex-1">Reportes Avanzados</span> <span>🔒</span>
        </div>
      </nav>

      {/* Usuario */}
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-premium-100 font-bold text-premium-dark">
          {fundadora?.[0] || 'P'}
        </span>
        <div className="leading-tight">
          <p className="text-sm font-bold text-slate-800">{fundadora}</p>
          <p className="text-xs text-slate-500">{empresa}</p>
        </div>
      </div>
    </div>
  );
}
