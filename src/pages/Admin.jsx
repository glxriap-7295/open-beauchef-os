import { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/os/AppLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { esAdmin } from '../utils/admin.js';
import { firebaseHabilitado } from '../services/firebase/app.js';
import { listStartups, assignMentor } from '../services/firebase/data.js';
import { completitudPerfil, camposFaltantes, PROFILE_FIELDS } from '../data/profileSchema.js';
import { matchMentores } from '../services/ai/matching.js';
import { transaccionesAMeses, consolidar } from '../utils/calculations.js';
import { formatCLP } from '../utils/formatters.js';
import { notifications, NotificationEvents } from '../services/notifications/index.js';

function Estado({ titulo, detalle, emoji }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
      <p className="text-4xl">{emoji}</p>
      <p className="mt-3 font-bold text-slate-800">{titulo}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{detalle}</p>
    </div>
  );
}

const label = (k) => PROFILE_FIELDS.find((f) => f.key === k)?.label || k;

/* ── Panel de match de mentores ── */
function MentorMatch({ perfil, uid, onAsignado }) {
  const ranking = useMemo(() => matchMentores(perfil), [perfil]);
  const [asignando, setAsignando] = useState(null);
  const [asignado, setAsignado] = useState(null);
  const top = ranking[0];
  const alt = ranking.slice(1, 3);

  const asignar = async (m) => {
    setAsignando(m.mentor.id);
    try {
      await assignMentor(uid, m.mentor, 'admin');
      setAsignado(m.mentor.nombre);
      onAsignado?.(m.mentor);
    } catch { /* rules pueden requerir permiso admin */ }
    setAsignando(null);
  };

  const Card = ({ r, destacado }) => (
    <div className={`rounded-2xl border p-4 ${destacado ? 'border-premium-100 bg-premium-50/40' : 'border-slate-100'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-lg shadow-sm">{r.mentor.foto}</span>
          <div>
            <p className="text-sm font-bold text-slate-800">{r.mentor.nombre}</p>
            <p className="text-xs text-slate-500">{r.mentor.expertise.slice(0, 3).join(' · ')}</p>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${r.score >= 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'}`}>{r.score}%</span>
      </div>
      {destacado && (
        <>
          <div className="mt-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Fortalezas</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {r.fortalezas.map((f) => <li key={f} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">{f}</li>)}
            </ul>
          </div>
          {r.riesgos.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Riesgos</p>
              <ul className="mt-1 space-y-0.5 text-xs text-slate-500">{r.riesgos.map((x) => <li key={x}>• {x}</li>)}</ul>
            </div>
          )}
        </>
      )}
      <button
        onClick={() => asignar(r)}
        disabled={asignando === r.mentor.id}
        className={`mt-3 w-full rounded-lg py-2 text-xs font-bold transition ${destacado ? 'bg-premium text-white hover:bg-premium-dark' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
      >
        {asignando === r.mentor.id ? 'Asignando…' : `Asignar a ${r.mentor.nombre.split(' ')[0]}`}
      </button>
    </div>
  );

  return (
    <div>
      <p className="mb-1 text-sm font-bold text-slate-800">Match de mentores (IA)</p>
      <p className="mb-3 text-xs text-slate-500">La IA sugiere; <b>la decisión final es tuya</b>. Nunca se asigna automáticamente.</p>
      {asignado && <p className="mb-3 rounded-xl bg-emerald-50 p-2.5 text-sm font-semibold text-emerald-700">✓ Mentor asignado: {asignado}</p>}
      {top && <Card r={top} destacado />}
      {alt.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <p className="col-span-full text-[11px] font-bold uppercase tracking-wide text-slate-400">Alternativas</p>
          {alt.map((r) => <Card key={r.mentor.id} r={r} />)}
        </div>
      )}
    </div>
  );
}

/* ── Drawer de detalle de startup ── */
function StartupDrawer({ s, onClose }) {
  const perfil = s.estado?.perfil || {};
  const txs = s.estado?.transacciones || [];
  const meses = transaccionesAMeses(txs);
  const fin = meses.length ? consolidar(meses) : null;
  const docs = s.estado?.documentos || [];
  const logros = s.estado?.logros || [];
  const gaps = camposFaltantes(perfil);

  const Seccion = ({ titulo, children }) => (
    <div className="rounded-2xl border border-slate-100 p-4">
      <p className="mb-2 text-sm font-bold text-slate-800">{titulo}</p>
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative h-full w-full max-w-lg animate-fadeInUp overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/90 p-5 backdrop-blur">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">{s.nombre || perfil.nombre || 'Startup'}</h2>
            <p className="text-xs text-slate-500">{s.email} · {completitudPerfil(perfil)}% de perfil</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>

        <div className="space-y-4 p-5">
          <Seccion titulo="Startup Profile">
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {['industria', 'etapa', 'problema', 'solucion', 'clienteObjetivo', 'modeloNegocio', 'sitioWeb', 'equipo'].map((k) => (
                <div key={k} className={k === 'problema' || k === 'solucion' ? 'sm:col-span-2' : ''}>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label(k)}</dt>
                  <dd className="text-sm text-slate-700">{perfil[k] ? perfil[k] : <span className="text-amber-500">—</span>}</dd>
                </div>
              ))}
            </dl>
          </Seccion>

          <div className="grid gap-4 sm:grid-cols-2">
            <Seccion titulo="Resumen financiero">
              {fin ? (
                <div className="space-y-1 text-sm">
                  <p className="text-slate-500">Ingresos: <b className="text-emerald-600">{formatCLP(fin.ingresos)}</b></p>
                  <p className="text-slate-500">Gastos: <b className="text-rose-500">{formatCLP(fin.gastosTotales)}</b></p>
                  <p className="text-slate-500">EBITDA: <b className="text-slate-800">{formatCLP(fin.ebitda)}</b></p>
                  <p className="text-xs text-slate-400">{txs.length} movimientos · {s.fuenteFinanciera || 'sin fuente'}</p>
                </div>
              ) : <p className="text-sm text-slate-400">Sin datos financieros conectados.</p>}
            </Seccion>
            <Seccion titulo="Marketing">
              <p className="text-sm text-slate-400">Se activa cuando el fundador usa el Copiloto Marketing.</p>
            </Seccion>
          </div>

          <Seccion titulo={`Documentos (${docs.length})`}>
            {docs.length ? (
              <ul className="space-y-1 text-sm text-slate-600">{docs.slice(0, 6).map((d) => <li key={d.id} className="truncate">📄 {d.nombre} <span className="text-xs text-slate-400">· {d.tipo}</span></li>)}</ul>
            ) : <p className="text-sm text-slate-400">Sin documentos.</p>}
          </Seccion>

          <div className="grid gap-4 sm:grid-cols-2">
            <Seccion titulo={`Gap Analysis (${gaps.length})`}>
              {gaps.length ? <ul className="space-y-0.5 text-sm text-slate-600">{gaps.slice(0, 5).map((g) => <li key={g.key}>• {g.label}</li>)}</ul> : <p className="text-sm text-emerald-600">Perfil completo 🎉</p>}
            </Seccion>
            <Seccion titulo="Actividad">
              {logros.length ? <ul className="space-y-0.5 text-sm text-slate-600">{logros.slice(0, 5).map((l) => <li key={l.id}>{l.icono} {l.titulo}</li>)}</ul> : <p className="text-sm text-slate-400">Sin actividad reciente.</p>}
            </Seccion>
          </div>

          <div className="rounded-2xl border border-premium-100 bg-premium-50/30 p-4">
            <MentorMatch perfil={perfil} uid={s.uid} onAsignado={(m) => notifications.emitir(NotificationEvents.mentorAsignado(m.nombre))} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const admin = esAdmin(user?.email);
  const [startups, setStartups] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [orden, setOrden] = useState('prep');
  const [sel, setSel] = useState(null);

  useEffect(() => {
    if (!admin || !firebaseHabilitado()) return;
    let vivo = true;
    listStartups().then((rows) => { if (vivo) setStartups(rows); }).catch(() => { if (vivo) setError('No se pudieron cargar las startups.'); });
    return () => { vivo = false; };
  }, [admin]);

  const filtradas = useMemo(() => {
    if (!startups) return [];
    const t = q.trim().toLowerCase();
    let r = startups.filter((s) => !t || (s.nombre || '').toLowerCase().includes(t) || (s.email || '').toLowerCase().includes(t) || (s.estado?.perfil?.industria || '').toLowerCase().includes(t));
    r = [...r].sort((a, b) => {
      if (orden === 'prep') return completitudPerfil(b.estado?.perfil) - completitudPerfil(a.estado?.perfil);
      if (orden === 'reciente') return (b.actualizado || 0) - (a.actualizado || 0);
      return (a.nombre || '').localeCompare(b.nombre || '');
    });
    return r;
  }, [startups, q, orden]);

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
          <div className="grid gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-100" />)}</div>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, email o industria…" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand sm:max-w-sm" />
              <select value={orden} onChange={(e) => setOrden(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand">
                <option value="prep">Ordenar: Preparación</option>
                <option value="reciente">Ordenar: Actividad reciente</option>
                <option value="nombre">Ordenar: Nombre</option>
              </select>
            </div>

            {filtradas.length === 0 ? (
              <Estado emoji="🌱" titulo="Sin resultados" detalle="No hay startups que coincidan. Cuando las emprendedoras completen su perfil, aparecerán aquí." />
            ) : (
              <div className="overflow-x-auto rounded-3xl border border-slate-100 bg-white p-2 shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-3 py-2 font-semibold">Startup</th>
                      <th className="px-3 py-2 font-semibold">Industria</th>
                      <th className="px-3 py-2 text-center font-semibold">Perfil</th>
                      <th className="px-3 py-2 text-center font-semibold">Finanzas</th>
                      <th className="px-3 py-2 font-semibold">Actualizado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtradas.map((s) => {
                      const perfil = s.estado?.perfil || {};
                      const fuente = s.fuenteFinanciera || s.estado?.fuenteFinanciera;
                      return (
                        <tr key={s.uid} onClick={() => setSel(s)} className="cursor-pointer hover:bg-brand-50/40">
                          <td className="px-3 py-3">
                            <p className="font-semibold text-slate-800">{s.nombre || perfil.nombre || '—'}</p>
                            <p className="text-xs text-slate-400">{s.email}</p>
                          </td>
                          <td className="px-3 py-3 text-slate-500">{perfil.industria || '—'}</td>
                          <td className="px-3 py-3 text-center"><span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand">{completitudPerfil(perfil)}%</span></td>
                          <td className="px-3 py-3 text-center">{fuente ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">{fuente === 'fintoc' ? 'Open Banking' : fuente === 'demo' ? 'Demo' : 'Manual'}</span> : <span className="text-xs text-slate-400">—</span>}</td>
                          <td className="px-3 py-3 text-slate-500">{s.actualizado ? new Date(s.actualizado).toLocaleDateString('es-CL') : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {sel && <StartupDrawer s={sel} onClose={() => setSel(null)} />}
    </AppLayout>
  );
}
