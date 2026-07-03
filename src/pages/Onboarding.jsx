import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { usePreparacion } from '../context/PreparacionContext.jsx';

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { actualizarPerfil, setFundadora, asegurarOwner, subirDocumento } = usePreparacion();

  const [nombre, setNombre] = useState('');
  const [sitioWeb, setSitioWeb] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [industria, setIndustria] = useState('');
  const [docs, setDocs] = useState([]); // {nombre}
  const fileRef = useRef(null);

  const onFiles = (e) => {
    const nuevos = Array.from(e.target.files || []).map((f) => ({ nombre: f.name }));
    setDocs((d) => [...d, ...nuevos]);
    e.target.value = '';
  };

  const finalizar = () => {
    const patch = { nombre: nombre.trim() };
    if (sitioWeb.trim()) patch.sitioWeb = sitioWeb.trim();
    if (industria.trim()) patch.industria = industria.trim();
    actualizarPerfil(patch);
    setFundadora(user?.nombre || '');
    asegurarOwner(user?.nombre, user?.email);
    if (linkedin.trim()) subirDocumento({ nombre: linkedin.trim(), tipo: 'LinkedIn' });
    docs.forEach((d) => subirDocumento({ nombre: d.nombre, tipo: 'Pitch Deck' }));
    navigate('/app', { replace: true });
  };

  const puedeSeguir = nombre.trim().length > 1;

  return (
    <div className="min-h-screen bg-os-bg px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-xs font-bold">OB</span>
          <span className="font-extrabold text-slate-800">Open Beauchef <span className="text-emerald-600">OS</span></span>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-sm">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {user?.nombre ? `¡Hola, ${user.nombre}!` : '¡Bienvenido/a!'} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Solo unos datos rápidos. Lo demás lo descubre la IA por ti — no más de 2 minutos.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Nombre de tu startup *</label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Acme Inc."
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Sitio web <span className="font-normal text-slate-400">(opcional)</span></label>
                <input value={sitioWeb} onChange={(e) => setSitioWeb(e.target.value)} placeholder="https://…" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">LinkedIn <span className="font-normal text-slate-400">(opcional)</span></label>
                <input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="linkedin.com/company/…" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Industria <span className="font-normal text-slate-400">(opcional)</span></label>
              <input value={industria} onChange={(e) => setIndustria(e.target.value)} placeholder="Ej: SaaS, Fintech, Salud…" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
            </div>

            <div className="rounded-2xl border border-dashed border-brand-100 bg-brand-50/40 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Documentos <span className="font-normal text-slate-400">(opcional)</span></p>
                <button onClick={() => fileRef.current?.click()} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-dark">Subir</button>
                <input ref={fileRef} type="file" multiple className="hidden" onChange={onFiles} />
              </div>
              {docs.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {docs.map((d, i) => <li key={i} className="truncate">📄 {d.nombre}</li>)}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Pitch Deck, modelo financiero, one-pager… la IA los analiza después.</p>
              )}
            </div>
          </div>

          <button
            onClick={finalizar}
            disabled={!puedeSeguir}
            className="mt-6 w-full rounded-xl bg-brand py-3 text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-50"
          >
            Entrar a mi panel →
          </button>
          <p className="mt-3 text-center text-xs text-slate-400">
            Podrás completar y editar todo tu perfil cuando quieras.
          </p>
        </div>
      </div>
    </div>
  );
}
