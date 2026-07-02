import { useState } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';

/**
 * Shell del "sistema operativo" del emprendedor: barra lateral fija en desktop
 * y drawer en mobile. El contenido de cada página se pasa como children.
 */
export default function AppLayout({ children }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="min-h-screen bg-os-bg">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white/70 p-4 backdrop-blur lg:flex">
        <Sidebar />
      </aside>

      {/* Topbar mobile */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
        <Link to="/app" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-xs font-bold">OB</span>
          <span className="font-extrabold text-slate-800">Open Beauchef <span className="text-emerald-600">OS</span></span>
        </Link>
        <button
          onClick={() => setAbierto(true)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Abrir menú"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Drawer mobile */}
      {abierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setAbierto(false)} />
          <div className="absolute inset-y-0 left-0 w-72 animate-fadeInUp bg-white p-4 shadow-2xl">
            <Sidebar onNavigate={() => setAbierto(false)} />
          </div>
        </div>
      )}

      {/* Contenido */}
      <div className="lg:pl-64">
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
