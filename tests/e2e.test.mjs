/** Regression: end-to-end — parse → categorize → edit → approve → statements → insights. */
import { createSuite } from './harness.mjs';
import { manualProvider } from '../src/services/banking/manualProvider.js';
import { categorize, legacyLabel } from '../src/services/finance/categorize.js';
import { aprobar } from '../src/services/finance/importSessions.js';
import { transaccionesAMeses } from '../src/utils/calculations.js';
import { resumenContable, tratamiento, categoryIdDeTransaccion } from '../src/services/finance/accountingMap.js';
import { computeInsights } from '../src/services/finance/insightEngine.js';

export default function run() {
  const { ok, eq, report } = createSuite('e2e');

  // 1-2) Parse a statement that includes a transfer + an owner contribution.
  const { movimientos: base } = manualProvider.procesarFilas([
    ['Fecha', 'Detalle', 'Cargo', 'Abono'],
    ['02/05/2025', 'ABONO STRIPE PAYOUT', '', '450000'],
    ['05/05/2025', 'PAGO META ADS', '60000', ''],
    ['08/05/2025', 'BLUEXPRESS ENVIO', '9000', ''],
    ['12/05/2025', 'ARRIENDO OFICINA', '400000', ''],
    ['15/05/2025', 'TRASPASO A CUENTA', '', '2000000'],
    ['20/05/2025', 'APORTE DE CAPITAL SOCIO', '', '5000000'],
    ['28/05/2025', 'MOV XZ-99', '30000', ''],
  ]);
  eq(base.length, 7, 'parsed 7 rows');

  // 3) Build draft (categorize + attach original)
  const draft = base.map((m, i) => {
    const c = categorize(m.descripcion, m.monto);
    return { id: `d${i}`, date: m.fecha, description: m.descripcion, amount: m.monto, descripcion: m.descripcion, monto: m.monto, categoryId: c.categoryId, category: legacyLabel(c.categoryId), original: { categoryId: c.categoryId, confidence: c.confidence, source: c.source, merchantId: c.merchantId, merchant: c.merchant, reason: c.reason } };
  });
  ok(draft.find((d) => d.description === 'TRASPASO A CUENTA').categoryId === 'transfers', 'transfer categorized as transfers');
  ok(draft.find((d) => d.description === 'APORTE DE CAPITAL SOCIO').categoryId === 'owner_contributions', 'owner contribution categorized');

  // 4) Founder edits ONE category
  const i = draft.findIndex((d) => d.description === 'MOV XZ-99');
  draft[i] = { ...draft[i], categoryId: 'utilities', source: 'user' };

  // 5) Approve
  const { session, transacciones } = aprobar({ transacciones: draft, filename: 'Mayo.csv', source: 'manual' });
  ok(transacciones.length === 7 && transacciones.every((t) => t.importId === session.importId), '7 tx committed with provenance');
  const edited = transacciones.find((t) => t.descripcion === 'MOV XZ-99');
  ok(edited.categoryId === 'utilities' && edited.original.categoryId === 'other', 'edit applied; original preserved');

  // 6-8) Statements + KPIs
  const [mes] = transaccionesAMeses(transacciones);
  eq(mes.ingresos, 450000, 'Income Statement revenue = 450000 (NOT 7.45M)');
  const r = resumenContable(transacciones);
  eq(r.revenue, 450000, 'Cash-flow/summary revenue excludes transfer+owner');
  eq(r.financingIn, 5000000, 'owner contribution → financing');
  eq(r.ebitda, r.grossProfit - r.opex, 'KPI: EBITDA = grossProfit − opex');

  // 9) Insights
  const insights = computeInsights(transacciones);
  ok(insights.length > 0 && insights.every((x) => x.id && x.explanation), 'structured insights produced');

  // Guardrail: exactly the transfer + owner contribution excluded from the P&L
  const nonPL = transacciones.filter((t) => !tratamiento(categoryIdDeTransaccion(t)).includeInPL);
  eq(nonPL.length, 2, 'exactly the transfer + owner contribution excluded from P&L');

  return report();
}
