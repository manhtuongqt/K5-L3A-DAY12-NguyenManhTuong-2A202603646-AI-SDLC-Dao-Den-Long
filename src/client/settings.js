// Cài đặt người chơi, lưu localStorage; mọi truy cập bọc try/catch.
const KEY = 'dao-den-long.settings.v1';

export const KEY_ACTIONS = [
  ['up', 'Đi lên'], ['down', 'Đi xuống'], ['left', 'Đi trái'], ['right', 'Đi phải'],
  ['jump', 'Nhảy'], ['dash', 'Lướt'], ['interact', 'Tương tác (thắp / châm dầu)'], ['pulse', 'Tỏa sáng'],
  ['pause', 'Tạm dừng'], ['camL', 'Xoay camera trái'], ['camR', 'Xoay camera phải'],
];
export const DEFAULT_KEYS = {
  up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft',
  interact: 'KeyE', pulse: 'KeyF', pause: 'Escape', camL: 'KeyQ', camR: 'KeyC',
};
// phím cố định, không cho gán lại
export const RESERVED_KEYS = { Enter: 'Xác nhận', NumpadEnter: 'Xác nhận', KeyR: 'Chơi lại Đêm' };

const DEFAULTS = {
  volume: 0.7, sensitivity: 1, distinguishableColors: false, reduceMotion: false, largeText: false,
  keys: DEFAULT_KEYS,
};

const clamp = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

export function keyLabel(code) {
  if (!code) return '—';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  const m = {
    Space: 'Space', ShiftLeft: 'Shift trái', ShiftRight: 'Shift phải', ControlLeft: 'Ctrl trái', ControlRight: 'Ctrl phải',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc', Tab: 'Tab', Backspace: 'Backspace',
  };
  return m[code] || code;
}

function cleanKeys(o) {
  const k = { ...DEFAULT_KEYS };
  if (o && typeof o === 'object') {
    for (const a of Object.keys(DEFAULT_KEYS)) if (typeof o[a] === 'string' && o[a] && !(o[a] in RESERVED_KEYS)) k[a] = o[a];
  }
  // lưu hỏng bị trùng phím thì quay về mặc định
  if (new Set(Object.values(k)).size !== Object.keys(k).length) return { ...DEFAULT_KEYS };
  return k;
}

export function loadSettings() {
  const s = { ...DEFAULTS, keys: { ...DEFAULT_KEYS } };
  try { s.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* bỏ qua */ }
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw);
      s.volume = clamp(Number(o.volume), 0, 1, DEFAULTS.volume);
      s.sensitivity = clamp(Number(o.sensitivity), 0.3, 2.5, DEFAULTS.sensitivity);
      s.distinguishableColors = o.distinguishableColors === true;
      if (typeof o.reduceMotion === 'boolean') s.reduceMotion = o.reduceMotion;
      s.largeText = o.largeText === true;
      s.keys = cleanKeys(o.keys);
    }
  } catch { /* chế độ riêng tư hoặc bị chặn: dùng mặc định */ }
  return s;
}

export function saveSettings(s) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({
      volume: s.volume, sensitivity: s.sensitivity, distinguishableColors: s.distinguishableColors === true,
      reduceMotion: s.reduceMotion === true, largeText: s.largeText === true, keys: s.keys,
    }));
  } catch { /* bỏ qua */ }
}
