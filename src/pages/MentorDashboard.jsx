import { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/os/AppLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { esMentor } from '../utils/admin.js';
import { firebaseHabilitado } from '../services/firebase/app.js';
import { listStartups, listAsignaciones } from '../services/firebase/data.js';
import { camposFaltantes, completitudPerfil } from '../data/profileSchema.js';
import { transaccionesAMeses, consolidar } from '../utils/calculations.js';
import { formatCLP } from '../utils/formatters.js';

function Estado({ emoji, titulo, detalle }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
      <p className="text-4xl">{emoji}</p>
      <p className="mt-3 font-bold text-slate-800">{titulo}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{detalle}</p>
    </div>
  );
}

/** Resumen tipo "AI summary" derivado del perfil (sin inventar datos). */
function resumenIA(perfil) {
  const p = [];
  if (perfil.industria) p.push(`opera en ${perfil.industria}`);
  if (perfil.etapa) p.push(`está en etapa ${perfil.etapa}`);
  if (perfil.clienteObjetivo) p.push('tiene definido su cliente objetivo');
  if (!p.length) return 'Perfil aún incompleto; conviene reforzar la información base.';
  return `La startup ${p.join(', ')}.`;
}

function TarjetaStartup({ s }) {
  const perfil = s.estado?.perfil || {};
  const txs = s.estado?.transacciones || [];
  const meses = transaccionesAMeses(txs);
  const fin = meses.length ? consolidar(meses) : null;
  const docs = s.estado?.documentos || [];
  const gaps = camposFaltantes(perfil).slice(0, 3);
  const [notas, setNotas] = useState('');

  const alertas = [];
  if (fin && fin.ebitda < 0) alertas.push('EBITDA negativo en el período.');
  if (!s.fuenteFinanciera && !s.estado?.fuenteFinanciera) alertas.push('Sin datos financieros conectados.');
  if (completitudPerfil(perfil) < 50) alertas.push('Perfil incompleto (<50%).');

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-slate-800">{s.nombre || perfil.nombre || 'Startup'}</p>
          <p className="text-xs text-slate-400">{perfil.industria || '—'} · {completitudPerfil(perfil)}% de perfil</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">Asignada</span>
      </div>

      <div className="mt-3 rounded-xl bg-brand-50/50 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-brand">Resumen IA</p>
        <p className="text-sm text-slate-700">{resumenIA(perfil)}</p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Finanzas</p>
          {fin ? <p className="text-sm text-slate-600">Ingresos {formatCLP(fin.ingresos)} · EBITDA {formatCLP(fin.ebitda)}</p> : <p className="text-sm text-slate-400">Sin datos.</p>}
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Documentos</p>
          <p className="text-sm text-slate-600">{docs.length} cargado(s)</p>
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Alertas</p>
          <ul className="mt-1 space-y-0.5 text-sm text-amber-700">{alertas.map((a) => <li key={a}>⚠️ {a}</li>)}</ul>
        </div>
      )}

      <div className="mt-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Temas sugeridos para la reunión</p>
        <ul className="mt-1 flex flex-wrap gap-1.5">
          {gaps.length ? gaps.map((g) => <li key={g.key} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{g.label}</li>) : <li className="text-xs text-emerald-600">Perfil completo</li>}
        </ul>
      </div>

      <div className="mt-3">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Notas de la reunión</p>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Anota acuerdos y próximos pasos…" className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand" />
      </div>
    </div>
  );
}

export default function MentorDashboard() {
  const { user } = useAuth();
  const mentor = esMentor(user?.email);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!mentor || !firebaseHabilitado()) return;
    let vivo = true;
    Promise.all([listStartups(), listAsignaciones()])
      .then(([startups, asigs]) => {
        if (!vivo) return;
        const asignadas = new Set(asigs.map((a) => a.uid));
        setData(startups.filter((s) => asignadas.has(s.uid)));
      })
      .catch(() => { if (vivo) setError('No se pudieron cargar tus startups.'); });
    return () => { vivo = false; };
  }, [mentor]);

  const contenido = useMemo(() => {
    if (!mentor) return <Estado emoji="🔒" titulo="Acceso de mentor" detalle="Esta sección es para mentores de Open Beauchef. Pide acceso al equipo." />;
    if (!firebaseHabilitado()) return <Estado emoji="☁️" titulo="Requiere Firebase" detalle="Configura Firebase para ver tus startups asignadas." />;
    if (error) return <Estado emoji="⚠️" titulo="Error" detalle={error} />;
    if (data === null) return <div className="grid gap-3 sm:grid-cols-2">{[0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-3xl bg-slate-100" />)}</div>;
    if (data.length === 0) return <Estado emoji="🤝" titulo="Aún no tienes startups asignadas" detalle="Cuando el equipo de Open Beauchef te asigne una startup, aparecerá aquí con su resumen y alertas." />;
    return <div className="grid gap-4 lg:grid-cols-2">{data.map((s) => <TarjetaStartup key={s.uid} s={s} />)}</div>;
  }, [mentor, data, error]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <header className="animate-fadeInUp">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Panel de mentor</h1>
          <p className="text-slate-500">Tus startups asignadas, con resumen, alertas y temas para la reunión.</p>
        </header>
        {contenido}
      </div>
    </AppLayout>
  );
}
