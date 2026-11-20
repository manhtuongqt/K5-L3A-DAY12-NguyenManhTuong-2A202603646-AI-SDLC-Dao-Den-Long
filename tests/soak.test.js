import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { openSync, closeSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, tmpDir } from './helpers.js';

function runSoak(exposeGC) {
  const dir = tmpDir();
  const out = path.join(dir, 'soak.json');
  const stdout = openSync(path.join(dir, 'stdout.txt'), 'w');
  const stderrPath = path.join(dir, 'stderr.txt');
  const stderr = openSync(stderrPath, 'w');
  let result;
  try {
    result = spawnSync(process.execPath, [
      ...(exposeGC ? ['--expose-gc'] : []), path.join(ROOT, 'scripts/soak.mjs'),
      '--seed', '7', '--nights', '2', '--out', out,
    ], { cwd: dir, timeout: 120000, stdio: ['ignore', stdout, stderr] });
  } finally {
    closeSync(stdout);
    closeSync(stderr);
  }
  assert.equal(result.status, 0, readFileSync(stderrPath, 'utf8'));
  return JSON.parse(readFileSync(out, 'utf8'));
}

test('P4 soak: two nights output exact contract keys and valid measurements', () => {
  const report = runSoak(true);
  assert.deepEqual(Object.keys(report).sort(),
    ['nights', 'crashes', 'results', 'mem_start_mb', 'mem_end_mb', 'duration_s'].sort());
  assert.equal(report.nights, 2);
  assert.equal(report.crashes, 0);
  assert.equal(report.results.length, 2);
  assert.ok(report.results.every((result) => result === 'won' || result === 'lost'));
  for (const key of ['mem_start_mb', 'mem_end_mb', 'duration_s']) {
    assert.equal(typeof report[key], 'number');
    assert.ok(Number.isFinite(report[key]));
    assert.ok(report[key] >= 0);
  }
  assert.ok(report.mem_start_mb > 0);
  assert.ok(report.mem_end_mb > 0);
  assert.ok(Math.abs(report.duration_s * 10 - Math.round(report.duration_s * 10)) < 1e-8);
});

test('P4 soak: works without exposed GC and repeats seeded results', () => {
  assert.deepEqual(runSoak(false).results, runSoak(true).results);
});
