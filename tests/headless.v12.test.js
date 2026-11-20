// Kiểm thử độc lập Contract v1.2: chỉ Ticket-03, ADR 0001 và tuning là oracle.
// Không import hoặc đọc mã mô phỏng. Mọi quan sát qua helpers.js -> CLI JSONL.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTRACT, T, S, LANTERNS, DURATION_S, START, ticksOf, distXZ,
  runOk, scenN, frames, snapAt, eventsNamed, assertScoreConsistent,
} from './helpers.js';

const roundFuel = (fuel) => Math.round(Math.max(0, fuel) * 10) / 10;
const decay = T.fuel_decay_per_s / 60;
const drain = T.drain_per_s / 60;
const capacity = (k) => Math.min(T.capacity_max, T.carry_capacity + 2 * k); // Ticket-03 §4: +2 mỗi lần
const lamp = (res, tick, id = 'L1') => snapAt(res, tick).lanterns.find((l) => l.id === id);
const shade = (res, tick, id = 'S1') => snapAt(res, tick).shades.find((s) => s.id === id);
const go = (res) => eventsNamed(res, 'game_over');
const interact = frames({ tick: 0, interact: true }, { tick: 1, interact: false });
const pulse = frames({ tick: 0, pulse: true }, { tick: 1, pulse: false });
const weak = (extra = {}) => ({ id: 'L1', pos: [10, 0, 0], lit: true, fuel: T.low_fuel_threshold - 1, ...extra });
const draining = (extra = {}) => ({ id: 'S1', pos: [10, 0, 0], state: 'drain', target_lantern_id: 'L1', ...extra });
const clean = (extra = {}) => scenN(1, extra);
const drainScenario = (extra = {}) => clean({
  player: { pos: [-20, 0, 0] }, lanterns: [weak()], shades: [draining()], ...extra,
});
const play = (scenario, ticks = 1, inputs) => runOk({ ticks, snapshotEvery: 1, scenario, inputs });

// §7: schema/scenario, số thực một chữ số, và tương thích mặc định.
test('[P3-7] contract v1.2 có đủ tuning nhiên liệu, ngưỡng thắng, sức chứa và điểm', () => {
  assert.equal(CONTRACT.contract_version, '1.2');
  for (const key of ['fuel_max', 'fuel_decay_per_s', 'fuel_per_mote', 'relight_cost', 'win_ratio',
    'drain_per_s', 'low_fuel_threshold', 'capacity_max', 'night1_duration_s', 'night2_duration_s', 'night3_duration_s']) {
    assert.ok(Number.isFinite(T[key]) && T[key] > 0, `tuning.${key}`);
  }
  for (const key of ['per_mote', 'per_lantern', 'per_relight', 'per_stun', 'per_stun_drain',
    'per_flame_left', 'per_lit_lantern_dawn']) assert.ok(Number.isFinite(S[key]) && S[key] > 0, `score.${key}`);
  assert.equal(S.per_second_left, 0, '§5 bỏ thưởng thời gian');
});

test('[P3-7] snapshot đủ trường v1.2; scenario lit:true không fuel mặc định fuel_max và ever_lit', () => {
  const res = play(clean({ lanterns: [{ id: 'L1', lit: true }] }), 60);
  const s0 = snapAt(res, 0);
  assert.equal(s0.player.capacity, T.carry_capacity, 'đèn scenario không tăng sức chứa');
  for (const key of ['pos', 'vel', 'grounded', 'invuln', 'flames', 'carried', 'dash_cd_s', 'pulse_cd_s', 'charm_s', 'capacity']) {
    assert.ok(Object.hasOwn(s0.player, key), `player.${key}`);
  }
  for (const s of res.snapshots) for (const l of s.lanterns) {
    for (const key of ['id', 'pos', 'lit', 'deposited', 'fuel', 'ever_lit', 'relit_count']) assert.ok(Object.hasOwn(l, key), key);
    assert.equal(typeof l.fuel, 'number');
    assert.equal(Math.round(l.fuel * 10) / 10, l.fuel, 'fuel xuất tối đa 1 chữ số thập phân');
    assert.equal(typeof l.ever_lit, 'boolean');
    assert.ok(Number.isInteger(l.relit_count) && l.relit_count >= 0);
    if (!l.lit) assert.equal(l.fuel, 0);
  }
  assert.equal(lamp(res, 0).fuel, T.fuel_max);
  assert.equal(lamp(res, 0).ever_lit, true);
  assert.equal(lamp(res, 0).relit_count, 0);
  for (const tick of [1, 3, 4, 30, 60]) assert.equal(lamp(res, tick).fuel, roundFuel(T.fuel_max - tick * decay));
  assert.equal(res.end.score, 0);
  assert.equal(res.events.length, 0);
});

// §1: nhiên liệu, châm dầu và thắp lại.
test('[P3-1] hao dầu liên tục; chỉ tắt đúng fuel <= 0, deposited về 0, giữ ever_lit và phát lantern_out một lần', () => {
  const seconds = 1;
  const n = ticksOf(seconds);
  const res = play(clean({ lanterns: [{ id: 'L1', lit: true, fuel: seconds * T.fuel_decay_per_s, deposited: T.lantern_cost }] }), n + 10);
  assert.equal(lamp(res, n - 1).lit, true, 'không quyết định tắt bằng fuel đã làm tròn');
  assert.equal(lamp(res, n).lit, false);
  assert.equal(lamp(res, n).fuel, 0);
  assert.equal(lamp(res, n).deposited, 0);
  assert.equal(lamp(res, n).ever_lit, true);
  assert.equal(lamp(res, n).relit_count, 0);
  assert.deepEqual(eventsNamed(res, 'lantern_out').map((e) => [e.tick, e.data]), [[n, { lantern_id: 'L1' }]]);
});

test('[P3-1/5] châm dầu dùng ceil số thiếu sau hao tick, chặn ở fuel_max, trừ đúng used và cộng điểm nạp', () => {
  const fuel0 = T.fuel_max - 1.5 * T.fuel_per_mote;
  const carried = T.carry_capacity;
  const used = Math.min(carried, Math.ceil((T.fuel_max - (fuel0 - decay)) / T.fuel_per_mote));
  const res = play(clean({ player: { carried }, lanterns: [weak({ pos: [0, 0, 0], fuel: fuel0 })] }), 1, interact);
  assert.deepEqual(eventsNamed(res, 'refuel').map((e) => [e.tick, e.data]), [[1, { lantern_id: 'L1', amount: used, fuel: T.fuel_max }]]);
  assert.equal(snapAt(res, 1).player.carried, carried - used);
  assert.equal(lamp(res, 1).fuel, T.fuel_max);
  assert.equal(res.end.score, used * S.per_mote);
  assert.equal(eventsNamed(res, 'deposit').length, 0);
  assert.equal(eventsNamed(res, 'lantern_lit').length, 0);
  assert.equal(snapAt(res, 1).player.capacity, T.carry_capacity, 'châm dầu không tính successful_lights');
});

test('[P3-1] châm thiếu đom đóm dùng hết đang mang, fuel tăng đúng fuel_per_mote mỗi con', () => {
  const fuel0 = T.low_fuel_threshold / 2;
  const carried = 2;
  const expectedFuel = roundFuel(fuel0 - decay + T.fuel_per_mote * carried);
  const res = play(clean({ player: { carried }, lanterns: [weak({ pos: [0, 0, 0], fuel: fuel0 })] }), 1, interact);
  assert.deepEqual(eventsNamed(res, 'refuel')[0].data, { lantern_id: 'L1', amount: carried, fuel: expectedFuel });
  assert.equal(lamp(res, 1).fuel, expectedFuel);
  assert.equal(snapAt(res, 1).player.carried, 0);
  assert.equal(res.end.score, carried * S.per_mote);
});

test('[P3-1] ceil dùng dầu thật: thiếu đúng một mote ở tick 0 thành cần hai sau bước hao', () => {
  const res = play(clean({ player: { carried: 3 }, lanterns: [weak({ pos: [0, 0, 0], fuel: T.fuel_max - T.fuel_per_mote })] }), 1, interact);
  const used = Math.ceil((T.fuel_per_mote + decay) / T.fuel_per_mote);
  assert.equal(eventsNamed(res, 'refuel')[0].data.amount, used);
  assert.equal(snapAt(res, 1).player.carried, 3 - used);
});

test('[P3-1] đèn bắt đầu đầy đã hao ở bước 2 nên nhận một mote tại bước 5, dù snapshot làm tròn thành đầy', () => {
  const res = play(clean({ player: { carried: 1 }, lanterns: [weak({ pos: [0, 0, 0], fuel: T.fuel_max })] }), 1, interact);
  assert.deepEqual(eventsNamed(res, 'refuel')[0].data, { lantern_id: 'L1', amount: 1, fuel: T.fuel_max });
  assert.equal(res.end.score, S.per_mote);
});

for (const lit of [false, true]) {
  test(`[P3-1] chọn đèn nhận được gần nhất trong bán kính tương tác (ứng viên gần lit=${lit})`, () => {
    const res = play(clean({
      player: { carried: 2 },
      lanterns: [
        { id: 'L1', pos: [T.interact_radius * 0.8, 0, 0], lit: !lit, fuel: T.fuel_max / 2 },
        { id: 'L2', pos: [T.interact_radius * 0.4, 0, 0], lit, fuel: T.fuel_max / 2 },
      ],
    }), 1, interact);
    const actions = res.events.filter((e) => ['refuel', 'deposit'].includes(e.name));
    assert.equal(actions.length, 1);
    assert.equal(actions[0].data.lantern_id, 'L2');
    assert.equal(actions[0].name, lit ? 'refuel' : 'deposit');
  });
}

test('[P3-1] hai đèn nhận được cách bằng nhau chọn id nhỏ, kể cả thứ tự scenario đảo ngược', () => {
  const res = play(clean({
    player: { carried: 1 },
    lanterns: [weak({ id: 'L2', pos: [-1, 0, 0] }), weak({ id: 'L1', pos: [1, 0, 0] })],
  }), 1, interact);
  assert.equal(eventsNamed(res, 'refuel')[0].data.lantern_id, 'L1');
});

test('[P3-1] carried=0: không refuel/deposit, không sự kiện hay điểm dù đèn cần dầu', () => {
  const res = play(clean({ lanterns: [weak({ pos: [0, 0, 0] })] }), 1, interact);
  assert.equal(res.events.length, 0);
  assert.equal(res.end.score, 0);
  assert.equal(lamp(res, 1).fuel, roundFuel(T.low_fuel_threshold - 1 - decay));
});

test('[P3-1] used=0 ở đèn đầy và túi rỗng: không chọn đèn, không sự kiện, không điểm', () => {
  const res = play(clean({ lanterns: [weak({ pos: [0, 0, 0], fuel: T.fuel_max })] }), 1, interact);
  assert.equal(lamp(res, 0).fuel, T.fuel_max);
  assert.equal(res.events.length, 0);
  assert.equal(res.end.score, 0);
  assert.equal(snapAt(res, 1).player.carried, 0);
});

test('[P3-1/4/5/7] thắp lần đầu cần lantern_cost, fuel_max, relight:false, tăng capacity và điểm nạp + thắp', () => {
  const res = play(clean({ player: { carried: T.lantern_cost }, lanterns: [{ id: 'L1', pos: [0, 0, 0] }] }), 1, interact);
  assert.deepEqual(eventsNamed(res, 'lantern_lit')[0].data, { lantern_id: 'L1', relight: false });
  assert.equal(lamp(res, 1).deposited, T.lantern_cost);
  assert.equal(lamp(res, 1).fuel, T.fuel_max);
  assert.equal(lamp(res, 1).ever_lit, true);
  assert.equal(lamp(res, 1).relit_count, 0);
  assert.equal(snapAt(res, 1).player.capacity, capacity(1));
  assert.equal(res.end.score, T.lantern_cost * S.per_mote + S.per_lantern);
});

test('[P3-1/4/5/7] đèn ever_lit thắp lại với relight_cost, relight:true, relit_count tăng, giữ phần đom đóm dư', () => {
  const res = play(clean({ player: { carried: T.relight_cost + 2 }, lanterns: [{ id: 'L1', pos: [0, 0, 0], ever_lit: true }] }), 1, interact);
  assert.deepEqual(eventsNamed(res, 'deposit')[0].data, { lantern_id: 'L1', amount: T.relight_cost, deposited: T.relight_cost });
  assert.deepEqual(eventsNamed(res, 'lantern_lit')[0].data, { lantern_id: 'L1', relight: true });
  assert.equal(lamp(res, 1).fuel, T.fuel_max);
  assert.equal(lamp(res, 1).ever_lit, true);
  assert.equal(lamp(res, 1).relit_count, 1);
  assert.equal(snapAt(res, 1).player.carried, 2);
  assert.equal(snapAt(res, 1).player.capacity, capacity(1));
  assert.equal(res.end.score, T.relight_cost * S.per_mote + S.per_relight);
});

test('[P3-1/4] nạp dở đèn ever_lit và đèn chưa sáng lần nào đều không tăng capacity hay nhận điểm thắp', () => {
  for (const ever_lit of [false, true]) {
    const cost = ever_lit ? T.relight_cost : T.lantern_cost;
    const res = play(clean({ player: { carried: cost - 1 }, lanterns: [{ id: 'L1', pos: [0, 0, 0], ever_lit }] }), 1, interact);
    assert.equal(lamp(res, 1).lit, false);
    assert.equal(lamp(res, 1).deposited, cost - 1);
    assert.equal(lamp(res, 1).fuel, 0);
    assert.equal(lamp(res, 1).relit_count, 0);
    assert.equal(snapAt(res, 1).player.capacity, capacity(0));
    assert.equal(res.end.score, (cost - 1) * S.per_mote);
    assert.equal(eventsNamed(res, 'lantern_lit').length, 0);
  }
});

test('[P3-1/3] dầu hết ở bước 2 có thể thắp lại ngay bước 5, bỏ deposited cũ và giữ ever_lit', () => {
  const res = play(clean({
    player: { carried: T.relight_cost },
    lanterns: [weak({ pos: [0, 0, 0], fuel: decay, deposited: T.lantern_cost })],
  }), 1, interact);
  assert.deepEqual(res.events.map((e) => e.name), ['lantern_out', 'deposit', 'lantern_lit']);
  assert.equal(eventsNamed(res, 'deposit')[0].data.amount, T.relight_cost);
  assert.equal(lamp(res, 1).deposited, T.relight_cost);
  assert.equal(lamp(res, 1).relit_count, 1);
  assert.equal(lamp(res, 1).fuel, T.fuel_max);
  assert.equal(snapAt(res, 1).player.capacity, capacity(1));
  assert.equal(res.end.score, T.relight_cost * S.per_mote + S.per_relight);
});

test('[P3-1/4/5] cùng một đèn tắt rồi thắp lại hai lần: relit_count và successful_lights cùng cộng dồn', () => {
  const outTick = 1 + ticksOf(T.fuel_max / T.fuel_decay_per_s);
  const res = runOk({ ticks: outTick, snapshotEvery: outTick, scenario: clean({
    player: { carried: 2 * T.relight_cost },
    lanterns: [weak({ pos: [0, 0, 0], fuel: decay })],
  }), inputs: frames(
    { tick: 0, interact: true }, { tick: 1, interact: false },
    { tick: outTick - 1, interact: true },
  ) });
  assert.deepEqual(eventsNamed(res, 'lantern_out').map((e) => e.tick), [1, outTick]);
  assert.deepEqual(eventsNamed(res, 'lantern_lit').map((e) => [e.tick, e.data]), [
    [1, { lantern_id: 'L1', relight: true }], [outTick, { lantern_id: 'L1', relight: true }],
  ]);
  assert.equal(lamp(res, outTick).relit_count, 2);
  assert.equal(lamp(res, outTick).fuel, T.fuel_max);
  assert.equal(lamp(res, outTick).deposited, T.relight_cost);
  assert.equal(snapAt(res, outTick).player.carried, 0);
  assert.equal(snapAt(res, outTick).player.capacity, capacity(2));
  assert.equal(res.end.score, 2 * (T.relight_cost * S.per_mote + S.per_relight));
  assertScoreConsistent(res);
});

// §2: ngưỡng an toàn, chọn mục tiêu, drain cộng dồn và chuyển trạng thái.
test('[P3-2] đúng fuel=threshold còn vùng an toàn; tick sau dưới ngưỡng mất vùng dù fuel xuất vẫn làm tròn bằng threshold', () => {
  const res = play(clean({
    lanterns: [weak({ pos: [0, 0, 0], fuel: T.low_fuel_threshold + decay })],
    shades: [{ pos: [T.safe_radius + 0.01, 0, 0], state: 'chase' }],
  }), 2);
  assert.equal(lamp(res, 1).fuel, T.low_fuel_threshold);
  assert.ok(distXZ(shade(res, 1).pos, [0, 0, 0]) >= T.safe_radius - 0.002);
  assert.ok(distXZ(shade(res, 2).pos, [0, 0, 0]) < T.safe_radius - 0.02);
});

test('[P3-2] đèn sáng fuel<threshold cho Bóng chase đi vào vùng 6 m và gây hit', () => {
  const res = play(clean({
    player: { flames: T.flames + 10 },
    lanterns: [weak({ pos: [0, 0, 0] })],
    shades: [{ pos: [T.safe_radius + 0.1, 0, 0], state: 'chase' }],
  }), 100);
  assert.ok(res.snapshots.some((s) => distXZ(s.shades[0].pos, [0, 0, 0]) < T.safe_radius - 1));
  assert.ok(eventsNamed(res, 'player_hit').length > 0);
});

test('[P3-2] wander ưu tiên đèn yếu gần nhất hơn đèn tắt gần hơn, đi 1.5m/s rồi drain đứng yên trong 2 m', () => {
  const target = [12, 0, 0];
  const res = play(clean({
    player: { pos: [-20, 0, 0] },
    lanterns: [weak({ pos: target }), weak({ id: 'L2', pos: [0, 0, 0] }), { id: 'L3', pos: [15, 0, 0] }],
    shades: [{ pos: [15, 0, 0], state: 'wander' }],
  }), 120);
  assert.equal(shade(res, 20).state, 'wander');
  assert.ok(Math.abs(shade(res, 20).pos[0] - (15 - 1.5 * 20 / 60)) <= 0.003, 'ADR: wander 1.5m/s về đèn yếu gần nhất');
  assert.equal(shade(res, 60).state, 'drain');
  assert.ok(distXZ(shade(res, 60).pos, target) <= 2.003);
  assert.deepEqual(shade(res, 60).pos, shade(res, 120).pos, 'drain đứng yên');
  assert.equal(lamp(res, 120).fuel, roundFuel(lamp(res, 60).fuel - T.fuel_decay_per_s - T.drain_per_s));
});

test('[P3-2] wander chọn đèn yếu cách bằng nhau theo id nhỏ hơn', () => {
  const res = play(clean({
    player: { pos: [-20, 0, 0] },
    lanterns: [weak({ id: 'L2', pos: [12, 0, 1] }), weak({ id: 'L1', pos: [12, 0, -1] })],
    shades: [{ pos: [15, 0, 0], state: 'wander' }],
  }), 20);
  assert.ok(shade(res, 20).pos[2] < 0, 'đi về L1 ở z<0');
  assert.equal(shade(res, 20).state, 'wander');
});

test('[P3-2] không có đèn yếu: wander chọn đèn tắt gần nhất theo ADR', () => {
  const res = play(clean({
    player: { pos: [-20, 0, 0] },
    lanterns: [{ id: 'L1', pos: [12, 0, 0] }, { id: 'L2', pos: [25, 0, 0] }],
    shades: [{ pos: [15, 0, 0], state: 'wander' }],
  }), 20);
  assert.equal(shade(res, 20).state, 'wander');
  assert.ok(Math.abs(shade(res, 20).pos[0] - 14.5) <= 0.003);
});

test('[P3-2] Bóng đang chase giữ đuổi Mây, không chuyển mục tiêu sang đèn yếu ở ngay cạnh', () => {
  const res = play(clean({ lanterns: [weak()], shades: [{ pos: [10, 0, 0], state: 'chase' }] }), 2);
  assert.equal(shade(res, 1).state, 'chase');
  assert.ok(shade(res, 1).pos[0] < 10);
  assert.equal(lamp(res, 2).fuel, roundFuel(T.low_fuel_threshold - 1 - 2 * decay), 'chase không hút dầu');
});

for (const count of [1, 2]) {
  test(`[P3-2/7] ${count} Bóng drain cộng dồn với hao tự nhiên, fuel_drain mỗi 60 tick riêng từng con`, () => {
    const fuel0 = T.low_fuel_threshold - 1;
    const res = play(drainScenario({ shades: Array.from({ length: count }, (_, i) => draining({ id: `S${i + 1}` })) }), 120);
    for (const tick of [1, 30, 60, 120]) {
      assert.equal(lamp(res, tick).fuel, roundFuel(fuel0 - tick * (decay + count * drain)), `fuel tick ${tick}`);
      assert.ok(snapAt(res, tick).shades.every((s) => s.state === 'drain'));
    }
    const ev = eventsNamed(res, 'fuel_drain');
    assert.equal(ev.length, 2 * count);
    for (const tick of [60, 120]) {
      assert.deepEqual(ev.filter((e) => e.tick === tick).map((e) => e.data.shade_id).sort(), Array.from({ length: count }, (_, i) => `S${i + 1}`));
      for (const e of ev.filter((e) => e.tick === tick)) {
        assert.deepEqual(Object.keys(e.data).sort(), ['lantern_id', 'shade_id', 'fuel'].sort());
        assert.equal(e.data.lantern_id, 'L1');
        assert.equal(e.data.fuel, roundFuel(fuel0 - tick * (decay + count * drain)));
      }
    }
    assert.deepEqual(shade(res, 0).pos, shade(res, 120).pos);
  });
}

test('[P3-2/7] bộ đếm fuel_drain bắt đầu khi vào drain, không theo tick toàn cục', () => {
  const res = play(clean({
    player: { pos: [-20, 0, 0] }, lanterns: [weak({ pos: [12, 0, 0] })],
    shades: [{ pos: [15, 0, 0], state: 'wander' }],
  }), 170);
  const entered = res.snapshots.find((s) => s.shades[0].state === 'drain');
  assert.ok(entered && entered.tick > 0);
  assert.deepEqual(eventsNamed(res, 'fuel_drain').map((e) => e.tick), [entered.tick + 60, entered.tick + 120]);
});

for (const distance of [6, 6.1]) {
  test(`[P3-2] drain -> chase ở XZ <=6, giữ drain khi >6 (khoảng cách ${distance})`, () => {
    const res = play(drainScenario({ player: { pos: [10 - distance, 0, 0] } }), 1);
    assert.equal(shade(res, 1).state, distance <= 6 ? 'chase' : 'drain');
    assert.equal(lamp(res, 1).fuel, roundFuel(T.low_fuel_threshold - 1 - decay - drain), 'bước 2 hút trước chuyển trạng thái');
  });
}

test('[P3-2] drain -> wander khi đèn tắt vì hết dầu', () => {
  const res = play(drainScenario({ lanterns: [weak({ fuel: decay + drain })] }), 1);
  assert.equal(lamp(res, 1).lit, false);
  assert.equal(shade(res, 1).state, 'wander');
  assert.equal(eventsNamed(res, 'lantern_out').length, 1);
});

test('[P3-2] drain -> wander nếu cách đèn >2 m', () => {
  const res = play(drainScenario({ shades: [draining({ pos: [12.1, 0, 0] })] }), 1);
  assert.equal(shade(res, 1).state, 'wander');
});

test('[P3-2] drain -> wander nếu đèn đã được châm lên threshold, Bóng trong vùng bị đuổi ra trong 30 tick và không gây hit', () => {
  const target = [0, 0, 0];
  const res = play(clean({
    player: { carried: 1 }, lanterns: [weak({ pos: target })],
    shades: [draining({ pos: [0.5, 0, 0] })],
  }), 60, interact);
  assert.ok(eventsNamed(res, 'refuel')[0].data.fuel >= T.low_fuel_threshold);
  assert.equal(shade(res, 1).state, 'wander');
  assert.equal(eventsNamed(res, 'player_hit').length, 0);
  for (let tick = 2; tick <= 30; tick++) {
    assert.ok(distXZ(shade(res, tick).pos, target) >= distXZ(shade(res, tick - 1).pos, target) - 0.003);
  }
  assert.ok(distXZ(shade(res, 31).pos, target) >= T.safe_radius - 0.003);
  assert.ok(distXZ(shade(res, 15).pos, target) < T.safe_radius - 0.1, 'thực sự đẩy dần');
});

test('[P3-2/5] pulse drain -> stunned, +per_stun_drain/con; con chase +per_stun, dừng hút và hết choáng về wander', () => {
  const res = play(clean({
    player: { carried: T.pulse_cost },
    lanterns: [weak({ pos: [3, 0, 0] })],
    shades: [draining({ pos: [3, 0, 0] }), { id: 'S2', pos: [-3, 0, 0], state: 'chase' }],
  }), ticksOf(T.pulse_stun_s) + 5, pulse);
  assert.deepEqual(eventsNamed(res, 'pulse')[0].data.stunned_ids, ['S1', 'S2']);
  assert.equal(shade(res, 1).state, 'stunned');
  assert.equal(shade(res, 1, 'S2').state, 'stunned');
  assert.equal(res.end.score, S.per_stun_drain + S.per_stun);
  assertScoreConsistent(res, { drainingAtPulse: { 1: ['S1'] } });
  assert.equal(lamp(res, 60).fuel, roundFuel(T.low_fuel_threshold - 1 - 60 * decay - drain));
  const expired = res.snapshots.find((s) => s.tick > 1 && s.shades[0].state !== 'stunned');
  assert.ok(expired);
  assert.equal(expired.shades[0].state, 'wander');
  assert.equal(eventsNamed(res, 'fuel_drain').length, 0);
});

test('[P3-1/2/5] châm dầu dùng hết túi ở bước 5: pulse bước 7 không kích hoạt, Bóng drain bị đuổi', () => {
  const carried = T.pulse_cost + 1;
  const res = play(clean({
    player: { carried }, lanterns: [weak({ pos: [0, 0, 0] })],
    shades: [draining({ pos: [0.5, 0, 0] })],
  }), 1, frames({ tick: 0, interact: true, pulse: true }));
  assert.deepEqual(res.events.map((e) => e.name), ['refuel']);
  assert.equal(eventsNamed(res, 'refuel')[0].data.amount, carried);
  assert.equal(shade(res, 1).state, 'wander');
  assert.equal(res.end.score, carried * S.per_mote);
  assert.equal(snapAt(res, 1).player.carried, 0);
  assert.equal(snapAt(res, 1).player.pulse_cd_s, 0);
  assert.equal(eventsNamed(res, 'player_hit').length, 0);
  assertScoreConsistent(res);
});

test('[P3-1/2] pause đóng băng cả hao dầu, drain và bộ đếm fuel_drain', () => {
  const res = play(drainScenario(), 100, frames({ tick: 0, pause: true }, { tick: 1, pause: false }));
  assert.equal(snapAt(res, 100).state, 'paused');
  assert.equal(snapAt(res, 100).sim_tick, 0);
  assert.equal(lamp(res, 100).fuel, T.low_fuel_threshold - 1);
  assert.equal(eventsNamed(res, 'fuel_drain').length, 0);
});

// §3/§5: ngưỡng thắng tại tick cuối, ưu tiên no_flames và thưởng bình minh.
for (const night of [1, 2, 3]) {
  const total = LANTERNS[night].length;
  const required = Math.ceil(T.win_ratio * total);
  for (const litCount of [required - 1, required]) {
    test(`[P3-3/5] Đêm ${night}: bình minh ${litCount}/${total} đèn -> ${litCount >= required ? 'dawn_survived' : 'dawn'} (ngưỡng ${required})`, () => {
      const fuel0 = T.fuel_max - 0.5;
      const flames = T.flames;
      const res = runOk({ night, ticks: 5, snapshotEvery: 1, scenario: scenN(night, {
        time_left_s: 1 / 60,
        lanterns: Array.from({ length: litCount }, (_, i) => ({ id: `L${i + 1}`, lit: true, fuel: fuel0 })),
      }) });
      const won = litCount >= required;
      assert.deepEqual(go(res).map((e) => [e.tick, e.data]), [[1, { result: won ? 'won' : 'lost', reason: won ? 'dawn_survived' : 'dawn' }]]);
      assert.equal(res.end.ticks, 1);
      assert.equal(res.end.state, won ? 'won' : 'lost');
      const expected = won ? litCount * (S.per_lit_lantern_dawn + Math.floor(fuel0 - decay)) + flames * S.per_flame_left : 0;
      assert.equal(res.end.score, expected, 'chỉ thưởng khi thắng; không thưởng thời gian');
    });
  }

  test(`[P3-3/7] Đêm ${night}: thời lượng mới từ tuning, không thắng sớm cả khi mọi đèn lit`, () => {
    const res = runOk({ night, ticks: 2, snapshotEvery: 1, scenario: scenN(night, {
      lanterns: LANTERNS[night].map((_, i) => ({ id: `L${i + 1}`, lit: true })),
    }) });
    assert.equal(snapAt(res, 0).time_left_s, DURATION_S[night]);
    assert.equal(res.end.state, 'playing');
    assert.equal(res.end.ticks, 2);
    assert.equal(go(res).length, 0);
    assert.equal(res.end.score, 0, 'scenario không có điểm thắp hay thưởng sớm');
  });
}

test('[P3-3/5] tick bình minh vẫn xét hit trước thắng: mất lửa cuối -> no_flames, không cộng thưởng', () => {
  const count = Math.ceil(T.win_ratio * LANTERNS[1].length);
  const res = play(clean({
    time_left_s: 1 / 60, player: { flames: 1 },
    lanterns: Array.from({ length: count }, (_, i) => ({ id: `L${i + 1}`, lit: true })),
    shades: [{ pos: [0.5, 0, 0], state: 'chase' }],
  }), 10);
  assert.deepEqual(res.events.map((e) => e.name), ['player_hit', 'game_over']);
  assert.deepEqual(go(res)[0].data, { result: 'lost', reason: 'no_flames' });
  assert.equal(res.end.ticks, 1);
  assert.equal(res.end.score, 0);
});

test('[P3-3] đèn hết dầu ở tick bình minh không được tính vào ngưỡng thắng', () => {
  const required = Math.ceil(T.win_ratio * LANTERNS[1].length);
  const res = play(clean({
    time_left_s: 1 / 60,
    lanterns: Array.from({ length: required }, (_, i) => ({ id: `L${i + 1}`, lit: true, fuel: i === 0 ? decay : T.fuel_max })),
  }), 10);
  assert.deepEqual(res.events.map((e) => e.name), ['lantern_out', 'game_over']);
  assert.deepEqual(go(res)[0].data, { result: 'lost', reason: 'dawn' });
});

test('[P3-3] thắp đủ ngưỡng ngay tick bình minh được tính sau mọi cập nhật của tick', () => {
  const required = Math.ceil(T.win_ratio * LANTERNS[1].length);
  const res = play(clean({
    time_left_s: 1 / 60, player: { carried: T.lantern_cost },
    lanterns: [
      { id: 'L1', pos: [0, 0, 0] },
      ...Array.from({ length: required - 1 }, (_, i) => ({ id: `L${i + 2}`, lit: true })),
    ],
  }), 10, interact);
  assert.deepEqual(res.events.map((e) => e.name), ['deposit', 'lantern_lit', 'game_over']);
  assert.deepEqual(go(res)[0].data, { result: 'won', reason: 'dawn_survived' });
});

test('[P3-5] thưởng floor(fuel) lấy dầu thật trước làm tròn snapshot; mỗi đèn và mỗi lửa được tính riêng', () => {
  const required = Math.ceil(T.win_ratio * LANTERNS[1].length);
  const fuels = Array.from({ length: required }, (_, i) => T.fuel_max - i * 0.5);
  const flames = T.flames - 1;
  const res = play(clean({
    time_left_s: 1 / 60, player: { flames },
    lanterns: fuels.map((fuel, i) => ({ id: `L${i + 1}`, lit: true, fuel })),
  }), 1);
  assert.equal(lamp(res, 1).fuel, T.fuel_max, '99.983... có thể xuất 100.0');
  const expected = fuels.reduce((sum, fuel) => sum + S.per_lit_lantern_dawn + Math.floor(fuel - decay), 0)
    + flames * S.per_flame_left;
  assert.equal(res.end.score, expected);
});

// §4: số lần thắp thực, scenario, trần và khả năng nhặt sau tăng sức chứa.
test('[P3-4] tăng sức chứa sau thắp thật cho phép nhặt vượt carry_capacity ở tick kế tiếp', () => {
  const res = play(clean({
    player: { carried: T.carry_capacity },
    lanterns: [{ id: 'L1', pos: [0, 0, 0], deposited: T.lantern_cost - 1 }],
    motes: Array.from({ length: capacity(1) - T.carry_capacity + 2 }, () => [0, 0, 0]),
  }), 2, interact);
  assert.equal(snapAt(res, 1).player.carried, T.carry_capacity - 1, 'nhặt ở bước 4 trước khi tăng capacity bước 5');
  assert.equal(snapAt(res, 1).motes.length, capacity(1) - T.carry_capacity + 2);
  assert.equal(snapAt(res, 1).player.capacity, capacity(1));
  assert.equal(snapAt(res, 2).player.carried, capacity(1));
  assert.equal(snapAt(res, 2).motes.length, 1);
  assert.equal(eventsNamed(res, 'mote_picked').length, capacity(1) - T.carry_capacity + 1);
  assert.equal(res.end.score, S.per_mote + S.per_lantern);
});

for (const k of [0, 1, 2, 4, 5, 6, 20]) {
  test(`[P3-4/7] successful_lights=${k}: capacity=min(capacity_max, carry_capacity+2k), nhặt chỉ tới trần`, () => {
    const cap = capacity(k);
    const res = play(clean({
      player: { successful_lights: k, carried: cap - 1 },
      lanterns: LANTERNS[1].map((_, i) => ({ id: `L${i + 1}`, lit: true })),
      motes: [[0, 0, 0], [0, 0, 0]],
    }), 1);
    assert.equal(snapAt(res, 0).player.capacity, cap);
    assert.equal(snapAt(res, 1).player.capacity, cap, 'đèn scenario không tính thêm lần thắp');
    assert.equal(snapAt(res, 1).player.carried, cap);
    assert.equal(eventsNamed(res, 'mote_picked').length, 1);
    assert.equal(snapAt(res, 1).motes.length, 1);
    assert.equal(res.end.score, 0, 'không cộng điểm nhặt hay đèn scenario');
  });
}

test('[P3-4] thắp thật ở trần vẫn giữ capacity_max; ván mới bắt đầu lại sức chứa cơ bản', () => {
  const k = Math.ceil((T.capacity_max - T.carry_capacity) / 2);
  const res = play(clean({
    player: { carried: T.lantern_cost, successful_lights: k },
    lanterns: [{ id: 'L1', pos: [0, 0, 0] }],
  }), 1, interact);
  assert.equal(snapAt(res, 1).player.capacity, T.capacity_max);
  for (const night of [1, 2, 3]) {
    const fresh = runOk({ night, ticks: 0, scenario: scenN(night) });
    assert.deepEqual(snapAt(fresh, 0).player.pos, START[night]);
    assert.equal(snapAt(fresh, 0).player.capacity, T.carry_capacity);
  }
});
