import { useEffect, useState } from 'react';
import AppLayout from '../components/os/AppLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePreparacion } from '../context/PreparacionContext.jsx';
import { notifications } from '../services/notifications/index.js';
import { banking } from '../services/banking/index.js';
import { getAIProvider } from '../services/ai/index.js';

const TABS = ['Perfil', 'Startup', 'Equipo', 'Integraciones', 'Notificaciones', 'Facturación'];

function Campo({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-slate-700">{label}</label>
      {children}
    </div>
  );
}
const inputCls = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

/* ── Perfil ── */
function TabPerfil() {
  const { user, actualizarUsuario } = useAuth();
  const [nombre, setNombre] = useState(user?.nombre || '');
  const [password, setPassword] = useState('');
  const [idioma, setIdioma] = useState('Español (Chile)');
  const [ok, setOk] = useState('');

  const guardar = async () => {
    await actualizarUsuario({ nombre, ...(password ? { password } : {}) });
    setPassword('');
    setOk('Cambios guardados');
    setTimeout(() => setOk(''), 2000);
  };

  return (
    <div className="max-w-lg space-y-4">
      <Campo label="Nombre"><input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} /></Campo>
      <Campo label="Email"><input className={`${inputCls} bg-slate-50`} value={user?.email || ''} readOnly /></Campo>
      <Campo label="Nueva contraseña"><input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Déjalo vacío para no cambiarla" /></Campo>
      <Campo label="Idioma">
        <select className={inputCls} value={idioma} onChange={(e) => setIdioma(e.target.value)}>
          <option>Español (Chile)</option><option>Español</option><option>English</option>
        </select>
      </Campo>
      <div className="flex items-center gap-3">
        <button onClick={guardar} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark">Guardar</button>
        {ok && <span className="text-sm font-semibold text-emerald-600">✓ {ok}</span>}
      </div>
    </div>
  );
}

/* ── Startup ── */
function TabStartup() {
  const { perfil, actualizarPerfil } = usePreparacion();
  const [form, setForm] = useState({
    industria: perfil.industria || '', sitioWeb: perfil.sitioWeb || '', etapa: perfil.etapa || '', descripcion: perfil.descripcion || '',
  });
  const [ok, setOk] = useState(false);
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setOk(false); };
  const guardar = () => { actualizarPerfil(form); setOk(true); setTimeout(() => setOk(false), 2000); };

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-3xl">🚀</span>
        <div>
          <p className="font-bold text-slate-800">{perfil.nombre || 'Tu startup'}</p>
          <p className="text-xs text-slate-500">El logo se personalizará en la versión final.</p>
        </div>
      </div>
      <Campo label="Industria"><input className={inputCls} value={form.industria} onChange={(e) => set('industria', e.target.value)} /></Campo>
      <Campo label="Sitio web"><input className={inputCls} value={form.sitioWeb} onChange={(e) => set('sitioWeb', e.target.value)} placeholder="https://…" /></Campo>
      <Campo label="Etapa">
        <select className={inputCls} value={form.etapa} onChange={(e) => set('etapa', e.target.value)}>
          <option value="">—</option><option>Idea</option><option>Validando Mercado</option><option>Preparándose para Escalar</option><option>Escalando</option>
        </select>
      </Campo>
      <Campo label="Descripción"><textarea rows={3} className={`${inputCls} resize-none`} value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)} placeholder="¿Qué hace tu startup en una frase?" /></Campo>
      <div className="flex items-center gap-3">
        <button onClick={guardar} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark">Guardar</button>
        {ok && <span className="text-sm font-semibold text-emerald-600">✓ Guardado</span>}
      </div>
    </div>
  );
}

/* ── Equipo ── */
function TabEquipo() {
  const { user } = useAuth();
  const { miembros, invitaciones, asegurarOwner, invitarMiembro, cancelarInvitacion, eliminarMiembro } = usePreparacion();
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState('Employee');

  useEffect(() => { asegurarOwner(user?.nombre, user?.email); }, [asegurarOwner, user]);

  const invitar = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    invitarMiembro(email, rol);
    setEmail('');
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-2xl border border-slate-100 bg-white p-4">
        <p className="mb-3 text-sm font-bold text-slate-800">Invitar a un colaborador</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@empresa.com" />
          <select className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand" value={rol} onChange={(e) => setRol(e.target.value)}>
            <option value="Employee">Empleado</option><option value="Owner">Owner</option>
          </select>
          <button onClick={invitar} className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark">Invitar</button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Los empleados pueden subir boletas, facturas y documentos, y categorizar gastos. Los owners gestionan al equipo.</p>
      </div>

      {invitaciones.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-bold text-slate-800">Invitaciones pendientes</p>
          <ul className="space-y-2">
            {invitaciones.map((i) => (
              <li key={i.id} className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-sm">
                <span className="flex-1 truncate text-slate-700">{i.email}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-amber-700">{i.rol === 'Owner' ? 'Owner' : 'Empleado'} · pendiente</span>
                <button onClick={() => cancelarInvitacion(i.id)} className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-50">Cancelar</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-bold text-slate-800">Miembros</p>
        <ul className="space-y-2">
          {miembros.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 text-sm">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 font-bold text-brand">{(m.nombre || m.email || '?')[0].toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-800">{m.nombre || m.email}</p>
                <p className="truncate text-xs text-slate-500">{m.email}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${m.rol === 'Owner' ? 'bg-premium-50 text-premium' : 'bg-slate-100 text-slate-500'}`}>{m.rol === 'Owner' ? 'Owner' : 'Empleado'}</span>
              {m.rol !== 'Owner' && <button onClick={() => eliminarMiembro(m.id)} className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-50">Quitar</button>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── Integraciones ── */
function FilaInt({ icon, nombre, desc, estado, tono }) {
  const tonos = { ok: 'bg-emerald-50 text-emerald-600', pend: 'bg-amber-50 text-amber-700', off: 'bg-slate-100 text-slate-500' };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 p-4">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-lg">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-bold text-slate-800">{nombre}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tonos[tono]}`}>{estado}</span>
    </div>
  );
}
function TabIntegraciones() {
  const { fintoc: fintocEstado } = usePreparacion();
  const fintocConfig = banking.openBankingDisponible();
  const ai = getAIProvider();
  const notiOk = notifications.soportado() && notifications.permiso() === 'granted';
  const fintocDesc = fintocEstado?.conectado
    ? `${fintocEstado.banco || 'Banco'} · ${fintocEstado.cuentas || 0} cuenta(s)${fintocEstado.ultimaSync ? ` · última sync ${new Date(fintocEstado.ultimaSync).toLocaleDateString('es-CL')}` : ''}`
    : fintocConfig ? 'Configurado y listo para sincronizar.' : 'Configura las variables de entorno para activarlo.';
  const fintocEstadoTxt = fintocEstado?.conectado ? 'Conectado' : fintocConfig ? 'Listo' : 'No configurado';
  const fintocTono = fintocEstado?.conectado ? 'ok' : fintocConfig ? 'pend' : 'off';
  return (
    <div className="max-w-2xl space-y-3">
      <FilaInt icon="🏦" nombre="Open Banking (Fintoc)" desc={fintocDesc} estado={fintocEstadoTxt} tono={fintocTono} />
      <FilaInt icon="📄" nombre="Carga Manual (CSV)" desc="Sube cartolas o movimientos en CSV." estado="Disponible" tono="ok" />
      <FilaInt icon="📊" nombre="Excel" desc="Importa planillas de movimientos." estado="Disponible" tono="ok" />
      <FilaInt icon="🧾" nombre="Cartola PDF" desc="Lectura de cartolas en PDF." estado="Próximamente" tono="off" />
      <FilaInt icon="🧠" nombre={`IA (${ai.esFallback ? 'Asistente local' : ai.nombre})`} desc={ai.esFallback ? 'Usando asistente local. Configura Ollama para IA completa.' : 'Proveedor de IA activo.'} estado={ai.esFallback ? 'Fallback' : 'Activo'} tono={ai.esFallback ? 'pend' : 'ok'} />
      <FilaInt icon="🔔" nombre="Notificaciones de escritorio" desc="Alertas de análisis, recomendaciones y sincronizaciones." estado={notiOk ? 'Activas' : 'Inactivas'} tono={notiOk ? 'ok' : 'off'} />
    </div>
  );
}

/* ── Notificaciones ── */
function TabNotificaciones() {
  const { notificacionesActivas, setNotificaciones, voiceMode, setVoiceMode, setTourVisto } = usePreparacion();
  const [permiso, setPermiso] = useState(notifications.permiso());
  const soportaVoz = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const alternar = async () => {
    if (!notificacionesActivas) {
      const p = await notifications.solicitarPermiso();
      setPermiso(p);
      setNotificaciones(p === 'granted');
    } else {
      setNotificaciones(false);
    }
  };

  const eventos = ['Análisis completado', 'Alerta financiera', 'Nueva recomendación', 'IA terminó de analizar documentos', 'Sincronización de Fintoc completada'];

  return (
    <div className="max-w-lg space-y-5">
      <div className="flex items-center justify-between rounded-2xl border border-slate-100 p-4">
        <div>
          <p className="text-sm font-bold text-slate-800">Notificaciones de escritorio</p>
          <p className="text-xs text-slate-500">{permiso === 'denied' ? 'Bloqueadas por el navegador. Habilítalas en la configuración del sitio.' : 'Recibe avisos importantes aunque no tengas la pestaña abierta.'}</p>
        </div>
        <button
          onClick={alternar}
          disabled={permiso === 'denied'}
          className={`relative h-7 w-12 rounded-full transition ${notificacionesActivas && permiso === 'granted' ? 'bg-emerald-500' : 'bg-slate-300'} disabled:opacity-50`}
          aria-label="Activar notificaciones"
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${notificacionesActivas && permiso === 'granted' ? 'left-6' : 'left-1'}`} />
        </button>
      </div>
      <div>
        <p className="mb-2 text-sm font-bold text-slate-800">Recibirás avisos de:</p>
        <ul className="space-y-1.5">
          {eventos.map((e) => (
            <li key={e} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600"><span className="text-emerald-500">✓</span> {e}</li>
          ))}
        </ul>
      </div>

      {/* Modo voz */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-100 p-4">
        <div>
          <p className="text-sm font-bold text-slate-800">Modo voz 🎙️</p>
          <p className="text-xs text-slate-500">{soportaVoz ? 'Dicta tus respuestas en AI Discovery con el micrófono.' : 'Tu navegador no soporta dictado por voz.'}</p>
        </div>
        <button
          onClick={() => setVoiceMode(!voiceMode)}
          disabled={!soportaVoz}
          className={`relative h-7 w-12 rounded-full transition ${voiceMode && soportaVoz ? 'bg-brand' : 'bg-slate-300'} disabled:opacity-50`}
          aria-label="Activar modo voz"
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${voiceMode && soportaVoz ? 'left-6' : 'left-1'}`} />
        </button>
      </div>

      {/* Repetir tour */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-100 p-4">
        <div>
          <p className="text-sm font-bold text-slate-800">Tour de la plataforma</p>
          <p className="text-xs text-slate-500">Vuelve a ver la guía interactiva de bienvenida.</p>
        </div>
        <button
          onClick={() => setTourVisto(false)}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Repetir tour
        </button>
      </div>
    </div>
  );
}

/* ── Facturación ── */
function TabFacturacion() {
  const planes = [
    { n: 'Starter', p: '$39', d: 'para empezar' },
    { n: 'Growth', p: '$89', d: 'para crecer', destacado: true },
    { n: 'Scale', p: 'Custom', d: 'a tu medida' },
  ];
  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">Programa Piloto</span>
          <span className="text-sm font-bold text-slate-800">Acceso completo · gratis</span>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Durante el piloto de Open Beauchef, el Copiloto Financiero y el Copiloto Marketing —normalmente de
          pago— están <b>disponibles gratis</b>. No se te cobrará nada.
        </p>
      </div>

      <div>
        <p className="mb-3 text-sm font-bold text-slate-800">Precios a futuro (referenciales)</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {planes.map((pl) => (
            <div key={pl.n} className={`rounded-2xl border p-4 ${pl.destacado ? 'border-premium bg-premium-50/40' : 'border-slate-100'}`}>
              <p className="font-extrabold text-slate-900">{pl.n}</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{pl.p}<span className="text-sm font-normal text-slate-400">{pl.p !== 'Custom' ? '/mes' : ''}</span></p>
              <p className="text-xs text-slate-500">{pl.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">El pago se habilitará después del piloto. No necesitas tarjeta ahora.</p>
      </div>
    </div>
  );
}

export default function Configuracion() {
  const [tab, setTab] = useState('Perfil');
  return (
    <AppLayout>
      <div className="space-y-6">
        <header className="animate-fadeInUp">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Configuración</h1>
          <p className="text-slate-500">Tu cuenta, tu startup, tu equipo y tus integraciones.</p>
        </header>

        <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-100 bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === t ? 'bg-brand text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          {tab === 'Perfil' && <TabPerfil />}
          {tab === 'Startup' && <TabStartup />}
          {tab === 'Equipo' && <TabEquipo />}
          {tab === 'Integraciones' && <TabIntegraciones />}
          {tab === 'Notificaciones' && <TabNotificaciones />}
          {tab === 'Facturación' && <TabFacturacion />}
        </div>
      </div>
    </AppLayout>
  );
}
