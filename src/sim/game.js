import { mulberry32 } from './rng.js';
import { ISLAND_RADIUS, LANTERN_POSITIONS, SHADE_Y } from './world.js';

const TICKS_PER_SECOND = 60;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isCount = (value) => Number.isInteger(value) && value >= 0;
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isVector = (value, length) => Array.isArray(value)
  && value.length === length && Array.from(value).every(isNumber);
const rounded = (value) => Math.round(value * 1000) / 1000 || 0;
const roundedPos = (pos) => pos.map(rounded);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const secondsToTicks = (seconds) => Math.round(seconds * TICKS_PER_SECOND);

// Numeric suffixes sort numerically (S2 precedes S10), independent of locale.
function compareIds(a, b) {
  const left = /^(.*?)(\d+)$/.exec(a.id);
  const right = /^(.*?)(\d+)$/.exec(b.id);
  if (left && right && left[1] === right[1]) {
    const difference = Number(left[2]) - Number(right[2]);
    if (difference) return difference;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function formatError(message) {
  const error = new Error(message);
  error.code = 2;
  throw error;
}

function validateFields(object, fields, predicate, description, path) {
  for (const field of fields) {
    if (has(object, field) && !predicate(object[field])) {
      formatError(`${path}.${field} ${description}`);
    }
  }
}

export function validateInputs(object) {
  if (!isObject(object) || !Array.isArray(object.frames)) {
    formatError('inputs.frames must be an array');
  }
  let previousTick = -1;
  for (const [index, frame] of object.frames.entries()) {
    const path = `inputs.frames[${index}]`;
    if (!isObject(frame)) formatError(`${path} must be an object`);
    if (!isCount(frame.tick) || frame.tick <= previousTick) {
      formatError(`${path}.tick must be a nonnegative integer, strictly increasing`);
    }
    previousTick = frame.tick;
    if (has(frame, 'move') && (!isVector(frame.move, 2)
      || frame.move.some((value) => value < -1 || value > 1))) {
      formatError(`${path}.move must contain two numbers in [-1, 1]`);
    }
    validateFields(frame, ['cam_yaw_deg'], isNumber, 'must be a finite number', path);
    validateFields(frame, ['jump', 'interact', 'pulse', 'dash'],
      (value) => typeof value === 'boolean', 'must be boolean', path);
  }
  return object;
}

export function validateScenario(object) {
  if (!isObject(object)) formatError('scenario must be an object');
  validateFields(object, ['random_motes', 'random_shades'],
    (value) => typeof value === 'boolean', 'must be boolean', 'scenario');
  validateFields(object, ['time_left_s'], (value) => isNumber(value) && value > 0,
    'must be a positive finite number', 'scenario');
  if (has(object, 'player')) {
    if (!isObject(object.player)) formatError('scenario.player must be an object');
    validateFields(object.player, ['pos'], (value) => isVector(value, 3),
      'must contain three finite numbers', 'scenario.player');
    validateFields(object.player, ['carried', 'flames'], isCount,
      'must be a nonnegative integer', 'scenario.player');
  }
  if (has(object, 'motes') && (!Array.isArray(object.motes)
    || !Array.from(object.motes).every((pos) => isVector(pos, 3)))) {
    formatError('scenario.motes must be an array of three-number positions');
  }
  if (has(object, 'shades')) {
    if (!Array.isArray(object.shades)) formatError('scenario.shades must be an array');
    const ids = new Set();
    for (const [index, shade] of object.shades.entries()) {
      if (!isObject(shade) || !isVector(shade.pos, 3)) {
        formatError(`scenario.shades[${index}] must be an object with a three-number pos`);
      }
      if (has(shade, 'id')) {
        if (typeof shade.id !== 'string' || shade.id.length === 0 || ids.has(shade.id)) {
          formatError(`scenario.shades[${index}].id must be a unique nonempty string`);
        }
        ids.add(shade.id);
      }
    }
  }
  if (has(object, 'lanterns')) {
    if (!Array.isArray(object.lanterns)) formatError('scenario.lanterns must be an array');
    const lanternIds = new Set(LANTERN_POSITIONS.map((_, index) => `L${index + 1}`));
    for (const [index, lantern] of object.lanterns.entries()) {
      const path = `scenario.lanterns[${index}]`;
      if (!isObject(lantern) || !lanternIds.has(lantern.id)) {
        formatError(`${path}.id must be one of L1..L5`);
      }
      validateFields(lantern, ['pos'], (value) => isVector(value, 3),
        'must contain three finite numbers', path);
      validateFields(lantern, ['deposited'], isCount, 'must be a nonnegative integer', path);
      validateFields(lantern, ['lit'], (value) => typeof value === 'boolean',
        'must be boolean', path);
    }
  }
  return object;
}

function clampToIsland(pos) {
  const radius = Math.hypot(pos[0], pos[2]);
  if (radius > ISLAND_RADIUS) {
    pos[0] *= ISLAND_RADIUS / radius;
    pos[2] *= ISLAND_RADIUS / radius;
  }
}

function pushFrom(pos, origin, amount) {
  const separation = distance(pos, origin);
  const dx = separation === 0 ? 1 : (pos[0] - origin[0]) / separation;
  const dz = separation === 0 ? 0 : (pos[2] - origin[2]) / separation;
  pos[0] += dx * amount;
  pos[2] += dz * amount;
}

export function createGame({ seed, tuning, scenario }) {
  if (scenario !== undefined) validateScenario(scenario);
  const setup = scenario ?? {};
  const random = mulberry32(seed >>> 0);
  const randomMotes = setup.random_motes ?? true;
  const randomShades = setup.random_shades ?? true;
  const player = {
    pos: [...(setup.player?.pos ?? [0, 0, 0])],
    flames: setup.player?.flames ?? tuning.flames,
    carried: setup.player?.carried ?? 0,
  };
  const lanterns = LANTERN_POSITIONS.map((pos, index) => ({
    id: `L${index + 1}`, pos: [...pos], lit: false, deposited: 0,
  }));
  for (const override of setup.lanterns ?? []) {
    const lantern = lanterns.find(({ id }) => id === override.id);
    if (has(override, 'pos')) lantern.pos = [...override.pos];
    if (has(override, 'lit')) lantern.lit = override.lit;
    if (has(override, 'deposited')) lantern.deposited = override.deposited;
  }

  let nextMoteId = 1;
  let nextShadeId = 1;
  let motes = [];
  const shades = [];
  let steps = 0;
  let state = 'playing';
  let score = 0;
  const initialTime = setup.time_left_s ?? tuning.night1_duration_s;
  let timeLeft = initialTime;
  let verticalSpeed = 0;
  let invuln = 0;
  let pulseCooldown = 0;
  const controls = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false };

  function spawnMote() {
    let pos;
    do {
      const radius = 3 + 35 * Math.sqrt(random());
      const angle = 2 * Math.PI * random();
      pos = [radius * Math.sin(angle), 0, radius * Math.cos(angle)];
    } while (lanterns.some((lantern) => distance(pos, lantern.pos) < 3));
    motes.push({ id: `M${nextMoteId++}`, pos: roundedPos(pos) });
  }

  function spawnShade() {
    let pos;
    // One first draw, then at most ten retries; keep the last draw if all fail.
    for (let attempt = 0; attempt <= 10; attempt += 1) {
      const angle = 2 * Math.PI * random();
      pos = [35 * Math.sin(angle), SHADE_Y, 35 * Math.cos(angle)];
      if (distance(pos, player.pos) >= 15 && !lanterns.some((lantern) =>
        lantern.lit && distance(pos, lantern.pos) < tuning.safe_radius)) break;
    }
    const shade = { id: `S${nextShadeId++}`, pos, state: 'chase', stunTicks: 0 };
    shades.push(shade);
    shades.sort(compareIds);
    return shade;
  }

  if (has(setup, 'motes')) {
    motes = setup.motes.map((pos) => ({ id: `M${nextMoteId++}`, pos: [pos[0], 0, pos[2]] }));
  } else if (randomMotes) {
    for (let i = 0; i < 20; i += 1) spawnMote();
  }
  if (has(setup, 'shades')) {
    const usedIds = new Set(setup.shades.filter((shade) => has(shade, 'id')).map((shade) => shade.id));
    let autoId = 1;
    for (const entry of setup.shades) {
      let id = entry.id;
      if (id === undefined) {
        while (usedIds.has(`S${autoId}`)) autoId += 1;
        id = `S${autoId++}`;
        usedIds.add(id);
      }
      const suffix = /^S(\d+)$/.exec(id);
      if (suffix) nextShadeId = Math.max(nextShadeId, Number(suffix[1]) + 1);
      shades.push({ id, pos: [entry.pos[0], SHADE_Y, entry.pos[2]], state: 'chase', stunTicks: 0 });
    }
    shades.sort(compareIds);
  } else if (randomShades) {
    for (let i = 0; i < 2; i += 1) spawnShade();
  }

  function step(input = {}) {
    if (state !== 'playing') return [];
    const tick = steps + 1;
    const events = [];
    const emit = (name, data) => events.push({ type: 'event', tick, name, data });

    // 1. Apply held input and detect rising edges.
    const edges = {};
    for (const button of ['jump', 'interact', 'pulse']) {
      const pressed = input[button] ?? controls[button];
      edges[button] = pressed && !controls[button];
      controls[button] = pressed;
    }
    if (input.move !== undefined) controls.move = [...input.move];
    if (input.cam_yaw_deg !== undefined) controls.cam_yaw_deg = input.cam_yaw_deg;

    // 2. Timers.
    if (invuln > 0) invuln -= 1;
    if (pulseCooldown > 0) pulseCooldown -= 1;

    // 3. Movement, normalized before rotating into world coordinates.
    let [x, z] = controls.move;
    const length = Math.hypot(x, z);
    if (length > 1) { x /= length; z /= length; }
    const yaw = (controls.cam_yaw_deg * Math.PI) / 180;
    const speed = tuning.player_speed / TICKS_PER_SECOND;
    player.pos[0] += (x * Math.cos(yaw) + z * Math.sin(yaw)) * speed;
    player.pos[2] += (-x * Math.sin(yaw) + z * Math.cos(yaw)) * speed;
    clampToIsland(player.pos);

    // 4. Jump; only horizontal distances affect gameplay interactions.
    if (edges.jump && player.pos[1] === 0) verticalSpeed = 7.0;
    player.pos[1] += verticalSpeed / TICKS_PER_SECOND;
    verticalSpeed -= 20 / TICKS_PER_SECOND;
    if (player.pos[1] <= 0) { player.pos[1] = 0; verticalSpeed = 0; }

    // 5. Pickup, in ascending id order.
    motes = motes.filter((mote) => {
      if (player.carried < tuning.carry_capacity && distance(player.pos, mote.pos) <= tuning.pickup_radius) {
        player.carried += 1;
        score += tuning.score.per_mote;
        emit('mote_picked', { carried: player.carried });
        return false;
      }
      return true;
    });

    // 6. Deposit into the nearest unlit lantern, with id as the tie breaker.
    if (edges.interact) {
      let closest;
      let nearest = Infinity;
      for (const lantern of lanterns) {
        const separation = distance(player.pos, lantern.pos);
        if (!lantern.lit && separation <= tuning.interact_radius && separation < nearest) {
          closest = lantern;
          nearest = separation;
        }
      }
      if (closest) {
        const amount = Math.min(player.carried, tuning.lantern_cost - closest.deposited);
        if (amount > 0) {
          player.carried -= amount;
          closest.deposited += amount;
          emit('deposit', { lantern_id: closest.id, amount, deposited: closest.deposited });
          if (closest.deposited >= tuning.lantern_cost) {
            closest.lit = true;
            score += tuning.score.per_lantern;
            emit('lantern_lit', { lantern_id: closest.id });
          }
        }
      }
    }

    // 7. Pulse; a new pulse also resets the timer of already stunned shades.
    if (edges.pulse && pulseCooldown === 0 && player.carried >= tuning.pulse_cost) {
      player.carried -= tuning.pulse_cost;
      pulseCooldown = secondsToTicks(tuning.pulse_cooldown_s);
      const stunnedIds = [];
      for (const shade of shades) {
        if (distance(player.pos, shade.pos) <= tuning.pulse_radius) {
          shade.state = 'stunned';
          shade.stunTicks = secondsToTicks(tuning.pulse_stun_s);
          pushFrom(shade.pos, player.pos, tuning.pulse_push_m);
          score += tuning.score.per_stun;
          stunnedIds.push(shade.id);
        }
      }
      emit('pulse', { stunned_ids: stunnedIds });
    }

    // 8. Shade movement. A stun expiring here does not move until next step.
    for (const shade of shades) {
      if (shade.state === 'stunned') {
        shade.stunTicks = Math.max(0, shade.stunTicks - 1);
        if (shade.stunTicks === 0) shade.state = 'chase';
      } else {
        const separation = distance(shade.pos, player.pos);
        if (separation > 0) {
          const travel = Math.min(separation, tuning.shade_speed / TICKS_PER_SECOND);
          shade.pos[0] += ((player.pos[0] - shade.pos[0]) / separation) * travel;
          shade.pos[2] += ((player.pos[2] - shade.pos[2]) / separation) * travel;
        }
      }
    }

    // 9. Island clamp, followed by safe zones in lantern id order.
    for (const shade of shades) {
      clampToIsland(shade.pos);
      for (const lantern of lanterns) {
        const separation = distance(shade.pos, lantern.pos);
        if (lantern.lit && separation < tuning.safe_radius) {
          pushFrom(shade.pos, lantern.pos, tuning.safe_radius - separation);
        }
      }
    }

    // 10. At most one hit per step.
    if (invuln === 0 && shades.some((shade) =>
      shade.state !== 'stunned' && distance(shade.pos, player.pos) <= tuning.shade_hit_radius)) {
      player.flames -= 1;
      const dropped = Math.floor(player.carried * tuning.hit_drop_ratio);
      player.carried -= dropped;
      invuln = secondsToTicks(tuning.invuln_s);
      emit('player_hit', { by: 'shade', flames: player.flames, dropped });
    }

    // 11. Spawn on the resulting tick (the steps value assigned in stage 12).
    if (randomMotes && tick % 120 === 0 && motes.length < 20) spawnMote();
    if (randomShades && tick % 1200 === 0 && shades.length < 6) {
      const shade = spawnShade();
      emit('shade_spawned', { id: shade.id });
    }

    // 12. Time is derived from the step count, never accumulated.
    steps = tick;
    timeLeft = initialTime - steps / TICKS_PER_SECOND;

    // 13. End conditions have strict priority: victory, health, then dawn.
    let reason;
    if (lanterns.every((lantern) => lantern.lit)) {
      state = 'won';
      reason = 'all_lit';
      score += tuning.score.per_second_left * Math.floor(timeLeft)
        + tuning.score.per_flame_left * player.flames;
    } else if (player.flames <= 0) {
      state = 'lost';
      reason = 'no_flames';
    } else if (timeLeft <= 1e-9) {
      state = 'lost';
      reason = 'dawn';
    }
    if (reason) emit('game_over', { result: state, reason });
    return events;
  }

  function snapshot() {
    return {
      type: 'snapshot', tick: steps, sim_tick: steps, state,
      time_left_s: rounded(timeLeft), score,
      player: { pos: roundedPos(player.pos), flames: player.flames, carried: player.carried },
      lanterns: lanterns.map((lantern) => ({
        id: lantern.id, pos: roundedPos(lantern.pos), lit: lantern.lit, deposited: lantern.deposited,
      })),
      shades: shades.map((shade) => ({ id: shade.id, pos: roundedPos(shade.pos), state: shade.state })),
      motes_active: motes.length,
      motes: motes.map((mote) => ({ id: mote.id, pos: roundedPos(mote.pos) })),
    };
  }

  return {
    step, snapshot,
    get state() { return state; },
    get ended() { return state !== 'playing'; },
    get steps() { return steps; },
  };
}
