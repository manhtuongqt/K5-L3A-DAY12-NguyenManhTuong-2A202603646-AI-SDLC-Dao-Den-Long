import * as THREE from 'three';
import contract from '../../game.contract.json';
import { createGame } from '../sim/game.js';
import { makeBenchScenario } from '../sim/bench.js';
import { makeGlowTexture } from './textures.js';
import { createStage } from './scene.js';
import { createPlayerView, createShadeView, createMoteView } from './actors.js';
import { createEffects } from './effects.js';

const bench = window.__bench;
function fail(err) {
  bench.error = err instanceof Error ? err.message : String(err);
  const message = document.getElementById('error');
  message.textContent = `Benchmark: ${bench.error}`;
  message.hidden = false;
  console.error(err);
}

try {
  const params = new URLSearchParams(location.search);
  const seed = Number(params.get('seed') ?? 42);
  const duration = Number(params.get('duration') ?? 30);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !Number.isFinite(duration) || duration <= 0) {
    throw new Error('Invalid benchmark seed/duration');
  }
  const texture = makeGlowTexture();
  const stage = createStage(document.getElementById('view'), contract.tuning, texture);
  // Benchmark always renders at the CDP viewport resolution, without adaptation.
  stage.renderer.setPixelRatio(1);
  stage.resize();
  const gl = stage.renderer.getContext();
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  bench.renderer = `Three.js r${THREE.REVISION}; ${gl.getParameter(gl.VERSION)}; ${gpu}`;
  stage.renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); fail(new Error('WebGL context lost'));
  });
  const game = createGame({ seed, night: 1, tuning: contract.tuning, scenario: makeBenchScenario(seed), bench: true });
  stage.loadMap(game.map);
  const fx = createEffects(stage.root, contract.tuning, texture);
  const player = createPlayerView(stage.root, texture);
  let current = game.snapshot();
  let previous = current;
  const shades = new Map(current.shades.map((s) => [s.id, createShadeView(stage.root, texture, s.id, s.state)]));
  const motes = new Map(current.motes.map((m) => [m.id, createMoteView(stage.root, texture, m.id)]));
  const step = 1 / 60;
  let accumulator = 0;
  let first = null;
  let last = null;
  const interpolate = (a, b, alpha) => b.map((v, i) => a[i] + (v - a[i]) * alpha);

  function frame() {
    if (bench.error || bench.done) return;
    try {
      const now = performance.now();
      if (first === null) first = now;
      const elapsed = (now - first) / 1000;
      const real = last === null ? 0 : (now - last) / 1000;
      last = now;
      // Frame timestamps select the fixed [3 s, 3 s + duration) window.
      // Keep actual frame deltas, including stalls; never manufacture shorter
      // boundary frames or apply the simulation's catch-up clamp to metrics.
      if (elapsed >= 3 + duration) { bench.done = true; return; }
      // Same fixed step and maximum catch-up budget as the gameplay client.
      const dt = Math.min(0.25, real);
      accumulator += dt;
      let steps = 0;
      while (accumulator >= step && steps < 5) {
        game.step({});
        previous = current;
        current = game.snapshot();
        accumulator -= step;
        steps++;
      }
      if (steps === 5) accumulator = 0;
      const alpha = Math.min(1, accumulator / step);
      const theta = 2 * Math.PI * elapsed / 15;
      // scene.root mirrors X. Convert the ticket's sim coordinates to world
      // coordinates, preserving +X -> +Z counterclockwise around the island.
      stage.camera.position.set(-30 * Math.cos(theta), 15, 30 * Math.sin(theta));
      stage.camera.lookAt(0, 0, 0);
      const lit = stage.updateLanterns(current.lanterns, dt, elapsed, [0, 0, 0]);
      fx.update(dt);
      stage.updateAmbience(lit / current.lanterns.length, dt, elapsed, fx.state.flash, false);
      player.update([0, 0, 0], 0, 0, elapsed, dt, false, fx.state.flash, { groundY: 0 });
      const before = new Map(previous.shades.map((s) => [s.id, s]));
      for (const shade of current.shades) {
        const prev = before.get(shade.id);
        const pos = prev ? interpolate(prev.pos, shade.pos, alpha) : shade.pos;
        const facing = prev ? Math.atan2(shade.pos[0] - prev.pos[0], shade.pos[2] - prev.pos[2]) : 0;
        shades.get(shade.id).update(pos, shade.state, pos[1] - 1, facing, elapsed, dt);
      }
      for (const mote of current.motes) motes.get(mote.id).update(mote.pos, elapsed, mote.kind, mote.ttl_s);
      stage.renderer.render(stage.scene, stage.camera);
      if (bench.firstFrameAt === null) bench.firstFrameAt = Date.now();

      if (elapsed >= 3 && real > 0) bench.dts.push(real * 1000);
      requestAnimationFrame(frame);
    } catch (err) { fail(err); }
  }
  window.addEventListener('resize', () => stage.resize());
  // Biên dịch sẵn mọi shader trong cảnh trước khung đầu, tránh khựng biên dịch giữa lúc đo.
  stage.renderer.compile(stage.scene, stage.camera);
  requestAnimationFrame(frame);
} catch (err) { fail(err); }
