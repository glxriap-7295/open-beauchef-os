/** Regression: canonical ACCOUNTING_MAP + statement routing + hard guardrails. */
import { createSuite } from './harness.mjs';
import { validateAccountingMap, resumenContable, tratamiento } from '../src/services/finance/accountingMap.js';
import { transaccionesAMeses } from '../src/utils/calculations.js';

export default function run() {
  const { ok, eq, report } = createSuite('accounting');

  // The map must be valid: every category mapped, guardrails intact.
  const v = validateAccountingMap();
  ok(v.ok, `ACCOUNTING_MAP valid (${v.errors.join('; ')})`);

  // Hard rule: non-P&L categories can never be revenue or in the P&L.
  for (const id of ['transfers', 'loans', 'owner_contributions']) {
    const t = tratamiento(id);
    ok(t.includeInRevenue === false, `${id} not revenue`);
    ok(t.includeInPL === false, `${id} not in P&L`);
  }

  const txs = [
    { fecha: '2025-05-02', monto: 450000, categoryId: 'revenue' },
    { fecha: '2025-05-03', monto: -60000, categoryId: 'marketing' },
    { fecha: '2025-05-04', monto: -90000, categoryId: 'inventory' },
    { fecha: '2025-05-05', monto: -8000, categoryId: 'shipping' },
    { fecha: '2025-05-06', monto: -500000, categoryId: 'payroll' },
    { fecha: '2025-05-07', monto: -30000, categoryId: 'software' },
    { fecha: '2025-05-08', monto: -3000, categoryId: 'bank_fees' },
    { fecha: '2025-05-09', monto: 2000000, categoryId: 'transfers' },
    { fecha: '2025-05-10', monto: 5000000, categoryId: 'loans' },
    { fecha: '2025-05-11', monto: 1000000, categoryId: 'owner_contributions' },
  ];

  // Income Statement
  const [mes] = transaccionesAMeses(txs);
  eq(mes.ingresos, 450000, 'Revenue excludes 8M of transfers/loans/owner');
  eq(mes.cogsProd, 90000, 'COGS production (inventory)');
  eq(mes.cogsEnvio, 8000, 'COGS shipping');
  eq(mes.cogsTrans, 3000, 'COGS transaction (bank fees)');
  eq(mes.empleados, 500000, 'OPEX payroll bucket');
  eq(mes.herramientas, 30000, 'OPEX software bucket');
  eq(mes.otros, 60000, 'OPEX other bucket (marketing)');
  eq(mes.ebitda, 450000 - 691000, 'EBITDA excludes financing/internal');

  // Accounting summary
  const r = resumenContable(txs);
  eq(r.revenue, 450000, 'summary revenue excludes non-P&L (transfers/loans/owner)');
  // financingIn is the sum of ALL financing inflows: loans (5,000,000) +
  // owner contributions (1,000,000) = 6,000,000. The transfer (2,000,000) is
  // 'internal' and excluded. (The previous expected value of 5,000,000 was a
  // copy-slip that only counted the loan; the app is correct.)
  eq(r.financingIn, 6000000, 'loans + owner contributions → financing (not revenue)');
  eq(r.ebitda, r.grossProfit - r.opex, 'EBITDA = grossProfit − opex');

  // Legacy Spanish labels still route
  eq(transaccionesAMeses([{ fecha: '2025-05-01', monto: 100000, categoria: 'Ventas' }])[0].ingresos, 100000, 'legacy Ventas → revenue');
  eq(transaccionesAMeses([{ fecha: '2025-05-01', monto: 100000, categoria: 'Otros' }])[0].ingresos, 0, 'legacy Otros inflow → NOT revenue');

  return report();
}
