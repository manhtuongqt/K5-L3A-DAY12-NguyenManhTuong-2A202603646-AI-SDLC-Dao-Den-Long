// Client: chuỗi màn (menu -> giới thiệu Đêm -> chơi -> kết quả -> Đêm kế -> Bình Minh),
// vòng lặp bước cố định 60 Hz, gọi sim, vẽ theo snapshot (nội suy giữa hai bước).
// File này chỉ hiển thị và gửi input; mọi luật chơi nằm trong src/sim/.
import './style.css';
import * as THREE from 'three';
import { createGame } from '../sim/game.js';
import contract from '../../game.contract.json';
import { PAL } from './palette.js';
import { makeGlowTexture } from './textures.js';
import { createStage } from './scene.js';
import { groundHeight } from './terrain.js';
import { fallbackMap } from './fallbackmaps.js';
import {
  createPlayerView, createShadeView, createMoteView, createDrifterView, createCharmView,
} from './actors.js';
import { createEffects, createWindLeaves } from './effects.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createScreens, NIGHTS } from './screens.js';
import { createAudio } from './audio.js';
import { loadSettings, saveSettings } from './settings.js';

const tuning = contract.tuning;
const STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;
const WIND_PERIOD = 1800; // tick: cơn gió bắt đầu ở 1800, 3600, ... (design mục 9), dài 300 tick
const WIND_WARN_TICKS = 120; // báo trước 2 s chỉ ở client

const canvas = document.getElementById('view');
const hud = createHud(tuning);
const params = new URLSearchParams(window.location.search);
const settings = loadSettings();
document.documentElement.dataset.distinguishableColors = String(settings.distinguishableColors);
const getSettings = () => settings;
const audio = createAudio(getSettings);

function randomSeed() {
  const a = new Uint32Array(1);
  (globalThis.crypto || window.crypto).getRandomValues(a);
  return a[0];
}
let urlSeed = null;
if (params.has('seed')) {
  const n = Number.parseInt(params.get('seed'), 10);
  if (Number.isFinite(n)) urlSeed = n >>> 0;
}
const nextSeed = () => { const s = urlSeed ?? randomSeed(); urlSeed = null; return s; };

// ---------------------------------------------------------------- Dựng cảnh
let stage;
let glowTex;
try {
  glowTex = makeGlowTexture();
  stage = createStage(canvas, tuning, glowTex);
} catch (err) {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend',
    `<div class="webgl-error">Không khởi tạo được WebGL: ${err && err.message ? err.message : err}</div>`);
  throw err;
}
const { root, camera } = stage;
const fx = createEffects(root, tuning, glowTex);
const leaves = createWindLeaves(root);
const playerView = createPlayerView(root, glowTex);
const shadeViews = new Map();
const moteViews = new Map();
const drifterViews = new Map();
const charmViews = new Map();
const drifterHeading = new Map();
const drainTargets = new Map();

// ---------------------------------------------------------------- Trạng thái
let g = null;
let map = null;
let night = 1;
let seed = 0;
let mode = 'menu'; // 'menu' | 'intro' | 'playing' | 'paused' | 'ended' | 'result'
let acc = 0;
let ticks = 0;
let prev = null;
let cur = null;
let faceAngle = 0;
let shake = 0;
let dashT = 0;
let endInfo = null;
let endTimer = 0;
let softPaused = false; // dự phòng khi sim chưa hỗ trợ pause
let clockT = 0;
let attractYaw = 0;
let lastCountdown = null;
let windWarned = false;
let windWasActive = false;
let leafDir = 40;
const run = { scores: [null, null, null] };
const runTotal = () => run.scores.reduce((s, v) => s + (v || 0), 0);

const input = createInput(canvas, {
  onAnyInput: () => unlockAudio(),
  onEnter: () => (screens.current ? screens.primary() : false),
  onPause: () => onEsc(),
  onRestart: () => { if (['playing', 'paused', 'ended', 'result'].includes(mode)) restartNight(); },
}, getSettings);

const screens = createScreens(document.getElementById('screen'), (a) => onAction(a), getSettings, (k, v) => {
  settings[k] = v;
  saveSettings(settings);
  if (k === 'volume') audio.applyVolume();
  if (k === 'distinguishableColors') document.documentElement.dataset.distinguishableColors = String(v);
}, tuning);

function unlockAudio() {
  if (!audio.ready) audio.init();
  if (audio.ready) audio.startMusic(night);
}
window.addEventListener('pointerdown', unlockAudio, { capture: true });

// Sao chép snapshot v1.2 để nội suy an toàn.
function copySnap(s) {
  const p = s.player;
  return {
    tick: s.tick,
    sim_tick: s.sim_tick ?? s.tick ?? 0,
    night: s.night ?? night,
    state: s.state,
    time_left_s: s.time_left_s,
    score: s.score,
    wind: { active: !!(s.wind && s.wind.active), dir_deg: s.wind ? s.wind.dir_deg : null },
    player: {
      pos: [...p.pos],
      vel: p.vel ? [...p.vel] : [0, 0, 0],
      grounded: p.grounded ?? true,
      invuln: !!p.invuln,
      flames: p.flames,
      carried: p.carried,
      capacity: p.capacity ?? tuning.carry_capacity,
      dash_cd_s: p.dash_cd_s || 0,
      pulse_cd_s: p.pulse_cd_s || 0,
      charm_s: p.charm_s || 0,
    },
    lanterns: s.lanterns.map((l) => ({
      id: l.id, pos: [...l.pos], lit: l.lit, deposited: l.deposited,
      fuel: l.lit ? (l.fuel ?? tuning.fuel_max) : 0,
      ever_lit: l.ever_lit ?? l.lit, relit_count: l.relit_count ?? 0,
    })),
    shades: s.shades.map((e) => ({ id: e.id, pos: [...e.pos], state: e.state })),
    motes: (s.motes || []).map((m) => ({ id: m.id, pos: [...m.pos], kind: m.kind || 'random', ttl_s: m.ttl_s ?? null })),
    drifters: (s.drifters || []).map((d) => ({ id: d.id, pos: [...d.pos], state: d.state, stolen: d.stolen || 0 })),
    charms: (s.charms || []).map((c) => ({ id: c.id, available: c.available, respawn_s: c.respawn_s || 0 })),
  };
}

function clearViews() {
  for (const pool of [shadeViews, moteViews, drifterViews, charmViews]) {
    for (const v of pool.values()) v.dispose();
    pool.clear();
  }
  drifterHeading.clear();
  drainTargets.clear();
}

function newGame(n, scenario) {
  night = n;
  audio.setNight(n);
  seed = nextSeed();
  g = createGame({ seed, night: n, tuning, scenario });
  window.__game = g;
  map = g.map || fallbackMap(n);
  prev = cur = copySnap(g.snapshot());
  acc = 0; ticks = 0; shake = 0; dashT = 0; faceAngle = 0;
  endInfo = null; endTimer = 0; softPaused = false;
  lastCountdown = null; windWarned = false; windWasActive = false;
  clearViews();
  stage.loadMap(map);
  stage.updateAmbience(0, 0, 0, 0, true);
  fx.state.flash = 0;
  hud.clearToasts();
  input.reset();
  input.yaw = 0;
  fpsStats.reset();
}

// ---------------------------------------------------------------- Chuỗi màn
function updateDuck() { audio.duck(!!screens.current); }

function showMenu() {
  mode = 'menu';
  hud.showHud(false);
  newGame(1);
  screens.show('menu');
  updateDuck();
}

function showIntro(n) {
  newGame(n);
  mode = 'intro';
  hud.showHud(false);
  screens.show('intro', { night: n, total: runTotal(), nLan: cur.lanterns.length });
  updateDuck();
}

function beginPlay() {
  mode = 'playing';
  screens.hide();
  hud.showHud(true);
  audio.startMusic(night);
  updateDuck();
  fpsStats.reset();
}

function restartNight() {
  newGame(night);
  beginPlay();
}

function startRun(n) {
  run.scores = [null, null, null];
  showIntro(n);
}

function simSupportsPause() { return g && typeof g.paused === 'boolean'; }

function openPause() {
  if (mode !== 'playing') return;
  if (simSupportsPause()) input.requestPause(); else softPaused = true;
  mode = 'paused';
  screens.show('pause');
  audio.sfx('click');
  updateDuck();
}

function closePause() {
  if (mode !== 'paused') return;
  if (simSupportsPause()) input.requestPause(); else softPaused = false;
  mode = 'playing';
  screens.hide();
  updateDuck();
}

let settingsReturn = null;
function onEsc() {
  const c = screens.current;
  if (c && c.name === 'settings') { onAction('back'); return; }
  if (mode === 'paused') closePause();
  else if (mode === 'playing') openPause();
}

function onAction(a) {
  audio.sfx('click');
  if (a === 'play') startRun(1);
  else if (a.startsWith('night:')) startRun(Number(a.slice(6)));
  else if (a === 'begin') beginPlay();
  else if (a === 'resume') closePause();
  else if (a === 'restart') { restartNight(); }
  else if (a === 'again') restartNight();
  else if (a === 'menu') showMenu();
  else if (a === 'settings') { settingsReturn = screens.current; screens.show('settings'); }
  else if (a === 'back') {
    const r = settingsReturn || { name: 'menu', data: {} };
    screens.show(r.name, r.data);
  } else if (a === 'next') showIntro(Math.min(3, night + 1));
  else if (a === 'new') startRun(1);
}

// tự tạm dừng khi rời tab
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'playing') openPause(); });

function finishEnd() {
  const win = endInfo.result === 'won';
  const flames = cur.player.flames;
  if (win) run.scores[night - 1] = cur.score;
  mode = 'result';
  hud.showHud(true);
  if (win && night >= 3) {
    screens.show('dawn', { total: runTotal(), scores: run.scores });
  } else {
    screens.show('result', {
      night, win, reason: endInfo.reason, score: cur.score, total: runTotal(), flames,
      lit: cur.lanterns.filter((l) => l.lit).length, nLan: cur.lanterns.length,
    });
  }
  updateDuck();
}

// ---------------------------------------------------------------- Sự kiện sim -> hiệu ứng / âm thanh / thông báo
const lanternById = (id) => cur.lanterns.find((l) => l.id === id);

function handleEvents(events) {
  for (const ev of events) {
    const d = ev.data || {};
    switch (ev.name) {
      case 'mote_picked':
        fx.pickup(cur.player.pos); audio.sfx('pickup');
        break;
      case 'deposit': {
        const l = lanternById(d.lantern_id);
        if (l) fx.deposit(l.pos);
        audio.sfx('deposit');
        const cost = prev.lanterns.find((lamp) => lamp.id === d.lantern_id)?.ever_lit ?
          tuning.relight_cost : tuning.lantern_cost;
        hud.toast(`Nạp ${d.amount} đom đóm vào ${d.lantern_id} (${d.deposited}/${cost})`);
        break;
      }
      case 'lantern_lit': {
        const l = lanternById(d.lantern_id);
        if (l) fx.lanternLit(l.pos, tuning.safe_radius);
        audio.sfx('lantern');
        hud.toast(`Đèn ${d.lantern_id} ${d.relight ? 'đã được thắp lại' : 'đã sáng'}!`);
        break;
      }
      case 'refuel': {
        const l = lanternById(d.lantern_id);
        if (l) fx.deposit(l.pos);
        audio.sfx('refuel');
        hud.toast(`Châm dầu ${d.lantern_id}: ${d.fuel}/${tuning.fuel_max} (dùng ${d.amount} đom đóm)`);
        break;
      }
      case 'fuel_drain':
        drainTargets.set(d.shade_id, d.lantern_id);
        break;
      case 'lantern_out':
        audio.sfx('lanternOut'); hud.toast(`Đèn ${d.lantern_id} hết dầu! Mang đom đóm tới thắp lại`, 'bad');
        break;
      case 'pulse':
        fx.pulse(cur.player.pos); audio.sfx('pulse');
        if (d.stunned_ids && d.stunned_ids.length) hud.toast(`Bóng Mực choáng váng x${d.stunned_ids.length}!`);
        break;
      case 'player_hit':
        shake = 1; hud.hitFlash(); audio.sfx('hit');
        if (d.by === 'fall') hud.toast('Mây rơi khỏi đảo! Mất hết đom đóm', 'bad');
        else hud.toast(d.dropped > 0 ? `Bóng Mực chạm bạn! Rơi ${d.dropped} đom đóm` : 'Bóng Mực chạm bạn!', 'bad');
        break;
      case 'shade_spawned':
        audio.sfx('shade'); hud.toast('Một Bóng Mực mới trồi lên từ sương...', 'bad');
        break;
      case 'dash':
        dashT = 0.25; fx.dash(cur.player.pos, faceAngle); audio.sfx('dash');
        break;
      case 'charm_picked':
        audio.sfx('charm'); hud.toast('Bùa Gió! Chạy nhanh và lướt không cần chờ', 'good');
        break;
      case 'drifter_steal':
        audio.sfx('steal'); hud.toast(`Gió Lạc cướp ${d.amount} đom đóm!`, 'bad');
        break;
      case 'drifter_drop':
        audio.sfx('drop'); hud.toast(`Gió Lạc làm rơi ${d.amount} đom đóm`, 'good');
        break;
      case 'night_start':
        hud.toast(`Đêm ${d.night ?? night} · ${(map && map.name) || NIGHTS[night].name}`);
        break;
      case 'game_over':
        endInfo = { result: d.result, reason: d.reason };
        audio.sfx(d.result === 'won' ? 'win' : 'lose');
        break;
      default: break;
    }
  }
}

// âm thanh suy ra từ snapshot (nhảy, bục nhảy, đếm ngược, gió)
function derivedAudio() {
  const p0 = prev.player; const p1 = cur.player;
  if (p0.grounded && !p1.grounded) {
    const vy = p1.vel[1];
    if (vy > 10) audio.sfx('pad');
    else if (vy > 3) audio.sfx('jump');
  }
  const secs = Math.ceil(cur.time_left_s - 1e-9);
  if (secs <= 10 && secs > 0 && secs !== lastCountdown && cur.state !== 'paused') {
    audio.sfx(secs === 1 ? 'tickFinal' : 'tick');
  }
  lastCountdown = secs;
  const st = cur.sim_tick;
  const inWarn = !!map.wind && st > 0 && !cur.wind.active && (st % WIND_PERIOD) >= WIND_PERIOD - WIND_WARN_TICKS;
  if (inWarn && !windWarned) { audio.sfx('windWarn'); hud.toast('Gió sắp nổi!', 'bad'); leafDir = Math.random() * 360; }
  windWarned = inWarn;
  if (cur.wind.active !== windWasActive) { windWasActive = cur.wind.active; audio.wind(windWasActive); }
}

// ---------------------------------------------------------------- FPS
// Độ phân giải thích ứng: dưới 28 FPS thì giảm dần (tối thiểu 45%), nhiều dư thì tăng lại. ?adapt=0 để tắt.
let slowWin = 0; let fastWin = 0;
function adapt(fps) {
  if (params.get('adapt') === '0' || document.hidden) return;
  slowWin = fps < 28 ? slowWin + 1 : 0;
  fastWin = fps > 58 ? fastWin + 1 : 0;
  const s = stage.renderScale;
  if (slowWin >= 3 && s > 0.45) { stage.setRenderScale(Math.max(0.45, s * 0.8)); slowWin = 0; }
  else if (fastWin >= 8 && s < 1) { stage.setRenderScale(Math.min(1, s * 1.15)); fastWin = 0; }
}
const fpsStats = (() => {
  let frames = 0; let time = 0; let winFrames = 0; let winTime = 0; let cur = 0; let min = Infinity;
  const api = {
    reset() { frames = 0; time = 0; winFrames = 0; winTime = 0; cur = 0; min = Infinity; },
    tick(dtReal) {
      frames++; time += dtReal; winFrames++; winTime += dtReal;
      if (winTime >= 0.5) {
        cur = winFrames / winTime;
        if (time > 2) min = Math.min(min, cur);
        winFrames = 0; winTime = 0;
        window.__fps = { avg: frames / time, cur, min: Number.isFinite(min) ? min : cur, frames, seconds: time, scale: stage.renderScale };
        adapt(cur);
        if (params.get('fps') === '1') hud.setFps(`FPS ${cur.toFixed(0)} · TB ${(frames / time).toFixed(1)} · min ${window.__fps.min.toFixed(0)} · ${Math.round(stage.renderScale * 100)}%`);
      }
    },
  };
  return api;
})();
if (params.get('fps') === '1') hud.showFps(true);

// ---------------------------------------------------------------- Vẽ
const lerp = (a, b, k) => a + (b - a) * k;
const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
// bước nhảy xa (hồi sinh) thì không nội suy
const lerpPos = (a, b, k) => (Math.hypot(b[0] - a[0], b[2] - a[2]) > 3 || Math.abs(b[1] - a[1]) > 3 ? b : lerp3(a, b, k));

function syncPool(pool, items, make, dispose) {
  const seen = new Set();
  for (const it of items) {
    seen.add(it.id);
    if (!pool.has(it.id)) pool.set(it.id, make(it));
  }
  for (const [id, v] of pool) {
    if (!seen.has(id)) { dispose(v); pool.delete(id); }
  }
}

const groundOf = (x, y, z) => {
  const h = groundHeight(map, x, z, y);
  return h === null ? -60 : h;
};

const camLook = new THREE.Vector3();
const tmpV = new THREE.Vector3();

function render(alpha, dt, t) {
  const pPrev = prev.player.pos;
  const pCur = cur.player.pos;
  const pPos = lerpPos(pPrev, pCur, alpha);
  const vel = cur.player.vel;
  let vx = vel[0]; let vz = vel[2];
  if (!g || !g.map) { vx = (pCur[0] - pPrev[0]) * 60; vz = (pCur[2] - pPrev[2]) * 60; }
  const hs = Math.hypot(vx, vz);
  if (hs > 0.6) faceAngle = Math.atan2(vx, vz);
  const speed01 = Math.min(1, hs / tuning.player_speed);
  dashT = Math.max(0, dashT - dt);
  const blink = cur.player.invuln && Math.floor(t * 12) % 2 === 0;

  const nLan = Math.max(1, cur.lanterns.length);
  const litCount = stage.updateLanterns(cur.lanterns, dt, t, pPos);
  fx.update(dt);
  stage.updateAmbience(litCount / nLan, dt, t, fx.state.flash, false);
  stage.skyGroup.position.set(pPos[0], 0, pPos[2]);

  playerView.update(pPos, faceAngle, speed01, t, dt, blink, fx.state.flash, {
    groundY: groundOf(pPos[0], pPos[1], pPos[2]), charm: cur.player.charm_s > 0, dashing: dashT > 0,
  });

  // Bóng Mực
  syncPool(shadeViews, cur.shades, (s) => createShadeView(root, glowTex, s.id, s.state), (v) => v.dispose());
  for (const id of drainTargets.keys()) {
    if (!cur.shades.some((s) => s.id === id && s.state === 'drain')) drainTargets.delete(id);
  }
  const prevShades = new Map(prev.shades.map((s) => [s.id, s]));
  for (const s of cur.shades) {
    const p0 = prevShades.get(s.id);
    const pos = p0 ? lerpPos(p0.pos, s.pos, alpha) : [...s.pos];
    // Ưu tiên mục tiêu từ sự kiện; trước sự kiện đầu tiên, suy ra đèn yếu gần nhất để vẽ.
    let drainTarget = null;
    if (s.state === 'drain') {
      drainTarget = lanternById(drainTargets.get(s.id));
      if (!drainTarget?.lit || drainTarget.fuel >= tuning.low_fuel_threshold) drainTarget = null;
      let best = Infinity;
      for (const l of drainTarget ? [] : cur.lanterns) {
        if (!l.lit || l.fuel >= tuning.low_fuel_threshold) continue;
        const d = Math.hypot(l.pos[0] - s.pos[0], l.pos[2] - s.pos[2]);
        if (d < best || (d === best && l.id < drainTarget.id)) { best = d; drainTarget = l; }
      }
    }
    const facing = drainTarget ? drainTarget.pos : pPos;
    const face = Math.atan2(facing[0] - pos[0], facing[2] - pos[2]);
    shadeViews.get(s.id).update(pos, s.state, pos[1] - 1.0, face, t, dt,
      settings.distinguishableColors, drainTarget?.pos);
  }

  // đom đóm (kể cả đom đóm rơi)
  syncPool(moteViews, cur.motes, (m) => createMoteView(root, glowTex, m.id), (v) => v.dispose());
  for (const m of cur.motes) moteViews.get(m.id).update(m.pos, t, m.kind, m.ttl_s);

  // Gió Lạc
  syncPool(drifterViews, cur.drifters, (d) => createDrifterView(root, glowTex, d.id), (v) => v.dispose());
  const prevDr = new Map(prev.drifters.map((d) => [d.id, d]));
  for (const d of cur.drifters) {
    const p0 = prevDr.get(d.id);
    const pos = p0 ? lerpPos(p0.pos, d.pos, alpha) : [...d.pos];
    if (p0) {
      const dx = d.pos[0] - p0.pos[0]; const dz = d.pos[2] - p0.pos[2];
      if (Math.hypot(dx, dz) > 0.005) drifterHeading.set(d.id, Math.atan2(dx, dz));
    }
    drifterViews.get(d.id).update(pos, d.state, d.stolen, pos[1] - 1.5, drifterHeading.get(d.id) ?? 0, t, dt);
  }

  // Bùa Gió (vị trí lấy từ bản đồ theo thứ tự id C1, C2...)
  syncPool(charmViews, cur.charms, (c) => {
    const idx = (parseInt(c.id.replace(/\D/g, ''), 10) || 1) - 1;
    const pt = (map.charm_points || [])[idx] || [0, 0, 0];
    return createCharmView(root, glowTex, c.id, pt);
  }, (v) => v.dispose());
  for (const c of cur.charms) charmViews.get(c.id).update(c.available, t);

  // lá bay khi gió
  const warn = windWarned && !cur.wind.active;
  const leafI = cur.wind.active ? 1 : warn ? 0.35 : 0;
  leaves.update(dt, t, pPos, leafI, cur.wind.active && cur.wind.dir_deg != null ? cur.wind.dir_deg : leafDir);

  // camera
  const th = ((attract() ? attractYaw : input.yaw) * Math.PI) / 180;
  if (attract()) {
    attractYaw += dt * 7;
    let minX = Infinity; let maxX = -Infinity;
    for (const i of map.islands) { minX = Math.min(minX, i.center[0] - i.radius); maxX = Math.max(maxX, i.center[0] + i.radius); }
    const cx = (minX + maxX) / 2;
    const dist = Math.max(30, (maxX - minX) * 0.55);
    const ax = cx - Math.sin(th) * dist; const az = -Math.cos(th) * dist;
    camera.position.set(-ax, dist * 0.42, az);
    camLook.set(-cx, 2, 0);
    camera.fov = 55;
  } else {
    const D = 9.5;
    const H = 7.2 + pPos[1] * 0.4;
    const cx = pPos[0] - Math.sin(th) * D;
    const cz = pPos[2] - Math.cos(th) * D;
    shake = Math.max(0, shake - dt * 2.2);
    const sh = shake * shake * 0.35;
    camera.position.set(-cx + (Math.random() - 0.5) * sh, H + (Math.random() - 0.5) * sh, cz);
    camLook.set(-pPos[0], 0.9 + pPos[1] * 0.5, pPos[2]);
    const launched = !cur.player.grounded && Math.hypot(vx, vz) > 10;
    const targetFov = 55 + (dashT > 0 ? 8 : 0) + (launched ? 5 : 0);
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 10);
  }
  camera.updateProjectionMatrix();
  camera.lookAt(camLook);
  stage.renderer.render(stage.scene, camera);
}

function attract() { return mode === 'menu' || mode === 'intro'; }

function hudValues() {
  const p = cur.player;
  let prompt = '';
  let nearest = null; let nd = Infinity;
  let interact = null; let interactDist = Infinity;
  for (const l of cur.lanterns) {
    const d = Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]);
    if (!l.lit && (d < nd || (d === nd && l.id < nearest.id))) { nd = d; nearest = l; }
    if (l.lit && l.fuel >= tuning.fuel_max) continue;
    if (d <= tuning.interact_radius && Math.abs(l.pos[1] - p.pos[1]) <= 1.5 &&
      (d < interactDist || (d === interactDist && l.id < interact.id))) {
      interactDist = d; interact = l;
    }
  }
  if (interact) {
    const cost = interact.ever_lit ? tuning.relight_cost : tuning.lantern_cost;
    prompt = interact.lit ? `E — Châm dầu (${interact.fuel}/${tuning.fuel_max})` :
      `E — ${interact.ever_lit ? 'Thắp lại' : 'Nạp ánh sáng'} (${interact.deposited}/${cost})`;
  }
  // mũi tên chỉ đèn chưa sáng gần nhất khi nó ở ngoài màn hình
  let arrow = null;
  if (nearest && mode !== 'menu' && mode !== 'intro') {
    tmpV.set(nearest.pos[0], nearest.pos[1] + 3.75, nearest.pos[2]);
    root.localToWorld(tmpV);
    tmpV.applyMatrix4(camera.matrixWorldInverse);
    const behind = tmpV.z > 0;
    tmpV.applyMatrix4(camera.projectionMatrix);
    let nx = tmpV.x; let ny = tmpV.y;
    if (behind) { nx = -nx; ny = -ny; if (Math.abs(nx) < 0.01 && Math.abs(ny) < 0.01) ny = -1; }
    const off = behind || Math.abs(nx) > 0.92 || Math.abs(ny) > 0.88;
    if (off && nd > 4) {
      const w = window.innerWidth; const h = window.innerHeight;
      const len = Math.hypot(nx, ny) || 1;
      const ux = nx / len; const uy = ny / len;
      // lề: tránh đè lên các bảng HUD (trên 130 px, dưới 140 px, hai bên 70 px)
      const sx = ux === 0 ? Infinity : (w / 2 - 70) / Math.abs(ux);
      const sy = uy === 0 ? Infinity : (h / 2 - (uy > 0 ? 130 : 140)) / Math.abs(uy);
      const s = Math.min(sx, sy);
      arrow = { x: w / 2 + ux * s, y: h / 2 - uy * s, angle: Math.atan2(ux, uy), dist: nd };
    }
  }
  return {
    snap: cur, night, nightName: (map && map.name) || NIGHTS[night].name,
    timeLeft: cur.time_left_s,
    prompt: mode === 'playing' ? prompt : '',
    arrow: mode === 'playing' ? arrow : null,
    windWarn: mode === 'playing' && windWarned && !cur.wind.active,
  };
}

// ---------------------------------------------------------------- Vòng lặp
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const real = Math.max(0, (now - last) / 1000);
  const dt = Math.min(0.25, real);
  last = now;
  clockT += dt;
  input.update(dt);
  if (mode === 'playing' || mode === 'paused') fpsStats.tick(real);

  if ((mode === 'playing' || mode === 'paused' || mode === 'ended') && !softPaused) {
    if (mode !== 'ended') acc += dt; else acc = 0;
    let n = 0;
    while (mode !== 'ended' && acc >= STEP && n < MAX_STEPS_PER_FRAME) {
      const events = g.step(input.stepInput());
      input.clearLatches();
      ticks++;
      prev = cur;
      cur = copySnap(g.snapshot());
      if (mode === 'playing') { handleEvents(events); derivedAudio(); } else if (mode === 'paused') handleEvents(events.filter((e) => e.name !== 'pause'));
      acc -= STEP;
      n++;
      if (g.ended) {
        if (!endInfo) endInfo = { result: g.state, reason: g.state === 'won' ? 'dawn_survived' : (cur.player.flames <= 0 ? 'no_flames' : 'dawn') };
        mode = 'ended'; endTimer = 1.3; prev = cur; acc = 0;
        screens.hide();
        break;
      }
    }
    if (n === MAX_STEPS_PER_FRAME) acc = 0;
  }
  if (mode === 'ended') {
    endTimer -= dt;
    if (endTimer <= 0) finishEnd();
  }

  const alpha = mode === 'playing' ? Math.min(1, acc / STEP) : 1;
  render(alpha, dt, clockT);
  if (mode !== 'menu' && mode !== 'intro') hud.update(hudValues());
}

// ---------------------------------------------------------------- Khởi động
window.addEventListener('resize', () => stage.resize());

// Dùng cho lead / kiểm tra bằng Chrome headless
window.__client = {
  input, stage, fx, audio, settings, run, screens,
  start: beginPlay,
  restart: restartNight,
  showIntro, showMenu, startRun,
  // dựng ván có scenario (chỉ để kiểm tra/chụp ảnh): __client.loadScenario({...}, night)
  loadScenario(scenario, n = night) { newGame(n, scenario); beginPlay(); },
  get mode() { return mode; },
  get night() { return night; },
  get seed() { return seed; },
  get ticks() { return ticks; },
  get snapshot() { return cur; },
};

const qNight = Number.parseInt(params.get('night'), 10);
const startNight = [1, 2, 3].includes(qNight) ? qNight : null;
if (params.get('autostart') === '1') {
  newGame(startNight || 1);
  beginPlay();
} else if (startNight) {
  showIntro(startNight);
} else {
  showMenu();
}
requestAnimationFrame((t) => { last = t; frame(t); });
