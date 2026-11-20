// Test hợp đồng headless (black-box): định dạng output, mô hình tick, mã thoát, tất định.
// Kết quả mong đợi suy ra từ docs/notes/phase-1-prd.md, phase-1-design.md, assumptions.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  T, SCENARIO_DIR, ISLAND_RADIUS, SHADE_Y, lanternPos, distXZ, round3,
  run, runOk, scen, frames, snapAt, eventsNamed, assertClose, assertPosClose,
} from './helpers.js';

const SNAPSHOT_KEYS = ['type', 'tick', 'sim_tick', 'state', 'time_left_s', 'score', 'player',
  'lanterns', 'shades', 'motes_active', 'motes'];

// Đệ quy gom mọi số trong một giá trị JSON.
function numbersIn(v, acc = []) {
  if (typeof v === 'number') acc.push(v);
  else if (Array.isArray(v)) v.forEach((x) => numbersIn(x, acc));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => numbersIn(x, acc));
  return acc;
}

// ---------------------------------------------------------------------------
// R1: snapshot tick 0, cấu trúc

test('[R1] snapshot tick 0 là dòng đầu, đủ trường, đúng trạng thái mặc định', () => {
  const res = runOk({ seed: 7, ticks: 5 });
  const s = res.lines[0];
  assert.equal(s.type, 'snapshot');
  assert.equal(s.tick, 0);
  assert.equal(s.sim_tick, 0);
  assert.equal(s.state, 'playing');
  assert.equal(s.time_left_s, T.night1_duration_s);
  assert.equal(s.score, 0);
  assert.deepEqual(s.player, { pos: [0, 0, 0], flames: T.flames, carried: 0 });
  assert.equal(s.lanterns.length, T.lantern_count_night1);
  s.lanterns.forEach((l, i) => {
    assert.equal(l.id, `L${i + 1}`);
    assert.deepEqual(l.pos, lanternPos(i + 1));
    assert.equal(l.lit, false);
    assert.equal(l.deposited, 0);
  });
});

test('[R1] snapshot có đủ trường, đúng thứ tự khóa, trạng thái hợp lệ', () => {
  const res = runOk({ seed: 3, ticks: 30, snapshotEvery: 10 });
  assert.ok(res.snapshots.length >= 4);
  for (const s of res.snapshots) {
    assert.deepEqual(Object.keys(s), SNAPSHOT_KEYS);
    assert.deepEqual(Object.keys(s.player), ['pos', 'flames', 'carried']);
    assert.equal(s.player.pos.length, 3);
    for (const l of s.lanterns) {
      assert.deepEqual(Object.keys(l), ['id', 'pos', 'lit', 'deposited']);
      assert.equal(l.pos.length, 3);
    }
    for (const sh of s.shades) {
      assert.deepEqual(Object.keys(sh), ['id', 'pos', 'state']);
      assert.ok(['chase', 'stunned'].includes(sh.state), `state Bóng Mực lạ: ${sh.state}`);
    }
    for (const m of s.motes) assert.deepEqual(Object.keys(m), ['id', 'pos']);
    assert.ok(['playing', 'won', 'lost'].includes(s.state));
    assert.equal(s.sim_tick, s.tick);
    assert.equal(s.motes_active, s.motes.length);
  }
});

test('[R1] thế giới mặc định (không scenario): 20 đom đóm, 2 Bóng Mực, trong đảo, cách đèn >= 3 m', () => {
  // design mục 7: ban đầu 20 đom đóm, 2 Bóng Mực ngẫu nhiên trên vòng bán kính 35.
  const s = runOk({ seed: 11, ticks: 1 }).lines[0];
  assert.equal(s.motes_active, 20);
  assert.equal(s.motes.length, 20);
  assert.equal(s.shades.length, 2);
  for (const m of s.motes) {
    assert.equal(m.pos[1], 0, 'đom đóm nằm trên mặt đất');
    assert.ok(Math.hypot(m.pos[0], m.pos[2]) <= ISLAND_RADIUS);
    for (const l of s.lanterns) assert.ok(distXZ(m.pos, l.pos) >= 3 - 0.002, 'đom đóm quá gần đèn');
  }
  for (const sh of s.shades) {
    assert.equal(sh.state, 'chase');
    assert.equal(sh.pos[1], SHADE_Y);
    assertClose(Math.hypot(sh.pos[0], sh.pos[2]), 35, 0.01, 'Bóng Mực sinh trên vòng bán kính 35:');
  }
  assert.deepEqual(s.motes.map((m) => m.id), Array.from({ length: 20 }, (_, i) => `M${i + 1}`));
  assert.deepEqual(s.shades.map((x) => x.id), ['S1', 'S2']);
});

test('[R1] tọa độ và time_left_s làm tròn tối đa 3 chữ số, không có -0, JSON gọn', () => {
  const inputs = frames(
    { tick: 0, move: [0.37, 0.91], cam_yaw_deg: 37 },
    { tick: 50, move: [-1, 0.2], cam_yaw_deg: 211.3 },
  );
  const res = runOk({ seed: 5, ticks: 300, snapshotEvery: 7, inputs });
  for (const l of res.lines) {
    for (const v of numbersIn(l)) {
      assert.ok(Number.isFinite(v));
      assert.equal(Math.round(v * 1000) / 1000, v, `số có hơn 3 chữ số thập phân: ${v}`);
      assert.ok(!Object.is(v, -0), 'có -0');
    }
  }
  // JSON.stringify không khoảng trắng: dòng gốc phải bằng tái tuần tự hóa.
  const rawLines = res.raw.split('\n').filter((x) => x !== '');
  rawLines.forEach((rl, i) => assert.equal(JSON.stringify(res.lines[i]), rl));
});

test('[R1] time_left_s = thời lượng - tick/60 (làm tròn 3 chữ số)', () => {
  const res = runOk({ seed: 2, ticks: 200, snapshotEvery: 20, scenario: scen() });
  for (const s of res.snapshots) assertClose(s.time_left_s, T.night1_duration_s - s.tick / 60, 0.0006, `tick ${s.tick}`);
  assert.equal(snapAt(res, 60).time_left_s, T.night1_duration_s - 1);
});

// ---------------------------------------------------------------------------
// R1: mô hình tick, chu kỳ snapshot, dòng end

test('[R1] --ticks N cho end.ticks = N khi game chưa kết thúc; end là dòng cuối', () => {
  for (const n of [1, 37, 120]) {
    const res = runOk({ ticks: n, scenario: scen() });
    const last = res.lines[res.lines.length - 1];
    assert.equal(last.type, 'end');
    assert.equal(last.ticks, n);
    assert.equal(last.state, 'playing');
    assert.equal(last.score, 0);
    assert.equal(res.lines.filter((l) => l.type === 'end').length, 1);
    assert.deepEqual(Object.keys(last), ['type', 'ticks', 'state', 'score']);
  }
});

test('[R1] --ticks 0 cho snapshot tick 0 rồi end ticks 0', () => {
  const res = runOk({ ticks: 0, scenario: scen() });
  assert.equal(res.lines[0].type, 'snapshot');
  assert.equal(res.lines[0].tick, 0);
  assert.equal(res.end.type, 'end');
  assert.equal(res.end.ticks, 0);
});

test('[R1] snapshot mặc định mỗi 10 tick, bắt đầu từ tick 0', () => {
  const res = runOk({ ticks: 95, scenario: scen() });
  assert.deepEqual(res.snapshots.map((s) => s.tick), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
  assert.equal(res.end.ticks, 95);
});

test('[R1] --snapshot-every K: snapshot đúng các tick chia hết cho K (kể cả tick cuối)', () => {
  const a = runOk({ ticks: 100, snapshotEvery: 25, scenario: scen() });
  assert.deepEqual(a.snapshots.map((s) => s.tick), [0, 25, 50, 75, 100]);
  // snapshot tick cuối đứng trước dòng end
  assert.equal(a.lines[a.lines.length - 2].type, 'snapshot');
  assert.equal(a.lines[a.lines.length - 2].tick, 100);
  const b = runOk({ ticks: 10, snapshotEvery: 1, scenario: scen() });
  assert.deepEqual(b.snapshots.map((s) => s.tick), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const c = runOk({ ticks: 50, snapshotEvery: 7, scenario: scen() });
  assert.deepEqual(c.snapshots.map((s) => s.tick), [0, 7, 14, 21, 28, 35, 42, 49]);
});

test('[R1] snapshot tick 0 là trạng thái trước input; input tick k tác dụng lên trạng thái k+1', () => {
  const inputs = frames({ tick: 5, move: [0, 1], cam_yaw_deg: 0 });
  const res = runOk({ ticks: 8, snapshotEvery: 1, scenario: scen(), inputs });
  for (let k = 0; k <= 5; k++) assert.deepEqual(snapAt(res, k).player.pos, [0, 0, 0], `tick ${k}`);
  assertClose(snapAt(res, 6).player.pos[2], T.player_speed / 60, 0.0006, 'tick 6');
  assertClose(snapAt(res, 8).player.pos[2], (3 * T.player_speed) / 60, 0.0006, 'tick 8');
});

test('[R1] input tick 0 đã tác dụng ở bước đầu (snapshot tick 0 vẫn ở gốc, tick 1 đã đi)', () => {
  const inputs = frames({ tick: 0, move: [0, 1] });
  const res = runOk({ ticks: 2, snapshotEvery: 1, scenario: scen(), inputs });
  assert.deepEqual(snapAt(res, 0).player.pos, [0, 0, 0]);
  assertClose(snapAt(res, 1).player.pos[2], T.player_speed / 60, 0.0006);
});

test('[R1] sự kiện mang tick = k+1 và đứng trước snapshot cùng tick', () => {
  // Đom đóm ngay tại chỗ người chơi: nhặt ở bước 0 -> sự kiện tick 1.
  const sc = scen({ motes: [[0, 0, 0]] });
  const res = runOk({ ticks: 3, snapshotEvery: 1, scenario: sc });
  const idx = res.lines.findIndex((l) => l.type === 'event');
  const ev = res.lines[idx];
  assert.equal(ev.name, 'mote_picked');
  assert.equal(ev.tick, 1);
  assert.deepEqual(ev.data, { carried: 1 });
  assert.deepEqual(Object.keys(ev), ['type', 'tick', 'name', 'data']);
  // thứ tự: snapshot0, event(tick1), snapshot1, ...
  assert.equal(res.lines[idx - 1].type, 'snapshot');
  assert.equal(res.lines[idx - 1].tick, 0);
  assert.equal(res.lines[idx + 1].type, 'snapshot');
  assert.equal(res.lines[idx + 1].tick, 1);
  assert.equal(res.lines[idx + 1].player.carried, 1);

  // interact ở frame tick 10 -> deposit ghi tick 11.
  const l1 = lanternPos(1);
  const sc2 = scen({ player: { pos: l1, carried: 2 } });
  const inputs = frames({ tick: 10, interact: true }, { tick: 11, interact: false });
  const r2 = runOk({ ticks: 20, scenario: sc2, inputs });
  assert.equal(eventsNamed(r2, 'deposit')[0].tick, 11);
});

test('[R1] frame chỉ đổi trường có mặt, trường vắng giữ giá trị cũ', () => {
  // move đặt ở tick 0, frame tick 30 chỉ đặt cam_yaw_deg=0 -> move vẫn là [0,1].
  const inputs = frames({ tick: 0, move: [0, 1] }, { tick: 30, interact: false }, { tick: 45, cam_yaw_deg: 0 });
  const res = runOk({ ticks: 60, snapshotEvery: 60, scenario: scen(), inputs });
  assertClose(snapAt(res, 60).player.pos[2], T.player_speed, 0.002);
});

test('[R1] không có file inputs: người chơi đứng yên', () => {
  const res = runOk({ ticks: 120, snapshotEvery: 60, scenario: scen() });
  for (const s of res.snapshots) assert.deepEqual(s.player.pos, [0, 0, 0]);
});

test('[R1] ví dụ scenario/inputs chép từ PRD chạy được, mã thoát 0, ticks đủ', () => {
  const res = runOk({
    ticks: 100,
    scenarioFile: path.join(SCENARIO_DIR, 'prd-example.scenario.json'),
    inputsFile: path.join(SCENARIO_DIR, 'prd-example.inputs.json'),
  });
  assert.equal(res.lines[0].shades.length, 1);
  assert.equal(res.lines[0].motes_active, 1);
  assert.equal(res.end.ticks, 100);
  assert.equal(res.end.state, 'playing');
});

test('[R1] hợp lệ: frames rỗng, frame chỉ có tick, vector move [1,1]', () => {
  runOk({ ticks: 5, scenario: scen(), inputs: { frames: [] } });
  runOk({ ticks: 5, scenario: scen(), inputs: frames({ tick: 0 }) });
  runOk({ ticks: 5, scenario: scen(), inputs: frames({ tick: 0, move: [1, 1] }) });
  runOk({ ticks: 5, scenario: scen(), inputs: frames({ tick: 0, move: [-1, -1], cam_yaw_deg: -45.5 }) });
});

// ---------------------------------------------------------------------------
// R1: mã thoát

const BAD_INPUTS = {
  'tick trùng': frames({ tick: 5 }, { tick: 5 }),
  'tick giảm': frames({ tick: 10 }, { tick: 3 }),
  'tick âm': frames({ tick: -1 }),
  'tick không nguyên': frames({ tick: 1.5 }),
  'tick là chuỗi': frames({ tick: '3' }),
  'thiếu tick': frames({ move: [0, 1] }),
  'move x > 1': frames({ tick: 0, move: [1.5, 0] }),
  'move z < -1': frames({ tick: 0, move: [0, -1.01] }),
  'move chỉ 1 phần tử': frames({ tick: 0, move: [0] }),
  'move 3 phần tử': frames({ tick: 0, move: [0, 0, 0] }),
  'move chứa chuỗi': frames({ tick: 0, move: [0, '1'] }),
  'move không phải mảng': frames({ tick: 0, move: 'up' }),
  'cam_yaw_deg là chuỗi': frames({ tick: 0, cam_yaw_deg: '90' }),
  'jump là số': frames({ tick: 0, jump: 1 }),
  'interact là chuỗi': frames({ tick: 0, interact: 'true' }),
  'pulse là null': frames({ tick: 0, pulse: null }),
  'thiếu frames': {},
  'frames không phải mảng': { frames: {} },
  'frame là số': { frames: [5] },
};
for (const [name, inputs] of Object.entries(BAD_INPUTS)) {
  test(`[R1] inputs sai định dạng (${name}) -> mã thoát 2, lỗi ra stderr`, () => {
    const res = run({ ticks: 10, scenario: scen(), inputs });
    assert.equal(res.status, 2, `stderr: ${res.stderr}`);
    assert.ok(res.stderr.trim().length > 0, 'phải có thông báo lỗi ở stderr');
  });
}

test('[R1] inputs không phải JSON -> mã thoát 2', () => {
  for (const raw of ['{ frames: [', 'khong phai json', '']) {
    const res = run({ ticks: 10, scenario: scen(), inputsRaw: raw });
    assert.equal(res.status, 2, `raw=${JSON.stringify(raw)} stderr: ${res.stderr}`);
    assert.ok(res.stderr.trim().length > 0);
  }
});

test('[R1] file inputs/scenario không tồn tại -> mã thoát 2', () => {
  assert.equal(run({ ticks: 10, inputsFile: '/nonexistent/dir/inputs.json' }).status, 2);
  assert.equal(run({ ticks: 10, scenarioFile: '/nonexistent/dir/scenario.json' }).status, 2);
});

const BAD_SCENARIOS = {
  'scenario là chuỗi': '"hi"',
  'scenario là số': '42',
  'player.pos 2 phần tử': scen({ player: { pos: [0, 0] } }),
  'player.pos chứa chuỗi': scen({ player: { pos: [0, '0', 0] } }),
  'carried âm': scen({ player: { carried: -1 } }),
  'carried không nguyên': scen({ player: { carried: 1.5 } }),
  'flames là chuỗi': scen({ player: { flames: '3' } }),
  'flames không nguyên': scen({ player: { flames: 2.5 } }),
  'random_motes không phải boolean': scen({ random_motes: 1 }),
  'random_shades không phải boolean': scen({ random_shades: 'false' }),
  'motes không phải mảng': scen({ motes: 5 }),
  'mote pos 2 phần tử': scen({ motes: [[0, 0]] }),
  'shades không phải mảng object': scen({ shades: [[1, 2, 3]] }),
  'shade thiếu pos': scen({ shades: [{}] }),
  'id đèn lạ': scen({ lanterns: [{ id: 'L9', pos: [0, 0, 0] }] }),
  'lit không phải boolean': scen({ lanterns: [{ id: 'L1', lit: 'yes' }] }),
  'deposited âm': scen({ lanterns: [{ id: 'L1', deposited: -1 }] }),
  'time_left_s = 0': scen({ time_left_s: 0 }),
  'time_left_s âm': scen({ time_left_s: -5 }),
  'time_left_s là chuỗi': scen({ time_left_s: '300' }),
};
for (const [name, sc] of Object.entries(BAD_SCENARIOS)) {
  test(`[R1] scenario sai định dạng (${name}) -> mã thoát 2`, () => {
    const res = typeof sc === 'string' ? run({ ticks: 10, scenarioRaw: sc }) : run({ ticks: 10, scenario: sc });
    assert.equal(res.status, 2, `stderr: ${res.stderr}`);
    assert.ok(res.stderr.trim().length > 0);
  });
}

test('[R1] scenario không phải JSON -> mã thoát 2', () => {
  assert.equal(run({ ticks: 10, scenarioRaw: '{ "player": ' }).status, 2);
});

test('[R1] thiếu --out -> mã thoát khác 0 (design: 1), có lỗi ở stderr', () => {
  const res = run({ ticks: 10, out: false });
  assert.notEqual(res.status, 0);
  assert.equal(res.status, 1);
  assert.ok(res.stderr.trim().length > 0);
});

test('[R1] thiếu --ticks / --seed, --night khác 1, tham số lạ -> mã thoát 1', () => {
  assert.equal(run({ ticks: null }).status, 1, 'thiếu --ticks');
  assert.equal(run({ ticks: 10, seed: null }).status, 1, 'thiếu --seed');
  assert.equal(run({ ticks: 10, night: 2 }).status, 1, '--night 2');
  assert.equal(run({ ticks: 10, extraArgs: ['--bogus', '1'] }).status, 1, 'tham số lạ');
});

test('[R1] game kết thúc sớm vẫn thoát mã 0 và end.ticks < --ticks', () => {
  const sc = scen({ time_left_s: 1 });
  const res = run({ ticks: 500, scenario: sc });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.end.ticks, 60);
  assert.equal(res.end.state, 'lost');
});

// ---------------------------------------------------------------------------
// R10: tất định

const WALK_INPUTS = (() => {
  const f = [];
  for (let k = 0; k < 3000; k += 40) {
    f.push({ tick: k, move: [Math.sin(k / 97), Math.cos(k / 61)], cam_yaw_deg: (k / 7) % 360 });
  }
  // thêm nút bấm xen kẽ
  const buttons = [];
  for (let k = 20; k < 3000; k += 200) buttons.push({ tick: k, pulse: true }, { tick: k + 1, pulse: false });
  for (let k = 120; k < 3000; k += 300) buttons.push({ tick: k, interact: true }, { tick: k + 1, interact: false });
  const all = [...f, ...buttons].sort((a, b) => a.tick - b.tick);
  // tick phải tăng nghiêm ngặt: gộp frame cùng tick
  const merged = [];
  for (const fr of all) {
    const last = merged[merged.length - 1];
    if (last && last.tick === fr.tick) Object.assign(last, fr); else merged.push({ ...fr });
  }
  return { frames: merged };
})();

test('[R10] cùng seed, không scenario, 3000 tick -> hai file giống hệt từng byte', () => {
  const a = runOk({ seed: 42, ticks: 3000 });
  const b = runOk({ seed: 42, ticks: 3000 });
  assert.ok(a.raw.length > 1000);
  assert.ok(Buffer.from(a.raw).equals(Buffer.from(b.raw)), 'output hai lần chạy khác nhau');
});

test('[R10] cùng seed + inputs có di chuyển/pulse/interact -> giống hệt từng byte (kể cả id tự sinh)', () => {
  const a = runOk({ seed: 20260, ticks: 3000, snapshotEvery: 5, inputs: WALK_INPUTS });
  const b = runOk({ seed: 20260, ticks: 3000, snapshotEvery: 5, inputs: WALK_INPUTS });
  assert.ok(Buffer.from(a.raw).equals(Buffer.from(b.raw)));
});

test('[R10] cùng seed + scenario + inputs (ví dụ PRD) -> giống hệt từng byte', () => {
  const opts = {
    seed: 9, ticks: 400,
    scenarioFile: path.join(SCENARIO_DIR, 'prd-example.scenario.json'),
    inputsFile: path.join(SCENARIO_DIR, 'prd-example.inputs.json'),
  };
  assert.ok(Buffer.from(runOk(opts).raw).equals(Buffer.from(runOk(opts).raw)));
});

test('[R10] seed khác nhau -> output khác nhau', () => {
  const a = runOk({ seed: 1, ticks: 600 });
  const b = runOk({ seed: 2, ticks: 600 });
  assert.notEqual(a.raw, b.raw);
  // thế giới ban đầu (đom đóm/Bóng Mực ngẫu nhiên) cũng phải khác
  assert.notDeepEqual(a.lines[0].motes, b.lines[0].motes);
});
