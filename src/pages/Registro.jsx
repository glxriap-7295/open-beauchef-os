import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Registro() {
  const { register, autenticado, ready } = useAuth();
  const navigate = useNavigate();

  if (ready && autenticado) return <Navigate to="/app" replace />;

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setCargando(true);
    try {
      await register({ nombre, email, password });
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setError(err.message || 'No se pudo crear la cuenta.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-os-bg px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-xs font-bold">OB</span>
          <span className="font-extrabold text-slate-800">Open Beauchef <span className="text-emerald-600">OS</span></span>
        </Link>

        <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-sm">
          <h1 className="text-xl font-extrabold text-slate-900">Crear cuenta</h1>
          <p className="mt-1 text-sm text-slate-500">Empieza a construir el sistema operativo de tu startup.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Tu nombre</label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Email</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Contraseña</label>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <p className="mt-1 text-xs text-slate-400">Mínimo 6 caracteres.</p>
            </div>

            {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{error}</p>}

            <button
              type="submit"
              disabled={cargando}
              className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-60"
            >
              {cargando ? 'Creando…' : 'Crear cuenta'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="font-semibold text-brand hover:underline">Iniciar sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
