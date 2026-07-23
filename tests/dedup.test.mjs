/** Regression: duplicate detection (CSV+PDF of same statement; recurring kept). */
import { createSuite } from './harness.mjs';
import { separarDuplicados } from '../src/services/finance/dedup.js';

const mk = (id, d, a, desc) => ({ id, date: d, amount: a, description: desc });

export default function run() {
  const { ok, eq, report } = createSuite('dedup');

  // 5 distinct → 5 kept
  eq(separarDuplicados([mk('a', '2025-06-01', -1, 'x'), mk('b', '2025-06-02', -2, 'y'), mk('c', '2025-06-03', -3, 'z')], []).nuevos.length, 3, '3 distinct → 3');

  // Same statement uploaded as CSV then PDF → the PDF's rows are all duplicates
  const csv = [mk('1', '2025-05-01', 150000, 'Venta Shopify #4432'), mk('2', '2025-05-02', -8000, 'BLUEXPRESS 998'), mk('3', '2025-05-03', -40000, 'Meta Ads')];
  const pdf = [mk('4', '2025-05-01', 150000, 'VENTA SHOPIFY 0099'), mk('5', '2025-05-02', -8000, 'Bluexpress ENVIO'), mk('6', '2025-05-03', -40000, 'META ADS PAGO'), mk('7', '2025-05-04', -12000, 'Gasto nuevo')];
  const res = separarDuplicados(pdf, csv);
  eq(res.duplicados.length, 3, 'CSV+PDF: 3 duplicates detected');
  eq(res.nuevos.length, 1, 'CSV+PDF: only the genuinely new row imported');

  // Recurring same-amount transfers (real statement) must NOT collapse
  const recurring = [
    mk('a', '2025-06-01', -50000, 'TRASPASO 1'), mk('b', '2025-06-01', -50000, 'TRASPASO 2'),
    mk('c', '2025-06-02', -50000, 'TRASPASO 3'), mk('d', '2025-06-03', -50000, 'TRASPASO 4'),
    mk('e', '2025-06-04', -50000, 'TRASPASO 5'),
  ];
  eq(separarDuplicados(recurring, []).nuevos.length, 5, 'recurring transfers preserved (not collapsed)');

  // A literal exact repeat inside one file is dropped
  eq(separarDuplicados([mk('a', '2025-06-01', -50000, 'TRASPASO'), mk('b', '2025-06-01', -50000, 'TRASPASO')], []).nuevos.length, 1, 'exact within-file duplicate collapsed');

  return report();
}
