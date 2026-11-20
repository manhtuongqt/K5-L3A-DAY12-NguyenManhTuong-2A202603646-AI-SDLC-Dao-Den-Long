import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMetrics } from '../scripts/lib/bench-metrics.mjs';

test('bench metrics: một khung 20 ms = 50 FPS', () => {
  assert.deepEqual(calculateMetrics([20]), { frames: 1, avg_fps: 50, p1_low_fps: 50, frame_ms_p95: 20 });
});

test('bench metrics: tính từ tổng dt, p95 nearest rank, không lấy trung bình FPS', () => {
  // 20 khung. p95 thứ 19 = 10, 1% chậm nhất = 20 ms.
  const dts = [20, ...Array(18).fill(10), 0.5];
  // Tổng thực = 200.5 => 99.7506 FPS, làm tròn 99.8.
  assert.deepEqual(calculateMetrics(dts), { frames: 20, avg_fps: 99.8, p1_low_fps: 50, frame_ms_p95: 10 });
  assert.equal(dts[0], 20);
});

test('bench metrics: ceil 1% của 101 khung lấy hai khung chậm nhất', () => {
  const dts = [...Array(99).fill(10), 30, 50];
  assert.deepEqual(calculateMetrics(dts), { frames: 101, avg_fps: 94.4, p1_low_fps: 25, frame_ms_p95: 10 });
});

test('bench metrics: làm tròn 1 chữ số ở đầu ra', () => {
  assert.deepEqual(calculateMetrics([16.666666, 16.666666]), {
    frames: 2, avg_fps: 60, p1_low_fps: 60, frame_ms_p95: 16.7,
  });
  for (const invalid of [[], [0], [-1], [NaN], [Infinity], [10, '20'], null]) assert.throws(() => calculateMetrics(invalid), TypeError);
});
