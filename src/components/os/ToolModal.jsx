/**
 * Shell de modal reutilizable para las herramientas gratuitas.
 * Mantiene el mismo lenguaje visual que el resto del OS (sin rediseñar nada).
 */
export default function ToolModal({ icon, titulo, subtitulo, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex max-h-[88vh] w-full max-w-2xl animate-fadeInUp flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-2xl">{icon}</span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">{titulo}</h2>
              {subtitulo && <p className="text-sm text-slate-500">{subtitulo}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>

        {/* Pie opcional */}
        {footer && <div className="border-t border-slate-100 p-4">{footer}</div>}
      </div>
    </div>
  );
}
