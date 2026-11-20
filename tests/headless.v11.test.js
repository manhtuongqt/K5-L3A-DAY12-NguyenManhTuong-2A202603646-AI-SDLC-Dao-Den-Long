// Test Contract v1.1 (Phase 2, Ticket-02): mỗi mục P2-1..P2-15 có ít nhất một scenario headless.
// Nguồn: docs/notes/phase-2-ticket.md (chính), docs/notes/phase-2-design.md (chỗ lead chốt).
// Tọa độ bản đồ chép từ ticket Phần 2, không lấy từ code. Chỗ ticket/design chưa nêu rõ được ghi chú "GIẢ ĐỊNH".
//
// GIẢ ĐỊNH về scenario (ticket chỉ nói "drifters/charms thay thế danh sách mặc định", không nêu cột):
//   drifters[] = { pos:[x,y,z], state?:'idle'|'chase'|'flee', stolen?:n, state_ticks_left?:n } (id mặc định D1, D2, ...);
//   không dùng charms[] trong scenario: bùa dùng danh sách mặc định của bản đồ và đặt Mây ngay trên bùa.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT, CONTRACT, T, S, SHADE_Y, LANTERNS, START, DURATION_S, lanternPos, circlePts, distXZ, dist3, ticksOf,
  run, runOk, scen, scenN, frames, snapAt, eventsNamed, assertClose, assertPosClose,
  assertScoreConsistent, walkInputs,
} from './helpers.js';

const POS_TOL = 0.003;
const chase = (pos, extra = {}) => ({ pos, state: 'chase', ...extra });
const onAny = (pts, pos, tol = 0.011) => pts.some((p) => dist3(p, pos) <= tol);
const hits = (res) => eventsNamed(res, 'player_hit');
const lastGameOver = (res) => eventsNamed(res, 'game_over').at(-1);

// ---------------------------------------------------------------------------
// P2-1: số chuẩn + contract v1.1 + snapshot đủ trường mới + --night 1/2/3

test('[P2-1] game.contract.json v1.2 giữ số chuẩn Phase 2 chưa bị Ticket-03 thay thế', () => {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8'));
  assert.equal(c.contract_version, '1.2');
  const t = c.tuning;
  const expected = {
    player_speed: 6, carry_capacity: 10, lantern_cost: 10, lantern_count_night1: 5, pickup_radius: 1,
    interact_radius: 2, pulse_cost: 3, pulse_radius: 5, flames: 3, invuln_s: 1.5, hit_drop_ratio: 0.5, pulse_stun_s: 2, pulse_push_m: 4,
    pulse_cooldown_s: 3, safe_radius: 6, shade_speed: 4, shade_hit_radius: 1, fall_enabled: true,
    dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5,
  };
  for (const [k, v] of Object.entries(expected)) assert.equal(t[k], v, `tuning.${k}`);
  // Thời lượng và điểm cũ bị thay bởi Ticket-03 §3/§5; kiểm tra qua scenario v1.2.
  assert.ok(c.team && c.build_cmd && c.run_cmd && c.headless_cmd);
});

for (const night of [1, 2, 3]) {
  test(`[P2-1] --night ${night}: snapshot 0 giữ trường Phase 2, đúng đêm, thời lượng, điểm xuất phát, đèn theo ticket`, () => {
    const res = runOk({ night, seed: 3, ticks: 10 });
    const s = res.lines[0];
    assert.equal(s.type, 'snapshot');
    assert.equal(s.night, night);
    assert.equal(s.state, 'playing');
    assert.equal(s.time_left_s, DURATION_S[night]);
    assert.deepEqual(s.wind, { active: false, dir_deg: null });
    assert.deepEqual(s.player.pos, START[night]);
    assert.deepEqual(s.player.vel, [0, 0, 0]);
    assert.equal(s.player.grounded, true);
    assert.equal(s.player.invuln, false);
    assert.equal(s.player.flames, T.flames);
    assert.equal(s.lanterns.length, LANTERNS[night].length);
    s.lanterns.forEach((l, i) => {
      assert.equal(l.id, `L${i + 1}`);
      for (let c = 0; c < 3; c++) assertClose(l.pos[c], LANTERNS[night][i][c], 0.06, `L${i + 1}[${c}]`);
      assert.equal(l.lit, false);
    });
    assert.equal(s.motes_active, 20);
    assert.deepEqual(s.shades, []);
    assert.ok(Array.isArray(s.drifters) && Array.isArray(s.charms));
    assert.equal(res.lines[1].name, 'night_start');
    assert.deepEqual(res.lines[1].data, { night });
    assert.equal(res.end.ticks, 10);
  });
}

test('[P2-1] điểm sinh đom đóm khớp ticket: Đêm 1 (8@12m + 16@33m), Đêm 2 (2 đảo × (4@10m + 8@22m)), Đêm 3 (18@34m, 8@18m Y=3, 4@5m Y=6)', () => {
  const pts = {
    1: [...circlePts(0, 0, 12, 0, 45, 8), ...circlePts(0, 0, 33, 0, 22.5, 16)],
    2: [0, 70].flatMap((cx) => [...circlePts(cx, 0, 10, 0, 90, 4), ...circlePts(cx, 0, 22, 0, 45, 8)]),
    3: [...circlePts(0, 0, 34, 0, 20, 18, 0), ...circlePts(0, 0, 18, 20, 20, 8, 3), ...circlePts(0, 0, 5, 45, 90, 4, 6)],
  };
  for (const night of [1, 2, 3]) {
    const s = runOk({ night, seed: 17, ticks: 1 }).lines[0];
    const used = new Set();
    for (const m of s.motes) {
      const i = pts[night].findIndex((p) => dist3(p, m.pos) <= 0.011);
      assert.ok(i >= 0, `Đêm ${night}: đom đóm ${m.id} ngoài điểm sinh ticket: ${m.pos}`);
      assert.ok(!used.has(i), `Đêm ${night}: hai đom đóm cùng điểm`);
      used.add(i);
    }
    assert.equal(s.motes.length, 20, `Đêm ${night}: 20 đom đóm lúc bắt đầu`);
  }
});

test('[P2-1] bùa mặc định: Đêm 2 có C1; Đêm 3 có C1, C2; đang có sẵn (available, respawn_s 0)', () => {
  const s2 = runOk({ night: 2, ticks: 1 }).lines[0];
  assert.deepEqual(s2.charms.map((c) => c.id), ['C1']);
  const s3 = runOk({ night: 3, ticks: 1 }).lines[0];
  assert.deepEqual(s3.charms.map((c) => c.id), ['C1', 'C2']);
  for (const c of [...s2.charms, ...s3.charms]) {
    assert.deepEqual(Object.keys(c), ['id', 'available', 'respawn_s']);
    assert.equal(c.available, true);
    assert.equal(c.respawn_s, 0);
  }
});

// ---------------------------------------------------------------------------
// P2-2: gia tốc <= 0.1 s, điều khiển trên không, nhảy chỉ khi chạm đất

test('[P2-2] vận tốc đạt đúng player_speed sau <= 6 tick (<= 0.1 s), không vượt, tăng đơn điệu', () => {
  const res = runOk({ ticks: 20, snapshotEvery: 1, scenario: scen(), inputs: frames({ tick: 0, move: [0, 1] }) });
  let prev = 0;
  for (let k = 0; k <= 20; k++) {
    const v = snapAt(res, k).player.vel;
    assertClose(v[0], 0, POS_TOL);
    assert.ok(v[2] >= prev - POS_TOL, `tick ${k}: vận tốc giảm`);
    assert.ok(v[2] <= T.player_speed + POS_TOL, `tick ${k}: vượt tốc độ chạy`);
    prev = v[2];
  }
  assertClose(snapAt(res, 6).player.vel[2], T.player_speed, POS_TOL, 'vel sau 6 tick:');
  assert.ok(snapAt(res, 1).player.vel[2] > 0 && snapAt(res, 1).player.vel[2] < T.player_speed, 'có tăng tốc, không tức thì');
});

test('[P2-2] thả phím thì dừng hẳn trong <= 0.1 s (6 tick) và đứng yên', () => {
  const res = runOk({
    ticks: 120, snapshotEvery: 1, scenario: scen(),
    inputs: frames({ tick: 0, move: [0, 1] }, { tick: 60, move: [0, 0] }),
  });
  for (const v of snapAt(res, 67).player.vel) assertClose(v, 0, POS_TOL);
  assert.deepEqual(snapAt(res, 70).player.pos, snapAt(res, 110).player.pos, 'đã dừng nhưng vẫn trôi');
  assert.ok(snapAt(res, 60).player.vel[2] > T.player_speed - 0.01, 'đang chạy trước khi thả');
});

test('[P2-2] điều khiển trên không đầy đủ: nhảy rồi đổi hướng giữa không trung, vận tốc ngang đạt player_speed', () => {
  const res = runOk({
    ticks: 30, snapshotEvery: 1, scenario: scen(),
    inputs: frames({ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 3, move: [1, 0] }),
  });
  const s = snapAt(res, 14);
  assert.equal(s.player.grounded, false);
  assert.ok(s.player.pos[1] > 0);
  assertClose(s.player.vel[0], T.player_speed, POS_TOL, 'vel x trên không:');
});

test('[P2-2] nhảy: vận tốc 7 m/s, trọng lực 20 m/s^2 -> đỉnh ~1.225 m, ~42 tick, grounded đúng', () => {
  const res = runOk({
    ticks: 80, snapshotEvery: 1, scenario: scen(),
    inputs: frames({ tick: 0, jump: true }, { tick: 1, jump: false }),
  });
  assert.equal(snapAt(res, 0).player.grounded, true);
  assert.equal(snapAt(res, 5).player.grounded, false);
  assert.equal(snapAt(res, 70).player.grounded, true);
  assert.equal(snapAt(res, 70).player.pos[1], 0);
  const peak = Math.max(...res.snapshots.map((s) => s.player.pos[1]));
  assert.ok(peak > 1.1 && peak < 1.3, `đỉnh nhảy ${peak}`);
});

test('[P2-2] nhảy chỉ khi chạm đất: bấm nhảy lần 2 trên không không có tác dụng', () => {
  const once = runOk({
    ticks: 45, snapshotEvery: 1, scenario: scen(),
    inputs: frames({ tick: 0, jump: true }, { tick: 1, jump: false }),
  });
  const twice = runOk({
    ticks: 45, snapshotEvery: 1, scenario: scen(),
    inputs: frames({ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 10, jump: true }, { tick: 11, jump: false }),
  });
  for (let k = 0; k <= 38; k++) {
    assertClose(snapAt(twice, k).player.pos[1], snapAt(once, k).player.pos[1], POS_TOL, `tick ${k} y:`);
    assertClose(snapAt(twice, k).player.vel[1], snapAt(once, k).player.vel[1], POS_TOL, `tick ${k} vy:`);
  }
});

// ---------------------------------------------------------------------------
// P2-3: lướt 14 m/s x 12 tick, hồi 90 tick, giữ độ cao, hướng, không bất tử

const dashAt0 = frames({ tick: 0, dash: true }, { tick: 1, dash: false });

test('[P2-3] lướt khi đứng yên theo hướng mặt ban đầu (+Z): sự kiện dash {} ở tick 1, quãng lướt 2.8 m trong 12 tick', () => {
  const res = runOk({ ticks: 40, snapshotEvery: 1, scenario: scen(), inputs: dashAt0 });
  const ev = eventsNamed(res, 'dash');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].tick, 1);
  assert.deepEqual(ev[0].data, {});
  const dashDist = (T.dash_speed * ticksOf(T.dash_duration_s)) / 60;
  assertClose(dashDist, 2.8, 1e-9, 'tuning dash: 14 * 12 / 60 =');
  assertPosClose(snapAt(res, ticksOf(T.dash_duration_s)).player.pos, [0, 0, dashDist], 0.03, 'sau 12 tick:');
  const mid = snapAt(res, 6).player.vel;
  assertClose(Math.hypot(mid[0], mid[2]), T.dash_speed, 0.05, '|vel| giữa lúc lướt:');
  assertClose(mid[0], 0, POS_TOL);
});

test('[P2-3] hồi chiêu lướt tính từ lúc bắt đầu: dash_cd_s ~1.5 ngay sau lướt, giảm dần về 0', () => {
  const res = runOk({ ticks: 120, snapshotEvery: 1, scenario: scen(), inputs: dashAt0 });
  const cd1 = snapAt(res, 1).player.dash_cd_s;
  assert.ok(cd1 >= T.dash_cooldown_s - 0.02 && cd1 <= T.dash_cooldown_s, `dash_cd_s=${cd1}`);
  assert.ok(snapAt(res, 60).player.dash_cd_s < cd1);
  assert.equal(snapAt(res, 100).player.dash_cd_s, 0);
});

test('[P2-3] dash lần 2 trước 90 tick không có sự kiện; sau hồi chiêu thì lướt lại được', () => {
  const inputs = frames(
    { tick: 0, dash: true }, { tick: 1, dash: false },
    { tick: 30, dash: true }, { tick: 31, dash: false },
    { tick: 100, dash: true }, { tick: 101, dash: false },
  );
  const res = runOk({ ticks: 130, scenario: scen(), inputs });
  assert.deepEqual(eventsNamed(res, 'dash').map((e) => e.tick), [1, 101]);
});

test('[P2-3] nhấn dash khi đang lướt bị bỏ qua (không lướt thêm)', () => {
  const inputs = frames(
    { tick: 0, dash: true }, { tick: 1, dash: false },
    { tick: 5, dash: true }, { tick: 6, dash: false },
  );
  const res = runOk({ ticks: 40, snapshotEvery: 1, scenario: scen(), inputs });
  assert.equal(eventsNamed(res, 'dash').length, 1);
  assertPosClose(snapAt(res, 12).player.pos, [0, 0, 2.8], 0.03);
});

test('[P2-3] lướt theo hướng đang di chuyển (cam_yaw_deg 90, move [0,1] -> +X)', () => {
  const inputs = frames({ tick: 0, move: [0, 1], cam_yaw_deg: 90 }, { tick: 20, dash: true }, { tick: 21, dash: false });
  const res = runOk({ ticks: 40, snapshotEvery: 1, scenario: scen(), inputs });
  const dx = snapAt(res, 32).player.pos[0] - snapAt(res, 20).player.pos[0];
  assert.ok(dx >= 2.7 && dx <= 3.1, `dx=${dx}`);
  assertClose(snapAt(res, 32).player.pos[2], 0, POS_TOL);
});

test('[P2-3] đứng yên thì lướt theo hướng nhân vật đang quay mặt (vừa chạy theo +X rồi dừng)', () => {
  const inputs = frames({ tick: 0, move: [1, 0] }, { tick: 30, move: [0, 0] }, { tick: 60, dash: true }, { tick: 61, dash: false });
  const res = runOk({ ticks: 90, snapshotEvery: 1, scenario: scen(), inputs });
  const p60 = snapAt(res, 60).player;
  for (const v of p60.vel) assertClose(v, 0, POS_TOL);
  const dx = snapAt(res, 72).player.pos[0] - p60.pos[0];
  assert.ok(dx >= 2.7 && dx <= 3.1, `dx=${dx}`);
  assertClose(snapAt(res, 72).player.pos[2], 0, POS_TOL);
});

test('[P2-3] lướt trên không giữ nguyên độ cao (không rơi, vy = 0) trong 12 tick', () => {
  const inputs = frames({ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 8, dash: true }, { tick: 9, dash: false });
  const res = runOk({ ticks: 40, snapshotEvery: 1, scenario: scen(), inputs });
  const y0 = snapAt(res, 10).player.pos[1];
  assert.ok(y0 > 0.5, `phải đang ở trên không (y=${y0})`);
  for (let k = 10; k <= 20; k++) assertClose(snapAt(res, k).player.pos[1], y0, 0.01, `tick ${k} y:`);
  assert.ok(Math.abs(snapAt(res, 14).player.vel[1]) < 0.01);
});

test('[P2-3] lướt không bất tử: invuln false và vẫn bị Bóng Mực chạm', () => {
  const sc = scen({ shades: [chase([0, 0, 3])] });
  const res = runOk({ ticks: 20, snapshotEvery: 1, scenario: sc, inputs: dashAt0 });
  assert.equal(snapAt(res, 2).player.invuln, false);
  assert.ok(hits(res).length >= 1, 'lướt xuyên Bóng Mực vẫn phải bị chạm');
});

// ---------------------------------------------------------------------------
// P2-4: rơi khỏi đảo (fall_enabled = true)

const fallWalk = frames({ tick: 0, move: [0, 1] }, { tick: 30, move: [0, 0] });
const fallScen = (player = {}) => scen({ player: { pos: [0, 0, 38], carried: 5, ...player } });

test('[P2-4] đi ra ngoài 40 m -> player_hit by fall (mất 1 lửa, mất hết đom đóm, lost = số đang mang), đúng 1 lần', () => {
  const res = runOk({ ticks: 260, snapshotEvery: 1, scenario: fallScen(), inputs: fallWalk });
  const f = hits(res);
  assert.equal(f.length, 1, 'rơi chỉ xảy ra đúng 1 lần');
  assert.deepEqual(f[0].data, { by: 'fall', flames: T.flames - 1, dropped: 0, lost: 5 });
  const F = f[0].tick;
  assert.ok(F >= 50 && F <= 130, `tick rơi ${F}`);
  assert.equal(snapAt(res, F).player.carried, 0);
  assert.equal(snapAt(res, F).player.flames, T.flames - 1);
  assert.ok(snapAt(res, F).player.pos[1] < -9.5, 'y < -10 khi bị tính là rơi');
  assert.equal(snapAt(res, F).motes.filter((m) => m.kind === 'dropped').length, 0, 'đom đóm mất hẳn, không rơi ra');
});

test('[P2-4] chờ 60 tick rồi hồi sinh ở điểm xuất phát, vận tốc 0, bất tử ~90 tick', () => {
  const res = runOk({ ticks: 260, snapshotEvery: 1, scenario: fallScen(), inputs: fallWalk });
  const F = hits(res)[0].tick;
  assert.ok(snapAt(res, F + 30).player.pos[1] < -9, 'đang chờ hồi sinh, vẫn ở nơi rơi');
  const back = snapAt(res, F + 63).player;
  assertPosClose(back.pos, [0, 0, 0], POS_TOL, 'hồi sinh ở start:');
  for (const v of back.vel) assertClose(v, 0, POS_TOL);
  assert.equal(back.invuln, true);
  assert.equal(snapAt(res, F + 60 + 80).player.invuln, true);
  assert.equal(snapAt(res, F + 60 + 100).player.invuln, false);
  assert.equal(back.flames, T.flames - 1);
  assert.equal(res.end.state, 'playing');
});

test('[P2-4] rơi bỏ qua bất tử: vẫn mất lửa dù invuln_ticks lớn', () => {
  const res = runOk({ ticks: 200, scenario: fallScen({ invuln_ticks: 5000 }), inputs: fallWalk });
  const f = hits(res);
  assert.equal(f.length, 1);
  assert.equal(f[0].data.by, 'fall');
  assert.equal(f[0].data.flames, T.flames - 1);
});

test('[P2-4] hết Ngọn Lửa vì rơi thì thua ngay (no_flames), không hồi sinh', () => {
  const res = runOk({ ticks: 400, snapshotEvery: 1, scenario: fallScen({ flames: 1 }), inputs: fallWalk });
  const F = hits(res)[0].tick;
  assert.deepEqual(hits(res)[0].data, { by: 'fall', flames: 0, dropped: 0, lost: 5 });
  assert.deepEqual(lastGameOver(res).data, { result: 'lost', reason: 'no_flames' });
  assert.equal(lastGameOver(res).tick, F);
  assert.equal(res.end.ticks, F);
  assert.equal(res.end.state, 'lost');
});

test('[P2-4] mép đảo không còn chặn (v1.1): đi thẳng ra mép thì người chơi rơi qua ngoài bán kính 40', () => {
  const res = runOk({ ticks: 120, snapshotEvery: 1, scenario: fallScen(), inputs: frames({ tick: 0, move: [0, 1] }) });
  const s = snapAt(res, 60);
  assert.ok(Math.hypot(s.player.pos[0], s.player.pos[2]) > 40, 'phải vượt ra ngoài đảo');
  assert.ok(s.player.pos[1] < 0);
});

// ---------------------------------------------------------------------------
// P2-5: Đêm 2: cầu tre, bục nhảy

const A = [0, 0, 0];
const B = [70, 0, 0];

test('[P2-5] đi qua cầu tre từ đảo A sang đảo B không bị rơi', () => {
  const res = runOk({ night: 2, ticks: 700, snapshotEvery: 5, scenario: scenN(2), inputs: frames({ tick: 0, move: [1, 0] }) });
  assert.equal(hits(res).length, 0);
  for (const s of res.snapshots) assert.ok(s.player.pos[1] > -0.01, `tick ${s.tick} y=${s.player.pos[1]}`);
  const end = snapAt(res, 700).player;
  assert.ok(end.pos[0] > 60 && end.pos[0] < 90, `x=${end.pos[0]}`); // đi ngang bùa (35,0,0) nên có thể chạy 7.2 m/s
  assert.equal(end.grounded, true);
  assert.ok(distXZ(end.pos, B) <= 28);
});

test('[P2-5] cầu tre không lan can: bước ngang ra khỏi cầu (z > 2) thì rơi', () => {
  const sc = scenN(2, { player: { pos: [35, 0, 0] } });
  const res = runOk({ night: 2, ticks: 220, scenario: sc, inputs: frames({ tick: 0, move: [0, 1] }, { tick: 60, move: [0, 0] }) });
  const f = hits(res);
  assert.equal(f.length, 1);
  assert.equal(f[0].data.by, 'fall');
  assert.equal(f[0].data.flames, T.flames - 1);
});

function padFlight(startPos, inputs) {
  return runOk({ night: 2, ticks: 150, snapshotEvery: 1, scenario: scenN(2, { player: { pos: startPos } }), inputs });
}

test('[P2-5] bục (20,0,18): bắn lên vy 14, vận tốc ngang 24 hướng tâm đảo B, bay ~1.4 s, đáp trong đảo B', () => {
  const res = padFlight([20, 0, 18]);
  assert.equal(snapAt(res, 0).player.grounded, true);
  const v1 = snapAt(res, 2).player.vel;
  assert.ok(v1[1] > 13 && v1[1] <= 14.01, `vy=${v1[1]}`);
  const v5 = snapAt(res, 5).player.vel;
  assertClose(v5[0], (24 * 50) / Math.hypot(50, 18), 0.06, 'vx:');
  assertClose(v5[2], (-24 * 18) / Math.hypot(50, 18), 0.06, 'vz:');
  for (let k = 3; k <= 78; k++) assert.equal(snapAt(res, k).player.grounded, false, `tick ${k}`);
  assert.equal(snapAt(res, 92).player.grounded, true, 'đáp xuống sau ~84 tick');
  const peak = Math.max(...res.snapshots.map((s) => s.player.pos[1]));
  assert.ok(peak > 4.5 && peak < 5.1, `đỉnh bay ${peak}`);
  const land = snapAt(res, 120).player.pos;
  assert.ok(distXZ(land, B) <= 28, `đáp ngoài đảo B: ${land}`);
  assert.ok(land[0] > 42, 'đáp trên đảo B');
  assertClose(land[1], 0, POS_TOL);
  assert.equal(hits(res).length, 0);
});

test('[P2-5] vận tốc phóng giữ nguyên tới khi chạm đất: phím di chuyển ngược không ghi đè', () => {
  const free = padFlight([20, 0, 18]);
  const held = padFlight([20, 0, 18], frames({ tick: 0, move: [-1, 0] }));
  assertPosClose(snapAt(held, 80).player.pos, snapAt(free, 80).player.pos, 0.1, 'vị trí giữa chuyến bay:');
  assert.ok(distXZ(snapAt(held, 92).player.pos, B) <= 28, 'vẫn đáp trong đảo B');
});

test('[P2-5] bục (50,0,-18) bắn về phía đảo A, đáp trong đảo A', () => {
  const res = padFlight([50, 0, -18]);
  const land = snapAt(res, 120).player.pos;
  assert.ok(distXZ(land, A) <= 28, `đáp ngoài đảo A: ${land}`);
  assert.ok(land[0] < 26);
  assert.equal(snapAt(res, 120).player.grounded, true);
  assert.equal(hits(res).length, 0);
});

// ---------------------------------------------------------------------------
// P2-6: Đêm 3: tầng, dốc, vách, bục, tháp

const sc3 = (pos, over = {}) => scenN(3, { player: { pos }, ...over });
const rad = (deg) => (deg * Math.PI) / 180;

for (const deg of [30, 150]) {
  test(`[P2-6] dốc góc ${deg} độ: đi từ chân dốc (bán kính 30 m) lên tới tầng 1 (Y=3)`, () => {
    const c = Math.cos(rad(deg));
    const s = Math.sin(rad(deg));
    const start = [33 * c, 0, 33 * s];
    const res = runOk({
      night: 3, ticks: 180, snapshotEvery: 1, scenario: sc3(start),
      inputs: frames({ tick: 0, move: [-c, -s] }),
    });
    const p = snapAt(res, 180).player;
    assertClose(p.pos[1], 3, 0.05, 'độ cao sau khi lên dốc:');
    assert.equal(p.grounded, true);
    assert.ok(Math.hypot(p.pos[0], p.pos[2]) < 24 && Math.hypot(p.pos[0], p.pos[2]) > 12, 'đang ở trên vành tầng 1');
    let prev = -1;
    for (const sn of res.snapshots) {
      assert.ok(sn.player.pos[1] >= prev - 0.01, `tick ${sn.tick}: độ cao giảm khi lên dốc`);
      prev = sn.player.pos[1];
    }
    assert.equal(hits(res).length, 0);
  });
}

test('[P2-6] vách đứng tầng 1: đi thẳng từ tầng 0 vào mép r=24 (ngoài dốc) thì bị chặn, không lên được', () => {
  const res = runOk({
    night: 3, ticks: 240, snapshotEvery: 1, scenario: sc3([0, 0, 30]),
    inputs: frames({ tick: 0, move: [0, -1] }),
  });
  for (const s of res.snapshots) {
    assert.equal(s.player.pos[1], 0, `tick ${s.tick} đã leo lên vách`);
    assert.ok(Math.hypot(s.player.pos[0], s.player.pos[2]) >= 24 - 0.01, `tick ${s.tick} xuyên vách`);
  }
  assert.equal(snapAt(res, 240).player.grounded, true);
});

test('[P2-6] bước ra khỏi mép trong tầng 1 (r<12) thì rơi xuống tầng dưới (không phải rơi khỏi đảo), rồi bị vách tầng 2 chặn', () => {
  // đi theo bán kính góc 60 độ (tránh bục (0,3,13) và hai dốc) từ r=18 vào trong.
  const res = runOk({
    night: 3, ticks: 150, snapshotEvery: 1, scenario: sc3([18 * 0.5, 3, 18 * Math.sin(rad(60))]),
    inputs: frames({ tick: 0, move: [-0.5, -Math.sin(rad(60))] }),
  });
  const p = snapAt(res, 150).player;
  assertClose(p.pos[1], 0, 0.01, 'đã rơi xuống tầng 0:');
  assert.equal(p.grounded, true);
  const r = Math.hypot(p.pos[0], p.pos[2]);
  assert.ok(r < 12.01 && r >= 8 - 0.01, `r=${r}: phải ở tầng 0 trong khoảng 8..12 (vách tầng 2 chặn ở 8)`);
  assert.equal(hits(res).length, 0, 'rơi xuống tầng dưới không mất lửa');
});

test('[P2-6] bục (0,3,13): bắn lên vy 12, vận tốc ngang 8 hướng -Z, đáp lên tầng 2 (Y=6, bán kính <= 8)', () => {
  const res = runOk({ night: 3, ticks: 150, snapshotEvery: 1, scenario: sc3([0, 3, 13]) });
  const v = snapAt(res, 2).player.vel;
  assert.ok(v[1] > 11 && v[1] <= 12.01, `vy=${v[1]}`);
  assertClose(v[2], -8, 0.05, 'vz:');
  assertClose(v[0], 0, 0.05, 'vx:');
  const peak = Math.max(...res.snapshots.map((s) => s.player.pos[1]));
  assert.ok(peak > 6.3, `đỉnh ${peak}`);
  const p = snapAt(res, 130).player;
  assertClose(p.pos[1], 6, 0.01, 'đáp lên tầng 2:');
  assert.equal(p.grounded, true);
  assert.ok(Math.hypot(p.pos[0], p.pos[2]) <= 8, 'đáp trong đĩa tầng 2');
  assert.equal(hits(res).length, 0);
});

test('[P2-6] tháp chuông bán kính 2 m ở tâm tầng 2 không leo được, đi vào thì bị chặn ở r=2', () => {
  const res = runOk({
    night: 3, ticks: 120, snapshotEvery: 1, scenario: sc3([0, 6, 6]),
    inputs: frames({ tick: 0, move: [0, -1] }),
  });
  for (const s of res.snapshots) {
    assertClose(s.player.pos[1], 6, 0.01, `tick ${s.tick} y:`);
    assert.ok(Math.hypot(s.player.pos[0], s.player.pos[2]) >= 2 - 0.01, `tick ${s.tick} xuyên tháp`);
  }
  assert.ok(snapAt(res, 120).player.pos[2] < 2.5, 'đã đi sát tháp');
});

// ---------------------------------------------------------------------------
// P2-7: Gió Lạc (Đêm 2 và 3)

const drifter = (pos, extra = {}) => ({ pos, state: 'idle', ...extra });
const nightWith = (over) => scenN(2, over);

test('[P2-7] mang >= 5 trong 15 m: idle -> chase -> cướp min(3, đang mang) -> flee 240 tick -> removed; chỉ cướp 1 lần', () => {
  const sc = nightWith({ player: { carried: 5 }, drifters: [drifter([10, 0, 0])] });
  const res = runOk({ night: 2, ticks: 420, snapshotEvery: 1, scenario: sc });
  assert.equal(snapAt(res, 0).drifters[0].state, 'idle');
  assert.equal(snapAt(res, 3).drifters[0].state, 'chase');
  const st = eventsNamed(res, 'drifter_steal');
  assert.equal(st.length, 1, 'mỗi con chỉ cướp 1 lần');
  assert.deepEqual(st[0].data, { drifter_id: 'D1', amount: 3, carried: 2 });
  const Ts = st[0].tick;
  assert.ok(Ts >= 70 && Ts <= 85, `cướp ở tick ${Ts} (khoảng (10-1.2)/(7/60) = 75)`);
  const after = snapAt(res, Ts + 1);
  assert.equal(after.drifters[0].state, 'flee');
  assert.equal(after.drifters[0].stolen, 3);
  assert.equal(after.player.carried, 2);
  assert.equal(after.player.flames, T.flames, 'Gió Lạc không làm mất Ngọn Lửa');
  assert.equal(snapAt(res, Ts + 200).drifters[0].state, 'flee');
  assert.ok(distXZ(snapAt(res, Ts + 100).drifters[0].pos, snapAt(res, Ts + 100).player.pos)
    - distXZ(snapAt(res, Ts + 1).drifters[0].pos, snapAt(res, Ts + 1).player.pos) >= 8, 'flee: bay ra xa Mây');
  assert.equal(snapAt(res, Ts + 245).drifters[0].state, 'removed');
  assert.equal(hits(res).length, 0);
});

test('[P2-7] chỉ rượt khi mang >= 5 và trong 15 m: mang 4 hoặc cách 25 m thì vẫn idle; mất điều kiện thì về idle', () => {
  const few = runOk({ night: 2, ticks: 90, snapshotEvery: 30, scenario: nightWith({ player: { carried: 4 }, drifters: [drifter([10, 0, 0])] }) });
  for (const s of few.snapshots) assert.equal(s.drifters[0].state, 'idle', `mang 4, tick ${s.tick}`);
  const far = runOk({ night: 2, ticks: 90, snapshotEvery: 30, scenario: nightWith({ player: { carried: 5 }, drifters: [drifter([25, 0, 0])] }) });
  for (const s of far.snapshots) assert.equal(s.drifters[0].state, 'idle', `cách 25 m, tick ${s.tick}`);
  // mất điều kiện: pulse (tốn 3) làm carried 5 -> 2, Gió Lạc ở 14 m ngoài tầm pulse nên không bị ảnh hưởng, phải về idle.
  const lose = runOk({
    night: 2, ticks: 40, snapshotEvery: 1,
    scenario: nightWith({ player: { carried: 5 }, drifters: [drifter([14, 0, 0])] }),
    inputs: frames({ tick: 10, pulse: true }, { tick: 11, pulse: false }),
  });
  assert.equal(snapAt(lose, 8).drifters[0].state, 'chase');
  assert.equal(snapAt(lose, 16).drifters[0].state, 'idle');
});

test('[P2-7] Tỏa Sáng trúng Gió Lạc đang chase -> chuyển flee, không cướp; flee rồi removed', () => {
  const sc = nightWith({ player: { carried: 10 }, drifters: [drifter([3, 0, 0], { state: 'chase' })] });
  const res = runOk({ night: 2, ticks: 300, snapshotEvery: 1, scenario: sc, inputs: frames({ tick: 0, pulse: true }, { tick: 1, pulse: false }) });
  assert.equal(eventsNamed(res, 'pulse').length, 1);
  assert.equal(snapAt(res, 1).drifters[0].state, 'flee');
  assert.equal(snapAt(res, 1).drifters[0].stolen, 0);
  assert.equal(eventsNamed(res, 'drifter_steal').length, 0, 'bị pulse thì không cướp');
  assert.equal(snapAt(res, 1).player.carried, 10 - T.pulse_cost);
  assert.equal(snapAt(res, 260).drifters[0].state, 'removed');
});

test('[P2-7] Tỏa Sáng trúng Gió Lạc đang flee có mang đồ -> thả toàn bộ thành đom đóm rơi, biến mất sau 120 tick', () => {
  const sc = nightWith({ player: { carried: 3 }, drifters: [drifter([3, 0, 0], { state: 'flee', stolen: 3 })] });
  const res = runOk({ night: 2, ticks: 200, snapshotEvery: 1, scenario: sc, inputs: frames({ tick: 0, pulse: true }, { tick: 1, pulse: false }) });
  const dr = eventsNamed(res, 'drifter_drop');
  assert.equal(dr.length, 1);
  assert.equal(dr[0].tick, 1);
  assert.deepEqual(dr[0].data, { drifter_id: 'D1', amount: 3 });
  const s = snapAt(res, 2);
  assert.equal(s.drifters[0].stolen, 0);
  const fallen = s.motes.filter((m) => m.kind === 'dropped');
  assert.equal(fallen.length, 3);
  for (const m of fallen) assert.ok(m.ttl_s > 7.5 && m.ttl_s <= 8, `ttl_s=${m.ttl_s}`);
  assert.notEqual(snapAt(res, 100).drifters[0].state, 'removed');
  assert.equal(snapAt(res, 130).drifters[0].state, 'removed');
  assert.equal(eventsNamed(res, 'drifter_steal').length, 0);
});

test('[P2-7] bất tử của Mây và vùng an toàn của đèn không ngăn bị cướp; không mất Ngọn Lửa', () => {
  const sc = nightWith({
    player: { pos: [0, 0, 20], carried: 5, invuln_ticks: 1000 },
    lanterns: [{ id: 'L1', lit: true }], // đèn L1 (0,0,20) đã sáng, Mây đứng trong vùng an toàn 6 m
    drifters: [drifter([8, 0, 20], { state: 'chase' })],
  });
  const res = runOk({ night: 2, ticks: 150, snapshotEvery: 50, scenario: sc });
  const st = eventsNamed(res, 'drifter_steal');
  assert.equal(st.length, 1);
  assert.deepEqual(st[0].data, { drifter_id: 'D1', amount: 3, carried: 2 });
  assert.equal(hits(res).length, 0);
  assert.equal(snapAt(res, 150).player.flames, T.flames);
});

test('[P2-7] lịch sinh Gió Lạc: D1 tại tick 1200, D2 tại tick 2400, tối đa 2 con còn sống (Đêm 2)', () => {
  const sc = { random_motes: false, random_shades: false, wind_enabled: false, player: { carried: 0 } };
  const res = runOk({ night: 2, seed: 5, ticks: 3700, snapshotEvery: 1, scenario: sc });
  assert.deepEqual(snapAt(res, 1199).drifters, []);
  assert.deepEqual(snapAt(res, 1200).drifters.map((d) => [d.id, d.state]), [['D1', 'idle']]);
  assert.deepEqual(snapAt(res, 2399).drifters.map((d) => d.id), ['D1']);
  assert.deepEqual(snapAt(res, 2400).drifters.map((d) => d.id), ['D1', 'D2']);
  assert.deepEqual(snapAt(res, 3700).drifters.map((d) => d.id), ['D1', 'D2'], 'tối đa 2 con còn sống');
});

test('[P2-7] Đêm 1 không có Gió Lạc', () => {
  const res = runOk({ night: 1, seed: 5, ticks: 1400, snapshotEvery: 200, scenario: { random_motes: false, random_shades: false } });
  for (const s of res.snapshots) assert.deepEqual(s.drifters, []);
});

// ---------------------------------------------------------------------------
// P2-8: Bùa Gió

const CHARM2 = [35, 0, 0];

test('[P2-8] nhặt bùa Đêm 2 (35,0,0): charm_picked {C1, 600}, charm_s ~10, bùa biến mất, hiện lại sau 2700 tick', () => {
  const res = runOk({ night: 2, ticks: 2780, snapshotEvery: 1, scenario: scenN(2, { player: { pos: CHARM2 } }) });
  const ev = eventsNamed(res, 'charm_picked');
  assert.deepEqual(ev[0].data, { charm_id: 'C1', charm_ticks: 600 });
  assert.equal(ev[0].tick, 1);
  const s1 = snapAt(res, 1);
  assert.ok(s1.player.charm_s > 9.9 && s1.player.charm_s <= 10, `charm_s=${s1.player.charm_s}`);
  assert.equal(s1.charms[0].available, false);
  assert.ok(s1.charms[0].respawn_s > 44.9 && s1.charms[0].respawn_s <= 45, `respawn_s=${s1.charms[0].respawn_s}`);
  assertClose(snapAt(res, 301).player.charm_s, 5, 0.03, 'charm_s sau 300 tick:');
  assert.equal(snapAt(res, 650).player.charm_s, 0, 'hết hiệu lực sau 600 tick');
  const mid = snapAt(res, 1501).charms[0];
  assert.equal(mid.available, false);
  assert.ok(mid.respawn_s > 19.8 && mid.respawn_s < 20.2, `respawn_s giữa chừng=${mid.respawn_s}`);
  assert.equal(snapAt(res, 2600).charms[0].available, false);
  assert.equal(ev.length, 2, 'bùa hiện lại thì Mây đứng đó nhặt lại');
  assert.ok(ev[1].tick >= 2690 && ev[1].tick <= 2720, `nhặt lại ở tick ${ev[1].tick}`);
});

test('[P2-8] có bùa: chạy 7.2 m/s; hết bùa trở lại 6 m/s', () => {
  const inputs = frames({ tick: 0, move: [1, 0] }, { tick: 40, move: [0, 0] }, { tick: 640, move: [-1, 0] });
  const res = runOk({ night: 2, ticks: 700, snapshotEvery: 1, scenario: scenN(2, { player: { pos: CHARM2 } }), inputs });
  const vmax = Math.max(...res.snapshots.filter((s) => s.tick <= 40).map((s) => s.player.vel[0]));
  assertClose(vmax, T.player_speed * 1.2, 0.01, 'tốc độ chạy khi có bùa:');
  assertClose(snapAt(res, 30).player.vel[0], 7.2, 0.01);
  assertClose(snapAt(res, 690).player.vel[0], -T.player_speed, 0.01, 'sau khi hết bùa:');
});

test('[P2-8] có bùa: Lướt không hồi chiêu (nhấn lại được ngay), nhấn khi đang lướt bị bỏ qua, lướt vẫn 14 m/s trong 12 tick', () => {
  const inputs = frames(
    { tick: 10, dash: true }, { tick: 11, dash: false },
    { tick: 15, dash: true }, { tick: 16, dash: false }, // đang lướt -> bỏ qua
    { tick: 30, dash: true }, { tick: 31, dash: false }, // lướt xong, không hồi chiêu -> được
  );
  const res = runOk({ night: 2, ticks: 60, snapshotEvery: 1, scenario: scenN(2, { player: { pos: CHARM2 } }), inputs });
  assert.deepEqual(eventsNamed(res, 'dash').map((e) => e.tick), [11, 31]);
  assert.equal(snapAt(res, 12).player.dash_cd_s, 0, 'bùa: không đặt hồi chiêu');
  const v = snapAt(res, 16).player.vel;
  assertClose(Math.hypot(v[0], v[2]), T.dash_speed, 0.05, '|vel| lúc lướt có bùa:');
  const dz = snapAt(res, 22).player.pos[2] - snapAt(res, 10).player.pos[2];
  assert.ok(dz >= 2.7 && dz <= 3.0, `quãng lướt ${dz}`); // hướng mặt +Z, 12 tick x 14 m/s
});

test('[P2-8] Đêm 3 có hai bùa: (30,0,25) và (-30,0,25), id C1, C2', () => {
  const a = runOk({ night: 3, ticks: 5, scenario: sc3([30, 0, 25]) });
  assert.deepEqual(eventsNamed(a, 'charm_picked').map((e) => e.data.charm_id), ['C1']);
  const b = runOk({ night: 3, ticks: 5, scenario: sc3([-30, 0, 25]) });
  assert.deepEqual(eventsNamed(b, 'charm_picked').map((e) => e.data.charm_id), ['C2']);
});

// ---------------------------------------------------------------------------
// P2-9: gió mạnh Đêm 3

test('[P2-9] gió Đêm 3: wind.active trong tick 1800..2099 (kéo dài 300 tick), hướng cố định; đứng yên bị đẩy 2 m/s', () => {
  const res = runOk({ night: 3, seed: 6, ticks: 2200, snapshotEvery: 10, scenario: scenN(3, { wind_enabled: true }) });
  assert.deepEqual(snapAt(res, 1790).wind, { active: false, dir_deg: null });
  const w = snapAt(res, 1810).wind;
  assert.equal(w.active, true);
  assert.ok(Number.isInteger(w.dir_deg) && w.dir_deg >= 0 && w.dir_deg < 360, `dir_deg=${w.dir_deg}`);
  for (let k = 1810; k <= 2090; k += 10) assert.deepEqual(snapAt(res, k).wind, w, `tick ${k}`);
  assert.deepEqual(snapAt(res, 2110).wind, { active: false, dir_deg: null });
  const p0 = snapAt(res, 1810).player.pos;
  const p1 = snapAt(res, 2090).player.pos;
  const d = (2 * 280) / 60;
  const a = rad(w.dir_deg);
  assertPosClose([p1[0] - p0[0], p1[2] - p0[2]], [d * Math.cos(a), d * Math.sin(a)], 0.15, 'dịch chuyển do gió:');
  assertPosClose(snapAt(res, 1790).player.pos, START[3], POS_TOL, 'trước khi có gió không bị đẩy:');
});

test('[P2-9] gió lặp mỗi 30 s: cơn thứ hai active quanh tick 3600..3899', () => {
  const res = runOk({ night: 3, seed: 6, ticks: 4000, snapshotEvery: 100, scenario: scenN(3, { wind_enabled: true }) });
  assert.equal(snapAt(res, 3500).wind.active, false);
  assert.equal(snapAt(res, 3700).wind.active, true);
  assert.equal(snapAt(res, 3800).wind.active, true);
  assert.equal(snapAt(res, 3900).wind.active, false);
});

test('[P2-9] wind_enabled:false tắt gió; Đêm 1 và 2 không bao giờ có gió', () => {
  const off = runOk({ night: 3, ticks: 2200, snapshotEvery: 100, scenario: scenN(3, { wind_enabled: false }) });
  for (const s of off.snapshots) assert.equal(s.wind.active, false);
  assertPosClose(snapAt(off, 2200).player.pos, START[3], POS_TOL);
  for (const night of [1, 2]) {
    const res = runOk({ night, ticks: 2000, snapshotEvery: 100, scenario: scen() });
    for (const s of res.snapshots) assert.deepEqual(s.wind, { active: false, dir_deg: null }, `Đêm ${night} tick ${s.tick}`);
  }
});

// ---------------------------------------------------------------------------
// P2-10: tạm dừng

test('[P2-10] pause: state paused, sim_tick/time_left/hồi chiêu/vị trí đứng yên trong khi tick vẫn tăng; resumed', () => {
  const t0 = T.night1_duration_s;
  const inputs = frames(
    { tick: 0, move: [0, 1] },
    { tick: 2, pulse: true }, { tick: 3, pulse: false },
    { tick: 10, pause: true }, { tick: 11, pause: false },
    { tick: 50, pause: true }, { tick: 51, pause: false },
  );
  const res = runOk({ ticks: 80, snapshotEvery: 1, scenario: scen({ player: { carried: T.carry_capacity } }), inputs });
  assert.deepEqual(res.events.map((e) => [e.name, e.tick]), [['pulse', 3], ['paused', 11], ['resumed', 51]]);
  assert.equal(snapAt(res, 10).state, 'playing');
  const ref = snapAt(res, 11);
  assert.equal(ref.state, 'paused');
  assert.equal(ref.sim_tick, 10, 'sim_tick đứng yên tại bước tạm dừng');
  assertClose(ref.time_left_s, t0 - 10 / 60, 0.001);
  for (let k = 12; k <= 50; k++) {
    const s = snapAt(res, k);
    assert.equal(s.state, 'paused', `tick ${k}`);
    assert.equal(s.tick, k, 'tick vẫn tăng');
    assert.equal(s.sim_tick, ref.sim_tick, `sim_tick tick ${k}`);
    assert.equal(s.time_left_s, ref.time_left_s);
    assert.deepEqual(s.player.pos, ref.player.pos, `vị trí tick ${k}`);
    assert.deepEqual(s.player.vel, ref.player.vel);
    assert.equal(s.player.pulse_cd_s, ref.player.pulse_cd_s, 'hồi chiêu đứng yên');
  }
  assert.ok(ref.player.pulse_cd_s > 0);
  const r = snapAt(res, 51);
  assert.equal(r.state, 'playing');
  assert.ok([10, 11].includes(r.sim_tick), `sim_tick lúc tiếp tục = ${r.sim_tick}`);
  assert.equal(snapAt(res, 80).sim_tick - snapAt(res, 60).sim_tick, 20, 'sau tiếp tục sim_tick lại chạy 1/tick');
  assert.ok(snapAt(res, 80).player.pos[2] > ref.player.pos[2], 'Mây chạy tiếp sau khi tiếp tục');
  assertClose(snapAt(res, 80).time_left_s, t0 - snapAt(res, 80).sim_tick / 60, 0.001);
  assert.equal(res.end.ticks, 80, 'end.ticks đếm cả tick tạm dừng');
});

test('[P2-10] đang tạm dừng thì không có sự kiện gameplay và Bóng Mực không di chuyển', () => {
  const sc = scen({ shades: [chase([10, 0, 0])] });
  const inputs = frames({ tick: 5, pause: true }, { tick: 6, pause: false });
  const res = runOk({ ticks: 100, snapshotEvery: 1, scenario: sc, inputs });
  const frozen = snapAt(res, 7).shades[0].pos;
  for (let k = 8; k <= 100; k++) assert.deepEqual(snapAt(res, k).shades[0].pos, frozen, `tick ${k}`);
  assert.equal(snapAt(res, 100).state, 'paused');
});

// ---------------------------------------------------------------------------
// P2-11: Bóng Mực mới

const SPAWN_PTS = {
  1: circlePts(0, 0, 37, 15, 30, 12),
  2: [0, 70].flatMap((cx) => circlePts(cx, 0, 26, 22.5, 45, 8)),
  3: circlePts(0, 0, 43, 0, 22.5, 16),
};
const SCHEDULE = { 1: [300, 300, 780, 1260], 2: [300, 300, 720, 1140], 3: [300, 300, 660, 1020] };

for (const night of [1, 2, 3]) {
  test(`[P2-11] Đêm ${night}: lịch sinh Bóng Mực (2 con tick 300, rồi mỗi ${[480, 420, 360][night - 1]} tick), id S1.. theo thứ tự, trên điểm sinh của ticket`, () => {
    const sc = scenN(night, { random_shades: true, player: { flames: 100 } });
    const res = runOk({ night, seed: 9, ticks: 1300, snapshotEvery: 1300, scenario: sc });
    const ev = eventsNamed(res, 'shade_spawned');
    assert.deepEqual(ev.map((e) => [e.tick, e.data.id]), SCHEDULE[night].map((t, i) => [t, `S${i + 1}`]));
    // vị trí lúc vừa sinh (đang spawning, đứng yên): chụp ở tick 300 bằng lần chạy ngắn
    const first = runOk({ night, seed: 9, ticks: 300, snapshotEvery: 1, scenario: sc });
    const s300 = snapAt(first, 300);
    assert.equal(snapAt(first, 299).shades.length, 0, 'chưa có Bóng Mực trước tick 300');
    assert.equal(s300.shades.length, 2);
    for (const sh of s300.shades) {
      assert.equal(sh.state, 'spawning');
      assert.ok(onAny(SPAWN_PTS[night], [sh.pos[0], 0, sh.pos[2]]), `Bóng Mực sinh ngoài điểm ticket: ${sh.pos}`);
      assert.ok(distXZ(sh.pos, START[night]) >= 15 - 0.01, 'sinh cách Mây >= 15 m');
      assert.equal(sh.pos[1], SHADE_Y);
    }
  });
}

test('[P2-11] trạng thái spawning kéo dài ~30 tick (không gây hit) rồi chuyển wander/chase', () => {
  const sc = scenN(1, { random_shades: true, player: { flames: 100 } });
  const res = runOk({ seed: 9, ticks: 360, snapshotEvery: 1, scenario: sc });
  assert.equal(snapAt(res, 320).shades[0].state, 'spawning');
  assert.notEqual(snapAt(res, 335).shades[0].state, 'spawning');
  assert.ok(['wander', 'chase'].includes(snapAt(res, 335).shades[0].state));
});

for (const [night, max, until] of [[1, 6, 3000], [2, 8, 3300], [3, 10, 3500]]) {
  test(`[P2-11] Đêm ${night}: số Bóng Mực tối đa ${max}`, () => {
    const sc = scenN(night, { random_shades: true, player: { flames: 100 } });
    const res = runOk({ night, seed: 2, ticks: until, snapshotEvery: 100, scenario: sc });
    for (const s of res.snapshots) assert.ok(s.shades.length <= max, `tick ${s.tick}: ${s.shades.length} con`);
    assert.equal(res.snapshots.at(-1).shades.length, max);
  });
}

test('[P2-11] Đêm 3: Bóng Mực nhanh 4.5 m/s', () => {
  const sc = scenN(3, { shades: [chase([0, 0, -10])] }); // Mây ở (0,0,-25), cách 15 m
  const res = runOk({ night: 3, ticks: 100, snapshotEvery: 1, scenario: sc });
  for (const k of [20, 50, 90]) {
    assertClose(distXZ(snapAt(res, k).shades[0].pos, START[3]), 15 - k * (4.5 / 60), 0.01, `tick ${k}:`);
  }
});

test('[P2-11] Bóng Mực trong scenario mặc định là wander: bay ~1.5 m/s khi ở xa (>12 m)', () => {
  const res = runOk({ ticks: 60, snapshotEvery: 1, scenario: scen({ shades: [{ pos: [30, 0, 0] }] }) });
  assert.equal(snapAt(res, 0).shades[0].state, 'wander');
  assert.equal(snapAt(res, 60).shades[0].state, 'wander');
  const d = distXZ(snapAt(res, 60).shades[0].pos, [30, 0, 0]);
  assert.ok(d > 1.3 && d < 1.6, `đi được ${d} m trong 1 s`);
});

test('[P2-11] wander -> chase khi Mây trong 12 m; chase giữ nguyên trong 12..18 m; chase -> wander khi > 18 m', () => {
  const near = runOk({ ticks: 6, snapshotEvery: 1, scenario: scen({ shades: [{ pos: [10, 0, 0] }] }) });
  assert.equal(snapAt(near, 4).shades[0].state, 'chase');
  const keepChase = runOk({ ticks: 12, snapshotEvery: 1, scenario: scen({ shades: [chase([15, 0, 0])] }) });
  for (let k = 0; k <= 12; k++) assert.equal(snapAt(keepChase, k).shades[0].state, 'chase', `chase 15 m, tick ${k}`);
  const keepWander = runOk({ ticks: 12, snapshotEvery: 1, scenario: scen({ shades: [{ pos: [15, 0, 0] }] }) });
  for (let k = 0; k <= 12; k++) assert.equal(snapAt(keepWander, k).shades[0].state, 'wander', `wander 15 m, tick ${k}`);
  const lose = runOk({ ticks: 6, snapshotEvery: 1, scenario: scen({ shades: [chase([20, 0, 0])] }) });
  assert.equal(snapAt(lose, 4).shades[0].state, 'wander');
});

test('[P2-11] bị đánh: Bóng Mực chuyển recoil 60 tick, lùi ra tổng 2 m, không gây hit trong lúc recoil, rồi chase lại', () => {
  const res = runOk({ ticks: 100, snapshotEvery: 1, scenario: scen({ shades: [chase([0.5, 0, 0])] }) });
  assert.equal(hits(res)[0].tick, 1);
  for (let k = 1; k <= 55; k++) assert.equal(snapAt(res, k).shades[0].state, 'recoil', `tick ${k}`);
  assert.equal(snapAt(res, 66).shades[0].state, 'chase');
  const d = (k) => distXZ(snapAt(res, k).shades[0].pos, snapAt(res, k).player.pos);
  for (let k = 6; k <= 55; k++) assert.ok(d(k) > d(k - 1) - 0.002, `tick ${k}: recoil phải lùi ra xa`);
  assertClose(d(55) - d(5), (50 * 2) / 60, 0.15, 'quãng lùi:');
  assert.equal(hits(res).filter((h) => h.tick < 90).length, 1);
});

test('[P2-11] Bóng Mực chạm lúc Mây bất tử không làm gì (không hit, không recoil) tới khi hết bất tử', () => {
  const sc = scen({ player: { invuln_ticks: 60 }, shades: [chase([0.5, 0, 0])] });
  const res = runOk({ ticks: 80, snapshotEvery: 1, scenario: sc });
  const first = hits(res)[0].tick;
  assert.ok(first >= 59 && first <= 62, `hit đầu ở tick ${first}`);
  assert.equal(snapAt(res, 30).shades[0].state, 'chase');
  assert.equal(snapAt(res, 30).player.invuln, true);
  assert.equal(snapAt(res, first).shades[0].state, 'recoil');
});

test('[P2-11] choáng 120 tick, đẩy 4 m trong 15 tick đầu, Pulse lại làm mới choáng và đẩy lùi', () => {
  const sc = scen({
    player: { carried: T.pulse_cost },
    shades: [{ pos: [3, 0, 0], state: 'stunned', state_ticks_left: 100 }],
  });
  const res = runOk({ ticks: 160, snapshotEvery: 1, scenario: sc, inputs: frames({ tick: 0, pulse: true }, { tick: 1, pulse: false }) });
  assert.equal(snapAt(res, 0).shades[0].state, 'stunned');
  assert.deepEqual(eventsNamed(res, 'pulse')[0].data, { stunned_ids: ['S1'] }, 'kể cả con đang choáng');
  assert.equal(snapAt(res, 110).shades[0].state, 'stunned', 'đã được làm mới thành 120 tick (nếu không đã hết ở tick ~100)');
  assert.notEqual(snapAt(res, 130).shades[0].state, 'stunned');
  assertClose(snapAt(res, 60).shades[0].pos[0], 3 + T.pulse_push_m, POS_TOL, 'bị đẩy lùi 4 m:');
});

test('[P2-11] đẩy lùi dừng khi gặp mép bản đồ (không bị đẩy ra biển mây)', () => {
  const sc = scen({ player: { pos: [35, 0, 0], carried: T.pulse_cost }, shades: [chase([38, 0, 0])] });
  const res = runOk({ ticks: 40, snapshotEvery: 1, scenario: sc, inputs: frames({ tick: 0, pulse: true }, { tick: 1, pulse: false }) });
  assert.deepEqual(eventsNamed(res, 'pulse')[0].data, { stunned_ids: ['S1'] });
  const x = snapAt(res, 40).shades[0].pos[0];
  assert.ok(x <= 40.01 && x >= 38, `x=${x}`);
});

test('[P2-11] Tỏa Sáng chọn mục tiêu theo khoảng cách 3D tới tâm Mây + 0.8 m: ngang 4.95 m trúng, ngang 5.0 m không trúng', () => {
  const sc = scen({
    player: { carried: T.carry_capacity },
    shades: [chase([T.pulse_radius - 0.05, 0, 0]), chase([0, 0, T.pulse_radius])],
  });
  const res = runOk({ ticks: 3, scenario: sc, inputs: frames({ tick: 0, pulse: true }, { tick: 1, pulse: false }) });
  assert.deepEqual(eventsNamed(res, 'pulse')[0].data, { stunned_ids: ['S1'] });
});

test('[P2-11] Bóng Mực đang spawning bị pulse thì chuyển stunned', () => {
  const sc = scen({ player: { carried: T.pulse_cost }, shades: [{ pos: [3, 0, 0], state: 'spawning', state_ticks_left: 25 }] });
  const res = runOk({ ticks: 3, snapshotEvery: 1, scenario: sc, inputs: frames({ tick: 0, pulse: true }, { tick: 1, pulse: false }) });
  assert.equal(snapAt(res, 0).shades[0].state, 'spawning');
  assert.deepEqual(eventsNamed(res, 'pulse')[0].data, { stunned_ids: ['S1'] });
  assert.equal(snapAt(res, 1).shades[0].state, 'stunned');
});

// ---------------------------------------------------------------------------
// P2-12: vùng an toàn 6 m, đuổi trong 30 tick, không gây hit

test('[P2-12] Bóng Mực đang trong 6 m khi đèn vừa thắp: ra tới mép sau ~30 tick và không gây hit trong lúc đó', () => {
  const L = lanternPos(1);
  const mk = () => scen({
    player: { pos: L, carried: T.lantern_cost },
    shades: [chase([L[0] + 0.5, 0, L[2]])], // sát Mây (<= 1 m) và nằm trong vùng an toàn sắp có
  });
  const res = runOk({ ticks: 150, snapshotEvery: 1, scenario: mk(), inputs: frames({ tick: 0, interact: true }, { tick: 1, interact: false }) });
  assert.equal(eventsNamed(res, 'lantern_lit').length, 1);
  assert.equal(hits(res).length, 0, 'không gây sát thương trong lúc bị đuổi ra');
  const d = (k) => distXZ(snapAt(res, k).shades[0].pos, L);
  for (let k = 2; k <= 40; k++) assert.ok(d(k) >= d(k - 1) - 0.002, `tick ${k}: phải đi ra, không vào`);
  assert.ok(d(15) > 1 && d(15) < T.safe_radius - 0.5, `tick 15 đang ở giữa đường: ${d(15)}`);
  assertClose(d(36), T.safe_radius, 0.06, 'đã ra tới mép 6 m:');
  for (let k = 36; k <= 150; k++) assert.ok(d(k) >= T.safe_radius - 0.01, `tick ${k} vào lại vùng an toàn: ${d(k)}`);
  // đối chứng: không thắp đèn thì cùng cấu hình bị chạm ngay
  const control = runOk({ ticks: 5, scenario: mk() });
  assert.equal(hits(control)[0].tick, 1);
});

test('[P2-12] Bóng Mực ở ngoài bị chặn ở mép 6 m quanh đèn đã sáng (đuổi Mây đứng ở chân đèn)', () => {
  const L = lanternPos(1, 1);
  const sc = scen({ player: { pos: L }, lanterns: [{ id: 'L1', lit: true }], shades: [chase([12, 0, 25]), chase([0, 0, 12])] });
  const res = runOk({ ticks: 400, snapshotEvery: 1, scenario: sc });
  let minD = Infinity;
  for (const s of res.snapshots) for (const sh of s.shades) {
    const d = distXZ(sh.pos, L);
    minD = Math.min(minD, d);
    assert.ok(d >= T.safe_radius - 0.01, `tick ${s.tick}: ${d}`);
  }
  assert.ok(minD < T.safe_radius + 0.1);
  assert.equal(hits(res).length, 0);
});

// ---------------------------------------------------------------------------
// P2-13: điểm chuẩn

test('[P2-13] điểm nạp/thắp/pulse theo tuning v1.2, nhặt vẫn không cộng điểm', () => {
  const L = lanternPos(1);
  // 1) nạp dở: chỉ nhận điểm mỗi đom đóm
  const a = runOk({ ticks: 3, scenario: scen({ player: { pos: L, carried: 4 } }), inputs: frames({ tick: 0, interact: true }, { tick: 1, interact: false }) });
  assert.equal(a.end.score, 4 * S.per_mote);
  // 2) nạp đủ: điểm nạp + điểm thắp lần đầu
  const b = runOk({ ticks: 3, scenario: scen({ player: { pos: L, carried: T.lantern_cost } }), inputs: frames({ tick: 0, interact: true }, { tick: 1, interact: false }) });
  assert.equal(b.end.score, T.lantern_cost * S.per_mote + S.per_lantern);
  // 3) pulse trúng 2 Bóng Mực, một con đang choáng sẵn: +5 mỗi con
  const sc = scen({
    player: { carried: 3 },
    shades: [chase([2, 0, 0]), { pos: [-2, 0, 0], state: 'stunned', state_ticks_left: 50 }],
  });
  const c = runOk({ ticks: 3, scenario: sc, inputs: frames({ tick: 0, pulse: true }, { tick: 1, pulse: false }) });
  assert.deepEqual(eventsNamed(c, 'pulse')[0].data, { stunned_ids: ['S1', 'S2'] });
  assert.equal(c.end.score, 2 * S.per_stun);
  // 4) nhặt không cộng điểm
  const d = runOk({ ticks: 3, scenario: scen({ motes: [[0, 0, 0]] }) });
  assert.equal(d.end.score, 0);
});

test('[P2-13] chỉ thưởng ở bình minh: điểm dầu/đèn và Ngọn Lửa theo tuning v1.2', () => {
  const t0 = 1;
  const l5 = lanternPos(5);
  const sc = scen({
    time_left_s: t0,
    player: { pos: l5, carried: T.lantern_cost, flames: 2 },
    lanterns: [1, 2, 3, 4].map((k) => ({ id: `L${k}`, lit: true })),
  });
  const res = runOk({ ticks: ticksOf(t0) + 1, snapshotEvery: 1, scenario: sc, inputs: frames({ tick: 0, interact: true }, { tick: 1, interact: false }) });
  const expected = T.lantern_cost * S.per_mote + S.per_lantern
    + 4 * (S.per_lit_lantern_dawn + Math.floor(T.fuel_max - t0 * T.fuel_decay_per_s))
    + S.per_lit_lantern_dawn + Math.floor(T.fuel_max - (ticksOf(t0) - 1) / 60 * T.fuel_decay_per_s)
    + S.per_flame_left * 2;
  assert.equal(res.end.score, expected);
  const dawnFuel = Object.fromEntries([1, 2, 3, 4, 5].map((id) => [`L${id}`,
    T.fuel_max - (id === 5 ? (ticksOf(t0) - 1) / 60 : t0) * T.fuel_decay_per_s]));
  assert.equal(assertScoreConsistent(res, { flames0: 2, dawnFuel }), expected);
});

for (const night of [2, 3]) {
  test(`[P2-13] Đêm ${night}: ván dài có di chuyển/lướt/pulse/nạp/rơi, điểm luôn khớp bảng điểm`, () => {
    const res = runOk({ night, seed: 31, ticks: 4000, snapshotEvery: 20, inputs: walkInputs(4000) });
    assertScoreConsistent(res, { t0: DURATION_S[night] });
  });
}

// ---------------------------------------------------------------------------
// P2-14: thứ tự thắng/thua

function lastLanternScenario(over = {}) {
  const { player, ...rest } = over;
  return scen({
    player: { pos: lanternPos(5), carried: T.lantern_cost, ...(player || {}) },
    lanterns: [1, 2, 3, 4].map((k) => ({ id: `L${k}`, lit: true })),
    ...rest,
  });
}
const light = frames({ tick: 0, interact: true }, { tick: 1, interact: false });

test('[P2-14] hết Ngọn Lửa cùng tick thắp đèn cuối -> thua (no_flames), không thắng', () => {
  const res = runOk({ ticks: 50, scenario: lastLanternScenario({ player: { flames: 0 } }), inputs: light });
  assert.deepEqual(res.events.map((e) => e.name), ['deposit', 'lantern_lit', 'game_over']);
  assert.deepEqual(lastGameOver(res).data, { result: 'lost', reason: 'no_flames' });
  assert.equal(res.end.state, 'lost');
  assert.equal(res.end.ticks, 1);
  assert.equal(res.end.score, T.lantern_cost * S.per_mote + S.per_lantern, 'thua: không có thưởng thắng');
});

test('[P2-14] thắp đèn cuối đúng tick bình minh -> thắng dawn_survived', () => {
  const res = runOk({ ticks: 50, scenario: lastLanternScenario({ time_left_s: 1 / 60 }), inputs: light });
  assert.deepEqual(lastGameOver(res).data, { result: 'won', reason: 'dawn_survived' });
  assert.equal(res.end.state, 'won');
  assert.equal(res.end.ticks, 1);
  const oldFuel = T.fuel_max - T.fuel_decay_per_s / 60;
  assert.equal(res.end.score, T.lantern_cost * S.per_mote + S.per_lantern
    + 4 * (S.per_lit_lantern_dawn + Math.floor(oldFuel))
    + S.per_lit_lantern_dawn + T.fuel_max + S.per_flame_left * T.flames);
});

test('[P2-14] hết giờ không có đèn sáng -> thua dawn', () => {
  const res = runOk({ ticks: 500, scenario: scen({ time_left_s: 1 }) });
  assert.deepEqual(lastGameOver(res).data, { result: 'lost', reason: 'dawn' });
  assert.equal(res.end.ticks, 60);
});

test('[P2-14] hết Ngọn Lửa cùng tick hết giờ -> no_flames (hết lửa luôn thua, ưu tiên hơn dawn)', () => {
  const res = runOk({ ticks: 50, scenario: scen({ time_left_s: 1 / 60, player: { flames: 0 } }) });
  assert.deepEqual(lastGameOver(res).data, { result: 'lost', reason: 'no_flames' });
});

// ---------------------------------------------------------------------------
// P2-15: hiệu năng headless, 3 Đêm đầy đủ (21.600 tick) <= 30 s

for (const night of [1, 2, 3]) {
  test(`[P2-15] Đêm ${night}: chạy đủ 21600 tick (một Đêm tối đa) trong <= 30 s`, () => {
    const sc = scenN(night, {
      random_motes: true, random_shades: true, random_drifters: true, wind_enabled: true,
      player: { flames: 1000 },
    });
    delete sc.motes;
    delete sc.shades;
    const t = Date.now();
    const res = runOk({ night, seed: 1, ticks: 21600, scenario: sc, inputs: walkInputs(21600) });
    const ms = Date.now() - t;
    assert.ok(ms <= 30000, `Đêm ${night} mất ${ms} ms`);
    assert.equal(res.end.ticks, DURATION_S[night] * 60, 'chạy tới hết đêm');
    assert.equal(res.end.state, 'lost');
    assert.deepEqual(lastGameOver(res).data, { result: 'lost', reason: 'dawn' });
  });
}

// ---------------------------------------------------------------------------
// Tất định cho cả 3 Đêm (Contract: cùng seed/scenario/inputs -> giống hệt từng byte)

for (const night of [1, 2, 3]) {
  test(`[P2-1/R10] Đêm ${night}: cùng seed + inputs (đủ lướt/nhảy/pulse/nạp, ngẫu nhiên đầy đủ) -> giống hệt từng byte; seed khác thì khác`, () => {
    const inputs = walkInputs(3000);
    const a = runOk({ night, seed: 77, ticks: 3000, snapshotEvery: 5, inputs });
    const b = runOk({ night, seed: 77, ticks: 3000, snapshotEvery: 5, inputs });
    assert.ok(a.raw.length > 5000);
    assert.ok(Buffer.from(a.raw).equals(Buffer.from(b.raw)), `Đêm ${night}: hai lần chạy khác nhau`);
    const c = runOk({ night, seed: 78, ticks: 3000, snapshotEvery: 5, inputs });
    assert.notEqual(a.raw, c.raw);
  });
}

test('[P2-1/R10] Đêm 2 và 3 cũng tất định khi không có inputs và không scenario (id Gió Lạc, Bóng Mực, gió tự sinh)', () => {
  for (const night of [2, 3]) {
    const a = runOk({ night, seed: 3, ticks: 3700, snapshotEvery: 50 });
    const b = runOk({ night, seed: 3, ticks: 3700, snapshotEvery: 50 });
    assert.ok(Buffer.from(a.raw).equals(Buffer.from(b.raw)));
  }
});

// CONTRACT được import để tránh cảnh báo khi cần dò thêm khóa trong tương lai.
void CONTRACT;
