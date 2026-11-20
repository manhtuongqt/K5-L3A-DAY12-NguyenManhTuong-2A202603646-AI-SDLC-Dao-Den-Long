// Bản đồ dự phòng (đúng số liệu ticket) chỉ dùng khi sim chưa cung cấp `g.map`.
const pol = (cx, cz, r, deg, y = 0) => {
  const a = (deg * Math.PI) / 180;
  return [Math.round((cx + r * Math.cos(a)) * 1000) / 1000, y, Math.round((cz + r * Math.sin(a)) * 1000) / 1000];
};

export function fallbackMap(night) {
  if (night === 2) {
    const n = (dx, dz) => { const l = Math.hypot(dx, dz); return [dx / l, dz / l]; };
    return {
      night: 2, name: 'Đảo Cau', start: [0, 0, 0],
      islands: [{ center: [0, 0], radius: 28, y: 0 }, { center: [70, 0], radius: 28, y: 0 }],
      bridges: [{ x: [26, 44], z: [-2, 2], y: 0 }],
      tiers: [], ramps: [], towers: [],
      pads: [
        { pos: [20, 0, 18], radius: 1, vy: 14, vh: 24, dir: n(50, -18) },
        { pos: [50, 0, -18], radius: 1, vy: 14, vh: 24, dir: n(-50, 18) },
      ],
      lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]]
        .map((pos, i) => ({ id: `L${i + 1}`, pos })),
      charm_points: [[35, 0, 0]], drifters: true, wind: false,
    };
  }
  if (night === 3) {
    return {
      night: 3, name: 'Đảo Chuông', start: [0, 0, -25],
      islands: [{ center: [0, 0], radius: 45, y: 0 }],
      bridges: [],
      tiers: [{ kind: 'annulus', r0: 12, r1: 24, zPositive: true, y: 3 }, { kind: 'disc', r: 8, y: 6 }],
      ramps: [30, 150].map((a) => ({ angle_deg: a, r_bottom: 30, r_top: 24, width: 3, y_bottom: 0, y_top: 3 })),
      pads: [{ pos: [0, 3, 13], radius: 1, vy: 12, vh: 8, dir: [0, -1] }],
      towers: [{ center: [0, 0], radius: 2, y0: 6, height: 8 }],
      lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]]
        .map((pos, i) => ({ id: `L${i + 1}`, pos })),
      charm_points: [[30, 0, 25], [-30, 0, 25]], drifters: true, wind: true,
    };
  }
  return {
    night: 1, name: 'Đảo Bến', start: [0, 0, 0],
    islands: [{ center: [0, 0], radius: 40, y: 0 }],
    bridges: [], tiers: [], ramps: [], pads: [], towers: [],
    lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]
      .map((pos, i) => ({ id: `L${i + 1}`, pos })),
    charm_points: [], drifters: false, wind: false,
  };
}
export { pol };
