// Bàn phím + chuột -> input cho sim, và yaw camera (cam_yaw_deg).
//
// Quy ước (khớp sim): move [x, z], D = +x, W = +z. Với yaw θ, W đi theo (sinθ, cosθ).
// Camera đặt phía sau nên W luôn đi "ra xa camera". Tăng yaw = camera quay sang phải.
// E dùng để nạp đèn nên xoay camera bằng Q (trái) và C (phải) hoặc kéo chuột trái.

const KEY_MAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'jump',
  KeyE: 'interact',
  KeyF: 'pulse',
  KeyQ: 'camL', KeyZ: 'camL',
  KeyC: 'camR',
};

export function createInput(canvas, handlers) {
  const held = {
    up: false, down: false, left: false, right: false,
    jump: false, interact: false, pulse: false, camL: false, camR: false,
  };
  // chốt "đã bấm" để cú bấm ngắn giữa hai bước 60 Hz không bị mất
  const latch = { jump: false, interact: false, pulse: false };
  const mouse = { drag: false, pulse: false };
  const api = {
    yaw: 0, // độ
    held,
    // cho phép lead/test ghi đè trực tiếp: nếu đặt thì dùng thay cho phím
    override: null,
  };

  function setKey(name, down) {
    held[name] = down;
    if (down && name in latch) latch[name] = true;
  }

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // không chặn phím tắt của trình duyệt
    if (e.code === 'Enter') { handlers.onEnter?.(); return; }
    if (e.code === 'KeyR' && !e.repeat) { handlers.onRestart?.(); return; }
    const name = KEY_MAP[e.code];
    if (!name) return;
    e.preventDefault();
    if (e.repeat) return;
    setKey(name, true);
  });
  window.addEventListener('keyup', (e) => {
    const name = KEY_MAP[e.code];
    if (!name) return;
    e.preventDefault();
    setKey(name, false);
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(held)) held[k] = false;
    mouse.drag = false;
    mouse.pulse = false;
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouse.drag = true;
    else if (e.button === 2) { mouse.pulse = true; latch.pulse = true; }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.drag = false;
    else if (e.button === 2) mouse.pulse = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (mouse.drag) api.yaw -= e.movementX * 0.3;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // gọi mỗi khung hình
  api.update = (dt) => {
    const turn = (held.camR ? 1 : 0) - (held.camL ? 1 : 0);
    api.yaw += turn * 100 * dt;
    api.yaw = ((api.yaw % 360) + 540) % 360 - 180; // gọn về [-180, 180)
  };

  // input giữ nguyên cho một bước sim
  api.stepInput = () => {
    if (api.override) return { ...api.override, cam_yaw_deg: api.yaw };
    const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    const z = (held.up ? 1 : 0) - (held.down ? 1 : 0);
    return {
      move: [x, z],
      cam_yaw_deg: api.yaw,
      jump: held.jump || latch.jump,
      interact: held.interact || latch.interact,
      pulse: held.pulse || mouse.pulse || latch.pulse,
    };
  };
  // gọi sau mỗi bước sim: chốt đã được bước đó nhìn thấy
  api.clearLatches = () => {
    latch.jump = latch.interact = latch.pulse = false;
  };
  api.reset = () => {
    for (const k of Object.keys(held)) held[k] = false;
    mouse.pulse = false;
    api.clearLatches();
  };

  return api;
}
