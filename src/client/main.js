// Client: vòng lặp bước cố định 60 Hz, gọi sim, vẽ theo snapshot (nội suy giữa hai bước).
// File này chỉ hiển thị và gửi input; mọi luật chơi nằm trong src/sim/.
import './style.css';
import * as THREE from 'three';
import { createGame } from '../sim/game.js';
import { SHADE_Y } from '../sim/world.js';
import contract from '../../game.contract.json';
import { makeGlowTexture } from './textures.js';
import { createStage } from './scene.js';
import { createPlayerView, createShadeView, createMoteView } from './actors.js';
import { createEffects } from './effects.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';

const tuning = contract.tuning;
const STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;

const canvas = document.getElementById('view');
const hud = createHud(tuning);
const params = new URLSearchParams(window.location.search);

function randomSeed() {
  const a = new Uint32Array(1);
  (globalThis.crypto || window.crypto).getRandomValues(a);
  return a[0];
}
function initialSeed() {
  if (params.has('seed')) {
    const n = Number.parseInt(params.get('seed'), 10);
    if (Number.isFinite(n)) return n >>> 0;
  }
  return randomSeed();
}

// ---------------------------------------------------------------- Dựng cảnh
let stage;
let glowTex;
try {
  glowTex = makeGlowTexture();
  stage = createStage(canvas, tuning, glowTex);
} catch (err) {
  console.error(err);
  hud.showError('Không khởi tạo được WebGL: ' + (err && err.message ? err.message : err));
  throw err;
}
const { root, camera } = stage;
const fx = createEffects(root, tuning, glowTex);
const playerView = createPlayerView(root, glowTex);
const shadeViews = new Map();
const moteViews = new Map();

// ---------------------------------------------------------------- Trạng thái client
let g = null;
let seed = initialSeed();
let mode = 'intro'; // 'intro' | 'playing' | 'ended'
let acc = 0;
let ticks = 0; // số bước client đã chạy
let prev = null;
let cur = null;
let lastPulseTick = -1e9;
let invulnUntilTick = -1;
let faceAngle = 0;
let shake = 0;
let endInfo = null;
let clockT = 0;

const input = createInput(canvas, {
  onEnter: () => { if (mode === 'intro') start(); },
  onRestart: () => { if (mode !== 'intro') restart(); },
});

// Sao chép snapshot để nội suy an toàn, kể cả khi sim tái sử dụng object.
function copySnap(s) {
  return {
    state: s.state,
    time_left_s: s.time_left_s,
    score: s.score,
    player: { pos: [...s.player.pos], flames: s.player.flames, carried: s.player.carried },
    lanterns: s.lanterns.map((l) => ({ id: l.id, pos: [...l.pos], lit: l.lit, deposited: l.deposited })),
    shades: s.shades.map((e) => ({ id: e.id, pos: [...e.pos], state: e.state })),
    motes: (s.motes || []).map((m) => ({ id: m.id, pos: [...m.pos] })),
  };
}

function newGame(newSeed, scenario) {
  seed = newSeed;
  g = createGame({ seed, tuning, scenario });
  window.__game = g;
  prev = cur = copySnap(g.snapshot());
  acc = 0;
  ticks = 0;
  lastPulseTick = -1e9;
  invulnUntilTick = -1;
  endInfo = null;
  shake = 0;
  faceAngle = 0;
  for (const v of shadeViews.values()) v.dispose();
  for (const v of moteViews.values()) v.dispose();
  shadeViews.clear();
  moteViews.clear();
  hud.hideEnd();
  hud.clearToasts();
  input.reset();
}

function start() {
  mode = 'playing';
  hud.showIntro(false);
  hud.showHud(true);
}

function restart() {
  newGame(randomSeed());
  start();
}

// ---------------------------------------------------------------- Sự kiện sim -> hiệu ứng / thông báo
function lanternById(id) {
  return cur.lanterns.find((l) => l.id === id);
}

function handleEvents(events) {
  for (const ev of events) {
    const d = ev.data || {};
    switch (ev.name) {
      case 'mote_picked':
        fx.pickup(cur.player.pos);
        break;
      case 'deposit': {
        const l = lanternById(d.lantern_id);
        if (l) fx.deposit(l.pos);
        hud.toast(`Nạp ${d.amount} đom đóm vào ${d.lantern_id} (${d.deposited}/${tuning.lantern_cost})`);
        break;
      }
      case 'lantern_lit': {
        const l = lanternById(d.lantern_id);
        if (l) fx.lanternLit(l.pos, tuning.safe_radius);
        hud.toast(`Đèn ${d.lantern_id} đã sáng!`);
        break;
      }
      case 'pulse':
        lastPulseTick = ev.tick ?? ticks;
        fx.pulse(cur.player.pos);
        if (d.stunned_ids && d.stunned_ids.length) {
          hud.toast(`Bóng Mực choáng váng x${d.stunned_ids.length}!`);
        }
        break;
      case 'player_hit':
        invulnUntilTick = ticks + Math.round(tuning.invuln_s * 60);
        shake = 1;
        hud.hitFlash();
        hud.toast(d.dropped > 0 ? `Bóng Mực chạm bạn! Rơi ${d.dropped} đom đóm` : 'Bóng Mực chạm bạn!', 'bad');
        break;
      case 'shade_spawned':
        hud.toast('Một Bóng Mực mới trồi lên từ sương...', 'bad');
        break;
      case 'game_over':
        endInfo = { result: d.result, reason: d.reason };
        break;
      default:
        break;
    }
  }
}

function finishIfEnded() {
  if (!g.ended) return false;
  if (!endInfo) {
    endInfo = {
      result: g.state,
      reason: g.state === 'won' ? 'all_lit' : (cur.player.flames <= 0 ? 'no_flames' : 'dawn'),
    };
  }
  mode = 'ended';
  prev = cur;
  hud.showEnd(endInfo.result, endInfo.reason, cur);
  return true;
}

// ---------------------------------------------------------------- Vẽ
const lerp = (a, b, k) => a + (b - a) * k;
const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

function syncPool(pool, items, make, dispose) {
  const seen = new Set();
  for (const it of items) {
    seen.add(it.id);
    if (!pool.has(it.id)) pool.set(it.id, make(it.id));
  }
  for (const [id, v] of pool) {
    if (!seen.has(id)) { dispose(v); pool.delete(id); }
  }
}

const camLook = new THREE.Vector3();

function render(alpha, dt, t) {
  const pPrev = prev.player.pos;
  const pCur = cur.player.pos;
  const pPos = lerp3(pPrev, pCur, alpha);

  // hướng nhìn theo vận tốc
  const vx = pCur[0] - pPrev[0];
  const vz = pCur[2] - pPrev[2];
  const vlen = Math.hypot(vx, vz);
  if (vlen > 0.01) faceAngle = Math.atan2(vx, vz);
  const speed01 = Math.min(1, vlen / (tuning.player_speed / 60));
  const blink = ticks < invulnUntilTick && Math.floor(t * 12) % 2 === 0;

  // đèn lồng + ánh sáng chung
  const litCount = stage.updateLanterns(cur.lanterns, dt, t);
  const total = Math.max(1, cur.lanterns.length);
  fx.update(dt);
  stage.updateAmbience(litCount / total, dt, t, fx.state.flash);

  playerView.update(pPos, faceAngle, speed01, t, dt, blink, fx.state.flash);

  // Bóng Mực
  syncPool(shadeViews, cur.shades, (id) => createShadeView(root, glowTex, id), (v) => v.dispose());
  const prevShades = new Map(prev.shades.map((s) => [s.id, s]));
  for (const s of cur.shades) {
    const p0 = prevShades.get(s.id);
    const pos = p0 ? lerp3(p0.pos, s.pos, alpha) : s.pos;
    if (pos[1] === undefined) pos[1] = SHADE_Y;
    const face = Math.atan2(pPos[0] - pos[0], pPos[2] - pos[2]);
    shadeViews.get(s.id).update(pos, s.state === 'stunned', face, t, dt);
  }

  // đom đóm
  syncPool(moteViews, cur.motes, (id) => createMoteView(root, glowTex, id), (v) => v.dispose());
  for (const m of cur.motes) moteViews.get(m.id).update(m.pos, t);

  // camera bám sau lưng Mây. Tọa độ sim -> Three: x đảo dấu (xem scene.js).
  const th = (input.yaw * Math.PI) / 180;
  const D = 9.5;
  const H = 7.2 + pPos[1] * 0.4;
  const cx = pPos[0] - Math.sin(th) * D;
  const cz = pPos[2] - Math.cos(th) * D;
  shake = Math.max(0, shake - dt * 2.2);
  const sh = shake * shake * 0.35;
  camera.position.set(-cx + (Math.random() - 0.5) * sh, H + (Math.random() - 0.5) * sh, cz);
  camLook.set(-pPos[0], 0.9 + pPos[1] * 0.5, pPos[2]);
  camera.lookAt(camLook);

  stage.renderer.render(stage.scene, camera);
}

function hudValues() {
  const nowTick = ticks;
  const pulseCd = Math.max(0, tuning.pulse_cooldown_s - (nowTick - lastPulseTick) / 60);
  const p = cur.player;
  // gợi ý khi đứng gần đèn chưa thắp
  let prompt = '';
  for (const l of cur.lanterns) {
    if (l.lit) continue;
    if (Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) <= tuning.interact_radius) {
      prompt = p.carried > 0 ? `Nhấn E để nạp đèn ${l.id}` : 'Cần đom đóm để thắp đèn';
      break;
    }
  }
  return {
    snap: cur,
    timeLeft: cur.time_left_s,
    pulseCd,
    canPulse: p.carried >= tuning.pulse_cost,
    prompt: mode === 'playing' ? prompt : '',
  };
}

// ---------------------------------------------------------------- Vòng lặp
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, Math.max(0, (now - last) / 1000));
  last = now;
  clockT += dt;
  input.update(dt);

  if (mode === 'playing') {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < MAX_STEPS_PER_FRAME) {
      const events = g.step(input.stepInput());
      input.clearLatches();
      ticks++;
      prev = cur;
      cur = copySnap(g.snapshot());
      handleEvents(events);
      acc -= STEP;
      n++;
      if (finishIfEnded()) { acc = 0; break; }
    }
    if (n === MAX_STEPS_PER_FRAME) acc = 0; // bỏ phần dư nếu máy chậm, không đuổi theo
  }

  const alpha = mode === 'playing' ? Math.min(1, acc / STEP) : 1;
  render(alpha, dt, clockT);
  hud.update(hudValues());
}

// ---------------------------------------------------------------- Khởi động
window.addEventListener('resize', () => stage.resize());
hud.el.startBtn.addEventListener('click', () => { if (mode === 'intro') start(); });
hud.el.intro.addEventListener('click', () => { if (mode === 'intro') start(); });
hud.el.restartBtn.addEventListener('click', () => { if (mode === 'ended') restart(); });

newGame(seed);

// cho lead / kiểm tra bằng Chrome headless
window.__client = {
  input,
  stage,
  fx,
  start,
  restart,
  // dựng ván có scenario (chỉ để kiểm tra/chụp ảnh): __client.loadScenario({...}, seed)
  loadScenario(scenario, s = seed) { newGame(s, scenario); start(); },
  get mode() { return mode; },
  get seed() { return seed; },
  get ticks() { return ticks; },
};

if (params.get('autostart') === '1') start();
requestAnimationFrame((t) => { last = t; frame(t); });
