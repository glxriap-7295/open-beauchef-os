/** Regression: deterministic InsightEngine (structured; excludes non-P&L). */
import { createSuite } from './harness.mjs';
import { computeInsights } from '../src/services/finance/insightEngine.js';

export default function run() {
  const { ok, eq, report } = createSuite('insights');

  const txs = [
    // April
    { fecha: '2025-04-05', monto: 400000, categoryId: 'revenue', descripcion: 'VENTA' },
    { fecha: '2025-04-10', monto: -40000, categoryId: 'software', descripcion: 'PAGO AWS', original: { merchant: 'Amazon Web Services' } },
    { fecha: '2025-04-12', monto: -100000, categoryId: 'marketing', descripcion: 'META ADS', original: { merchant: 'Meta Ads' } },
    // May (revenue up, marketing up sharply)
    { fecha: '2025-05-05', monto: 600000, categoryId: 'revenue', descripcion: 'VENTA' },
    { fecha: '2025-05-10', monto: -42000, categoryId: 'software', descripcion: 'PAGO AWS', original: { merchant: 'Amazon Web Services' } },
    { fecha: '2025-05-12', monto: -180000, categoryId: 'marketing', descripcion: 'META ADS', original: { merchant: 'Meta Ads' } },
    { fecha: '2025-05-20', monto: -25000, categoryId: 'other', descripcion: 'MOV XZ', confianza: 35 },
    // Non-P&L inflows that must NOT influence any insight number
    { fecha: '2025-05-25', monto: 5000000, categoryId: 'loans', descripcion: 'PRESTAMO' },
    { fecha: '2025-05-26', monto: 2000000, categoryId: 'transfers', descripcion: 'TRASPASO' },
  ];

  const ins = computeInsights(txs);
  const byId = Object.fromEntries(ins.map((i) => [i.id, i]));

  ok(ins.length > 0, 'produces insights');
  ok(ins.every((i) => i.id && i.severity && i.metric !== undefined && i.value !== undefined && i.title && i.explanation), 'all insights are structured objects');
  eq(byId.revenue_mom?.value, 0.5, 'revenue MoM +50% (loans/transfers ignored)');
  eq(byId['expense_growth:marketing']?.value, 0.8, 'marketing +80% MoM');
  ok(byId.top_merchants?.data?.[0]?.merchant === 'Meta Ads', 'largest merchant = Meta Ads');
  ok(byId.recurring_subscriptions?.value >= 2, 'recurring subscriptions detected');
  ok(byId.missing_categorization, 'missing categorization flagged');
  ok(byId.gross_margin && byId.ebitda, 'gross margin + EBITDA insights present');
  ok(!ins.some((i) => String(i.explanation).includes('7000000') || String(i.explanation).includes('7.000.000')), 'no insight reports the inflated 7M figure');

  return report();
}
