import { mulberry32 } from './rng.js';
import { MAPS } from './maps.js';
import { groundAt, containsXZ, blocked } from './terrain.js';

const HZ = 60;
// Ticket/design constants without corresponding keys in game.contract.json.
const RULES = Object.freeze({
  acceleration: 60, jump: 7, gravity: -20, heightTolerance: 1.5,
  initialMotes: 20, moteMax: 30, moteInterval: 240, dropTTL: 480,
  dropMin: 1.5, dropMax: 2.5, fallY: -10, respawn: 60,
  charmDuration: 600, charmRespawn: 2700, charmSpeedRatio: 1.2,
  spawnDistance: 15, spawnDuration: 30, wanderSpeed: 1.5, detect: 12, abandon: 18,
  recoilDuration: 60, recoilDistance: 2, pushDuration: 15, evictionDuration: 30,
  capacityPerLight: 2, drainReach: 2, drainDetect: 6,
  drifterInterval: 1200, drifterMax: 2, drifterIdleSpeed: 2, drifterSpeed: 7,
  drifterDetect: 15, drifterThreshold: 5, drifterContact: 1.2, drifterSteal: 3,
  drifterFlee: 240, drifterDropFlee: 120, windInterval: 1800, windDuration: 300, windSpeed: 2,
});
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const isCount = (v) => Number.isSafeInteger(v) && v >= 0;
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isVector = (v, n) => Array.isArray(v) && v.length === n && Array.from(v).every(isNumber);
const rounded = (v) => Math.round(v * 1000) / 1000 || 0;
const roundedPos = (p) => p.map(rounded);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const distance3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const ticks = (s) => Math.round(s * HZ);
const shadeStates = ['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'];
const drifterStates = ['idle', 'chase', 'flee', 'removed'];
function compareIds(a, b) {
  const l = /^(.*?)(\d+)$/.exec(a.id), r = /^(.*?)(\d+)$/.exec(b.id);
  if (l && r && l[1] === r[1] && Number(l[2]) !== Number(r[2])) return Number(l[2]) - Number(r[2]);
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
function formatError(message) { const e = new Error(message); e.code = 2; throw e; }
function fields(o, names, check, path) {
  for (const name of names) if (has(o, name) && !check(o[name])) formatError(`Invalid ${path}.${name}`);
}
export function validateInputs(o) {
  if (!isObject(o) || !Array.isArray(o.frames)) formatError('inputs.frames must be an array');
  let previous = -1;
  for (const f of o.frames) {
    if (!isObject(f) || !isCount(f.tick) || f.tick <= previous) formatError('Input ticks must strictly increase');
    previous = f.tick;
    fields(f, ['move'], (v) => isVector(v, 2) && v.every((n) => n >= -1 && n <= 1), 'input');
    fields(f, ['cam_yaw_deg'], isNumber, 'input');
    fields(f, ['jump', 'dash', 'interact', 'pulse', 'pause'], (v) => typeof v === 'boolean', 'input');
  }
  return o;
}
export function validateScenario(o, night = 1) {
  if (!isObject(o)) formatError('scenario must be an object');
  fields(o, ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled'], (v) => typeof v === 'boolean', 'scenario');
  fields(o, ['time_left_s'], (v) => isNumber(v) && v > 0, 'scenario');
  if (has(o, 'player')) {
    if (!isObject(o.player)) formatError('scenario.player must be an object');
    fields(o.player, ['pos'], (v) => isVector(v, 3), 'player');
    fields(o.player, ['carried', 'flames', 'invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks', 'successful_lights'], isCount, 'player');
  }
  if (has(o, 'motes') && (!Array.isArray(o.motes) || !Array.from(o.motes).every((p) => isVector(p, 3)))) {
    formatError('scenario.motes must be an array of positions');
  }
  for (const key of ['shades', 'drifters', 'charms', 'lanterns']) {
    if (!has(o, key)) continue;
    if (!Array.isArray(o[key])) formatError(`scenario.${key} must be an array`);
    const ids = new Set();
    for (const e of o[key]) {
      if (!isObject(e)) formatError(`scenario.${key} entries must be objects`);
      if ((key === 'shades' || key === 'drifters') && !isVector(e.pos, 3)) formatError(`${key}.pos required`);
      fields(e, ['pos'], (v) => isVector(v, 3), key);
      if (has(e, 'id')) {
        if (typeof e.id !== 'string' || !e.id || ids.has(e.id)) formatError(`${key}.id must be unique nonempty strings`);
        ids.add(e.id);
      }
      if (key === 'shades' || key === 'drifters') {
        fields(e, ['state'], (v) => (key === 'shades' ? shadeStates : drifterStates).includes(v), key);
        fields(e, ['state_ticks_left', 'stolen'], isCount, key);
      }
      if (key === 'shades') {
        fields(e, ['target_lantern_id'], (v) => MAPS[night]?.lanterns.some((l) => l.id === v), key);
      }
      if (key === 'charms') {
        fields(e, ['available'], (v) => typeof v === 'boolean', key);
        fields(e, ['respawn_ticks', 'respawn_ticks_left'], isCount, key);
        fields(e, ['respawn_s'], (v) => isNumber(v) && v >= 0, key);
        if (!has(e, 'pos') && !MAPS[night]?.charm_points[Number(e.id?.slice(1)) - 1]) formatError('Charm needs pos or a map charm id');
      }
      if (key === 'lanterns') {
        if (!MAPS[night]?.lanterns.some((l) => l.id === e.id)) formatError('Unknown lantern id for this night');
        fields(e, ['deposited'], isCount, key);
        fields(e, ['lit', 'ever_lit'], (v) => typeof v === 'boolean', key);
        fields(e, ['fuel'], (v) => isNumber(v) && v >= 0, key);
      }
    }
  }
  return o;
}
function away(pos, origin) {
  const d = distance(pos, origin);
  return d ? [(pos[0] - origin[0]) / d, (pos[2] - origin[2]) / d] : [1, 0];
}

export function createGame({ seed, night = 1, tuning, scenario, bench = false }) {
  if (!MAPS[night]) throw new Error('night must be 1, 2 or 3');
  if (scenario !== undefined) validateScenario(scenario, night);
  const setup = scenario ?? {};
  const random = mulberry32(seed >>> 0);
  const map = { ...MAPS[night], duration_s: tuning[`night${night}_duration_s`],
    shade_speed: tuning.shade_speed * MAPS[night].shade_speed / MAPS[1].shade_speed };
  const choose = (array) => array[Math.floor(random() * array.length)];
  const randomMotes = !bench && (setup.random_motes ?? true);
  const randomShades = !bench && (setup.random_shades ?? true);
  const randomDrifters = !bench && map.drifters && (setup.random_drifters ?? true);
  const windEnabled = map.wind && (setup.wind_enabled ?? true);
  const fuelMax60 = Math.round(tuning.fuel_max * HZ);
  const fuelPerMote60 = Math.round(tuning.fuel_per_mote * HZ);
  const lowFuel60 = Math.round(tuning.low_fuel_threshold * HZ);
  const fuelValue = (l) => l.lit ? Math.round(l.fuel60 / HZ * 10) / 10 : 0;
  const hasSafeZone = (l) => l.lit && l.fuel60 >= lowFuel60;
  const player = {
    pos: [...(setup.player?.pos ?? map.start)], vel: [0, 0, 0], grounded: false,
    flames: setup.player?.flames ?? tuning.flames, carried: setup.player?.carried ?? 0,
    invuln: setup.player?.invuln_ticks ?? 0, dashCD: setup.player?.dash_cd_ticks ?? 0,
    pulseCD: setup.player?.pulse_cd_ticks ?? 0, charm: setup.player?.charm_ticks ?? 0,
    successfulLights: setup.player?.successful_lights ?? 0,
    facing: [0, 1], dash: 0, dashDir: [0, 1], dashEnded: false, launch: null, respawn: 0,
  };
  const capacity = () => Math.min(tuning.capacity_max,
    tuning.carry_capacity + RULES.capacityPerLight * player.successfulLights);
  const initialGround = groundAt(map, player.pos[0], player.pos[2], player.pos[1]);
  player.grounded = initialGround !== null && Math.abs(player.pos[1] - initialGround) < 1e-8;
  const lanterns = map.lanterns.map((l) => ({ id: l.id, pos: [...l.pos], lit: false, deposited: 0,
    fuel60: 0, ever_lit: false, relit_count: 0 }));
  for (const e of setup.lanterns ?? []) {
    const l = lanterns.find((item) => item.id === e.id);
    if (has(e, 'pos')) l.pos = [...e.pos];
    if (has(e, 'lit')) l.lit = e.lit;
    if (has(e, 'deposited')) l.deposited = e.deposited;
    l.fuel60 = l.lit ? Math.min(fuelMax60, Math.round((e.fuel ?? tuning.fuel_max) * HZ)) : 0;
    l.ever_lit = e.ever_lit ?? l.lit;
  }
  let steps = 0, simTick = 0, state = 'playing', paused = false, score = 0;
  const initialTime = setup.time_left_s ?? map.duration_s;
  let timeLeft = initialTime;
  let nextMote = 1, nextShade = 1, nextDrifter = 1;
  let motes = [];
  const shades = [], drifters = [];
  const wind = { active: false, dir_deg: null };
  const controls = { move: [0, 0], cam_yaw_deg: 0, jump: false, dash: false, interact: false, pulse: false, pause: false };
  const groundY = (pos) => groundAt(map, pos[0], pos[2], Infinity) ?? 0;
  function newMote(pos, kind = 'random', point = null) {
    motes.push({ id: `M${nextMote++}`, pos: [...pos], kind, point,
      ttl: kind === 'dropped' ? RULES.dropTTL : null, born: simTick });
  }
  function spawnMote() {
    if (motes.length >= RULES.moteMax) return;
    const occupied = new Set(motes.filter((m) => m.kind === 'random').map((m) => m.point));
    const free = map.mote_points.map((_, i) => i).filter((i) => !occupied.has(i));
    if (free.length) { const i = choose(free); newMote(map.mote_points[i], 'random', i); }
  }
  function dropMotes(pos, amount, scatter) {
    for (let i = 0; i < amount; i += 1) {
      const a = scatter ? random() * Math.PI * 2 : 0;
      const r = scatter ? RULES.dropMin + random() * (RULES.dropMax - RULES.dropMin) : 0;
      const p = [pos[0] + Math.cos(a) * r, 0, pos[2] + Math.sin(a) * r];
      p[1] = groundAt(map, p[0], p[2], pos[1]) ?? groundAt(map, pos[0], pos[2], pos[1]) ?? 0;
      newMote(p, 'dropped');
    }
  }
  function makeShade(id, pos, entry = {}) {
    const s = bench ? 'wander' : entry.state ?? 'wander';
    return { id, pos: [pos[0], groundY(pos) + 1, pos[2]], state: s,
      timer: entry.state_ticks_left ?? (s === 'spawning' ? RULES.spawnDuration
        : s === 'stunned' ? ticks(tuning.pulse_stun_s) : s === 'recoil' ? RULES.recoilDuration : 0),
      push: 0, pushDir: [1, 0], recoilDir: away(pos, player.pos), target: null, eviction: null,
      targetLanternId: entry.target_lantern_id ?? null, drainTicks: 0,
    };
  }
  function initializeEntities(entries, prefix, make, list) {
    const used = new Set(entries.filter((e) => has(e, 'id')).map((e) => e.id));
    let auto = 1, next = 1;
    for (const e of entries) {
      while (used.has(`${prefix}${auto}`)) auto += 1;
      const id = e.id ?? `${prefix}${auto++}`;
      used.add(id);
      const match = new RegExp(`^${prefix}(\\d+)$`).exec(id);
      if (match) next = Math.max(next, Number(match[1]) + 1);
      list.push(make(id, e.pos, e));
    }
    list.sort(compareIds);
    return next;
  }
  if (has(setup, 'motes')) {
    for (const pos of setup.motes) {
      const point = map.mote_points.findIndex((p) => distance(p, pos) < 0.001 && Math.abs(p[1] - pos[1]) < 0.001);
      newMote(pos, 'random', point < 0 ? null : point);
    }
  } else if (randomMotes) for (let i = 0; i < RULES.initialMotes; i += 1) spawnMote();
  nextShade = initializeEntities(setup.shades ?? [], 'S', makeShade, shades);
  function makeDrifter(id, pos, e = {}) {
    const s = e.state ?? 'idle';
    return { id, pos: [pos[0], groundY(pos) + 1.5, pos[2]], state: s, stolen: e.stolen ?? 0,
      timer: e.state_ticks_left ?? (s === 'flee' ? RULES.drifterFlee : 0),
      target: null, fleeDir: away(pos, player.pos) };
  }
  nextDrifter = initializeEntities(setup.drifters ?? [], 'D', makeDrifter, drifters);
  const charmEntries = setup.charms ?? map.charm_points.map((pos, i) => ({ id: `C${i + 1}`, pos }));
  const charms = [];
  initializeEntities(charmEntries, 'C', (id, pos, e) => ({ id,
      pos: [...(pos ?? map.charm_points[Number(id.slice(1)) - 1])],
      available: e.available ?? true,
      respawn: (e.available ?? true) ? 0 : (e.respawn_ticks ?? e.respawn_ticks_left
        ?? (has(e, 'respawn_s') ? ticks(e.respawn_s) : RULES.charmRespawn)),
    }), charms);

  function spawnShade() {
    const valid = map.shade_points.filter((p) => distance(p, player.pos) >= RULES.spawnDistance
      && !lanterns.some((l) => hasSafeZone(l) && distance(p, l.pos) < tuning.safe_radius)
      && !shades.some((s) => distance(p, s.pos) < 1e-6));
    if (!valid.length || shades.length >= map.shade_max) return null;
    const p = [...choose(valid)]; p[1] = groundY(p) + 1;
    const s = makeShade(`S${nextShade++}`, p, { state: 'spawning' });
    shades.push(s); shades.sort(compareIds); return s;
  }
  function shadeMove(s, dir, amount) {
    const to = [s.pos[0] + dir[0] * amount, s.pos[1], s.pos[2] + dir[1] * amount];
    // Flying enemies cross tier walls, but cannot cross the void or the tower.
    const collision = blocked(map, s.pos, to, { flying: true });
    if (!collision) { s.pos[0] = to[0]; s.pos[2] = to[2]; }
    s.pos[1] = groundY(s.pos) + 1;
    return !collision;
  }
  function moveTowards(entity, target, speed, flyingShade = false) {
    const d = distance(entity.pos, target);
    if (!d) return;
    const dir = [(target[0] - entity.pos[0]) / d, (target[2] - entity.pos[2]) / d];
    const travel = Math.min(d, speed / HZ);
    if (flyingShade) shadeMove(entity, dir, travel);
    else { entity.pos[0] += dir[0] * travel; entity.pos[2] += dir[1] * travel; entity.pos[1] = groundY(entity.pos) + 1.5; }
  }
  function constrainSafe(s) {
    for (const l of lanterns) {
      if (!hasSafeZone(l) || s.eviction?.id === l.id) continue;
      const d = distance(s.pos, l.pos);
      if (d < tuning.safe_radius) {
        const dir = away(s.pos, l.pos);
        s.pos[0] = l.pos[0] + dir[0] * tuning.safe_radius;
        s.pos[2] = l.pos[2] + dir[1] * tuning.safe_radius;
      }
    }
    s.pos[1] = groundY(s.pos) + 1;
  }
  function mobileState(s) {
    return !player.respawn && distance(s.pos, player.pos) <= RULES.detect ? 'chase' : 'wander';
  }
  function nearestLantern(pos, accepts) {
    let chosen, nearest = Infinity;
    for (const l of lanterns) if (accepts(l)) {
      const d = distance(pos, l.pos);
      if (d < nearest || (d === nearest && (!chosen || compareIds(l, chosen) < 0))) {
        chosen = l; nearest = d;
      }
    }
    return chosen;
  }
  function startFlee(d, duration) {
    d.state = 'flee'; d.timer = duration; d.fleeDir = away(d.pos, player.pos);
  }

  function step(input = {}) {
    if (state !== 'playing') return [];
    steps += 1;
    const events = [];
    const emit = (name, data = {}) => events.push({ type: 'event', tick: steps, name, data });
    // 1. All buttons are remembered even while paused, avoiding stale rising edges.
    const edges = {};
    for (const button of ['jump', 'dash', 'interact', 'pulse', 'pause']) {
      const pressed = input[button] ?? controls[button];
      edges[button] = pressed && !controls[button]; controls[button] = pressed;
    }
    const wasPaused = paused;
    if (edges.pause) { paused = !paused; emit(paused ? 'paused' : 'resumed'); }
    if (paused) return events;
    if (wasPaused) for (const button of ['jump', 'dash', 'interact', 'pulse']) edges[button] = false;
    if (!wasPaused) {
      if (input.move !== undefined) controls.move = [...input.move];
      if (input.cam_yaw_deg !== undefined) controls.cam_yaw_deg = input.cam_yaw_deg;
    }
    simTick += 1;

    // 2. Simulation time and timers freeze together on paused wall-clock ticks.
    timeLeft = Math.max(0, initialTime - simTick / HZ);
    // One fuel60 unit is 1/60 fuel: per-second tuning is the integer cost per tick.
    for (const l of lanterns) if (!bench && l.lit) l.fuel60 = Math.max(0, l.fuel60 - tuning.fuel_decay_per_s);
    const draining = [];
    for (const s of shades) if (!bench && s.state === 'drain' && !s.eviction) {
      const l = lanterns.find((lamp) => lamp.id === s.targetLanternId);
      if (l?.lit && distance(s.pos, l.pos) <= RULES.drainReach) {
        l.fuel60 = Math.max(0, l.fuel60 - tuning.drain_per_s);
        s.drainTicks += 1;
        if (s.drainTicks % HZ === 0) draining.push({ s, l });
      }
    }
    // Report the final fuel after all shades have drained, so stacked drain is order-independent.
    for (const { s, l } of draining) emit('fuel_drain', { lantern_id: l.id, shade_id: s.id, fuel: fuelValue(l) });
    for (const l of lanterns) if (l.lit && l.fuel60 <= 0) {
      l.lit = false; l.fuel60 = 0; l.deposited = 0;
      emit('lantern_out', { lantern_id: l.id });
    }
    for (const key of ['invuln', 'dashCD', 'pulseCD', 'charm']) if (player[key] > 0) player[key] -= 1;
    for (const s of shades) if (s.timer > 0) s.timer -= 1;
    for (const d of drifters) {
      if (d.state === 'flee' && d.timer > 0 && --d.timer === 0) d.state = 'removed';
    }
    for (const m of motes) if (m.ttl !== null) m.ttl -= 1;
    motes = motes.filter((m) => m.ttl === null || m.ttl > 0);
    for (const c of charms) if (!c.available && c.respawn > 0 && --c.respawn === 0) c.available = true;
    if (windEnabled && simTick % RULES.windInterval === 0) wind.dir_deg = Math.floor(random() * 360);
    wind.active = windEnabled && simTick >= RULES.windInterval && simTick % RULES.windInterval < RULES.windDuration;
    if (!wind.active) wind.dir_deg = null;

    // 3. Player movement, jump/dash/pads/wind, then fall exactly once per life.
    let activePlayer = player.respawn === 0;
    if (player.respawn > 0 && --player.respawn === 0) {
      player.pos = [...map.start]; player.vel = [0, 0, 0]; player.grounded = true;
      player.invuln = ticks(tuning.invuln_s); player.launch = null; player.dash = 0;
      player.dashEnded = false;
    }
    if (activePlayer) {
      let [x, z] = controls.move;
      const len = Math.hypot(x, z);
      if (len > 1) { x /= len; z /= len; }
      const yaw = controls.cam_yaw_deg * Math.PI / 180;
      const direction = [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
      const moving = Math.hypot(...direction) > 0;
      if (moving) { const n = Math.hypot(...direction); player.facing = direction.map((v) => v / n); }
      const runSpeed = tuning.player_speed * (player.charm > 0 ? RULES.charmSpeedRatio : 1);
      // A completed dash restores the launch vector, or the ordinary running speed.
      if (player.dash === 0 && player.dashEnded) {
        player.vel[0] = player.launch ? player.launch[0] : player.dashDir[0] * runSpeed;
        player.vel[2] = player.launch ? player.launch[1] : player.dashDir[1] * runSpeed;
        player.dashEnded = false;
      }
      const activatePad = () => {
        if (!player.grounded || player.dash > 0) return;
        const pad = map.pads.find((p) => distance(player.pos, p.pos) <= p.radius
          && Math.abs(player.pos[1] - p.pos[1]) <= 0.25);
        if (pad) {
          player.vel[1] = pad.vy; player.launch = pad.dir.map((v) => v * pad.vh);
          player.vel[0] = player.launch[0]; player.vel[2] = player.launch[1]; player.grounded = false;
        }
      };
      activatePad();
      if (edges.jump && player.grounded && !player.dash) { player.vel[1] = RULES.jump; player.grounded = false; }
      if (edges.dash && !player.dash && (player.dashCD === 0 || player.charm > 0)) {
        player.dash = ticks(tuning.dash_duration_s); player.dashDir = [...player.facing];
        player.vel[1] = 0;
        if (!player.charm) player.dashCD = ticks(tuning.dash_cooldown_s);
        emit('dash');
      }
      const dashing = player.dash > 0;
      if (dashing) {
        player.vel[0] = player.dashDir[0] * tuning.dash_speed;
        player.vel[1] = 0;
        player.vel[2] = player.dashDir[1] * tuning.dash_speed;
      }
      else if (!player.launch) {
        const dx = direction[0] * runSpeed - player.vel[0], dz = direction[1] * runSpeed - player.vel[2];
        const delta = Math.hypot(dx, dz), factor = delta ? Math.min(1, RULES.acceleration / HZ / delta) : 0;
        player.vel[0] += dx * factor; player.vel[2] += dz * factor;
      }
      const old = [...player.pos];
      const nextY = player.pos[1] + (dashing ? 0 : player.vel[1] / HZ);
      const angle = (wind.dir_deg ?? 0) * Math.PI / 180;
      const to = [player.pos[0] + player.vel[0] / HZ + (wind.active ? Math.cos(angle) * RULES.windSpeed / HZ : 0),
        nextY, player.pos[2] + player.vel[2] / HZ + (wind.active ? Math.sin(angle) * RULES.windSpeed / HZ : 0)];
      if (!blocked(map, old, to)) { player.pos[0] = to[0]; player.pos[2] = to[2]; }
      player.pos[1] = nextY;
      if (!dashing) player.vel[1] += RULES.gravity / HZ;
      const ground = groundAt(map, player.pos[0], player.pos[2], Math.max(old[1], nextY));
      if (!dashing && ground !== null && player.pos[1] <= ground + 1e-9 && player.vel[1] <= 0) {
        player.pos[1] = ground; player.vel[1] = 0; player.grounded = true; player.launch = null;
      } else if (!dashing && player.grounded && ground !== null && ground - old[1] <= 0.25 && ground >= old[1]) {
        // Walk up a ramp without jumping.
        player.pos[1] = ground; player.vel[1] = 0;
      } else player.grounded = ground !== null && Math.abs(player.pos[1] - ground) < 1e-9 && !player.vel[1];
      if (dashing && --player.dash === 0) player.dashEnded = true;
      if (!dashing) activatePad();
      if (!tuning.fall_enabled && !containsXZ(map, player.pos[0], player.pos[2])) player.pos = old;
      if (!bench && tuning.fall_enabled && player.pos[1] < RULES.fallY) {
        const lost = player.carried;
        player.flames -= 1; player.carried = 0; player.respawn = RULES.respawn;
        player.vel = [0, 0, 0]; player.grounded = false; player.launch = null; player.dash = 0;
        player.dashEnded = false;
        activePlayer = false;
        emit('player_hit', { by: 'fall', flames: player.flames, dropped: 0, lost });
      }
    }

    // 4. Mote/charm pickup (dropped motes cannot interact on their birth tick).
    const inReach = (pos, radius) => distance(player.pos, pos) <= radius + 1e-9
      && Math.abs(player.pos[1] - pos[1]) <= RULES.heightTolerance;
    if (!bench && activePlayer) {
      motes = motes.filter((m) => {
        if ((m.kind === 'random' || m.born < simTick) && player.carried < capacity() && inReach(m.pos, tuning.pickup_radius)) {
          player.carried += 1; emit('mote_picked', { carried: player.carried }); return false;
        }
        return true;
      });
      for (const c of charms) if (c.available && inReach(c.pos, tuning.pickup_radius)) {
        c.available = false; c.respawn = RULES.charmRespawn; player.charm = RULES.charmDuration;
        emit('charm_picked', { charm_id: c.id, charm_ticks: player.charm });
      }
    }

    // 5. Deposit before safe zones and pulse; score is awarded on deposit.
    const activatedSafeZones = [];
    if (activePlayer && edges.interact) {
      let nearest = Infinity, chosen;
      for (const l of lanterns) {
        const d = distance(player.pos, l.pos);
        if ((!l.lit || l.fuel60 < fuelMax60) && inReach(l.pos, tuning.interact_radius)
          && (d < nearest || (d === nearest && compareIds(l, chosen) < 0))) { nearest = d; chosen = l; }
      }
      if (chosen) {
        const cost = chosen.ever_lit ? tuning.relight_cost : tuning.lantern_cost;
        if (chosen.lit) {
          const amount = Math.min(player.carried, Math.ceil((fuelMax60 - chosen.fuel60) / fuelPerMote60));
          if (amount > 0) {
            const wasSafe = hasSafeZone(chosen);
            player.carried -= amount; chosen.fuel60 = Math.min(fuelMax60, chosen.fuel60 + fuelPerMote60 * amount);
            score += amount * tuning.score.per_mote;
            if (!wasSafe && hasSafeZone(chosen)) activatedSafeZones.push(chosen);
            emit('refuel', { lantern_id: chosen.id, amount, fuel: fuelValue(chosen) });
          }
        } else {
          const amount = Math.max(0, Math.min(player.carried, cost - chosen.deposited));
          if (amount > 0) {
            player.carried -= amount; chosen.deposited += amount; score += amount * tuning.score.per_mote;
            emit('deposit', { lantern_id: chosen.id, amount, deposited: chosen.deposited });
            if (chosen.deposited >= cost) {
              const relight = chosen.ever_lit;
              chosen.lit = true; chosen.fuel60 = fuelMax60; chosen.ever_lit = true;
              if (relight) chosen.relit_count += 1;
              player.successfulLights += 1;
              activatedSafeZones.push(chosen);
              score += relight ? tuning.score.per_relight : tuning.score.per_lantern;
              emit('lantern_lit', { lantern_id: chosen.id, relight });
            }
          }
        }
      }
    }
    // 6. A newly lit lantern evicts existing occupants over exactly 30 updates.
    for (const s of shades) {
      if (s.eviction && !lanterns.some((l) => l.id === s.eviction.id && hasSafeZone(l))) s.eviction = null;
      for (const l of activatedSafeZones) {
        if (s.state === 'drain' && s.targetLanternId === l.id) { s.state = 'wander'; s.drainTicks = 0; }
        const d = distance(s.pos, l.pos);
        if (d < tuning.safe_radius) s.eviction = { id: l.id, left: RULES.evictionDuration,
          dir: away(s.pos, l.pos), speed: (tuning.safe_radius - d) / RULES.evictionDuration };
      }
      constrainSafe(s);
    }

    // 7. Target lock is 3D and precedes all enemy motion this tick.
    if (activePlayer && edges.pulse && !player.pulseCD && player.carried >= tuning.pulse_cost) {
      player.carried -= tuning.pulse_cost; player.pulseCD = ticks(tuning.pulse_cooldown_s);
      const center = [player.pos[0], player.pos[1] + 0.8, player.pos[2]], ids = [];
      for (const s of shades) if (distance3(center, s.pos) <= tuning.pulse_radius) {
        score += s.state === 'drain' ? tuning.score.per_stun_drain : tuning.score.per_stun;
        s.state = 'stunned'; s.timer = ticks(tuning.pulse_stun_s); s.push = RULES.pushDuration;
        s.drainTicks = 0; s.pushDir = away(s.pos, player.pos); ids.push(s.id);
      }
      emit('pulse', { stunned_ids: ids });
      for (const d of drifters) if (distance3(center, d.pos) <= tuning.pulse_radius) {
        if (d.state === 'chase') startFlee(d, RULES.drifterFlee);
        else if (d.state === 'flee' && d.stolen > 0) {
          const amount = d.stolen; dropMotes(d.pos, amount, false); d.stolen = 0;
          startFlee(d, RULES.drifterDropFlee); emit('drifter_drop', { drifter_id: d.id, amount });
        }
      }
    }

    // 8. Enemy motion. Eviction takes precedence and suppresses hits through its last tick.
    for (const s of shades) {
      s.evictedThisTick = !!s.eviction;
      if (s.eviction) {
        const e = s.eviction;
        shadeMove(s, e.dir, e.speed);
        if (--e.left === 0) s.eviction = null;
      } else if (s.state === 'stunned') {
        if (s.push > 0) { if (!shadeMove(s, s.pushDir, tuning.pulse_push_m / RULES.pushDuration)) s.push = 0; else s.push -= 1; }
        if (!s.timer) s.state = 'wander';
      } else if (s.state === 'recoil') {
        shadeMove(s, s.recoilDir, RULES.recoilDistance / RULES.recoilDuration);
        if (!s.timer) s.state = mobileState(s);
      } else if (s.state === 'spawning') {
        if (!s.timer) s.state = mobileState(s);
      } else if (s.state === 'drain') {
        const l = lanterns.find((lamp) => lamp.id === s.targetLanternId);
        if (!l?.lit || hasSafeZone(l) || distance(s.pos, l.pos) > RULES.drainReach) {
          s.state = 'wander'; s.drainTicks = 0;
        } else if (!player.respawn && distance(s.pos, player.pos) <= RULES.drainDetect) {
          s.state = 'chase'; s.drainTicks = 0;
          moveTowards(s, player.pos, map.shade_speed, true);
        }
      } else {
        const d = distance(s.pos, player.pos);
        if (!bench && s.state === 'wander' && !player.respawn && d <= RULES.detect) s.state = 'chase';
        if (s.state === 'chase' && (d > RULES.abandon || player.respawn)) s.state = 'wander';
        if (s.state === 'chase') moveTowards(s, player.pos, map.shade_speed, true);
        else {
          const l = nearestLantern(s.pos, (lamp) => lamp.lit && lamp.fuel60 < lowFuel60)
            ?? nearestLantern(s.pos, (lamp) => !lamp.lit);
          s.targetLanternId = l?.id ?? null;
          if (l) {
            if (!l.lit || distance(s.pos, l.pos) > RULES.drainReach) moveTowards(s, l.pos, RULES.wanderSpeed, true);
            if (!bench && l.lit && distance(s.pos, l.pos) <= RULES.drainReach) { s.state = 'drain'; s.drainTicks = 0; }
          } else {
            if (!s.target || distance(s.pos, s.target) <= 1) s.target = [...choose(map.mote_points)];
            moveTowards(s, s.target, RULES.wanderSpeed, true);
          }
        }
      }
      constrainSafe(s);
    }
    for (const d of drifters) {
      if (d.state === 'removed') continue;
      if (d.state === 'flee') {
        d.fleeDir = away(d.pos, player.pos);
        d.pos[0] += d.fleeDir[0] * RULES.drifterSpeed / HZ;
        d.pos[2] += d.fleeDir[1] * RULES.drifterSpeed / HZ; d.pos[1] = groundY(d.pos) + 1.5;
      } else {
        const chase = activePlayer && player.carried >= RULES.drifterThreshold && distance(d.pos, player.pos) <= RULES.drifterDetect;
        d.state = chase ? 'chase' : 'idle';
        if (chase) moveTowards(d, player.pos, RULES.drifterSpeed);
        else {
          if (!d.target || distance(d.pos, d.target) <= 1) d.target = [...choose(map.mote_points)];
          moveTowards(d, d.target, RULES.drifterIdleSpeed);
        }
      }
    }

    // 9. Theft precedes damage; invulnerability blocks only shade hits.
    if (!bench && activePlayer) {
      for (const d of drifters) if (d.state === 'chase' && distance(d.pos, player.pos) <= RULES.drifterContact) {
        const amount = Math.min(RULES.drifterSteal, player.carried);
        player.carried -= amount; d.stolen = amount; startFlee(d, RULES.drifterFlee);
        emit('drifter_steal', { drifter_id: d.id, amount, carried: player.carried });
      }
      if (!player.invuln) for (const s of shades) {
        if (['wander', 'chase'].includes(s.state) && !s.evictedThisTick && !s.eviction
          && inReach(s.pos, tuning.shade_hit_radius)) {
          player.flames -= 1;
          const dropped = Math.floor(player.carried * tuning.hit_drop_ratio);
          player.carried -= dropped; dropMotes(player.pos, dropped, true);
          player.invuln = ticks(tuning.invuln_s);
          s.state = 'recoil'; s.timer = RULES.recoilDuration; s.recoilDir = away(s.pos, player.pos);
          emit('player_hit', { by: 'shade', flames: player.flames, dropped }); break;
        }
      }
    }

    // 10. New entities can first interact on the following simulation tick.
    if (randomMotes && simTick % RULES.moteInterval === 0) spawnMote();
    if (randomShades && (simTick === map.shade_first_tick
      || (simTick > map.shade_first_tick && (simTick - map.shade_first_tick) % map.shade_interval_ticks === 0))) {
      for (let i = 0; i < (simTick === map.shade_first_tick ? 2 : 1); i += 1) {
        const s = spawnShade(); if (s) emit('shade_spawned', { id: s.id });
      }
    }
    if (randomDrifters && simTick % RULES.drifterInterval === 0
      && drifters.filter((d) => d.state !== 'removed').length < RULES.drifterMax) {
      const p = [...choose(map.shade_points)]; p[1] = groundY(p) + 1.5;
      drifters.push(makeDrifter(`D${nextDrifter++}`, p)); drifters.sort(compareIds);
    }

    // 11. Resolve dawn after all updates; no_flames always takes precedence.
    let reason;
    if (!bench && player.flames <= 0) { state = 'lost'; reason = 'no_flames'; }
    else if (!bench && timeLeft <= 1e-9) {
      const lit = lanterns.filter((l) => l.lit);
      if (lit.length >= Math.ceil(tuning.win_ratio * lanterns.length)) {
        state = 'won'; reason = 'dawn_survived';
        score += player.flames * tuning.score.per_flame_left;
        for (const l of lit) score += tuning.score.per_lit_lantern_dawn + Math.floor(l.fuel60 / HZ);
      } else { state = 'lost'; reason = 'dawn'; }
    }
    if (reason) emit('game_over', { result: state, reason });
    return events;
  }

  function snapshot() {
    return {
      type: 'snapshot', tick: steps, sim_tick: simTick, night, state: paused ? 'paused' : state,
      time_left_s: rounded(timeLeft), score, wind: { active: wind.active, dir_deg: wind.dir_deg },
      player: { pos: roundedPos(player.pos), vel: roundedPos(player.vel), grounded: player.grounded,
        invuln: player.invuln > 0, flames: player.flames, carried: player.carried, capacity: capacity(),
        dash_cd_s: rounded(player.dashCD / HZ), pulse_cd_s: rounded(player.pulseCD / HZ), charm_s: rounded(player.charm / HZ) },
      lanterns: lanterns.map((l) => ({ id: l.id, pos: roundedPos(l.pos), lit: l.lit, deposited: l.deposited,
        fuel: fuelValue(l), ever_lit: l.ever_lit, relit_count: l.relit_count })),
      shades: shades.map((s) => ({ id: s.id, pos: roundedPos(s.pos), state: s.state })),
      motes_active: motes.length,
      motes: motes.map((m) => ({ id: m.id, pos: roundedPos(m.pos), kind: m.kind, ttl_s: m.ttl === null ? null : rounded(m.ttl / HZ) })),
      drifters: drifters.map((d) => ({ id: d.id, pos: roundedPos(d.pos), state: d.state, stolen: d.stolen })),
      charms: charms.map((c) => ({ id: c.id, available: c.available, respawn_s: rounded(c.respawn / HZ) })),
    };
  }
  return { step, snapshot,
    get state() { return paused ? 'paused' : state; }, get ended() { return state !== 'playing'; },
    get steps() { return steps; }, get map() { return map; }, get paused() { return paused; },
  };
}
