import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePreparacion } from '../context/PreparacionContext.jsx';
import { getMesesDerivados, consolidar, promedios, saldoActual as calcSaldo, runwayMeses } from '../utils/calculations.js';
import { SALDO_INICIAL } from '../data/palomaData.js';
import { formatCompactCLP, formatMeses } from '../utils/formatters.js';

const PASOS = [
  'Conecta tu empresa',
  'Open Banking',
  'Motor de Inteligencia Financiera',
  'Asistente WhatsApp',
  'Resultados',
  '¡Todo listo!',
];

/* ───────────────── Screen 1 ───────────────── */
function Screen1() {
  const fuentes = [
    { n: 'Excel', e: '📊', d: 'Sube tus planillas y las leemos automáticamente.' },
    { n: 'Google Sheets', e: '📗', d: 'Sincroniza tus hojas en la nube en tiempo real.' },
    { n: 'ERP', e: '🏢', d: 'Conecta tu sistema contable o de gestión.' },
    { n: 'Open Banking', e: '🏦', d: 'Trae tus movimientos bancarios de forma segura.' },
    { n: 'WhatsApp', e: '💬', d: 'Registra gastos y responde dudas desde tu teléfono.' },
    { n: 'SII', e: '🧾', d: 'Importa tus documentos tributarios electrónicos.' },
  ];
  return (
    <div>
      <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Conecta tu empresa</h2>
      <p className="mt-2 text-slate-500">Open Beauchef se conecta a tus fuentes de datos. Tú eliges; nosotros hacemos el resto.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fuentes.map((f) => (
          <div key={f.n} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-50 text-xl">{f.e}</span>
            <p className="mt-3 font-bold text-slate-800">{f.n}</p>
            <p className="mt-1 text-sm text-slate-500">{f.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────── Screen 2 ───────────────── */
function Screen2() {
  const [conectando, setConectando] = useState(false);
  const [listo, setListo] = useState(false);
  const bancos = ['Banco de Chile', 'Santander', 'BCI', 'Itaú', 'Estado', 'Scotiabank'];
  const conectar = () => {
    setConectando(true);
    setTimeout(() => { setConectando(false); setListo(true); }, 1400);
  };
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2">
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">
          🔒 Conexión segura
        </span>
        <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Open Banking</h2>
        <p className="mt-2 text-slate-500">
          Open Beauchef sincroniza automáticamente tus movimientos bancarios mediante Open Banking.
          No más cartolas manuales.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          <li>✓ Lectura solo de movimientos (nunca movemos tu dinero).</li>
          <li>✓ Conexión cifrada de extremo a extremo.</li>
          <li>✓ Se actualiza solo, todos los días.</li>
        </ul>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
        <p className="text-sm font-bold text-slate-800">Selecciona tu banco</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {bancos.map((b) => (
            <div key={b} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm text-slate-600">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-50 text-xs font-bold text-slate-500">{b[0]}</span>
              {b}
            </div>
          ))}
        </div>
        <button
          onClick={conectar}
          disabled={conectando || listo}
          className={`mt-4 w-full rounded-xl py-2.5 text-sm font-bold text-white transition ${
            listo ? 'bg-emerald-500' : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          {conectando ? 'Conectando…' : listo ? '✓ Conectado' : 'Conectar de forma segura'}
        </button>
        <p className="mt-2 text-center text-xs text-slate-500">Demostración de producto · no se conecta a un banco real.</p>
      </div>
    </div>
  );
}

/* ───────────────── Screen 3 ───────────────── */
function Screen3() {
  const nodos = [
    { t: 'Banco', e: '🏦' },
    { t: 'Movimientos', e: '📥' },
    { t: 'IA', e: '🧠' },
    { t: 'Clasificación', e: '🏷️' },
    { t: 'Estado de Resultados', e: '📊' },
    { t: 'Flujo de Caja', e: '💧' },
    { t: 'Alertas', e: '🔔' },
  ];
  return (
    <div>
      <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Motor de Inteligencia Financiera</h2>
      <p className="mt-2 text-slate-500">Cada movimiento recorre este flujo automáticamente, en segundos.</p>

      <div className="mt-8 flex flex-col items-stretch gap-0">
        {nodos.map((n, i) => (
          <div key={n.t} className="flex flex-col items-center">
            <div
              className="flex w-full max-w-md items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm animate-fadeInUp"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-premium-50 text-xl">{n.e}</span>
              <span className="font-bold text-slate-800">{n.t}</span>
              {i === 2 && <span className="ml-auto rounded-full bg-premium px-2 py-0.5 text-[10px] font-bold text-white">IA</span>}
            </div>
            {i < nodos.length - 1 && (
              <svg viewBox="0 0 10 30" className="h-7 w-3 text-premium-light">
                <line x1="5" y1="0" x2="5" y2="30" stroke="currentColor" strokeWidth="2.5" strokeDasharray="6 6" className="animate-flowDash" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────── Screen 4 ───────────────── */
function Screen4() {
  const [resp, setResp] = useState(null);
  const opciones = ['Marketing', 'Operaciones', 'RRHH', 'Otro'];
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Asistente WhatsApp</h2>
        <p className="mt-2 text-slate-500">
          Cuando la IA necesita contexto, te pregunta por WhatsApp. Respondes con un toque y el sistema
          aprende de cada respuesta para clasificar mejor la próxima vez.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          <li>✓ Sin instalar nada nuevo.</li>
          <li>✓ La IA mejora con cada interacción.</li>
          <li>✓ Adjunta boletas y listo.</li>
        </ul>
      </div>

      {/* Mock de chat */}
      <div className="mx-auto w-full max-w-sm rounded-[2rem] border-8 border-slate-900 bg-[#E5DDD5] p-3 shadow-2xl">
        <div className="rounded-t-xl bg-emerald-700 px-3 py-2 text-white">
          <p className="text-sm font-bold">OB Copilot</p>
          <p className="text-[11px] text-emerald-100">en línea</p>
        </div>
        <div className="space-y-2 p-3">
          <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-white p-2.5 text-sm text-slate-700 shadow">
            Hola 👋 Detectamos un movimiento por <b>CLP 82.000</b>. ¿Podrías decirnos a qué corresponde?
          </div>

          {!resp ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {opciones.map((o) => (
                <button
                  key={o}
                  onClick={() => setResp(o)}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow transition hover:bg-emerald-50"
                >
                  {o}
                </button>
              ))}
              <button
                onClick={() => setResp('Boleta')}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow transition hover:bg-slate-50"
              >
                📎 Subir Boleta
              </button>
            </div>
          ) : (
            <>
              <div className="ml-auto max-w-[80%] rounded-xl rounded-tr-sm bg-emerald-100 p-2.5 text-sm text-slate-800 shadow">
                {resp === 'Boleta' ? '📎 Boleta enviada' : resp}
              </div>
              <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-white p-2.5 text-sm text-slate-700 shadow">
                ¡Gracias! Lo clasifiqué como <b>{resp === 'Boleta' ? 'gasto con respaldo' : resp}</b>. La IA aprende de
                cada respuesta para acertar sola la próxima vez. ✨
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────── Screen 5 ───────────────── */
function Screen5() {
  const meses = getMesesDerivados();
  const con = consolidar(meses);
  const prom = promedios(meses);
  const saldo = calcSaldo(meses, SALDO_INICIAL);
  const runway = runwayMeses(saldo, prom.gastosTotales);

  const cards = [
    { t: 'Estado de Resultados', v: formatCompactCLP(con.ebitda), s: `EBITDA · margen ${con.margen.toFixed(0)}%`, e: '📊' },
    { t: 'Flujo de Caja', v: formatCompactCLP(saldo), s: 'Saldo de caja actual', e: '💧' },
    { t: 'Runway', v: runway === Infinity ? '∞' : formatMeses(runway), s: 'A burn promedio', e: '🛫' },
    { t: 'Alertas', v: '3', s: 'Detectadas este período', e: '🔔' },
  ];
  return (
    <div>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-premium-50 px-3 py-1 text-xs font-bold text-premium">✨ Generado automáticamente</span>
      <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Resultados</h2>
      <p className="mt-2 text-slate-500">Sin planillas ni trabajo manual. Esto se genera solo a partir de tus datos.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.t} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-lg">{c.e}</span>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{c.t}</p>
            <p className="text-2xl font-extrabold text-slate-900">{c.v}</p>
            <p className="text-xs text-slate-500">{c.s}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-premium-100 bg-premium-50/50 p-4 text-sm text-premium-dark">
        <b>Recomendaciones IA:</b> optimiza tus costos de COGS en octubre y revisa el alza de envíos. Tu
        preparación financiera subirá al conectar estas fuentes de forma permanente.
      </div>
    </div>
  );
}

/* ───────────────── Screen 6 ───────────────── */
function Screen6({ onFinish }) {
  const { nivel } = usePreparacion();
  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-premium to-brand text-4xl text-white animate-floaty">🎉</div>
      <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">¡Todo listo!</h2>
      <p className="mt-2 text-slate-500">
        Así funcionará Open Beauchef cuando todo esté automatizado. Activamos el Copiloto Financiero en tu
        demo y tu Nivel de Preparación mejoró.
      </p>
      <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3">
        <span className="text-sm font-semibold text-emerald-700">Nivel de Preparación</span>
        <span className="text-2xl font-extrabold text-emerald-700">{nivel}%</span>
        <span className="text-emerald-600">↑</span>
      </div>
      <div className="mt-7">
        <button
          onClick={onFinish}
          className="rounded-xl bg-premium px-7 py-3 text-sm font-bold text-white shadow-lg shadow-premium/30 transition hover:bg-premium-dark"
        >
          Volver al Panel Principal →
        </button>
      </div>
    </div>
  );
}

/* ───────────────── Contenedor ───────────────── */
export default function WalkthroughFuturo() {
  const navigate = useNavigate();
  const { completarDemoFinanciera } = usePreparacion();
  const [paso, setPaso] = useState(0);
  const [aplicado, setAplicado] = useState(false);

  // Al llegar al último paso, aplica la mejora de preparación una sola vez.
  const irA = (n) => {
    if (n === 5 && !aplicado) {
      completarDemoFinanciera();
      setAplicado(true);
    }
    setPaso(Math.max(0, Math.min(PASOS.length - 1, n)));
  };

  const screens = [<Screen1 />, <Screen2 />, <Screen3 />, <Screen4 />, <Screen5 />, <Screen6 onFinish={() => navigate('/app')} />];

  return (
    <div className="min-h-screen bg-os-bg">
      {/* Barra superior */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 text-xs font-bold text-white">OB</span>
            <span className="text-sm font-bold text-slate-700">Cómo funcionará Open Beauchef</span>
          </div>
          <button onClick={() => navigate('/copiloto')} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-600">
            Salir ✕
          </button>
        </div>
        {/* Progreso */}
        <div className="mx-auto flex max-w-5xl gap-1.5 px-4 pb-3 sm:px-6">
          {PASOS.map((p, i) => (
            <div key={p} className={`h-1.5 flex-1 rounded-full transition ${i <= paso ? 'bg-premium' : 'bg-slate-200'}`} />
          ))}
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-premium">Paso {paso + 1} de {PASOS.length}</p>
        <div key={paso} className="animate-fadeInUp">{screens[paso]}</div>
      </main>

      {/* Navegación */}
      <footer className="sticky bottom-0 border-t border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <button
            onClick={() => irA(paso - 1)}
            disabled={paso === 0}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
              paso === 0 ? 'cursor-default text-slate-300' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            ← Volver
          </button>
          {paso < PASOS.length - 1 ? (
            <button
              onClick={() => irA(paso + 1)}
              className="rounded-xl bg-premium px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-premium/30 transition hover:bg-premium-dark"
            >
              Continuar →
            </button>
          ) : (
            <button
              onClick={() => navigate('/app')}
              className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              Finalizar
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
