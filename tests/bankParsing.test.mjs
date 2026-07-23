/** Regression: universal bank-statement parser across real Chilean layouts. */
import { createSuite } from './harness.mjs';
import { manualProvider } from '../src/services/banking/manualProvider.js';

const montos = (r) => r.movimientos.map((m) => m.monto);

export default function run() {
  const { ok, eq, report } = createSuite('bankParsing');

  // Banco de Chile — Cargo/Abono/Saldo
  let r = manualProvider.procesarFilas([
    ['Fecha', 'Descripción', 'Cargo', 'Abono', 'Saldo'],
    ['12/03/2025', 'Venta online', '', '150000', '150000'],
    ['13/03/2025', 'Pago proveedor', '80000', '', '70000'],
  ]);
  eq(r.movimientos.length, 2, 'BancoDeChile: 2 movimientos');
  ok(r.movimientos[0].monto === 150000 && r.movimientos[1].monto === -80000, 'BancoDeChile: abono +, cargo −');

  // BancoEstado — comma CSV, signed Monto
  r = manualProvider.procesarFilas([
    ['Fecha', 'Descripcion', 'Monto', 'Saldo'],
    ['2025-05-03', 'Transferencia recibida cliente', '275000', '275000'],
    ['2025-05-06', 'Compra proveedor', '-84000', '191000'],
  ]);
  eq(JSON.stringify(montos(r)), JSON.stringify([275000, -84000]), 'BancoEstado: signed Monto, Saldo ignored');

  // BCI — Cargos/Abonos with a document column
  r = manualProvider.procesarFilas([
    ['Fecha', 'Detalle', 'N° Documento', 'Cargos', 'Abonos', 'Saldo'],
    ['01/06/2025', 'Compra', '000123456789', '50000', '', '900000'],
    ['02/06/2025', 'Depósito', '000987654321', '', '120000', '1020000'],
  ]);
  eq(JSON.stringify(montos(r)), JSON.stringify([-50000, 120000]), 'BCI: cargo/abono, doc# and saldo ignored');

  // Santander — signed Monto, MAYÚSCULAS headers
  r = manualProvider.procesarFilas([
    ['FECHA', 'DETALLE', 'MONTO', 'SALDO'],
    ['05-06-2025', 'PAGO CLIENTE', '300000', '300000'],
    ['06-06-2025', 'ARRIENDO', '-400000', '-100000'],
  ]);
  eq(JSON.stringify(montos(r)), JSON.stringify([300000, -400000]), 'Santander: signed uppercase');

  // Scotiabank — Débito/Crédito (accents)
  r = manualProvider.procesarFilas([
    ['Fecha', 'Descripción', 'Débito', 'Crédito', 'Saldo'],
    ['2025-06-01', 'Compra café', '3500', '', '96500'],
    ['2025-06-02', 'Abono', '', '1000000', '1096500'],
  ]);
  eq(JSON.stringify(montos(r)), JSON.stringify([-3500, 1000000]), 'Scotiabank: débito −, crédito +');

  // Credit card — Cargos/Abonos (purchases as charges, payment as abono)
  r = manualProvider.procesarFilas([
    ['Fecha', 'Comercio', 'Cargos', 'Abonos'],
    ['2025-06-03', 'NETFLIX', '9990', ''],
    ['2025-06-04', 'PAGO TARJETA', '', '50000'],
  ]);
  eq(JSON.stringify(montos(r)), JSON.stringify([-9990, 50000]), 'CreditCard: charge −, payment +');

  // Two header rows (Banco de Chile legacy: "Monto/O CARGOS", "Abono/O ABONOS")
  r = manualProvider.procesarFilas([
    ['Fecha', 'Detalle', 'Monto', 'Abono', 'Saldo'],
    ['DIA/MES', '', 'O CARGOS', 'O ABONOS', ''],
    ['03/06/2025', 'COMPRA SUPERMERCADO', '15000', '', '120000'],
    ['05/06/2025', 'SUELDO', '', '800000', '920000'],
  ]);
  eq(r.diagnostico?.headerRows, 2, 'TwoHeader: detected 2 header rows');
  eq(JSON.stringify(montos(r)), JSON.stringify([-15000, 800000]), 'TwoHeader: correct signs');

  // Number formats: EU / US / CLP / parentheses / trailing minus
  r = manualProvider.procesarFilas([
    ['Fecha', 'Glosa', 'Monto'],
    ['2025-01-01', 'eu', '1.234,56'],
    ['2025-01-02', 'us', '1,234.56'],
    ['2025-01-03', 'clp', '1.234'],
    ['2025-01-04', 'paren', '(2.000,50)'],
    ['2025-01-05', 'trailing', '5000-'],
    ['2025-01-06', 'leadzero', '+0000264251'],
  ]);
  eq(JSON.stringify(montos(r)), JSON.stringify([1234.56, 1234.56, 1234, -2000.5, -5000, 264251]), 'Number formats parsed');

  // OCR-shape (rows already split; suspicious huge value flagged, not imported blindly)
  r = manualProvider.procesarFilas([
    ['Fecha', 'Glosa', 'Monto'],
    ['2025-06-01', 'normal', '50000'],
    ['2025-06-02', 'raro', '2500000000'],
  ]);
  ok(r.movimientos.find((m) => Math.abs(m.monto) > 1e9)?.sospechoso === true, 'suspicious amount flagged');

  // Summary rows ignored by semantics (not by amount==0)
  r = manualProvider.procesarFilas([
    ['Fecha', 'Glosa', 'Cargo', 'Abono', 'Saldo'],
    ['SALDO INICIAL', '', '', '', '1000000'],
    ['02/06/2025', 'Compra', '5000', '', '995000'],
    ['TOTALES', '', '5000', '', ''],
  ]);
  eq(r.movimientos.length, 1, 'summary/total rows ignored');

  // Empty input safe
  eq(manualProvider.procesarFilas([]).movimientos.length, 0, 'empty input → no crash');

  return report();
}
