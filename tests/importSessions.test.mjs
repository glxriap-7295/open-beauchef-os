/** Regression: import sessions (approve, provenance, preserved original, delete, backfill). */
import { createSuite } from './harness.mjs';
import { aprobar, editarCategoria, eliminarImportacion, eliminarTransaccion, backfillLegacy } from '../src/services/finance/importSessions.js';

export default function run() {
  const { ok, eq } = createSuite('importSessions');

  const draft = [
    { id: 'a', date: '2025-05-02', amount: 450000, description: 'ABONO STRIPE', categoryId: 'revenue', original: { categoryId: 'revenue', confidence: 96, source: 'merchant', merchantId: 'stripe', merchant: 'Stripe', reason: 'x' } },
    { id: 'b', date: '2025-05-05', amount: -60000, description: 'PAGO META ADS', categoryId: 'marketing', original: { categoryId: 'marketing', confidence: 96, source: 'merchant', merchantId: 'meta-ads', merchant: 'Meta Ads', reason: 'y' } },
  ];

  // Approve → session + provenance + summary
  const { session, transacciones } = aprobar({ transacciones: draft, filename: 'Mayo.csv', source: 'manual', institution: 'Banco de Chile' });
  ok(/^imp-/.test(session.importId) && session.status === 'approved', 'session created & approved');
  ok(transacciones.every((t) => t.importId === session.importId && t.importFilename === 'Mayo.csv'), 'provenance stamped');
  ok(transacciones.every((t) => t.original && t.original.categoryId), 'original preserved on all');
  eq(session.summary.income, 450000, 'summary income');
  eq(session.summary.byCategory.marketing, -60000, 'summary byCategory keyed by id');

  // Edit preserves original, records edit
  const ed = editarCategoria(transacciones[1], 'software');
  eq(ed.categoryId, 'software', 'edit sets effective category');
  eq(ed.original.categoryId, 'marketing', 'edit preserves ORIGINAL');
  eq(ed.edited.fromCategoryId, 'marketing', 'edit audit recorded');

  // Delete import removes only its rows + session
  const otra = aprobar({ transacciones: [{ id: 'z', date: '2025-06-01', amount: 100, description: 'x', categoryId: 'other' }], filename: 'Junio.csv' });
  let estado = { transacciones: [...transacciones, ...otra.transacciones], importSessions: [session, otra.session] };
  const del = eliminarImportacion(estado, session.importId);
  eq(del.transacciones.length, 1, 'delete import: only its tx removed');
  eq(del.importSessions.length, 1, 'delete import: its session removed');

  // Delete one tx recomputes its session summary
  const delTx = eliminarTransaccion(estado, 'b');
  ok(!delTx.transacciones.find((t) => t.id === 'b'), 'tx deleted');

  // Idempotent legacy backfill
  const legacy = { transacciones: [{ id: 'o1', fecha: '2025-01-01', monto: 5000, descripcion: 'v', categoria: 'Ventas' }], fuenteFinanciera: 'manual' };
  const bf1 = backfillLegacy(legacy);
  ok(bf1.transacciones.every((t) => t.importId === 'imp-legacy' && t.categoryId), 'backfill stamps imp-legacy + categoryId');
  eq(bf1.importSessions[0].importId, 'imp-legacy', 'backfill creates legacy session');
  ok(backfillLegacy(bf1) === bf1, 'backfill idempotent (no-op second run)');

  return report();
}
