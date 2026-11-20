// Test luật chơi (black-box qua CLI headless). Mọi con số lấy từ game.contract.json (T),
// hằng số thế giới lấy từ docs/notes/phase-1-design.md mục 2.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  T, S, ISLAND_RADIUS, SHADE_Y, lanternPos, distXZ, ticksOf, perTick,
  runOk, scen, frames, snapAt, eventsNamed, assertClose, assertPosClose, assertScoreConsistent,
} from './helpers.js';

const STEP = perTick(T.player_speed);
const SHADE_STEP = perTick(T.shade_speed);
const POS_TOL = 0.002; // làm tròn 3 chữ số + sai số cộng dồn nhỏ
const gameOver = (res) => eventsNamed(res, 'game_over');

// ---------------------------------------------------------------------------
// R2: di chuyển

function walk({ move, yaw = 0, ticks = 60, pos = [0, 0, 0] }) {
  const res = runOk({
    ticks, snapshotEvery: 1,
    scenario: scen({ player: { pos } }),
    inputs: frames({ tick: 0, move, cam_yaw_deg: yaw }),
  });
  return res;
}

test('[R2] move [0,1], yaw 0, 60 tick -> z = player_speed (đi theo +Z)', () => {
  const p = snapAt(walk({ move: [0, 1] }), 60).player.pos;
  assertPosClose(p, [0, 0, T.player_speed], POS_TOL);
});

test('[R2] move [1,0], yaw 0 -> đi theo +X', () => {
  assertPosClose(snapAt(walk({ move: [1, 0] }), 60).player.pos, [T.player_speed, 0, 0], POS_TOL);
});

test('[R2] move [0,1], yaw 90 -> đi theo +X', () => {
  assertPosClose(snapAt(walk({ move: [0, 1], yaw: 90 }), 60).player.pos, [T.player_speed, 0, 0], POS_TOL);
});

test('[R2] move [1,0], yaw 90 -> đi theo -Z (x\' = x cos + z sin, z\' = -x sin + z cos)', () => {
  assertPosClose(snapAt(walk({ move: [1, 0], yaw: 90 }), 60).player.pos, [0, 0, -T.player_speed], POS_TOL);
});

test('[R2] move [0,1], yaw 180 -> đi theo -Z', () => {
  assertPosClose(snapAt(walk({ move: [0, 1], yaw: 180 }), 60).player.pos, [0, 0, -T.player_speed], POS_TOL);
});

test('[R2] vector [1,1] được chuẩn hóa về độ dài 1 (không nhanh hơn player_speed)', () => {
  const p = snapAt(walk({ move: [1, 1] }), 60).player.pos;
  const d = T.player_speed / Math.SQRT2;
  assertPosClose(p, [d, 0, d], POS_TOL);
  assertClose(Math.hypot(p[0], p[2]), T.player_speed, POS_TOL, 'quãng đường:');
});

test('[R2] vector ngắn hơn 1 không bị phóng đại: [0, 0.5] đi nửa tốc độ', () => {
  assertPosClose(snapAt(walk({ move: [0, 0.5] }), 60).player.pos, [0, 0, T.player_speed / 2], POS_TOL);
});

test('[R2] quãng đường đi được tỉ lệ ticks: player_speed * ticks / 60', () => {
  const res = walk({ move: [0, 1], ticks: 90 });
  assertClose(snapAt(res, 90).player.pos[2], (T.player_speed * 90) / 60, POS_TOL);
  assertClose(snapAt(res, 30).player.pos[2], (T.player_speed * 30) / 60, POS_TOL);
});

test('[R2] mép đảo bán kính 40 chặn lại, không bao giờ vượt ra ngoài', () => {
  const res = walk({ move: [0, 1], ticks: 180, pos: [0, 0, 38] });
  for (const s of res.snapshots) {
    assert.ok(Math.hypot(s.player.pos[0], s.player.pos[2]) <= ISLAND_RADIUS + 0.001, `tick ${s.tick} ra ngoài đảo`);
  }
  assertPosClose(snapAt(res, 180).player.pos, [0, 0, ISLAND_RADIUS], POS_TOL);
  assert.equal(eventsNamed(res, 'player_hit').length, 0, 'fall_enabled=false: không có player_hit by fall');
});

test('[R2] mép đảo theo đường chéo: bị kéo về đúng bán kính 40 theo hướng tâm', () => {
  const res = walk({ move: [1, 1], ticks: 120, pos: [28, 0, 28] });
  const p = snapAt(res, 120).player.pos;
  assertClose(Math.hypot(p[0], p[2]), ISLAND_RADIUS, POS_TOL, 'bán kính:');
  assertClose(p[0], p[2], POS_TOL, 'giữ hướng tâm->người chơi:');
});

test('[R2] nhảy: y > 0 ngay sau khi bấm, quay về 0, không đổi vị trí XZ', () => {
  const res = runOk({
    ticks: 90, snapshotEvery: 1, scenario: scen(),
    inputs: frames({ tick: 0, jump: true }, { tick: 1, jump: false }),
  });
  assert.ok(snapAt(res, 5).player.pos[1] > 0);
  assert.equal(snapAt(res, 90).player.pos[1], 0);
  for (const s of res.snapshots) {
    assert.ok(s.player.pos[1] >= 0);
    assert.equal(s.player.pos[0], 0);
    assert.equal(s.player.pos[2], 0);
  }
});

// ---------------------------------------------------------------------------
// R3: nhặt đom đóm

test('[R3] đom đóm trong pickup_radius được nhặt: mote_picked {carried}, điểm per_mote', () => {
  const sc = scen({ motes: [[0, 0, T.pickup_radius - 0.01]] });
  const res = runOk({ ticks: 5, snapshotEvery: 1, scenario: sc });
  const ev = eventsNamed(res, 'mote_picked');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].tick, 1);
  assert.deepEqual(ev[0].data, { carried: 1 });
  const s = snapAt(res, 1);
  assert.equal(s.player.carried, 1);
  assert.equal(s.motes_active, 0);
  assert.equal(s.score, S.per_mote);
  assert.equal(res.end.score, S.per_mote);
});

test('[R3] đom đóm ngoài pickup_radius không bị nhặt', () => {
  const sc = scen({ motes: [[0, 0, T.pickup_radius + 0.05]] });
  const res = runOk({ ticks: 10, snapshotEvery: 5, scenario: sc });
  assert.equal(eventsNamed(res, 'mote_picked').length, 0);
  assert.equal(snapAt(res, 10).player.carried, 0);
  assert.equal(snapAt(res, 10).motes_active, 1);
});

test('[R3] đi tới đom đóm: nhặt đúng tick khi khoảng cách <= pickup_radius', () => {
  const z0 = 5.05; // tránh biên chính xác
  const res = runOk({
    ticks: 120, snapshotEvery: 1,
    scenario: scen({ motes: [[0, 0, z0]] }),
    inputs: frames({ tick: 0, move: [0, 1] }),
  });
  const k = Math.ceil((z0 - T.pickup_radius) / STEP - 1e-6); // số bước để vào bán kính
  const ev = eventsNamed(res, 'mote_picked');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].tick, k);
  assert.equal(snapAt(res, k).player.carried, 1);
  assert.equal(snapAt(res, k - 1).player.carried, 0);
});

test('[R3] túi đầy (carry_capacity) thì không nhặt, đom đóm ở lại', () => {
  const sc = scen({ player: { carried: T.carry_capacity }, motes: [[0, 0, 0]] });
  const res = runOk({ ticks: 20, snapshotEvery: 10, scenario: sc });
  assert.equal(eventsNamed(res, 'mote_picked').length, 0);
  const s = snapAt(res, 20);
  assert.equal(s.player.carried, T.carry_capacity);
  assert.equal(s.motes_active, 1);
  assert.equal(res.end.score, 0);
});

test('[R3] còn chỗ 1: hai đom đóm cùng lúc chỉ nhặt một (id nhỏ trước), carried = capacity', () => {
  const sc = scen({ player: { carried: T.carry_capacity - 1 }, motes: [[0, 0, 0], [0, 0, 0.5]] });
  const res = runOk({ ticks: 10, snapshotEvery: 5, scenario: sc });
  const ev = eventsNamed(res, 'mote_picked');
  assert.equal(ev.length, 1);
  assert.deepEqual(ev[0].data, { carried: T.carry_capacity });
  const s = snapAt(res, 10);
  assert.deepEqual(s.motes.map((m) => m.id), ['M2']);
  assert.equal(res.end.score, S.per_mote);
});

test('[R3] nhiều đom đóm cùng một bước: nhặt lần lượt, carried tăng dần, điểm = n * per_mote', () => {
  const sc = scen({ motes: [[0, 0, 0], [0.2, 0, 0], [0, 0, 0.2]] });
  const res = runOk({ ticks: 3, snapshotEvery: 1, scenario: sc });
  const ev = eventsNamed(res, 'mote_picked');
  assert.deepEqual(ev.map((e) => e.data.carried), [1, 2, 3]);
  assert.ok(ev.every((e) => e.tick === 1));
  assert.equal(res.end.score, 3 * S.per_mote);
});

// ---------------------------------------------------------------------------
// R4: nạp đèn, thắp đèn, thắng

const L1 = lanternPos(1);
const interactAt0 = frames({ tick: 0, interact: true }, { tick: 1, interact: false });

test('[R4] interact gần đèn: deposit đúng amount, carried giảm, chưa đủ thì chưa lit', () => {
  const partial = Math.max(1, T.lantern_cost - 1);
  const sc = scen({ player: { pos: L1, carried: partial } });
  const res = runOk({ ticks: 5, snapshotEvery: 1, scenario: sc, inputs: interactAt0 });
  const dep = eventsNamed(res, 'deposit');
  assert.equal(dep.length, 1);
  assert.equal(dep[0].tick, 1);
  assert.deepEqual(dep[0].data, { lantern_id: 'L1', amount: partial, deposited: partial });
  assert.equal(eventsNamed(res, 'lantern_lit').length, 0);
  const s = snapAt(res, 1);
  assert.equal(s.player.carried, 0);
  const l1 = s.lanterns.find((l) => l.id === 'L1');
  assert.equal(l1.deposited, partial);
  assert.equal(l1.lit, false);
  assert.equal(res.end.score, 0);
});

test('[R4] đủ lantern_cost: deposit rồi lantern_lit, lit = true, điểm per_lantern', () => {
  const sc = scen({ player: { pos: L1, carried: T.lantern_cost } });
  const res = runOk({ ticks: 5, snapshotEvery: 1, scenario: sc, inputs: interactAt0 });
  const names = res.events.map((e) => e.name);
  assert.deepEqual(names, ['deposit', 'lantern_lit']);
  assert.deepEqual(res.events[0].data, { lantern_id: 'L1', amount: T.lantern_cost, deposited: T.lantern_cost });
  assert.deepEqual(res.events[1].data, { lantern_id: 'L1' });
  assert.ok(res.events.every((e) => e.tick === 1));
  const s = snapAt(res, 1);
  assert.equal(s.lanterns.find((l) => l.id === 'L1').lit, true);
  assert.equal(s.player.carried, 0);
  assert.equal(s.score, S.per_lantern);
  assert.equal(res.end.state, 'playing', 'mới 1/5 đèn: chưa thắng');
});

test('[R4] đèn đã nạp dở: chỉ nạp phần còn thiếu (amount = min(carried, cost - deposited))', () => {
  const have = T.lantern_cost - 2;
  const sc = scen({ player: { pos: L1, carried: T.carry_capacity }, lanterns: [{ id: 'L1', deposited: have }] });
  const res = runOk({ ticks: 5, snapshotEvery: 1, scenario: sc, inputs: interactAt0 });
  const dep = eventsNamed(res, 'deposit')[0];
  assert.deepEqual(dep.data, { lantern_id: 'L1', amount: 2, deposited: T.lantern_cost });
  assert.equal(eventsNamed(res, 'lantern_lit').length, 1);
  assert.equal(snapAt(res, 1).player.carried, T.carry_capacity - 2);
});

test('[R4] ngoài interact_radius thì không nạp', () => {
  const pos = [L1[0], 0, L1[2] - (T.interact_radius + 0.5)];
  const sc = scen({ player: { pos, carried: 3 } });
  const res = runOk({ ticks: 5, snapshotEvery: 5, scenario: sc, inputs: interactAt0 });
  assert.equal(res.events.length, 0);
  assert.equal(snapAt(res, 5).player.carried, 3);
});

test('[R4] trong interact_radius (gần biên) thì nạp được', () => {
  const pos = [L1[0], 0, L1[2] - T.interact_radius * 0.9];
  const sc = scen({ player: { pos, carried: 2 } });
  const res = runOk({ ticks: 3, scenario: sc, inputs: interactAt0 });
  assert.equal(eventsNamed(res, 'deposit').length, 1);
});

test('[R4] carried = 0 thì interact không có sự kiện', () => {
  const res = runOk({ ticks: 5, scenario: scen({ player: { pos: L1 } }), inputs: interactAt0 });
  assert.equal(res.events.length, 0);
});

test('[R4] interact chỉ kích hoạt ở cạnh false->true: giữ phím không nạp lại', () => {
  const sc = scen({ player: { pos: L1, carried: 2 }, motes: [[L1[0], 0, L1[2]]] });
  // giữ interact suốt; đom đóm ở chân đèn được nhặt ở bước 0 (carried 3) -> chỉ 1 deposit nếu không có cạnh mới.
  const res = runOk({ ticks: 30, scenario: sc, inputs: frames({ tick: 0, interact: true }) });
  assert.equal(eventsNamed(res, 'deposit').length, 1);
});

test('[R4] không nạp vào đèn đã thắp; chọn đèn CHƯA thắp gần nhất trong interact_radius', () => {
  const r = T.interact_radius;
  const sc = scen({
    player: { pos: [0, 0, 0], carried: 2 },
    lanterns: [
      { id: 'L1', pos: [0.2, 0, 0], lit: true }, // gần nhất nhưng đã thắp
      { id: 'L2', pos: [r * 0.8, 0, 0] },
      { id: 'L3', pos: [r * 0.4, 0, 0] }, // gần nhất trong số chưa thắp
    ],
  });
  const res = runOk({ ticks: 3, scenario: sc, inputs: interactAt0 });
  const dep = eventsNamed(res, 'deposit');
  assert.equal(dep.length, 1);
  assert.equal(dep[0].data.lantern_id, 'L3');
});

test('[R4] dựng scenario có đèn lit:true sẵn không phát sự kiện, không cộng điểm', () => {
  const sc = scen({ lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true }] });
  const res = runOk({ ticks: 20, snapshotEvery: 5, scenario: sc });
  assert.equal(res.events.length, 0);
  assert.equal(res.lines[0].score, 0);
  assert.equal(res.lines[0].lanterns.filter((l) => l.lit).length, 2);
  assert.equal(res.end.score, 0);
  assert.equal(res.end.state, 'playing');
});

function winScenario({ t0 = 100, flames = T.flames } = {}) {
  const l5 = lanternPos(5);
  const lanterns = [1, 2, 3, 4].map((k) => ({ id: `L${k}`, lit: true }));
  return scen({
    player: { pos: l5, carried: T.lantern_cost, flames },
    lanterns,
    time_left_s: t0,
  });
}

test('[R4] 4 đèn lit sẵn + nạp đèn cuối -> game_over won all_lit, end.state won, sim dừng', () => {
  const res = runOk({ ticks: 500, snapshotEvery: 1, scenario: winScenario(), inputs: interactAt0 });
  assert.deepEqual(res.events.map((e) => e.name), ['deposit', 'lantern_lit', 'game_over']);
  const go = gameOver(res)[0];
  assert.equal(go.tick, 1);
  assert.deepEqual(go.data, { result: 'won', reason: 'all_lit' });
  assert.equal(res.end.type, 'end');
  assert.equal(res.end.state, 'won');
  assert.equal(res.end.ticks, 1, 'sim dừng ngay khi thắng');
  assert.ok(res.lines.every((l) => (l.tick ?? 0) <= 1), 'không có dòng nào sau tick thắng');
  assert.equal(snapAt(res, 1).state, 'won');
  assert.equal(snapAt(res, 1).lanterns.filter((l) => l.lit).length, T.lantern_count_night1);
});

test('[R4] điểm thắng = per_lantern + per_second_left*floor(time_left) + per_flame_left*flames', () => {
  for (const [t0, flames] of [[100, T.flames], [60.5, 1], [300, 2]]) {
    const res = runOk({ ticks: 50, scenario: winScenario({ t0, flames }), inputs: interactAt0 });
    const timeLeft = t0 - 1 / 60; // sau 1 bước
    const expected = S.per_lantern + S.per_second_left * Math.floor(timeLeft) + S.per_flame_left * flames;
    assert.equal(res.end.score, expected, `t0=${t0} flames=${flames}`);
    assert.equal(res.end.state, 'won');
  }
});

test('[R4] thắng thì có thưởng nhưng lantern_lit chỉ tính 1 lần (đèn lit sẵn không cộng)', () => {
  const res = runOk({ ticks: 5, scenario: winScenario({ t0: 100 }), inputs: interactAt0 });
  assert.equal(eventsNamed(res, 'lantern_lit').length, 1);
  assert.equal(res.end.score, S.per_lantern + S.per_second_left * 99 + S.per_flame_left * T.flames);
});

// ---------------------------------------------------------------------------
// R5: Bóng Mực đuổi, chạm

test('[R5] Bóng Mực tiến về phía người chơi đúng shade_speed/60 mỗi tick (dọc trục)', () => {
  const res = runOk({ ticks: 100, snapshotEvery: 1, scenario: scen({ shades: [{ pos: [20, 0, 0] }] }) });
  for (const s of res.snapshots) {
    const sh = s.shades[0];
    assert.equal(sh.id, 'S1');
    assert.equal(sh.state, 'chase');
    assert.equal(sh.pos[1], SHADE_Y);
    assertClose(sh.pos[0], 20 - s.tick * SHADE_STEP, POS_TOL, `tick ${s.tick} x:`);
    assertClose(sh.pos[2], 0, POS_TOL);
  }
});

test('[R5] Bóng Mực đuổi theo đường thẳng (chéo): khoảng cách giảm đúng shade_speed/60 mỗi tick', () => {
  const start = [12, 0, 16]; // cách 20 m
  const res = runOk({ ticks: 100, snapshotEvery: 1, scenario: scen({ shades: [{ pos: start }] }) });
  for (const s of res.snapshots) {
    const d = distXZ(s.shades[0].pos, [0, 0, 0]);
    assertClose(d, 20 - s.tick * SHADE_STEP, POS_TOL, `tick ${s.tick}:`);
    const f = 1 - (s.tick * SHADE_STEP) / 20;
    assertClose(s.shades[0].pos[0], 12 * f, POS_TOL);
    assertClose(s.shades[0].pos[2], 16 * f, POS_TOL);
  }
});

test('[R5] Bóng Mực đuổi theo người chơi đang chạy: mục tiêu là vị trí hiện tại', () => {
  const res = runOk({
    ticks: 30, snapshotEvery: 30,
    scenario: scen({ shades: [{ pos: [0, 0, 30] }] }),
    inputs: frames({ tick: 0, move: [1, 0] }), // người chơi đi +X
  });
  const s = snapAt(res, 30);
  assert.ok(s.shades[0].pos[0] > 0, 'Bóng Mực phải lệch về phía người chơi (+X)');
  assert.ok(s.shades[0].pos[2] < 30);
});

test('[R5] trúng: player_hit {by:"shade", flames, dropped = floor(carried*hit_drop_ratio)}', () => {
  for (const carried of [0, 1, 3, 4, T.carry_capacity].filter((c) => c <= T.carry_capacity)) {
    const sc = scen({ player: { carried }, shades: [{ pos: [T.shade_hit_radius * 0.5, 0, 0] }] });
    const res = runOk({ ticks: 3, snapshotEvery: 1, scenario: sc });
    const hits = eventsNamed(res, 'player_hit');
    assert.equal(hits.length, 1, `carried=${carried}`);
    const dropped = Math.floor(carried * T.hit_drop_ratio);
    assert.equal(hits[0].tick, 1);
    assert.deepEqual(hits[0].data, { by: 'shade', flames: T.flames - 1, dropped });
    const s = snapAt(res, 1);
    assert.equal(s.player.flames, T.flames - 1);
    assert.equal(s.player.carried, carried - dropped);
  }
});

test('[R5] Bóng Mực ngoài shade_hit_radius thì không gây sát thương', () => {
  const sc = scen({ shades: [{ pos: [T.shade_hit_radius + 3, 0, 0] }] });
  const res = runOk({ ticks: 5, scenario: sc });
  assert.equal(eventsNamed(res, 'player_hit').length, 0);
});

test('[R5] trong invuln_s không trúng lần 2: hai lần trúng cách nhau >= ticks(invuln_s)', () => {
  const inv = ticksOf(T.invuln_s);
  const res = runOk({
    ticks: inv * T.flames + 60, snapshotEvery: 30,
    scenario: scen({ shades: [{ pos: [0.3, 0, 0] }] }),
  });
  const hits = eventsNamed(res, 'player_hit');
  assert.ok(hits.length >= 2);
  for (let i = 1; i < hits.length; i++) {
    assert.ok(hits[i].tick - hits[i - 1].tick >= inv, `trúng lần ${i + 1} quá sớm`);
  }
});

test('[R5] nhịp trúng chính xác theo design: tick 1, 1+inv, 1+2*inv...; hết lửa -> lost no_flames', () => {
  const inv = ticksOf(T.invuln_s);
  const res = runOk({
    ticks: inv * T.flames + 60, snapshotEvery: 30,
    scenario: scen({ shades: [{ pos: [0.3, 0, 0] }] }),
  });
  const hits = eventsNamed(res, 'player_hit');
  assert.deepEqual(hits.map((h) => h.tick), Array.from({ length: T.flames }, (_, i) => 1 + i * inv));
  assert.deepEqual(hits.map((h) => h.data.flames), Array.from({ length: T.flames }, (_, i) => T.flames - 1 - i));
  const lastTick = 1 + (T.flames - 1) * inv;
  const go = gameOver(res);
  assert.equal(go.length, 1);
  assert.equal(go[0].tick, lastTick);
  assert.deepEqual(go[0].data, { result: 'lost', reason: 'no_flames' });
  assert.equal(res.end.ticks, lastTick);
  assert.equal(res.end.state, 'lost');
  assert.equal(res.end.score, 0, 'thua thì không có thưởng');
});

test('[R5] flames = 1 mà bị trúng -> player_hit flames 0 rồi game_over lost no_flames ngay tick đó', () => {
  const sc = scen({ player: { flames: 1 }, shades: [{ pos: [0.3, 0, 0] }] });
  const res = runOk({ ticks: 100, snapshotEvery: 1, scenario: sc });
  assert.deepEqual(res.events.map((e) => e.name), ['player_hit', 'game_over']);
  assert.deepEqual(res.events[0].data, { by: 'shade', flames: 0, dropped: 0 });
  assert.equal(res.events[0].tick, 1);
  assert.deepEqual(res.events[1].data, { result: 'lost', reason: 'no_flames' });
  assert.equal(res.end.ticks, 1);
  assert.equal(res.end.state, 'lost');
  assert.equal(snapAt(res, 1).state, 'lost');
});

test('[R5] không bao giờ có player_hit by "fall" (fall_enabled=false)', () => {
  const res = runOk({
    ticks: 300, scenario: scen(),
    inputs: frames({ tick: 0, move: [1, 0] }), // đi thẳng ra mép
  });
  assert.equal(T.fall_enabled, false);
  assert.equal(eventsNamed(res, 'player_hit').length, 0);
});

// ---------------------------------------------------------------------------
// R6: tỏa sáng

const pulseAt0 = frames({ tick: 0, pulse: true }, { tick: 1, pulse: false });

test('[R6] pulse: stunned_ids, carried giảm pulse_cost, Bóng Mực bị đẩy thêm pulse_push_m, điểm per_stun', () => {
  const d0 = T.pulse_radius / 2;
  const sc = scen({
    player: { carried: 3 },
    shades: [{ pos: [d0, 0, 0] }, { pos: [0, 0, T.pulse_radius + 3] }],
  });
  const res = runOk({ ticks: 5, snapshotEvery: 1, scenario: sc, inputs: pulseAt0 });
  const ev = eventsNamed(res, 'pulse');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].tick, 1);
  assert.deepEqual(ev[0].data, { stunned_ids: ['S1'] });
  const s = snapAt(res, 1);
  assert.equal(s.player.carried, 3 - T.pulse_cost);
  const s1 = s.shades.find((x) => x.id === 'S1');
  const s2 = s.shades.find((x) => x.id === 'S2');
  assert.equal(s1.state, 'stunned');
  assertPosClose(s1.pos, [d0 + T.pulse_push_m, SHADE_Y, 0], POS_TOL, 'S1 bị đẩy:');
  assert.equal(s2.state, 'chase', 'ngoài pulse_radius thì không bị choáng');
  assert.equal(s.score, S.per_stun);
  assert.equal(res.end.score, S.per_stun);
});

test('[R6] đẩy theo hướng ra xa người chơi (chéo), mỗi Bóng Mực trong bán kính được tính điểm', () => {
  const d0 = 3;
  const sc = scen({
    player: { carried: 2 },
    shades: [{ pos: [d0 * 0.8, 0, d0 * 0.6] }, { pos: [-d0, 0, 0] }],
  });
  const res = runOk({ ticks: 3, snapshotEvery: 1, scenario: sc, inputs: pulseAt0 });
  assert.deepEqual(eventsNamed(res, 'pulse')[0].data, { stunned_ids: ['S1', 'S2'] });
  const f = (d0 + T.pulse_push_m) / d0;
  const s = snapAt(res, 1);
  assertPosClose(s.shades[0].pos, [d0 * 0.8 * f, SHADE_Y, d0 * 0.6 * f], POS_TOL);
  assertPosClose(s.shades[1].pos, [-(d0 + T.pulse_push_m), SHADE_Y, 0], POS_TOL);
  assert.equal(res.end.score, 2 * S.per_stun);
});

function stunRun(ticks) {
  const d0 = 3;
  return runOk({
    ticks, snapshotEvery: 1,
    scenario: scen({ player: { carried: 1 }, shades: [{ pos: [d0, 0, 0] }] }),
    inputs: pulseAt0,
  });
}

test('[R6] choáng kéo dài pulse_stun_s: đứng yên khi choáng, rồi về chase và đuổi lại', () => {
  const st = ticksOf(T.pulse_stun_s);
  const res = stunRun(st + 40);
  const pushed = 3 + T.pulse_push_m;
  for (const k of [1, 10, Math.floor(st / 2), st - 5]) {
    const sh = snapAt(res, k).shades[0];
    assert.equal(sh.state, 'stunned', `tick ${k}`);
    assertClose(sh.pos[0], pushed, POS_TOL, `tick ${k} đứng yên:`);
  }
  assert.equal(snapAt(res, st + 5).shades[0].state, 'chase');
  const x1 = snapAt(res, st + 5).shades[0].pos[0];
  const x2 = snapAt(res, st + 35).shades[0].pos[0];
  assert.ok(x1 - x2 >= 25 * SHADE_STEP, 'sau choáng Bóng Mực phải tiến lại gần người chơi');
});

test('[R6] biên chính xác theo design (bước 7-8): choáng ở tick 1..stun-1, chase từ tick stun', () => {
  const st = ticksOf(T.pulse_stun_s);
  const res = stunRun(st + 2);
  assert.equal(snapAt(res, st - 1).shades[0].state, 'stunned');
  assert.equal(snapAt(res, st).shades[0].state, 'chase');
  // chưa di chuyển ở bước vừa hết choáng
  assertClose(snapAt(res, st).shades[0].pos[0], 3 + T.pulse_push_m, POS_TOL);
});

test('[R6] Bóng Mực đang choáng không gây sát thương', () => {
  // Người chơi lao vào Bóng Mực đang choáng: pulse đẩy nó ra 7 m, đi tới 7 m rồi không bị trúng.
  const sc = scen({ player: { carried: 1 }, shades: [{ pos: [3, 0, 0] }] });
  const inputs = frames({ tick: 0, pulse: true, move: [1, 0] }, { tick: 1, pulse: false });
  const res = runOk({ ticks: 80, snapshotEvery: 20, scenario: sc, inputs });
  assert.equal(eventsNamed(res, 'player_hit').length, 0);
  assert.ok(snapAt(res, 80).player.pos[0] > T.pulse_push_m, 'người chơi đã đi xuyên qua vùng choáng');
});

test('[R6] pulse lần 2 trong hồi chiêu (pulse_cooldown_s) không có sự kiện, không tốn thêm', () => {
  const d0 = 3;
  const sc = scen({ player: { carried: 3 }, shades: [{ pos: [d0, 0, 0] }] });
  const inputs = frames(
    { tick: 0, pulse: true }, { tick: 1, pulse: false },
    { tick: 10, pulse: true }, { tick: 11, pulse: false },
  );
  const res = runOk({ ticks: 40, snapshotEvery: 1, scenario: sc, inputs });
  assert.equal(eventsNamed(res, 'pulse').length, 1);
  assert.equal(snapAt(res, 40).player.carried, 3 - T.pulse_cost);
  assert.equal(res.end.score, S.per_stun);
});

test('[R6] sau hồi chiêu pulse dùng lại được', () => {
  const cd = ticksOf(T.pulse_cooldown_s);
  const sc = scen({ player: { carried: 3 } });
  const t2 = cd + 10;
  const inputs = frames(
    { tick: 0, pulse: true }, { tick: 1, pulse: false },
    { tick: t2, pulse: true }, { tick: t2 + 1, pulse: false },
  );
  const res = runOk({ ticks: t2 + 5, snapshotEvery: 1, scenario: sc, inputs });
  const ev = eventsNamed(res, 'pulse');
  assert.equal(ev.length, 2);
  assert.equal(ev[1].tick, t2 + 1);
  assert.ok(Array.isArray(ev[1].data.stunned_ids));
  assert.equal(snapAt(res, t2 + 1).player.carried, 3 - 2 * T.pulse_cost);
});

test('[R6] biên hồi chiêu chính xác theo design: pulse ở tick cd-1 bị chặn, ở tick cd được phép (sự kiện tick cd+1)', () => {
  const cd = ticksOf(T.pulse_cooldown_s);
  const sc = scen({ player: { carried: 4 } });
  const early = frames(
    { tick: 0, pulse: true }, { tick: 1, pulse: false },
    { tick: cd - 1, pulse: true }, { tick: cd, pulse: false },
  );
  assert.equal(eventsNamed(runOk({ ticks: cd + 5, scenario: sc, inputs: early }), 'pulse').length, 1);
  const ontime = frames(
    { tick: 0, pulse: true }, { tick: 1, pulse: false },
    { tick: cd, pulse: true }, { tick: cd + 1, pulse: false },
  );
  const ev = eventsNamed(runOk({ ticks: cd + 5, scenario: sc, inputs: ontime }), 'pulse');
  assert.equal(ev.length, 2);
  assert.equal(ev[1].tick, cd + 1);
});

test('[R6] carried < pulse_cost thì pulse không có sự kiện, không choáng, không tốn', () => {
  const carried = T.pulse_cost - 1;
  const sc = scen({ player: { carried }, shades: [{ pos: [3, 0, 0] }] });
  const res = runOk({ ticks: 5, snapshotEvery: 1, scenario: sc, inputs: pulseAt0 });
  assert.equal(eventsNamed(res, 'pulse').length, 0);
  const s = snapAt(res, 1);
  assert.equal(s.player.carried, carried);
  assert.equal(s.shades[0].state, 'chase');
  assertClose(s.shades[0].pos[0], 3 - SHADE_STEP, POS_TOL, 'Bóng Mực không bị đẩy:');
  assert.equal(res.end.score, 0);
});

test('[R6] giữ phím pulse không kích hoạt lặp (chỉ cạnh false->true)', () => {
  const cd = ticksOf(T.pulse_cooldown_s);
  const sc = scen({ player: { carried: 4 } });
  const res = runOk({ ticks: cd * 3, scenario: sc, inputs: frames({ tick: 0, pulse: true }) });
  assert.equal(eventsNamed(res, 'pulse').length, 1);
});

test('[R6] pulse không trúng ai vẫn tốn ánh sáng và có sự kiện với stunned_ids rỗng', () => {
  const res = runOk({ ticks: 3, snapshotEvery: 1, scenario: scen({ player: { carried: 2 } }), inputs: pulseAt0 });
  const ev = eventsNamed(res, 'pulse');
  assert.equal(ev.length, 1);
  assert.deepEqual(ev[0].data, { stunned_ids: [] });
  assert.equal(snapAt(res, 1).player.carried, 2 - T.pulse_cost);
  assert.equal(res.end.score, 0);
});

// ---------------------------------------------------------------------------
// R7: Bóng Mực sợ đèn đã thắp

test('[R7] Bóng Mực đuổi người chơi đứng sát đèn đã thắp không bao giờ vào trong safe_radius', () => {
  const sc = scen({
    player: { pos: L1 },
    lanterns: [{ id: 'L1', lit: true }],
    shades: [{ pos: [20, 0, 25] }, { pos: [-18, 0, 30] }, { pos: [0, 0, -10] }],
  });
  const res = runOk({ ticks: 900, snapshotEvery: 1, scenario: sc });
  let minD = Infinity;
  for (const s of res.snapshots) {
    for (const sh of s.shades) {
      const d = distXZ(sh.pos, L1);
      minD = Math.min(minD, d);
      assert.ok(d >= T.safe_radius - POS_TOL, `tick ${s.tick} ${sh.id} vào vùng an toàn: ${d}`);
    }
  }
  assert.ok(minD <= T.safe_radius + 0.1, `Bóng Mực phải áp sát vùng an toàn (min ${minD}), nếu không test vô nghĩa`);
  assert.equal(eventsNamed(res, 'player_hit').length, 0);
  assert.equal(res.end.state, 'playing');
});

test('[R7] đèn CHƯA thắp không có vùng an toàn: Bóng Mực tới sát và gây sát thương', () => {
  const sc = scen({ player: { pos: L1 }, shades: [{ pos: [20, 0, 25] }] });
  const res = runOk({ ticks: 600, snapshotEvery: 1, scenario: sc });
  const minD = Math.min(...res.snapshots.map((s) => distXZ(s.shades[0].pos, L1)));
  assert.ok(minD < T.safe_radius - 1, `min ${minD}`);
  assert.ok(eventsNamed(res, 'player_hit').length >= 1);
});

test('[R7] Bóng Mực đang nằm trong safe_radius của đèn đã thắp bị đẩy ra ngay sau bước đầu', () => {
  const sc = scen({
    player: { pos: [0, 0, -30] },
    lanterns: [{ id: 'L1', lit: true }],
    shades: [{ pos: [L1[0] + 1, 0, L1[2]] }],
  });
  const res = runOk({ ticks: 5, snapshotEvery: 1, scenario: sc });
  for (const s of res.snapshots.filter((x) => x.tick >= 1)) {
    assert.ok(distXZ(s.shades[0].pos, L1) >= T.safe_radius - POS_TOL, `tick ${s.tick}`);
  }
});

// ---------------------------------------------------------------------------
// R8: hết giờ

test('[R8] time_left_s nhỏ -> game_over lost dawn, end.ticks đúng', () => {
  for (const t0 of [0.5, 1.5, 2]) {
    const n = Math.round(t0 * 60);
    const res = runOk({ ticks: 1000, snapshotEvery: 1, scenario: scen({ time_left_s: t0 }) });
    const go = gameOver(res);
    assert.equal(go.length, 1, `t0=${t0}`);
    assert.equal(go[0].tick, n);
    assert.deepEqual(go[0].data, { result: 'lost', reason: 'dawn' });
    assert.equal(res.end.ticks, n);
    assert.equal(res.end.state, 'lost');
    assert.equal(res.end.score, 0);
    assert.equal(res.lines[0].time_left_s, t0, 'snapshot 0 phản ánh time_left_s của scenario');
    assert.ok(snapAt(res, n).time_left_s <= 0.001);
    assert.equal(snapAt(res, n).state, 'lost');
  }
});

test('[R8] hết đêm mặc định (night1_duration_s) không thắp đèn -> lost dawn tại tick duration*60', () => {
  const n = T.night1_duration_s * 60;
  const res = runOk({ ticks: n + 500, snapshotEvery: 1000, scenario: scen() });
  assert.deepEqual(gameOver(res)[0].data, { result: 'lost', reason: 'dawn' });
  assert.equal(gameOver(res)[0].tick, n);
  assert.equal(res.end.ticks, n);
  assert.equal(res.end.state, 'lost');
});

test('[R8] thắp xong đèn cuối đúng lúc còn thời gian thì thắng chứ không thua dawn', () => {
  const res = runOk({ ticks: 100, scenario: winScenario({ t0: 2 }), inputs: interactAt0 });
  assert.deepEqual(gameOver(res)[0].data, { result: 'won', reason: 'all_lit' });
});

// ---------------------------------------------------------------------------
// R9: điểm số

test('[R9] điểm trong snapshot và end = tổng điểm từ sự kiện (nhặt, tỏa sáng, thắp đèn, thưởng thắng)', () => {
  // 2 đom đóm tại chỗ + pulse tick 0 (1 Bóng Mực trong bán kính), rồi nạp đèn L1 (thiếu 1) ở tick 5.
  const t0 = 100;
  const sc = scen({
    time_left_s: t0,
    motes: [[0, 0, 0], [0.1, 0, 0]],
    shades: [{ pos: [3, 0, 0] }],
    lanterns: [
      { id: 'L1', pos: [1, 0, 0], deposited: T.lantern_cost - 1 },
      ...[2, 3, 4, 5].map((k) => ({ id: `L${k}`, lit: true })),
    ],
  });
  const inputs = frames(
    { tick: 0, pulse: true }, { tick: 1, pulse: false },
    { tick: 5, interact: true }, { tick: 6, interact: false },
  );
  const res = runOk({ ticks: 200, snapshotEvery: 1, scenario: sc, inputs });
  const names = res.events.map((e) => e.name);
  assert.deepEqual(names, ['mote_picked', 'mote_picked', 'pulse', 'deposit', 'lantern_lit', 'game_over']);
  const expected = 2 * S.per_mote + S.per_stun + S.per_lantern
    + S.per_second_left * Math.floor(t0 - 6 / 60) + S.per_flame_left * T.flames;
  assert.equal(res.end.score, expected);
  assert.equal(assertScoreConsistent(res, { t0 }), expected);
});

test('[R9] ván thua: điểm chỉ gồm sự kiện, không có thưởng thời gian/máu', () => {
  const sc = scen({
    player: { flames: 1 },
    motes: [[0, 0, 0]],
    shades: [{ pos: [0.3, 0, 0] }],
  });
  const res = runOk({ ticks: 50, snapshotEvery: 1, scenario: sc });
  assert.equal(res.end.state, 'lost');
  assert.equal(res.end.score, S.per_mote);
  assertScoreConsistent(res, { flames0: 1 });
});

test('[R9] ván ngẫu nhiên dài (seed cố định, di chuyển + pulse + interact): điểm luôn khớp bảng điểm', () => {
  const f = [];
  for (let k = 0; k < 3000; k += 25) f.push({ tick: k, move: [Math.sin(k / 50), Math.cos(k / 80)], cam_yaw_deg: k % 360 });
  const extra = [];
  for (let k = 10; k < 3000; k += 150) extra.push({ tick: k, pulse: true }, { tick: k + 1, pulse: false });
  for (let k = 60; k < 3000; k += 100) extra.push({ tick: k, interact: true }, { tick: k + 1, interact: false });
  const merged = [];
  for (const fr of [...f, ...extra].sort((a, b) => a.tick - b.tick)) {
    const last = merged[merged.length - 1];
    if (last && last.tick === fr.tick) Object.assign(last, fr); else merged.push({ ...fr });
  }
  for (const seed of [1, 99]) {
    const res = runOk({ seed, ticks: 3000, snapshotEvery: 5, inputs: { frames: merged } });
    assertScoreConsistent(res);
  }
});

// ---------------------------------------------------------------------------
// Sinh ngẫu nhiên theo design mục 7 (liên quan R10: id tự sinh phải tất định)

test('[R10] Bóng Mực ngẫu nhiên sinh thêm mỗi 1200 tick với sự kiện shade_spawned, id nối tiếp S3, S4', () => {
  const sc = { random_motes: false, player: { flames: 100 } }; // random_shades mặc định bật
  const res = runOk({ seed: 4, ticks: 2500, snapshotEvery: 1250, scenario: sc });
  const ev = eventsNamed(res, 'shade_spawned');
  assert.deepEqual(ev.map((e) => [e.tick, e.data.id]), [[1200, 'S3'], [2400, 'S4']]);
});

test('[R10] random_shades:false / random_motes:false: không bao giờ tự sinh', () => {
  const res = runOk({ seed: 4, ticks: 2500, snapshotEvery: 500, scenario: scen({ player: { flames: 100 } }) });
  assert.equal(eventsNamed(res, 'shade_spawned').length, 0);
  for (const s of res.snapshots) {
    assert.equal(s.shades.length, 0);
    assert.equal(s.motes_active, 0);
  }
});

test('[R10] đom đóm ngẫu nhiên được bổ sung khi < 20: sau khi nhặt bớt, số đom đóm tăng lại', () => {
  // Người chơi gần như đứng yên; ta chỉ cần: mỗi 120 tick, nếu < 20 thì +1 (không sự kiện).
  const sc = { random_shades: false, player: { pos: [0, 0, 0] } };
  // đi một vòng để nhặt vài con đom đóm rồi đứng yên
  const f = [{ tick: 0, move: [0, 1] }, { tick: 300, move: [1, 0] }, { tick: 600, move: [0, 0] }];
  const res = runOk({ seed: 8, ticks: 2400, snapshotEvery: 120, scenario: sc, inputs: { frames: f } });
  const picked = eventsNamed(res, 'mote_picked').length;
  const last = res.snapshots[res.snapshots.length - 1];
  const afterWalk = res.snapshots.find((s) => s.tick === 600);
  if (picked > 0) {
    assert.ok(last.motes_active > afterWalk.motes_active || afterWalk.motes_active === 20,
      'đom đóm phải được sinh lại dần');
  }
  assert.ok(last.motes_active <= 20);
});
