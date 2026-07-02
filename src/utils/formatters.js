/**
 * Formateadores de números para Chile (CLP).
 */

const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** "$9.518.008" — peso chileno, sin decimales, separador de miles con punto. */
export function formatCLP(value) {
  const n = Number(value) || 0;
  return clpFormatter.format(Math.round(n));
}

/** Versión compacta para tarjetas: "$9,5M", "$850K", "$1.250M". */
export function formatCompactCLP(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toLocaleString('es-CL', { maximumFractionDigits: 1 })}M`;
  }
  if (abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toLocaleString('es-CL', { maximumFractionDigits: 0 })}K`;
  }
  return `${sign}$${abs.toLocaleString('es-CL')}`;
}

/** "31,5%" */
export function formatPct(value, decimals = 1) {
  const n = Number(value) || 0;
  return `${n.toLocaleString('es-CL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
}

/** "4,2 meses" */
export function formatMeses(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '∞';
  return `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })} meses`;
}
