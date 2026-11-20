// Shared map schema from phase-2-design §3. Angles run from +X towards +Z.
const ring = (count, radius, y = 0, cx = 0, cz = 0, offset = 0) =>
  Array.from({ length: count }, (_, i) => {
    const a = (offset + i * 360 / count) * Math.PI / 180;
    return [cx + radius * Math.cos(a), y, cz + radius * Math.sin(a)];
  });
const lamps = (positions) => positions.map((pos, i) => ({ id: `L${i + 1}`, pos }));
const direction = (x, z) => [x / Math.hypot(x, z), z / Math.hypot(x, z)];
const base = {
  bridges: [], tiers: [], ramps: [], pads: [], towers: [], charm_points: [],
  shade_first_tick: 300, drifters: false, wind: false,
};

export const MAPS = {
  1: {
    ...base, night: 1, name: 'Đảo Bến', duration_s: 300, start: [0, 0, 0],
    islands: [{ center: [0, 0], radius: 40, y: 0 }],
    lanterns: lamps([[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2],
      [-14.7, 0, -20.2], [-23.8, 0, 7.7]]),
    mote_points: [...ring(8, 12), ...ring(16, 33)],
    shade_points: ring(12, 37, 0, 0, 0, 15),
    shade_interval_ticks: 480, shade_max: 6, shade_speed: 4,
  },
  2: {
    ...base, night: 2, name: 'Đảo Cau', duration_s: 330, start: [0, 0, 0],
    islands: [{ center: [0, 0], radius: 28, y: 0 }, { center: [70, 0], radius: 28, y: 0 }],
    bridges: [{ x: [26, 44], z: [-2, 2], y: 0 }],
    pads: [
      { pos: [20, 0, 18], radius: 1, vy: 14, vh: 24, dir: direction(50, -18) },
      { pos: [50, 0, -18], radius: 1, vy: 14, vh: 24, dir: direction(-50, 18) },
    ],
    lanterns: lamps([[0, 0, 20], [17, 0, -10], [-17, 0, -10],
      [70, 0, 20], [87, 0, -10], [53, 0, -10]]),
    mote_points: [...ring(4, 10), ...ring(8, 22), ...ring(4, 10, 0, 70), ...ring(8, 22, 0, 70)],
    shade_points: [...ring(8, 26, 0, 0, 0, 22.5), ...ring(8, 26, 0, 70, 0, 22.5)],
    charm_points: [[35, 0, 0]],
    shade_interval_ticks: 420, shade_max: 8, shade_speed: 4, drifters: true,
  },
  3: {
    ...base, night: 3, name: 'Đảo Chuông', duration_s: 360, start: [0, 0, -25],
    islands: [{ center: [0, 0], radius: 45, y: 0 }],
    tiers: [
      { kind: 'annulus', r0: 12, r1: 24, zPositive: true, y: 3 },
      { kind: 'disc', r: 8, y: 6 },
    ],
    ramps: [30, 150].map((angle_deg) => ({
      angle_deg, r_bottom: 30, r_top: 24, width: 3, y_bottom: 0, y_top: 3,
    })),
    pads: [{ pos: [0, 3, 13], radius: 1, vy: 12, vh: 8, dir: [0, -1] }],
    towers: [{ center: [0, 0], radius: 2, y0: 6, height: 8 }],
    lanterns: lamps([[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10],
      [-35, 0, -10], [20, 0, -35], [-20, 0, -35]]),
    mote_points: [...ring(18, 34), ...Array.from({ length: 8 }, (_, i) => {
      const a = (20 + i * 20) * Math.PI / 180;
      return [18 * Math.cos(a), 3, 18 * Math.sin(a)];
    }), ...ring(4, 5, 6, 0, 0, 45)],
    shade_points: ring(16, 43), charm_points: [[30, 0, 25], [-30, 0, 25]],
    shade_interval_ticks: 360, shade_max: 10, shade_speed: 4.5, drifters: true, wind: true,
  },
};
