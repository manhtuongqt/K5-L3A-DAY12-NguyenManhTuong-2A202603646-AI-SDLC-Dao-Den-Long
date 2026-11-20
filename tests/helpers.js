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

// Bản đồ chuẩn: tọa độ chép từ docs/notes/phase-2-ticket.md (Phần 2), không lấy từ code.
export const LANTERNS = {
  1: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
  2: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
  3: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
};
/** Điểm xuất phát (Đêm 3 theo phase-2-design mục 9). */
export const START = { 1: [0, 0, 0], 2: [0, 0, 0], 3: [0, 0, -25] };
export const DURATION_S = { 1: T.night1_duration_s, 2: T.night2_duration_s, 3: T.night3_duration_s };
export const lanternPos = (k, night = 1) => [...LANTERNS[night][k - 1]];

/** Điểm trên đường tròn: (cx + r cos a, y, cz + r sin a), a tính từ +X về +Z (design mục 2). */
export function circlePts(cx, cz, r, startDeg, stepDeg, count, y = 0) {
  return Array.from({ length: count }, (_, i) => {
    const a = ((startDeg + stepDeg * i) * Math.PI) / 180;
    return [cx + r * Math.cos(a), y, cz + r * Math.sin(a)];
  });
}

export const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
export const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

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
    // events: mọi sự kiện TRỪ night_start (phát ở tick 0 ngay sau snapshot 0, v1.1). allEvents: tất cả.
    get events() { return this.lines.filter((l) => l.type === 'event' && l.name !== 'night_start'); },
    get allEvents() { return this.lines.filter((l) => l.type === 'event'); },
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

/** Scenario "sạch": không ngẫu nhiên, không đom đóm, không Bóng Mực/Gió Lạc, không gió, người chơi ở gốc. */
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

/** Như scen() nhưng điểm đứng mặc định là điểm xuất phát của Đêm `night`, và tắt Gió Lạc/gió. */
export function scenN(night, over = {}) {
  const sc = scen({ random_drifters: false, wind_enabled: false, ...over });
  if (!over.player || !over.player.pos) sc.player.pos = [...START[night]];
  return sc;
}

export const frames = (...f) => ({ frames: f });

/**
 * Quãng đường đi được sau `ticks` tick giữ phím từ đứng yên: không thể vượt speed*ticks/60,
 * và thua tốc độ tối đa không quá 0.1 s * speed (tăng tốc <= 0.1 s theo ticket).
 */
export function assertRunDistance(actual, ticks, speed = T.player_speed, msg = '') {
  const max = (speed * ticks) / 60;
  assert.ok(actual <= max + 0.003 && actual >= max - speed * 0.1 - 0.003,
    `${msg} quãng đường ${actual} ngoài [${max - speed * 0.1}, ${max}]`);
}

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
      if (l.name === 'deposit') score += S.per_mote * l.data.amount; // v1.1: điểm khi NẠP, không khi nhặt
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

/** Inputs "đi dạo" tất định: đổi move/yaw mỗi 40 tick, pulse/interact/dash xen kẽ. Tick tăng nghiêm ngặt. */
export function walkInputs(total, { dash = true } = {}) {
  const all = [];
  for (let k = 0; k < total; k += 40) {
    all.push({ tick: k, move: [Math.sin(k / 97), Math.cos(k / 61)], cam_yaw_deg: (k / 7) % 360 });
  }
  for (let k = 20; k < total; k += 200) all.push({ tick: k, pulse: true }, { tick: k + 1, pulse: false });
  for (let k = 120; k < total; k += 300) all.push({ tick: k, interact: true }, { tick: k + 1, interact: false });
  if (dash) for (let k = 70; k < total; k += 250) all.push({ tick: k, dash: true }, { tick: k + 1, dash: false });
  for (let k = 90; k < total; k += 330) all.push({ tick: k, jump: true }, { tick: k + 1, jump: false });
  all.sort((a, b) => a.tick - b.tick);
  const merged = [];
  for (const fr of all) {
    const last = merged[merged.length - 1];
    if (last && last.tick === fr.tick) Object.assign(last, fr); else merged.push({ ...fr });
  }
  return { frames: merged };
}
