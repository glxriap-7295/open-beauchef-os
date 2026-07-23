/**
 * Mini harness para la suite de regresión (Node ESM, sin dependencias).
 * Cada archivo *.test.mjs exporta `default function run()` que devuelve el número
 * de fallos. `run.mjs` los ejecuta todos y falla si alguno falla.
 */
export function createSuite(name) {
  let pass = 0;
  let fail = 0;
  const fails = [];
  const ok = (cond, msg) => { if (cond) pass += 1; else { fail += 1; fails.push(msg); } };
  const eq = (a, b, msg) => ok(a === b, `${msg} (esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)})`);
  const report = () => {
    const estado = fail ? '✗' : '✓';
    console.log(`${estado} [${name}] ${pass} passed, ${fail} failed`);
    fails.forEach((m) => console.log('     ✗', m));
    return fail;
  };
  return { ok, eq, report };
}
