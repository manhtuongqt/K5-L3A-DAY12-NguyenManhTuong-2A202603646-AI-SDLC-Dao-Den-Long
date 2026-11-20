// Tiện ích dùng chung cho test black-box của chế độ headless.
// Không import gì từ src/: chỉ gọi CLI `node src/headless.js` và đọc JSONL.
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const HEADLESS = path.join(ROOT, 'src', 'headless.js');
export const CONTRACT = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8'));
export const T = CONTRACT.tuning;
export const S = T.score;
export const SCENARIO_DIR = path.join(ROOT, 'tests', 'scenarios');

// Hằng số thế giới lấy từ docs/notes/phase-1-design.md mục 2 (không nằm trong tuning).
export const ISLAND_RADIUS = 40;
export const SHADE_Y = 1.0;

/** giây -> tick, đúng quy ước của đặc tả: Math.round(s*60). */
export const ticksOf = (s) => Math.round(s * 60);
/** mét đi được mỗi tick với tốc độ v (m/s). */
export const perTick = (v) => v / 60;
export const round3 = (v) => Math.round(v * 1000) / 1000;

/** Vị trí đèn Lk theo design mục 2: góc 72*(k-1) độ từ +Z quay về +X, bán kính 25. */
export function lanternPos(k) {
  const a = ((72 * (k - 1)) * Math.PI) / 180;
  return [round3(25 * Math.sin(a)), 0, round3(25 * Math.cos(a))];
}

export const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

// ---------------------------------------------------------------------------
// Chạy CLI

const DIRS = [];
process.on('exit', () => {
  for (const d of DIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* bỏ qua */ }
  }
});

export function tmpDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-test-'));
  DIRS.push(d);
  return d;
}

/**
 * Chạy `node src/headless.js`.
 * opts: seed (mặc định 1, null = bỏ), night (mặc định 1, null = bỏ), ticks (null = bỏ),
 *   out (mặc định true; false = bỏ --out), snapshotEvery,
 *   scenario (object) | scenarioRaw (chuỗi nguyên văn) | scenarioFile (đường dẫn),
 *   inputs (object) | inputsRaw | inputsFile, extraArgs (mảng).
 */
export function run(opts = {}) {
  const dir = tmpDir();
  const args = [HEADLESS];
  const put = (k, v) => { if (v !== undefined && v !== null) args.push(k, String(v)); };
  put('--seed', opts.seed === undefined ? 1 : opts.seed);
  put('--night', opts.night === undefined ? 1 : opts.night);
  put('--ticks', opts.ticks);
  put('--snapshot-every', opts.snapshotEvery);

  let scenarioFile = opts.scenarioFile;
  if (opts.scenario !== undefined) {
    scenarioFile = path.join(dir, 'scenario.json');
    fs.writeFileSync(scenarioFile, JSON.stringify(opts.scenario));
  } else if (opts.scenarioRaw !== undefined) {
    scenarioFile = path.join(dir, 'scenario.json');
    fs.writeFileSync(scenarioFile, opts.scenarioRaw);
  }
  put('--scenario', scenarioFile);

  let inputsFile = opts.inputsFile;
  if (opts.inputs !== undefined) {
    inputsFile = path.join(dir, 'inputs.json');
    fs.writeFileSync(inputsFile, JSON.stringify(opts.inputs));
  } else if (opts.inputsRaw !== undefined) {
    inputsFile = path.join(dir, 'inputs.json');
    fs.writeFileSync(inputsFile, opts.inputsRaw);
  }
  put('--inputs', inputsFile);

  const outPath = path.join(dir, 'out.jsonl');
  if (opts.out !== false) put('--out', outPath);
  if (opts.extraArgs) args.push(...opts.extraArgs);

  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
  const raw = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : null;
  let cache = null;
  const res = {
    status: r.status,
    signal: r.signal,
    stderr: r.stderr || '',
    stdout: r.stdout || '',
    outPath,
    raw,
    get lines() {
      if (cache) return cache;
      assert.notEqual(raw, null, 'không có file output');
      const parts = raw.split('\n');
      if (parts[parts.length - 1] === '') parts.pop();
      cache = parts.map((l, i) => {
        try { return JSON.parse(l); } catch (e) { throw new Error(`dòng ${i + 1} không phải JSON: ${l.slice(0, 80)}`); }
      });
      return cache;
    },
    get snapshots() { return this.lines.filter((l) => l.type === 'snapshot'); },
    get events() { return this.lines.filter((l) => l.type === 'event'); },
    get end() { return this.lines[this.lines.length - 1]; },
  };
  return res;
}

/** Chạy và khẳng định mã thoát 0. */
export function runOk(opts) {
  const res = run(opts);
  assert.equal(res.status, 0, `mã thoát ${res.status}, stderr: ${res.stderr}`);
  return res;
}

export const eventsNamed = (res, name) => res.events.filter((e) => e.name === name);
export const snapAt = (res, tick) => {
  const s = res.snapshots.find((x) => x.tick === tick);
  assert.ok(s, `không có snapshot tick ${tick}`);
  return s;
};

// ---------------------------------------------------------------------------
// Dựng scenario

/** Scenario "sạch": không ngẫu nhiên, không đom đóm, không Bóng Mực, người chơi ở gốc. */
export function scen(over = {}) {
  const { player, ...rest } = over;
  return {
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: [],
    player: { pos: [0, 0, 0], carried: 0, flames: T.flames, ...(player || {}) },
    ...rest,
  };
}

export const frames = (...f) => ({ frames: f });

export function assertClose(actual, expected, tol, msg = '') {
  assert.ok(Math.abs(actual - expected) <= tol, `${msg} thực tế ${actual}, mong đợi ${expected} ± ${tol}`);
}
export function assertPosClose(actual, expected, tol, msg = '') {
  assert.equal(actual.length, expected.length, `${msg} độ dài pos`);
  for (let i = 0; i < expected.length; i++) assertClose(actual[i], expected[i], tol, `${msg} pos[${i}]`);
}

/**
 * Kiểm tra điểm trong output khớp bảng điểm (R9): cộng dồn theo sự kiện rồi so với
 * mọi snapshot và dòng end. Thắng: thêm per_second_left*floor(time_left) + per_flame_left*flames.
 */
export function assertScoreConsistent(res, { t0 = T.night1_duration_s, flames0 = T.flames } = {}) {
  let score = 0;
  let flames = flames0;
  for (const l of res.lines) {
    if (l.type === 'event') {
      if (l.name === 'mote_picked') score += S.per_mote;
      else if (l.name === 'lantern_lit') score += S.per_lantern;
      else if (l.name === 'pulse') score += S.per_stun * l.data.stunned_ids.length;
      else if (l.name === 'player_hit') flames = l.data.flames;
      else if (l.name === 'game_over' && l.data.result === 'won') {
        score += S.per_second_left * Math.floor(t0 - l.tick / 60) + S.per_flame_left * flames;
      }
    } else if (l.type === 'snapshot') {
      assert.equal(l.score, score, `score snapshot tick ${l.tick}`);
    } else if (l.type === 'end') {
      assert.equal(l.score, score, 'score trong end');
    }
  }
  return score;
}
