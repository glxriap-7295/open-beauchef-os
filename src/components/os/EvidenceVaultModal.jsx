import { useRef, useState } from 'react';
import ToolModal from './ToolModal.jsx';
import { usePreparacion } from '../../context/PreparacionContext.jsx';
import { TIPOS_EVIDENCIA } from '../../data/profileSchema.js';

const TIPOS = TIPOS_EVIDENCIA;

const ESTADO_STYLE = {
  Subiendo: 'bg-sky-100 text-sky-700 animate-pulse',
  Pendiente: 'bg-slate-100 text-slate-500',
  'Analizando...': 'bg-amber-100 text-amber-700 animate-pulse',
  Analizado: 'bg-emerald-100 text-emerald-700',
};

export default function EvidenceVaultModal({ onClose }) {
  const { documentos, subirDocumento, setEstadoDocumento, renombrarDocumento, eliminarDocumento } = usePreparacion();
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [editId, setEditId] = useState(null);
  const [editNombre, setEditNombre] = useState('');
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const analizar = (id) => {
    // Mock de estados: Subiendo -> Analizando... -> Analizado
    setEstadoDocumento(id, 'Subiendo');
    setTimeout(() => setEstadoDocumento(id, 'Analizando...'), 900);
    setTimeout(() => setEstadoDocumento(id, 'Analizado'), 2800);
  };

  const onFiles = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((f) => {
      const id = subirDocumento({ nombre: f.name, tipo });
      analizar(id);
    });
    e.target.value = '';
  };

  const agregarManual = () => {
    const id = subirDocumento({ nombre: `${tipo}.pdf`, tipo });
    analizar(id);
  };

  const guardarNombre = (id) => {
    if (editNombre.trim()) renombrarDocumento(id, editNombre.trim());
    setEditId(null);
  };

  return (
    <ToolModal
      icon="🗂️"
      titulo="Evidence Vault"
      subtitulo="Centraliza la evidencia de tu startup. La IA la analiza por ti."
      onClose={onClose}
    >
      {/* Zona de carga */}
      <div className="rounded-2xl border border-dashed border-brand-100 bg-brand-50/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition duration-[180ms] hover:bg-brand-dark hover:shadow-md"
          >
            Subir archivo
          </button>
          <button
            onClick={agregarManual}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            + Agregar ejemplo
          </button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={onFiles} />
        </div>
        <p className="mt-2 text-xs text-slate-500">Sube un documento y se clasificará como «{tipo}». El análisis es una demostración.</p>
      </div>

      {/* Lista */}
      <div className="mt-5 space-y-2">
        {documentos.length === 0 && (
          <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">
            📭 Aún no has subido documentos. Sube tu Pitch Deck o tu modelo financiero para empezar.
          </div>
        )}

        {documentos.map((d) => (
          <div key={d.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-lg">📄</span>
            <div className="min-w-0 flex-1">
              {editId === d.id ? (
                <input
                  autoFocus
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  onBlur={() => guardarNombre(d.id)}
                  onKeyDown={(e) => e.key === 'Enter' && guardarNombre(d.id)}
                  className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand"
                />
              ) : (
                <p className="truncate text-sm font-semibold text-slate-800">{d.nombre}</p>
              )}
              <p className="text-xs text-slate-500">{d.tipo}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${ESTADO_STYLE[d.estado] || 'bg-slate-100 text-slate-500'}`}>
              {d.estado}
            </span>
            <button
              onClick={() => setPreview(d)}
              className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-brand transition hover:bg-brand-50"
            >
              Vista previa
            </button>
            <button
              onClick={() => { setEditId(d.id); setEditNombre(d.nombre); }}
              className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
            >
              Renombrar
            </button>
            <button
              onClick={() => eliminarDocumento(d.id)}
              className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-rose-500 transition hover:bg-rose-50"
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>

      {/* Vista previa (mock) */}
      {preview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg animate-fadeInUp rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900">Vista previa</h3>
              <button onClick={() => setPreview(null)} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100">✕</button>
            </div>
            <div className="mt-4 grid h-56 place-items-center rounded-2xl border border-slate-100 bg-slate-50 text-center">
              <div>
                <p className="text-5xl">📄</p>
                <p className="mt-2 font-semibold text-slate-700">{preview.nombre}</p>
                <p className="text-sm text-slate-500">{preview.tipo} · {preview.estado}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              La previsualización del contenido estará disponible en la versión final. En esta demo mostramos los
              metadatos del documento.
            </p>
          </div>
        </div>
      )}
    </ToolModal>
  );
}
