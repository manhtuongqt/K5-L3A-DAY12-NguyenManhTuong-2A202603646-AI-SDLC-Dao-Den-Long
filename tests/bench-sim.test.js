// Public sim API exercised in a separate Node CLI; expectations come from P4 §2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { openSync, closeSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, tmpDir } from './helpers.js';

function runBench(body) {
  const dir = tmpDir();
  const out = path.join(dir, 'result.json');
  const stdout = openSync(path.join(dir, 'stdout.txt'), 'w');
  const stderrPath = path.join(dir, 'stderr.txt');
  const stderr = openSync(stderrPath, 'w');
  let result;
  try {
    result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { readFileSync, writeFileSync } from 'node:fs';
      import { createGame } from './src/sim/game.js';
      import { makeBenchScenario } from './src/sim/bench.js';
      const { tuning } = JSON.parse(readFileSync('game.contract.json', 'utf8'));
      const result = (() => { ${body} })();
      writeFileSync(${JSON.stringify(out)}, JSON.stringify(result));
    `], { cwd: ROOT, timeout: 120000, stdio: ['ignore', stdout, stderr] });
  } finally {
    closeSync(stdout);
    closeSync(stderr);
  }
  assert.equal(result.status, 0, readFileSync(stderrPath, 'utf8'));
  return JSON.parse(readFileSync(out, 'utf8'));
}

test('P4 bench: seeded standard scene has 200 wander shades, 100 motes and L1–L3 fuel 100', () => {
  const { scenario, repeat, other, snapshot } = runBench(`
    const scenario = makeBenchScenario(42);
    return { scenario, repeat: makeBenchScenario(42), other: makeBenchScenario(43),
      snapshot: createGame({ seed: 42, night: 1, tuning, scenario, bench: true }).snapshot() };
  `);
  assert.deepEqual(scenario, repeat);
  assert.notDeepEqual(scenario.shades, other.shades);
  assert.equal(scenario.random_motes, false);
  assert.equal(scenario.random_shades, false);
  assert.equal(scenario.random_drifters, false);
  assert.deepEqual(scenario.player.pos, [0, 0, 0]);
  assert.equal(scenario.shades.length, 200);
  assert.equal(new Set(scenario.shades.map((s) => s.id)).size, 200);
  assert.equal(scenario.motes.length, 100);
  for (const shade of scenario.shades) {
    assert.equal(shade.state, 'wander');
    const radius = Math.hypot(shade.pos[0], shade.pos[2]);
    assert.ok(radius >= 4 && radius <= 37);
  }
  for (const pos of scenario.motes) {
    assert.ok(Math.hypot(pos[0], pos[2]) >= 3 && Math.hypot(pos[0], pos[2]) <= 38);
    assert.equal(pos[1], 0);
  }
  assert.equal(snapshot.night, 1);
  assert.equal(snapshot.shades.length, 200);
  assert.equal(snapshot.motes_active, 100);
  assert.deepEqual(snapshot.lanterns.filter((l) => l.lit).map((l) => [l.id, l.fuel]),
    [['L1', 100], ['L2', 100], ['L3', 100]]);
});

test('P4 bench: 600 ticks keep scene, fuel, carried and flames while shades still wander', () => {
  const { before, after, events, ended } = runBench(`
    const game = createGame({ seed: 42, night: 1, tuning, scenario: makeBenchScenario(42), bench: true });
    const before = game.snapshot(), events = [];
    for (let tick = 0; tick < 600; tick += 1) events.push(...game.step());
    return { before, after: game.snapshot(), events, ended: game.ended };
  `);
  assert.equal(after.sim_tick, 600);
  assert.equal(after.shades.length, 200);
  assert.deepEqual(after.shades.map((s) => s.id), before.shades.map((s) => s.id));
  assert.ok(after.shades.every((s) => s.state === 'wander'));
  assert.ok(after.shades.some((s, i) => Math.hypot(s.pos[0] - before.shades[i].pos[0],
    s.pos[2] - before.shades[i].pos[2]) > 1));
  assert.deepEqual(after.motes, before.motes);
  assert.deepEqual(after.lanterns, before.lanterns);
  assert.deepEqual(after.player.pos, [0, 0, 0]);
  assert.equal(after.player.carried, 0);
  assert.equal(after.player.flames, before.player.flames);
  assert.equal(after.state, 'playing');
  assert.equal(ended, false);
  assert.deepEqual(events, []);
});

test('P4 bench: mode itself blocks spawning even when scenario random flags are enabled', () => {
  const result = runBench(`
    const game = createGame({ seed: 1, night: 2, tuning, bench: true, scenario: {
      random_motes: true, random_shades: true, random_drifters: true,
      time_left_s: 0.1, motes: [], shades: []
    } });
    const events = [];
    for (let tick = 0; tick < 1201; tick += 1) events.push(...game.step());
    return { snapshot: game.snapshot(), ended: game.ended, events };
  `);
  assert.equal(result.snapshot.sim_tick, 1201);
  assert.equal(result.snapshot.motes_active, 0);
  assert.deepEqual(result.snapshot.shades, []);
  assert.deepEqual(result.snapshot.drifters, []);
  assert.equal(result.ended, false);
  assert.equal(result.snapshot.time_left_s, 0);
  assert.deepEqual(result.events, []);
});

test('P4 bench: contact cannot pick up motes/charms, hit or steal', () => {
  const { before, after, events } = runBench(`
    const scenario = { random_motes: false, random_shades: false, random_drifters: false,
      player: { pos: [0, 0, 0], carried: 10 }, motes: [[0, 0, 0]],
      shades: [{ pos: [0, 0, 0], state: 'wander' }],
      drifters: [{ pos: [0, 0, 0], state: 'chase' }],
      charms: [{ id: 'C1', pos: [0, 0, 0] }] };
    const game = createGame({ seed: 1, night: 2, tuning, scenario, bench: true });
    const before = game.snapshot(), events = [];
    for (let tick = 0; tick < 2; tick += 1) events.push(...game.step());
    return { before, after: game.snapshot(), events };
  `);
  assert.equal(after.player.flames, before.player.flames);
  assert.equal(after.player.carried, 10);
  assert.equal(after.motes_active, 1);
  assert.equal(after.charms[0].available, true);
  assert.equal(after.drifters[0].stolen, 0);
  assert.equal(after.shades[0].state, 'wander');
  assert.deepEqual(events, []);
});

test('P4 bench: low lantern fuel is not drained and zero flames cannot end the night', () => {
  const { snapshot, ended, events } = runBench(`
    const scenario = { ...makeBenchScenario(42), time_left_s: 0.1,
      player: { pos: [0, 0, 0], flames: 0 },
      shades: [{ pos: [0, 0, 25], state: 'drain', target_lantern_id: 'L1' }],
      lanterns: [{ id: 'L1', lit: true, fuel: 20 }] };
    const game = createGame({ seed: 42, night: 1, tuning, scenario, bench: true });
    const events = [];
    for (let tick = 0; tick < 600; tick += 1) events.push(...game.step());
    return { snapshot: game.snapshot(), ended: game.ended, events };
  `);
  assert.equal(snapshot.lanterns[0].fuel, 20);
  assert.equal(snapshot.lanterns[0].lit, true);
  assert.equal(snapshot.shades[0].state, 'wander');
  assert.equal(snapshot.sim_tick, 600);
  assert.equal(ended, false);
  assert.deepEqual(events, []);
});

test('P4 bench: falling cannot remove flames or carried motes', () => {
  const { before, after, events } = runBench(`
    const game = createGame({ seed: 1, night: 1, tuning, bench: true, scenario: {
      player: { pos: [50, -11, 0], carried: 7 }, motes: [], shades: []
    } });
    const before = game.snapshot(), events = game.step();
    return { before, after: game.snapshot(), events };
  `);
  assert.equal(after.player.flames, before.player.flames);
  assert.equal(after.player.carried, 7);
  assert.deepEqual(events, []);
});
