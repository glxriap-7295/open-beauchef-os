import { useRef, useState } from 'react';
import ToolModal from './ToolModal.jsx';
import { banking } from '../../services/banking/index.js';
import { notifications, NotificationEvents } from '../../services/notifications/index.js';
import { usePreparacion } from '../../context/PreparacionContext.jsx';
import { formatCLP } from '../../utils/formatters.js';

export default function ConectarDatosModal({ onClose }) {
  const { setFuenteFinanciera, agregarLogro } = usePreparacion();
  const [metodo, setMetodo] = useState(null); // 'fintoc' | 'manual'
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const fintocOk = banking.openBankingDisponible();

  const conectarFintoc = async () => {
    setError('');
    setCargando(true);
    try {
      // En producción, el widgetToken lo emite tu backend con la secret key.
      await banking.fintoc.conectar({});
      setFuenteFinanciera('fintoc');
      setResultado({ tipo: 'fintoc' });
      notifications.emitir(NotificationEvents.analisisCompleto('Tu banco (Open Banking)'));
      agregarLogro('Cuenta bancaria conectada (Open Banking)', '🏦');
    } catch (e) {
      setError(e.message || 'No se pudo conectar con Fintoc en este entorno.');
    } finally {
      setCargando(false);
    }
  };

  const onArchivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setCargando(true);
    try {
      const { movimientos, resumen } = await banking.manual.procesarArchivo(file);
      if (!movimientos.length) {
        setError('No encontramos movimientos en el archivo. Revisa el formato (fecha, descripción, monto).');
      } else {
        setFuenteFinanciera('manual');
        setResultado({ tipo: 'manual', nombre: file.name, resumen });
        notifications.emitir(NotificationEvents.analisisCompleto(file.name));
        agregarLogro('Cartola cargada al Copiloto Financiero', '📄');
      }
    } catch {
      setError('No pudimos leer el archivo. Sube un CSV válido.');
    } finally {
      setCargando(false);
      e.target.value = '';
    }
  };

  return (
    <ToolModal
      icon="🔌"
      titulo="Conectar tus datos financieros"
      subtitulo="Elige cómo alimentar al Copiloto Financiero. Puedes cambiar de método cuando quieras."
      onClose={onClose}
    >
      {!resultado && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Open Banking */}
          <button
            onClick={() => setMetodo('fintoc')}
            className={`rounded-2xl border p-5 text-left transition duration-[180ms] hover:-translate-y-0.5 hover:shadow-md ${
              metodo === 'fintoc' ? 'border-brand bg-brand-50/40' : 'border-slate-200 bg-white'
            }`}
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-xl">🏦</span>
            <p className="mt-3 font-bold text-slate-800">Open Banking</p>
            <p className="mt-1 text-sm text-slate-500">Sincroniza tus movimientos automáticamente con Fintoc.</p>
            <span className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${fintocOk ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'}`}>
              {fintocOk ? 'Disponible' : 'Requiere configuración'}
            </span>
          </button>

          {/* Manual */}
          <button
            onClick={() => setMetodo('manual')}
            className={`rounded-2xl border p-5 text-left transition duration-[180ms] hover:-translate-y-0.5 hover:shadow-md ${
              metodo === 'manual' ? 'border-brand bg-brand-50/40' : 'border-slate-200 bg-white'
            }`}
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-xl">📄</span>
            <p className="mt-3 font-bold text-slate-800">Carga Manual</p>
            <p className="mt-1 text-sm text-slate-500">Sube tu cartola o movimientos en CSV / Excel.</p>
            <span className="mt-3 inline-block rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">Siempre disponible</span>
          </button>
        </div>
      )}

      {/* Panel del método elegido */}
      {metodo === 'fintoc' && !resultado && (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          {fintocOk ? (
            <button
              onClick={conectarFintoc}
              disabled={cargando}
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark"
            >
              {cargando ? 'Conectando…' : 'Conectar con Fintoc'}
            </button>
          ) : (
            <p className="text-sm text-slate-600">
              🔒 Open Banking aún no está configurado en este entorno ({banking.fintoc.motivoNoDisponible()}).
              No te preocupes: puedes usar <b>Carga Manual</b> y todo funciona igual.
            </p>
          )}
        </div>
      )}

      {metodo === 'manual' && !resultado && (
        <div className="mt-5 rounded-2xl border border-dashed border-brand-100 bg-brand-50/40 p-5 text-center">
          <p className="text-sm text-slate-600">Sube un archivo CSV con columnas de fecha, descripción y monto.</p>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={cargando}
            className="mt-3 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark"
          >
            {cargando ? 'Procesando…' : 'Seleccionar archivo CSV'}
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv,.xlsx,.xls" className="hidden" onChange={onArchivo} />
        </div>
      )}

      {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{error}</p>}

      {/* Resultado */}
      {resultado && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
          <p className="flex items-center gap-2 font-bold text-slate-800">✅ Datos conectados</p>
          {resultado.tipo === 'manual' ? (
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><p className="text-slate-500">Movimientos</p><p className="font-bold text-slate-800">{resultado.resumen.total}</p></div>
              <div><p className="text-slate-500">Entradas</p><p className="font-bold text-emerald-600">{formatCLP(resultado.resumen.entradas)}</p></div>
              <div><p className="text-slate-500">Salidas</p><p className="font-bold text-rose-500">{formatCLP(resultado.resumen.salidas)}</p></div>
              <div><p className="text-slate-500">Neto</p><p className="font-bold text-slate-800">{formatCLP(resultado.resumen.neto)}</p></div>
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-600">Tu banco quedó conectado vía Open Banking.</p>
          )}
          <p className="mt-3 text-xs text-slate-500">
            El Copiloto Financiero usará esta fuente para clasificar tus movimientos y generar tus reportes.
          </p>
          <button
            onClick={onClose}
            className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700"
          >
            Ir al Copiloto Financiero
          </button>
        </div>
      )}
    </ToolModal>
  );
}
