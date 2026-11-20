// Nearest-rank p95: sorted[ceil(0.95 * N) - 1]. All rates use raw dts;
// rounding happens only once, on output.
export function calculateMetrics(dts) {
  if (!Array.isArray(dts) || dts.length === 0 || dts.some((dt) => !Number.isFinite(dt) || dt <= 0)) {
    throw new TypeError('Benchmark needs a non-empty array of positive frame times');
  }
  const sorted = [...dts].sort((a, b) => a - b);
  const frames = dts.length;
  const k = Math.max(1, Math.ceil(frames * 0.01));
  const total = dts.reduce((a, b) => a + b, 0);
  const slowTotal = sorted.slice(-k).reduce((a, b) => a + b, 0);
  const round = (n) => Math.round(n * 10) / 10;
  return { frames, avg_fps: round(1000 * frames / total),
    p1_low_fps: round(1000 * k / slowTotal),
    frame_ms_p95: round(sorted[Math.ceil(frames * 0.95) - 1]) };
}
