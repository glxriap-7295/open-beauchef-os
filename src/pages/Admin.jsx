import { useEffect, useState } from 'react';
import AppLayout from '../components/os/AppLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { esAdmin } from '../utils/admin.js';
import { firebaseHabilitado } from '../services/firebase/app.js';
import { listStartups } from '../services/firebase/data.js';
import { completitudPerfil } from '../data/profileSchema.js';

function Estado({ titulo, detalle, emoji }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
      <p className="text-4xl">{emoji}</p>
      <p className="mt-3 font-bold text-slate-800">{titulo}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{detalle}</p>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const admin = esAdmin(user?.email);
  const [startups, setStartups] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!admin || !firebaseHabilitado()) return;
    let vivo = true;
    listStartups()
      .then((rows) => { if (vivo) setStartups(rows); })
      .catch(() => { if (vivo) setError('No se pudieron cargar las startups.'); });
    return () => { vivo = false; };
  }, [admin]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <header className="animate-fadeInUp">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Panel de administración</h1>
          <p className="text-slate-500">Todas las startups del piloto de Open Beauchef.</p>
        </header>

        {!admin ? (
          <Estado emoji="🔒" titulo="Acceso restringido" detalle="Esta sección es solo para administradores de Open Beauchef." />
        ) : !firebaseHabilitado() ? (
          <Estado emoji="☁️" titulo="Requiere Firebase" detalle="Configura las variables VITE_FIREBASE_* para ver a las startups del piloto en tiempo real." />
        ) : error ? (
          <Estado emoji="⚠️" titulo="Error" detalle={error} />
        ) : startups === null ? (
          <div className="rounded-3xl border border-slate-100 bg-white p-10 text-center text-slate-400">Cargando startups…</div>
        ) : startups.length === 0 ? (
          <Estado emoji="🌱" titulo="Aún no hay startups" detalle="Cuando las emprendedoras creen su cuenta y completen su perfil, aparecerán aquí." />
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-slate-100 bg-white p-2 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2 font-semibold">Startup</th>
                  <th className="px-3 py-2 font-semibold">Fundador/a</th>
                  <th className="px-3 py-2 text-center font-semibold">Perfil</th>
                  <th className="px-3 py-2 text-center font-semibold">Finanzas</th>
                  <th className="px-3 py-2 font-semibold">Actualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {startups.map((s) => {
                  const perfil = s.estado?.perfil || {};
                  const pct = completitudPerfil(perfil);
                  const fuente = s.fuenteFinanciera || s.estado?.fuenteFinanciera;
                  return (
                    <tr key={s.uid} className="hover:bg-slate-50/60">
                      <td className="px-3 py-3 font-semibold text-slate-800">{s.nombre || perfil.nombre || '—'}</td>
                      <td className="px-3 py-3 text-slate-500">{s.email || '—'}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand">{pct}%</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {fuente
                          ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">{fuente === 'fintoc' ? 'Open Banking' : fuente === 'demo' ? 'Demo' : 'Manual'}</span>
                          : <span className="text-xs text-slate-400">Sin conectar</span>}
                      </td>
                      <td className="px-3 py-3 text-slate-500">{s.actualizado ? new Date(s.actualizado).toLocaleString('es-CL') : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
