import { useEffect, useRef, useState } from 'react';
import ToolModal from './ToolModal.jsx';
import { usePreparacion } from '../../context/PreparacionContext.jsx';
import { getAIProvider } from '../../services/ai/index.js';
import { notifications, NotificationEvents } from '../../services/notifications/index.js';
import { TIPOS_EVIDENCIA, completitudPerfil } from '../../data/profileSchema.js';

export default function AIDiscoveryModal({ onClose }) {
  const {
    perfil, documentos, subirDocumento, setEstadoDocumento,
    actualizarPerfil, agregarLogro,
  } = usePreparacion();

  const ai = getAIProvider();
  const [paso, setPaso] = useState('intro'); // intro | analizando | chat | listo
  const [tipo, setTipo] = useState(TIPOS_EVIDENCIA[0]);
  const [resumen, setResumen] = useState('');
  const [mensajes, setMensajes] = useState([]);
  const [campoActual, setCampoActual] = useState(null);
  const [input, setInput] = useState('');
  const [pensando, setPensando] = useState(false);
  const perfilRef = useRef({ ...perfil });
  const fileRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [mensajes, pensando]);

  const subir = (nombre) => {
    const id = subirDocumento({ nombre, tipo });
    return id;
  };
  const onFiles = (e) => {
    Array.from(e.target.files || []).forEach((f) => subir(f.name));
    e.target.value = '';
  };

  // ── Paso 2: análisis ──────────────────────────────────────────────
  const analizar = async () => {
    setPaso('analizando');
    notifications.solicitarPermiso();
    // Marca los documentos como analizados (evidencia procesada).
    documentos.forEach((d) => setEstadoDocumento(d.id, 'Analizado'));

    const { detectados, resumen: res } = await ai.analyzeEvidence(documentos, perfilRef.current);
    if (Object.keys(detectados).length) {
      perfilRef.current = { ...perfilRef.current, ...detectados };
      actualizarPerfil(detectados);
    }
    setResumen(res);
    notifications.emitir(NotificationEvents.analisisCompleto('Tu evidencia'));

    // Primera pregunta
    const q = await ai.nextQuestion(perfilRef.current, []);
    if (!q) {
      finalizar();
      return;
    }
    setCampoActual(q.campo);
    setMensajes([{ rol: 'assistant', contenido: res }, { rol: 'assistant', contenido: q.pregunta }]);
    setPaso('chat');
  };

  // ── Paso 3: conversación ──────────────────────────────────────────
  const responder = async () => {
    const texto = input.trim();
    if (!texto || pensando) return;
    setInput('');
    const historia = [...mensajes, { rol: 'user', contenido: texto }];
    setMensajes(historia);

    // Guarda la respuesta en el Startup Profile.
    if (campoActual) {
      perfilRef.current = { ...perfilRef.current, [campoActual]: texto };
      actualizarPerfil({ [campoActual]: texto });
    }

    setPensando(true);
    const q = await ai.nextQuestion(perfilRef.current, historia);
    setPensando(false);

    if (!q) {
      setMensajes((m) => [...m, { rol: 'assistant', contenido: '¡Listo! Ya tengo lo que necesitaba. Tu Startup Profile quedó mucho más completo. 🙌' }]);
      finalizar();
      return;
    }
    setCampoActual(q.campo);
    setMensajes((m) => [...m, { rol: 'assistant', contenido: q.pregunta }]);
  };

  const finalizar = () => {
    agregarLogro('AI Discovery completado', '🧠');
    notifications.emitir(NotificationEvents.nuevaRecomendacion('Tu perfil se actualizó. Revisa el Roadmap para tus próximos pasos.'));
    setPaso('listo');
  };

  const completitud = completitudPerfil(perfilRef.current);

  return (
    <ToolModal
      icon="🧠"
      titulo="AI Discovery"
      subtitulo={`Asistente ${ai.esFallback ? 'Open Beauchef' : ai.nombre} · construye tu perfil conversando`}
      onClose={onClose}
      footer={
        paso === 'chat' ? (
          <form
            onSubmit={(e) => { e.preventDefault(); responder(); }}
            className="flex items-center gap-2"
          >
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu respuesta…"
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <button
              type="submit"
              disabled={pensando || !input.trim()}
              className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-50"
            >
              Enviar
            </button>
          </form>
        ) : null
      }
    >
      {/* Paso 1: intro + evidencia */}
      {paso === 'intro' && (
        <div>
          <p className="text-sm text-slate-600">
            Sube la evidencia que tengas (Pitch Deck, modelo financiero, sitio web, etc.). La IA la analiza y
            <b> solo te pregunta lo que falta</b> — nunca lo que ya está en tus documentos.
          </p>

          <div className="mt-4 rounded-2xl border border-dashed border-brand-100 bg-brand-50/40 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand"
              >
                {TIPOS_EVIDENCIA.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={() => fileRef.current?.click()} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-dark">
                Subir evidencia
              </button>
              <button onClick={() => subir(`${tipo}.pdf`)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                + Ejemplo
              </button>
              <input ref={fileRef} type="file" multiple className="hidden" onChange={onFiles} />
            </div>
          </div>

          {documentos.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {documentos.map((d) => (
                <li key={d.id} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm">
                  <span>📄</span>
                  <span className="flex-1 truncate text-slate-700">{d.nombre}</span>
                  <span className="text-xs text-slate-400">{d.tipo}</span>
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={analizar}
            className="mt-5 w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
          >
            {documentos.length ? 'Analizar evidencia y comenzar' : 'Comenzar sin evidencia'}
          </button>
        </div>
      )}

      {/* Paso 2: animación de análisis */}
      {paso === 'analizando' && (
        <div className="flex flex-col items-center py-10 text-center">
          <div className="relative grid h-24 w-24 place-items-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-brand/20" />
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand text-3xl text-white animate-floaty">🧠</span>
          </div>
          <p className="mt-5 font-bold text-slate-800">Analizando tu evidencia…</p>
          <p className="mt-1 text-sm text-slate-500">Extrayendo lo que ya sabemos para no volver a preguntártelo.</p>
        </div>
      )}

      {/* Paso 3: chat */}
      {paso === 'chat' && (
        <div ref={scrollRef} className="max-h-[42vh] space-y-3 overflow-y-auto pr-1">
          {mensajes.map((m, i) => (
            <div key={i} className={`flex ${m.rol === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                m.rol === 'user' ? 'rounded-br-sm bg-brand text-white' : 'rounded-bl-sm bg-slate-100 text-slate-700'
              }`}>
                {m.contenido}
              </div>
            </div>
          ))}
          {pensando && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2.5 text-sm text-slate-400">Escribiendo…</div>
            </div>
          )}
        </div>
      )}

      {/* Paso 4: listo */}
      {paso === 'listo' && (
        <div className="py-6 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500 text-3xl text-white animate-floaty">✓</div>
          <p className="mt-4 text-lg font-extrabold text-slate-900">Tu Startup Profile está más completo</p>
          <p className="mt-1 text-sm text-slate-500">Completitud del perfil: <b className="text-emerald-600">{completitud}%</b></p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            Todo lo que conversamos ya está guardado y disponible para el resto del OS: Gap Analysis, Roadmap,
            Mentores y el Copiloto Financiero.
          </p>
          <button onClick={onClose} className="mt-5 rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark">
            Ver mi panel
          </button>
        </div>
      )}
    </ToolModal>
  );
}
