import { Link, useLocation } from 'react-router-dom';

export default function Navbar({ conexion }) {
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white font-bold">F</span>
            <span className="font-extrabold text-slate-800 text-lg tracking-tight">
              Financial <span className="text-brand">Copilot</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/"
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                pathname === '/' ? 'text-brand bg-brand-50' : 'text-slate-600 hover:text-brand hover:bg-brand-50'
              }`}
            >
              Inicio
            </Link>
            <Link
              to="/dashboard"
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                pathname === '/dashboard' ? 'text-brand bg-brand-50' : 'text-slate-600 hover:text-brand hover:bg-brand-50'
              }`}
            >
              Dashboard
            </Link>

            {conexion !== undefined && (
              <span
                title={conexion ? 'Datos en vivo desde el backend' : 'Backend no disponible — mostrando datos demo'}
                className={`ml-1 hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  conexion ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${conexion ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {conexion ? 'Backend conectado' : 'Modo demo'}
              </span>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
