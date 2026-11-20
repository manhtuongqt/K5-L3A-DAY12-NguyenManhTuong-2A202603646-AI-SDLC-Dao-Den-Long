// Test luật chơi Đêm 1 (black-box qua CLI headless), cập nhật cho luật v1.1.
// Mọi con số lấy từ game.contract.json (T); bản đồ lấy từ docs/notes/phase-2-ticket.md.
// Test v1.0 bị luật mới thay thế được sửa/xóa kèm lý do trong docs/notes/test-changes-phase-2.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  T, S, SHADE_Y, lanternPos, distXZ, ticksOf, perTick,
  runOk, scen, frames, snapAt, eventsNamed, assertClose, assertPosClose,
  assertRunDistance, assertScoreConsistent,
} from './helpers.js';

const SHADE_STEP = perTick(T.shade_speed);
const POS_TOL = 0.002; // làm tròn 3 chữ số + sai số cộng dồn nhỏ
const gameOver = (res) => eventsNamed(res, 'game_over');
const shade = (pos, extra = {}) => ({ pos, state: 'chase', ...extra }); // v1.1: mặc định là wander, nên đặt chase tường minh

// ---------------------------------------------------------------------------
// R2: di chuyển (v1.1: có gia tốc nên quãng đường là khoảng, không còn là số tròn)

function walk({ move, yaw = 0, ticks = 60, pos = [0, 0, 0] }) {
  return runOk({
    ticks, snapshotEvery: 1,
    scenario: scen({ player: { pos } }),
    inputs: frames({ tick: 0, move, cam_yaw_deg: yaw }),
  });
}

test('[R2] move [0,1], yaw 0, 60 tick -> đi theo +Z, quãng đường ~ player_speed (có gia tốc)', () => {
  const p = snapAt(walk({ move: [0, 1] }), 60).player.pos;
  assertClose(p[0], 0, POS_TOL);
  assertRunDistance(p[2], 60);
});

test('[R2] move [1,0], yaw 0 -> đi theo +X', () => {
  const p = snapAt(walk({ move: [1, 0] }), 60).player.pos;
  assertClose(p[2], 0, POS_TOL);
  assertRunDistance(p[0], 60);
});

test('[R2] move [0,1], yaw 90 -> đi theo +X', () => {
  const p = snapAt(walk({ move: [0, 1], yaw: 90 }), 60).player.pos;
  assertClose(p[2], 0, POS_TOL);
  assertRunDistance(p[0], 60);
});

test('[R2] move [1,0], yaw 90 -> đi theo -Z (x\' = x cos + z sin, z\' = -x sin + z cos)', () => {
  const p = snapAt(walk({ move: [1, 0], yaw: 90 }), 60).player.pos;
  assertClose(p[0], 0, POS_TOL);
  assertRunDistance(-p[2], 60);
});

test('[R2] move [0,1], yaw 180 -> đi theo -Z', () => {
  const p = snapAt(walk({ move: [0, 1], yaw: 180 }), 60).player.pos;
  assertClose(p[0], 0, POS_TOL);
  assertRunDistance(-p[2], 60);
});

test('[R2] vector [1,1] được chuẩn hóa về độ dài 1 (không nhanh hơn player_speed)', () => {
  const p = snapAt(walk({ move: [1, 1] }), 60).player.pos;
  assertClose(p[0], p[2], POS_TOL, 'x = z:');
  assertRunDistance(Math.hypot(p[0], p[2]), 60);
});

test('[R2] vector ngắn hơn 1 không bị phóng đại: [0, 0.5] đi nửa tốc độ', () => {
  const p = snapAt(walk({ move: [0, 0.5] }), 60).player.pos;
  assertRunDistance(p[2], 60, T.player_speed / 2);
});

test('[R2] quãng đường tỉ lệ ticks (tối đa player_speed * ticks / 60)', () => {
  const res = walk({ move: [0, 1], ticks: 90 });
  assertRunDistance(snapAt(res, 90).player.pos[2], 90);
  assertRunDistance(snapAt(res, 30).player.pos[2], 30);
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
// R3: nhặt đom đóm (v1.1: nhặt KHÔNG cộng điểm; túi 10; bán kính 1.0)

test('[R3] đom đóm trong pickup_radius được nhặt: mote_picked {carried}, chưa cộng điểm', () => {
  const sc = scen({ motes: [[0, 0, T.pickup_radius - 0.01]] });
  const res = runOk({ ticks: 5, snapshotEvery: 1, scenario: sc });
  const ev = eventsNamed(res, 'mote_picked');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].tick, 1);
  assert.deepEqual(ev[0].data, { carried: 1 });
  const s = snapAt(res, 1);
  assert.equal(s.player.carried, 1);
  assert.equal(s.motes_active, 0);
  assert.equal(s.score, 0, 'v1.1: điểm đom đóm tính khi nạp đèn, không khi nhặt');
  assert.equal(res.end.score, 0);
});

test('[R3] đom đóm ngoài pickup_radius không bị nhặt', () => {
  const sc = scen({ motes: [[0, 0, T.pickup_radius + 0.05]] });
  const res = runOk({ ticks: 10, snapshotEvery: 5, scenario: sc });
  assert.equal(eventsNamed(res, 'mote_picked').length, 0);
  assert.equal(snapAt(res, 10).player.carried, 0);
  assert.equal(snapAt(res, 10).motes_active, 1);
});

// mô phỏng tăng tốc 1 m/s mỗi tick (design Phase 2 mục 4); hai cách tích phân vị trí -> khoảng tick.
function ticksToReach(dist, model) {
  let pos = 0;
  let vel = 0;
  for (let i = 1; i < 2000; i++) {
    const prev = vel;
    vel = Math.min(prev + 1, T.player_speed);
    pos += (model === 'new' ? vel : prev) / 60;
    if (dist - pos <= T.pickup_radius) return i;
  }
  throw new Error('không tới');
}

test('[R3] đi tới đom đóm: nhặt đúng tick khi khoảng cách <= pickup_radius (có gia tốc)', () => {
  const z0 = 5.05;
  const res = runOk({
    ticks: 200, snapshotEvery: 1,
    scenario: scen({ motes: [[0, 0, z0]] }),
    inputs: frames({ tick: 0, move: [0, 1] }),
  });
  const kLo = ticksToReach(z0, 'new');
  const kHi = ticksToReach(z0, 'old') + 1;
  const ev = eventsNamed(res, 'mote_picked');
  assert.equal(ev.length, 1);
  assert.ok(ev[0].tick >= kLo && ev[0].tick <= kHi, `tick nhặt ${ev[0].tick} ngoài [${kLo}, ${kHi}]`);
  assert.equal(snapAt(res, ev[0].tick).player.carried, 1);
  assert.equal(snapAt(res, ev[0].tick - 1).player.carried, 0);
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
  assert.deepEqual(snapAt(res, 10).motes.map((m) => m.id), ['M2']);
  assert.equal(res.end.score, 0, 'nhặt không cộng điểm');
});

test('[R3] nhiều đom đóm cùng một bước: nhặt lần lượt, carried tăng dần, điểm vẫn 0 (chưa nạp)', () => {
  const sc = scen({ motes: [[0, 0, 0], [0.2, 0, 0], [0, 0, 0.2]] });
  const res = runOk({ ticks: 3, snapshotEvery: 1, scenario: sc });
  const ev = eventsNamed(res, 'mote_picked');
  assert.deepEqual(ev.map((e) => e.data.carried), [1, 2, 3]);
  assert.ok(ev.every((e) => e.tick === 1));
  assert.equal(res.end.score, 0);
});

// ---------------------------------------------------------------------------
// R4: nạp đèn, thắp đèn, thắng (v1.1: điểm +10 mỗi đom đóm nạp, +100 đèn, đèn Đêm 1 theo ticket)

const L1 = lanternPos(1);
const interactAt0 = frames({ tick: 0, interact: true }, { tick: 1, interact: false });

test('[R4] interact gần đèn: deposit đúng amount, carried giảm, chưa đủ thì chưa lit, +per_mote mỗi con nạp', () => {
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
  assert.equal(res.end.score, partial * S.per_mote);
});

test('[R4] đủ lantern_cost: deposit rồi lantern_lit, lit = true, điểm = cost*per_mote + per_lantern', () => {
  const sc = scen({ player: { pos: L1, carried: T.lantern_cost } });
  const res = runOk({ ticks: 5, snapshotEvery: 1, scenario: sc, inputs: interactAt0 });
  assert.deepEqual(res.events.map((e) => e.name), ['deposit', 'lantern_lit']);
  assert.deepEqual(res.events[0].data, { lantern_id: 'L1', amount: T.lantern_cost, deposited: T.lantern_cost });
  assert.deepEqual(res.events[1].data, { lantern_id: 'L1' });
  assert.ok(res.events.every((e) => e.tick === 1));
  const s = snapAt(res, 1);
  assert.equal(s.lanterns.find((l) => l.id === 'L1').lit, true);
  assert.equal(s.player.carried, 0);
  assert.equal(s.score, T.lantern_cost * S.per_mote + S.per_lantern);
  assert.equal(res.end.state, 'playing', 'mới 1/5 đèn: chưa thắng');
});

test('[R4] đèn nhớ tiến độ: nạp nhiều lần, lần sau cộng dồn vào deposited', () => {
  // Mây đứng ở chân đèn mang 4 -> nạp; đom đóm cách 1.5 m (ngoài pickup_radius) được nhặt khi bước tới, nạp lần hai.
  const sc = scen({ player: { pos: L1, carried: 4 }, motes: [[L1[0], 0, L1[2] - 1.5]] });
  const inputs = frames(
    { tick: 0, interact: true, move: [0, 0] }, { tick: 1, interact: false, move: [0, -1] },
    { tick: 10, move: [0, 0] },
    { tick: 40, interact: true }, { tick: 41, interact: false },
  );
  const res = runOk({ ticks: 60, snapshotEvery: 1, scenario: sc, inputs });
  const dep = eventsNamed(res, 'deposit');
  assert.equal(dep.length, 2);
  assert.deepEqual(dep[0].data, { lantern_id: 'L1', amount: 4, deposited: 4 });
  assert.deepEqual(dep[1].data, { lantern_id: 'L1', amount: 1, deposited: 5 });
  assert.equal(eventsNamed(res, 'mote_picked').length, 1);
  assert.equal(res.end.score, 5 * S.per_mote);
});

test('[R4] đèn đã nạp dở: chỉ nạp phần còn thiếu (amount = min(carried, cost - deposited))', () => {
  const have = T.lantern_cost - 2;
  const sc = scen({ player: { pos: L1, carried: T.carry_capacity }, lanterns: [{ id: 'L1', deposited: have }] });
  const res = runOk({ ticks: 5, snapshotEvery: 1, scenario: sc, inputs: interactAt0 });
  const dep = eventsNamed(res, 'deposit')[0];
  assert.deepEqual(dep.data, { lantern_id: 'L1', amount: 2, deposited: T.lantern_cost });
  assert.equal(eventsNamed(res, 'lantern_lit').length, 1);
  assert.equal(snapAt(res, 1).player.carried, T.carry_capacity - 2);
  assert.equal(snapAt(res, 1).score, 2 * S.per_mote + S.per_lantern);
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
const winBase = T.lantern_cost * S.per_mote + S.per_lantern; // điểm nạp + thắp đèn cuối

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

test('[R4] điểm thắng = nạp + per_lantern + per_second_left*floor(time_left) + per_flame_left*flames', () => {
  for (const [t0, flames] of [[100, T.flames], [60.5, 1], [300, 2]]) {
    const res = runOk({ ticks: 50, scenario: winScenario({ t0, flames }), inputs: interactAt0 });
    const expected = winBase + S.per_second_left * Math.floor(t0 - 1 / 60) + S.per_flame_left * flames;
    assert.equal(res.end.score, expected, `t0=${t0} flames=${flames}`);
    assert.equal(res.end.state, 'won');
  }
});

// ---------------------------------------------------------------------------
// R5: Bóng Mực đuổi, chạm

test('[R5] Bóng Mực (chase) tiến về phía người chơi đúng shade_speed/60 mỗi tick (dọc trục)', () => {
  const res = runOk({ ticks: 150, snapshotEvery: 1, scenario: scen({ shades: [shade([17, 0, 0])] }) });
  for (const s of res.snapshots) {
    const sh = s.shades[0];
    assert.equal(sh.id, 'S1');
    assert.equal(sh.state, 'chase', `tick ${s.tick}`);
    if (s.tick >= 1) assert.equal(sh.pos[1], SHADE_Y);
    assertClose(sh.pos[0], 17 - s.tick * SHADE_STEP, POS_TOL, `tick ${s.tick} x:`);
    assertClose(sh.pos[2], 0, POS_TOL);
  }
});

test('[R5] Bóng Mực đuổi theo đường thẳng (chéo): khoảng cách giảm đúng shade_speed/60 mỗi tick', () => {
  const start = [10.2, 0, 13.6]; // cách 17 m (nằm giữa 12 m và 18 m: giữ trạng thái chase)
  const res = runOk({ ticks: 150, snapshotEvery: 1, scenario: scen({ shades: [shade(start)] }) });
  for (const s of res.snapshots) {
    const d = distXZ(s.shades[0].pos, [0, 0, 0]);
    assertClose(d, 17 - s.tick * SHADE_STEP, POS_TOL, `tick ${s.tick}:`);
    const f = 1 - (s.tick * SHADE_STEP) / 17;
    assertClose(s.shades[0].pos[0], 10.2 * f, POS_TOL);
    assertClose(s.shades[0].pos[2], 13.6 * f, POS_TOL);
  }
});

test('[R5] Bóng Mực đuổi theo người chơi đang chạy: mục tiêu là vị trí hiện tại', () => {
  const res = runOk({
    ticks: 30, snapshotEvery: 30,
    scenario: scen({ shades: [shade([0, 0, 15])] }),
    inputs: frames({ tick: 0, move: [1, 0] }), // người chơi đi +X
  });
  const s = snapAt(res, 30);
  assert.ok(s.shades[0].pos[0] > 0, 'Bóng Mực phải lệch về phía người chơi (+X)');
  assert.ok(s.shades[0].pos[2] < 15);
});

test('[R5] trúng: player_hit {by:"shade", flames, dropped=floor(carried*hit_drop_ratio)}, Bóng Mực recoil, đom đóm rơi quanh Mây', () => {
  for (const carried of [0, 1, 3, 4, T.carry_capacity].filter((c) => c <= T.carry_capacity)) {
    const sc = scen({ player: { carried }, shades: [shade([T.shade_hit_radius * 0.5, 0, 0])] });
    const res = runOk({ ticks: 3, snapshotEvery: 1, scenario: sc });
    const hits = eventsNamed(res, 'player_hit');
    assert.equal(hits.length, 1, `carried=${carried}`);
    const dropped = Math.floor(carried * T.hit_drop_ratio);
    assert.equal(hits[0].tick, 1);
    assert.deepEqual(hits[0].data, { by: 'shade', flames: T.flames - 1, dropped });
    const s = snapAt(res, 1);
    assert.equal(s.player.flames, T.flames - 1);
    assert.equal(s.player.carried, carried - dropped);
    assert.equal(s.player.invuln, true);
    assert.equal(s.shades[0].state, 'recoil');
    const fallen = s.motes.filter((m) => m.kind === 'dropped');
    assert.equal(fallen.length, dropped, 'đom đóm rơi xuất hiện thành mote kind=dropped');
    for (const m of fallen) {
      const d = distXZ(m.pos, s.player.pos);
      assert.ok(d >= 1.5 - POS_TOL && d <= 2.5 + POS_TOL, `đom đóm rơi ngoài vành 1.5-2.5: ${d}`);
      assert.ok(m.ttl_s > 7.9 && m.ttl_s <= 8, `ttl_s ${m.ttl_s} (480 tick = 8 s)`);
    }
  }
});

test('[R5] Bóng Mực ngoài shade_hit_radius thì không gây sát thương', () => {
  const sc = scen({ shades: [shade([T.shade_hit_radius + 3, 0, 0])] });
  const res = runOk({ ticks: 5, scenario: sc });
  assert.equal(eventsNamed(res, 'player_hit').length, 0);
});

test('[R5] trong invuln_s không trúng lần 2: hai lần trúng cách nhau >= ticks(invuln_s)', () => {
  const inv = ticksOf(T.invuln_s);
  const res = runOk({
    ticks: inv * T.flames + 60, snapshotEvery: 30,
    scenario: scen({ shades: [shade([0.3, 0, 0])] }),
  });
  const hits = eventsNamed(res, 'player_hit');
  assert.ok(hits.length >= 2);
  for (let i = 1; i < hits.length; i++) {
    assert.ok(hits[i].tick - hits[i - 1].tick >= inv, `trúng lần ${i + 1} quá sớm`);
  }
});

test('[R5] nhịp trúng theo design: tick 1, 1+inv, 1+2*inv...; hết lửa -> lost no_flames', () => {
  // Bóng Mực recoil 2 m / 60 tick rồi quay lại, chạm lúc bất tử thì không làm gì -> trúng lại ngay khi hết bất tử.
  const inv = ticksOf(T.invuln_s);
  const res = runOk({
    ticks: inv * T.flames + 60, snapshotEvery: 30,
    scenario: scen({ shades: [shade([0.3, 0, 0])] }),
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
  const sc = scen({ player: { flames: 1 }, shades: [shade([0.3, 0, 0])] });
  const res = runOk({ ticks: 100, snapshotEvery: 1, scenario: sc });
  assert.deepEqual(res.events.map((e) => e.name), ['player_hit', 'game_over']);
  assert.deepEqual(res.events[0].data, { by: 'shade', flames: 0, dropped: 0 });
  assert.equal(res.events[0].tick, 1);
  assert.deepEqual(res.events[1].data, { result: 'lost', reason: 'no_flames' });
  assert.equal(res.end.ticks, 1);
  assert.equal(res.end.state, 'lost');
  assert.equal(snapAt(res, 1).state, 'lost');
});

// ---------------------------------------------------------------------------
// R6: tỏa sáng (v1.1: 3 đom đóm, 3D, đẩy 4 m trong 15 tick, choáng 120 tick, hồi chiêu 3 s)

const pulseAt0 = frames({ tick: 0, pulse: true }, { tick: 1, pulse: false });
const STUN = ticksOf(T.pulse_stun_s);

function stunRun(ticks, d0 = 3) {
  return runOk({
    ticks, snapshotEvery: 1,
    scenario: scen({ player: { carried: T.pulse_cost }, shades: [shade([d0, 0, 0])] }),
    inputs: pulseAt0,
  });
}

test('[R6] pulse: stunned_ids, carried giảm pulse_cost, Bóng Mực xa thêm pulse_push_m, điểm per_stun', () => {
  const d0 = T.pulse_radius / 2;
  const sc = scen({
    player: { carried: T.pulse_cost + 2 },
    shades: [shade([d0, 0, 0]), shade([0, 0, T.pulse_radius + 3])],
  });
  const res = runOk({ ticks: 40, snapshotEvery: 1, scenario: sc, inputs: pulseAt0 });
  const ev = eventsNamed(res, 'pulse');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].tick, 1);
  assert.deepEqual(ev[0].data, { stunned_ids: ['S1'] });
  const s = snapAt(res, 40);
  assert.equal(s.player.carried, 2);
  assert.equal(s.shades.find((x) => x.id === 'S1').state, 'stunned');
  assertPosClose(s.shades.find((x) => x.id === 'S1').pos, [d0 + T.pulse_push_m, SHADE_Y, 0], POS_TOL, 'S1 bị đẩy:');
  assert.notEqual(s.shades.find((x) => x.id === 'S2').state, 'stunned', 'ngoài pulse_radius không bị choáng');
  assert.equal(s.score, S.per_stun);
  assert.equal(res.end.score, S.per_stun);
  assertClose(snapAt(res, 1).player.pulse_cd_s, T.pulse_cooldown_s, 0.02, 'pulse_cd_s:');
});

test('[R6] đẩy dần trong ~15 tick (<= 4/15 m mỗi tick), tổng pulse_push_m, rồi đứng yên trong lúc choáng', () => {
  const d0 = 3;
  const res = stunRun(60, d0);
  let prev = d0;
  for (let k = 1; k <= 60; k++) {
    const x = snapAt(res, k).shades[0].pos[0];
    assert.ok(x >= prev - POS_TOL, `tick ${k} lùi về phía người chơi`);
    assert.ok(x - prev <= T.pulse_push_m / 15 + 2 * POS_TOL, `tick ${k} đẩy quá nhanh: ${x - prev}`);
    prev = x;
  }
  assert.ok(snapAt(res, 5).shades[0].pos[0] < d0 + T.pulse_push_m - 0.5, 'tick 5 chưa đẩy xong (không tức thì)');
  for (const k of [17, 30, 59]) assertClose(snapAt(res, k).shades[0].pos[0], d0 + T.pulse_push_m, POS_TOL, `tick ${k}:`);
});

test('[R6] đẩy theo hướng ra xa người chơi (chéo), mỗi Bóng Mực trong bán kính được tính điểm', () => {
  const d0 = 3;
  const sc = scen({
    player: { carried: T.pulse_cost },
    shades: [shade([d0 * 0.8, 0, d0 * 0.6]), shade([-d0, 0, 0])],
  });
  const res = runOk({ ticks: 30, snapshotEvery: 1, scenario: sc, inputs: pulseAt0 });
  assert.deepEqual(eventsNamed(res, 'pulse')[0].data, { stunned_ids: ['S1', 'S2'] });
  const f = (d0 + T.pulse_push_m) / d0;
  const s = snapAt(res, 30);
  assertPosClose(s.shades[0].pos, [d0 * 0.8 * f, SHADE_Y, d0 * 0.6 * f], POS_TOL);
  assertPosClose(s.shades[1].pos, [-(d0 + T.pulse_push_m), SHADE_Y, 0], POS_TOL);
  assert.equal(res.end.score, 2 * S.per_stun);
});

test('[R6] choáng kéo dài pulse_stun_s (120 tick, sai số 2 tick): stunned rồi quay lại chase và đuổi', () => {
  const res = stunRun(STUN + 40);
  for (const k of [1, 10, Math.floor(STUN / 2), STUN - 3]) {
    assert.equal(snapAt(res, k).shades[0].state, 'stunned', `tick ${k}`);
  }
  assert.equal(snapAt(res, STUN + 5).shades[0].state, 'chase');
  const x1 = snapAt(res, STUN + 5).shades[0].pos[0];
  const x2 = snapAt(res, STUN + 35).shades[0].pos[0];
  assert.ok(x1 - x2 >= 25 * SHADE_STEP, 'sau choáng Bóng Mực phải tiến lại gần người chơi');
});

test('[R6] Bóng Mực đang choáng không gây sát thương', () => {
  const sc = scen({ player: { carried: T.pulse_cost }, shades: [shade([3, 0, 0])] });
  const inputs = frames({ tick: 0, pulse: true, move: [1, 0] }, { tick: 1, pulse: false });
  const res = runOk({ ticks: 80, snapshotEvery: 20, scenario: sc, inputs });
  assert.equal(eventsNamed(res, 'player_hit').length, 0);
  assert.ok(snapAt(res, 80).player.pos[0] > T.pulse_push_m, 'người chơi đã đi xuyên qua vùng choáng');
});

test('[R6] pulse lần 2 trong hồi chiêu (pulse_cooldown_s) không có sự kiện, không tốn thêm', () => {
  const sc = scen({ player: { carried: 3 * T.pulse_cost }, shades: [shade([3, 0, 0])] });
  const inputs = frames(
    { tick: 0, pulse: true }, { tick: 1, pulse: false },
    { tick: 10, pulse: true }, { tick: 11, pulse: false },
  );
  const res = runOk({ ticks: 40, snapshotEvery: 1, scenario: sc, inputs });
  assert.equal(eventsNamed(res, 'pulse').length, 1);
  assert.equal(snapAt(res, 40).player.carried, 2 * T.pulse_cost);
  assert.equal(res.end.score, S.per_stun);
});

test('[R6] sau hồi chiêu pulse dùng lại được', () => {
  const cd = ticksOf(T.pulse_cooldown_s);
  const sc = scen({ player: { carried: 3 * T.pulse_cost } });
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
  assert.equal(snapAt(res, t2 + 1).player.carried, 3 * T.pulse_cost - 2 * T.pulse_cost);
});

test('[R6] biên hồi chiêu theo thứ tự bước của ticket: pulse ở tick cd-1 bị chặn, ở tick cd được (sự kiện tick cd+1)', () => {
  const cd = ticksOf(T.pulse_cooldown_s);
  const sc = scen({ player: { carried: 3 * T.pulse_cost } });
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
  const sc = scen({ player: { carried }, shades: [shade([3, 0, 0])] });
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
  const sc = scen({ player: { carried: T.carry_capacity } });
  const res = runOk({ ticks: cd * 3, scenario: sc, inputs: frames({ tick: 0, pulse: true }) });
  assert.equal(eventsNamed(res, 'pulse').length, 1);
});

test('[R6] pulse không trúng ai vẫn tốn ánh sáng và có sự kiện với stunned_ids rỗng', () => {
  const res = runOk({ ticks: 3, snapshotEvery: 1, scenario: scen({ player: { carried: T.pulse_cost + 2 } }), inputs: pulseAt0 });
  const ev = eventsNamed(res, 'pulse');
  assert.equal(ev.length, 1);
  assert.deepEqual(ev[0].data, { stunned_ids: [] });
  assert.equal(snapAt(res, 1).player.carried, 2);
  assert.equal(res.end.score, 0);
});

// ---------------------------------------------------------------------------
// R7: Bóng Mực sợ đèn đã thắp (v1.1: vùng an toàn 6 m, Bóng Mực phải ở trạng thái chase từ <= 18 m)

test('[R7] Bóng Mực đuổi người chơi đứng sát đèn đã thắp không bao giờ vào trong safe_radius', () => {
  const sc = scen({
    player: { pos: L1 },
    lanterns: [{ id: 'L1', lit: true }],
    shades: [shade([10, 0, 25]), shade([-12, 0, 30]), shade([0, 0, 12])],
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
  const sc = scen({ player: { pos: L1 }, shades: [shade([10, 0, 25])] });
  const res = runOk({ ticks: 600, snapshotEvery: 1, scenario: sc });
  const minD = Math.min(...res.snapshots.map((s) => distXZ(s.shades[0].pos, L1)));
  assert.ok(minD < T.safe_radius - 1, `min ${minD}`);
  assert.ok(eventsNamed(res, 'player_hit').length >= 1);
});

test('[R7] Bóng Mực đang nằm trong safe_radius của đèn đã sáng sẵn không ở lại bên trong sau tick đầu', () => {
  const sc = scen({
    player: { pos: [0, 0, -30] },
    lanterns: [{ id: 'L1', lit: true }],
    shades: [shade([L1[0] + 1, 0, L1[2]])],
  });
  const res = runOk({ ticks: 40, snapshotEvery: 1, scenario: sc });
  // Bóng đang chase cách Mây 55 m (> 18 m) nên về wander; dù thế nào cũng không được ở trong vùng an toàn.
  for (const s of res.snapshots.filter((x) => x.tick >= 36)) {
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

test('[R8] thắp xong đèn cuối khi còn thời gian thì thắng chứ không thua dawn', () => {
  const res = runOk({ ticks: 100, scenario: winScenario({ t0: 2 }), inputs: interactAt0 });
  assert.deepEqual(gameOver(res)[0].data, { result: 'won', reason: 'all_lit' });
});

// ---------------------------------------------------------------------------
// R9: điểm số (v1.1: +10 mỗi đom đóm NẠP, +100 đèn, +5 mỗi Bóng Mực trúng pulse, thưởng khi thắng)

test('[R9] điểm trong snapshot và end = tổng điểm từ sự kiện (nạp, tỏa sáng, thắp đèn, thưởng thắng)', () => {
  // mang 2 + nhặt 2 tại chỗ = 4; pulse tick 0 (-3, 1 Bóng Mực trong 5 m); nạp 1 đom đóm còn lại vào L1 (thiếu 1) ở tick 5.
  const t0 = 100;
  const sc = scen({
    time_left_s: t0,
    player: { carried: 2 },
    motes: [[0, 0, 0], [0.1, 0, 0]],
    shades: [shade([3, 0, 0])],
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
  assert.deepEqual(res.events.map((e) => e.name),
    ['mote_picked', 'mote_picked', 'pulse', 'deposit', 'lantern_lit', 'game_over']);
  const expected = 1 * S.per_mote + S.per_stun + S.per_lantern
    + S.per_second_left * Math.floor(t0 - 6 / 60) + S.per_flame_left * T.flames;
  assert.equal(res.end.score, expected);
  assert.equal(assertScoreConsistent(res, { t0 }), expected);
});

test('[R9] ván thua: điểm chỉ gồm sự kiện (nạp), không có thưởng thời gian/máu', () => {
  const sc = scen({
    player: { pos: L1, carried: 4, flames: 1 },
    shades: [shade([L1[0] + 0.3, 0, L1[2]])],
  });
  const res = runOk({ ticks: 50, snapshotEvery: 1, scenario: sc, inputs: interactAt0 });
  assert.equal(res.end.state, 'lost');
  assert.equal(res.end.score, 4 * S.per_mote);
  assertScoreConsistent(res, { flames0: 1 });
});

test('[R9] ván ngẫu nhiên dài (seed cố định, di chuyển + pulse + interact + dash): điểm luôn khớp bảng điểm', () => {
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
// Sinh ngẫu nhiên theo lịch (v1.1: Bóng Mực từ tick 300; đom đóm tick 240, 480, ...). Liên quan R10: id tự sinh tất định.

test('[R10] Bóng Mực ngẫu nhiên: 2 con tại tick 300 (S1, S2), rồi 1 con mỗi 480 tick (S3, S4), id nối tiếp', () => {
  const sc = { random_motes: false, player: { flames: 100 } }; // random_shades mặc định bật
  const res = runOk({ seed: 4, ticks: 1300, snapshotEvery: 1300, scenario: sc });
  const ev = eventsNamed(res, 'shade_spawned');
  assert.deepEqual(ev.map((e) => [e.tick, e.data.id]), [[300, 'S1'], [300, 'S2'], [780, 'S3'], [1260, 'S4']]);
});

test('[R10] random_shades:false / random_motes:false: không bao giờ tự sinh', () => {
  const res = runOk({ seed: 4, ticks: 2500, snapshotEvery: 500, scenario: scen({ player: { flames: 100 } }) });
  assert.equal(eventsNamed(res, 'shade_spawned').length, 0);
  for (const s of res.snapshots) {
    assert.equal(s.shades.length, 0);
    assert.equal(s.motes_active, 0);
  }
});

test('[R10] đom đóm ngẫu nhiên: 20 lúc đầu, +1 tại tick 240, 480, ...; Đêm 1 chỉ có 24 điểm nên dừng ở 24', () => {
  const sc = { random_shades: false, player: { pos: [0, 0, 0], flames: T.flames } };
  const res = runOk({ seed: 8, ticks: 1300, snapshotEvery: 1, scenario: sc });
  assert.equal(snapAt(res, 0).motes_active, 20);
  assert.equal(snapAt(res, 239).motes_active, 20);
  assert.equal(snapAt(res, 240).motes_active, 21);
  assert.equal(snapAt(res, 479).motes_active, 21);
  assert.equal(snapAt(res, 480).motes_active, 22);
  assert.equal(snapAt(res, 720).motes_active, 23);
  assert.equal(snapAt(res, 960).motes_active, 24);
  assert.equal(snapAt(res, 1200).motes_active, 24, 'hết điểm trống thì bỏ lượt');
});
