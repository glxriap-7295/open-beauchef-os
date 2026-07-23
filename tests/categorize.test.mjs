/** Regression: categorization engine (stable ids, merchants, memory, guardrails). */
import { createSuite } from './harness.mjs';
import { categorize, CATEGORY_REGISTRY, resolveCategoryId } from '../src/services/finance/categorize.js';
import { categorizar, CATEGORIAS, clavePorDescripcion } from '../src/services/finance/categorizer.js';

export default function run() {
  const { ok, eq, report } = createSuite('categorize');

  // Backward-compat (legacy Spanish labels) — the original qa.mjs expectations.
  eq(categorizar('Pago Meta Ads Facebook', -50000).categoria, 'Marketing', 'Meta Ads → Marketing');
  eq(categorizar('BLUEXPRESS envio', -8000).categoria, 'Envíos', 'Bluexpress → Envíos');
  eq(categorizar('Abono Stripe payout', 300000).categoria, 'Ventas', 'Stripe inflow → Ventas');
  eq(categorizar('Pago SII F29', -120000).categoria, 'Impuestos', 'SII → Impuestos');
  eq(categorizar('Arriendo oficina', -400000).categoria, 'Arriendo', 'Arriendo → Arriendo');
  ok(CATEGORIAS.includes(categorizar('xyzzy random unknown', -1000).categoria), 'unknown → valid legacy category');

  // Stable ids + merchant recognition (unknown-merchant aliases).
  const aws = categorize('PAGO AWS EMEA 12345', -45000);
  eq(aws.categoryId, 'software', 'AWS EMEA → software id');
  eq(aws.merchantId, 'aws', 'AWS merchant id');
  ok(aws.reason && aws.reason.length > 0, 'insight has non-empty reason');
  eq(categorize('AmazonAWS suscripcion', -1).merchantId, 'aws', 'AmazonAWS alias matches');
  eq(categorize('MercadoLibre venta', -5000).merchantId, 'mercado-libre', 'MercadoLibre alias matches');

  // Unknown merchant → low-confidence fallback (never invents).
  const unknown = categorize('GLOSA RARA QUE NADIE CONOCE', -5000);
  eq(unknown.categoryId, 'other', 'unknown expense → other');
  ok(unknown.confidence <= 40, 'unknown expense → low confidence');
  ok(CATEGORY_REGISTRY.some((c) => c.id === unknown.categoryId), 'fallback is a real category');

  // Low-confidence income fallback.
  eq(categorize('DEPOSITO NN 999', 5000).confidence, 45, 'unknown inflow → 45');

  // Accounting guardrails: transfers/loans/owner never revenue (even inflows).
  eq(categorize('TRASPASO A CUENTA 999', 50000).categoryId, 'transfers', 'transfer inflow → transfers, NOT revenue');
  eq(categorize('APORTE DE CAPITAL SOCIO', 5000000).categoryId, 'owner_contributions', 'owner contribution → owner_contributions');
  eq(categorize('DESEMBOLSO PRESTAMO COMERCIAL', 3000000).categoryId, 'loans', 'loan disbursement → loans');
  eq(categorize('TRANSFERENCIA ENTRE CUENTAS', 100000).categoryId, 'transfers', 'transfer blocked from revenue');
  eq(categorize('Venta local', 80000).categoryId, 'revenue', 'real sale → revenue');

  // Sign-aware processors.
  eq(categorize('Abono Stripe', 200000).categoryId, 'revenue', 'Stripe inflow → revenue');
  eq(categorize('Comision Stripe', -3000).categoryId, 'bank_fees', 'Stripe outflow → bank_fees');

  // User memory beats rules; legacy Spanish memory value resolves to stable id.
  const maps = { [clavePorDescripcion('Transferencia Juan Perez 12345')]: 'Remuneraciones' };
  const mem = categorizar('Transferencia Juan Perez 98765', -900000, { mappings: maps });
  eq(mem.categoria, 'Remuneraciones', 'memory override (legacy value) reclassifies');
  ok(mem.confianza >= 99, 'memory confidence 99+');
  const memId = categorize('Transferencia Juan Perez 98765', -900000, { memory: { [clavePorDescripcion('Transferencia Juan Perez 1')]: 'payroll' } });
  eq(memId.categoryId, 'payroll', 'memory override (stable id) reclassifies');

  // Stable-key strips numbers/dates so corrections generalize.
  eq(
    clavePorDescripcion('Compra 12/03 ref 4432 Falabella'),
    clavePorDescripcion('Compra 05/11 ref 9981 Falabella'),
    'stable key ignores numbers/dates',
  );

  // Legacy resolver.
  eq(resolveCategoryId('Envíos'), 'shipping', 'resolve legacy Envíos → shipping');
  eq(resolveCategoryId('payroll'), 'payroll', 'resolve id passthrough');
  ok(resolveCategoryId('zzz') === null, 'unknown label → null');

  return report();
}
