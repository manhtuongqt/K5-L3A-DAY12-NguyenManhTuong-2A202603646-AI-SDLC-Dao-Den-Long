// Cài đặt người chơi (âm lượng, độ nhạy chuột), lưu localStorage; mọi truy cập bọc try/catch.
const KEY = 'dao-den-long.settings.v1';
const DEFAULTS = { volume: 0.7, sensitivity: 1 };

const clamp = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

export function loadSettings() {
  const s = { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw);
      s.volume = clamp(Number(o.volume), 0, 1, DEFAULTS.volume);
      s.sensitivity = clamp(Number(o.sensitivity), 0.3, 2.5, DEFAULTS.sensitivity);
    }
  } catch { /* chế độ riêng tư hoặc bị chặn: dùng mặc định */ }
  return s;
}

export function saveSettings(s) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ volume: s.volume, sensitivity: s.sensitivity }));
  } catch { /* bỏ qua */ }
}
