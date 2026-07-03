import { useState } from 'react';
import ToolModal from './ToolModal.jsx';
import { usePreparacion } from '../../context/PreparacionContext.jsx';

const CAMPOS = [
  { id: 'nombre', label: 'Nombre de la startup', tipo: 'input', placeholder: 'Ej: Acme Inc.' },
  { id: 'industria', label: 'Industria', tipo: 'input', placeholder: 'Ej: SaaS, Fintech, Retail…' },
  { id: 'etapa', label: 'Etapa', tipo: 'select', opciones: ['Idea', 'Validando Mercado', 'Preparándose para Escalar', 'Escalando'] },
  { id: 'sitioWeb', label: 'Sitio web', tipo: 'input', placeholder: 'https://…' },
  { id: 'problema', label: 'Problema que resuelves', tipo: 'textarea', placeholder: '¿Qué dolor de tus clientes resuelves?' },
  { id: 'solucion', label: 'Solución', tipo: 'textarea', placeholder: '¿Cómo lo resuelves?' },
  { id: 'modeloNegocio', label: 'Modelo de negocio y pricing', tipo: 'textarea', placeholder: '¿Cómo generas ingresos?' },
  { id: 'clienteObjetivo', label: 'Cliente objetivo (ICP)', tipo: 'textarea', placeholder: '¿A quién te diriges?' },
];

export default function StartupCardModal({ onClose }) {
  const { perfil, actualizarPerfil } = usePreparacion();
  const [form, setForm] = useState({ ...perfil });
  const [guardado, setGuardado] = useState(false);

  const set = (id, v) => {
    setForm((f) => ({ ...f, [id]: v }));
    setGuardado(false);
  };

  const guardar = () => {
    actualizarPerfil(form);
    setGuardado(true);
  };

  const completos = CAMPOS.filter((c) => String(form[c.id] || '').trim()).length;

  return (
    <ToolModal
      icon="🪪"
      titulo="Startup Card"
      subtitulo="El perfil vivo de tu startup. Se actualiza en tu panel al guardar."
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">{completos}/{CAMPOS.length} campos completos</span>
          <div className="flex items-center gap-3">
            {guardado && <span className="text-sm font-semibold text-emerald-600">✓ Guardado</span>}
            <button
              onClick={guardar}
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition duration-[180ms] hover:bg-brand-dark hover:shadow-md"
            >
              Guardar cambios
            </button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {CAMPOS.map((c) => (
          <div key={c.id} className={c.tipo === 'textarea' ? 'sm:col-span-2' : ''}>
            <label className="mb-1 block text-sm font-semibold text-slate-700">{c.label}</label>
            {c.tipo === 'input' && (
              <input
                value={form[c.id] || ''}
                onChange={(e) => set(c.id, e.target.value)}
                placeholder={c.placeholder}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            )}
            {c.tipo === 'select' && (
              <select
                value={form[c.id] || ''}
                onChange={(e) => set(c.id, e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                {c.opciones.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {c.tipo === 'textarea' && (
              <textarea
                value={form[c.id] || ''}
                onChange={(e) => set(c.id, e.target.value)}
                placeholder={c.placeholder}
                rows={2}
                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            )}
          </div>
        ))}
      </div>
    </ToolModal>
  );
}
