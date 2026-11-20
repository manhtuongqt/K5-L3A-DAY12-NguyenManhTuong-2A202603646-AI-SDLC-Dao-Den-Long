// Bàn phím + chuột -> input cho sim, và yaw camera (cam_yaw_deg).
//
// Quy ước (khớp sim): move [x, z], D = +x, W = +z. Với yaw θ, W đi theo (sinθ, cosθ).
// Camera đặt phía sau nên W luôn đi "ra xa camera". Tăng yaw = camera quay sang phải.
// E dùng để nạp đèn nên xoay camera bằng Q (trái) và C (phải) hoặc kéo chuột trái.
// Phím gán được trong Cài đặt > Đổi phím. Mặc định Shift = Lướt, Esc/P = tạm dừng (gửi `pause` cho sim, sim tự dừng logic).

// Bản đồ phím lấy từ settings.keys; phím phụ (mũi tên, Shift phải, P, Z) chỉ dùng khi chưa bị gán cho hành động khác.
const ALIASES = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  ShiftRight: 'dash', KeyP: 'pause', Escape: 'pause', KeyZ: 'camL',
};
let mapFor = null; let mapCache = null;
function keyMap(keys) {
  if (mapFor === keys && mapCache) return mapCache;
  const m = {};
  for (const [a, c] of Object.entries(keys || {})) m[c] = a;
  for (const [c, a] of Object.entries(ALIASES)) if (!(c in m)) m[c] = a;
  mapFor = keys; mapCache = m;
  return m;
}

export function createInput(canvas, handlers, getSettings) {
  const held = {
    up: false, down: false, left: false, right: false,
    jump: false, interact: false, pulse: false, dash: false, camL: false, camR: false,
  };
  // chốt "đã bấm" để cú bấm ngắn giữa hai bước 60 Hz không bị mất
  const latch = { jump: false, interact: false, pulse: false, dash: false, pause: false };
  const mouse = { drag: false, pulse: false };
  const api = { yaw: 0, held, override: null };

  const setKey = (name, down) => {
    held[name] = down;
    if (down && name in latch) latch[name] = true;
  };

  window.addEventListener('keydown', (e) => {
    handlers.onAnyInput?.();
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return; // đang gõ tên
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      if (handlers.onEnter?.()) e.preventDefault();
      return;
    }
    if (e.code === 'KeyR') {
      if (!e.repeat) handlers.onRestart?.();
      return;
    }
    const name = keyMap(getSettings && getSettings().keys)[e.code];
    if (!name) return;
    e.preventDefault();
    if (e.repeat) return;
    if (name === 'pause') { handlers.onPause?.(); return; }
    setKey(name, true);
  });
  window.addEventListener('keyup', (e) => {
    const name = keyMap(getSettings && getSettings().keys)[e.code];
    if (!name || name === 'pause') return;
    e.preventDefault();
    setKey(name, false);
  });
  window.addEventListener('blur', () => api.releaseAll());

  canvas.addEventListener('mousedown', (e) => {
    handlers.onAnyInput?.();
    if (e.button === 0) mouse.drag = true;
    else if (e.button === 2) { mouse.pulse = true; latch.pulse = true; }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.drag = false;
    else if (e.button === 2) mouse.pulse = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (mouse.drag) api.yaw -= e.movementX * 0.3 * (getSettings ? getSettings().sensitivity : 1);
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  api.update = (dt) => {
    const turn = (held.camR ? 1 : 0) - (held.camL ? 1 : 0);
    api.yaw += turn * 100 * (getSettings ? getSettings().sensitivity : 1) * dt;
    api.yaw = ((api.yaw % 360) + 540) % 360 - 180;
  };

  api.requestPause = () => { latch.pause = true; };

  api.stepInput = () => {
    const base = api.override ? { ...api.override } : (() => {
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const z = (held.up ? 1 : 0) - (held.down ? 1 : 0);
      return {
        move: [x, z],
        jump: held.jump || latch.jump,
        interact: held.interact || latch.interact,
        pulse: held.pulse || mouse.pulse || latch.pulse,
        dash: held.dash || latch.dash,
      };
    })();
    base.cam_yaw_deg = api.yaw;
    base.pause = latch.pause;
    return base;
  };
  api.clearLatches = () => {
    latch.jump = latch.interact = latch.pulse = latch.dash = latch.pause = false;
  };
  api.releaseAll = () => {
    for (const k of Object.keys(held)) held[k] = false;
    mouse.drag = false;
    mouse.pulse = false;
  };
  api.reset = () => {
    api.releaseAll();
    api.clearLatches();
  };
  return api;
}
