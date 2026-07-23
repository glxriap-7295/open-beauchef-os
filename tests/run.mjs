/**
 * Regression runner. Runs every *.test.mjs and exits non-zero if any fails.
 * Usage:  node tests/run.mjs   (or `npm test`)
 *
 * These tests import the REAL source under ../src, so they exercise the actual
 * modules. They are pure (no browser / no import.meta), so they run under Node.
 */
import categorize from './categorize.test.mjs';
import bankParsing from './bankParsing.test.mjs';
import dedup from './dedup.test.mjs';
import importSessions from './importSessions.test.mjs';
import accounting from './accounting.test.mjs';
import insights from './insights.test.mjs';
import e2e from './e2e.test.mjs';

const suites = [categorize, bankParsing, dedup, importSessions, accounting, insights, e2e];
let failures = 0;
for (const run of suites) {
  try { failures += run(); }
  catch (e) { failures += 1; console.log('✗ [suite crashed]', e?.message || e); }
}
console.log(`\n${failures ? '✗' : '✓'} TOTAL: ${failures} failing assertion(s).`);
process.exit(failures ? 1 : 0);
