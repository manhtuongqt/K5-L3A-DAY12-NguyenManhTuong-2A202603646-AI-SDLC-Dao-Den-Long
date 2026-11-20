// Terrain contains no game state. A missing support is represented by null.
const EPS = 1e-9;
export function containsXZ(map, x, z) {
  return map.islands.some(({ center, radius }) => Math.hypot(x - center[0], z - center[1]) <= radius + EPS)
    || map.bridges.some((b) => x >= b.x[0] - EPS && x <= b.x[1] + EPS
      && z >= b.z[0] - EPS && z <= b.z[1] + EPS);
}

function surfacesAt(map, x, z) {
  const heights = [];
  for (const island of map.islands) {
    if (Math.hypot(x - island.center[0], z - island.center[1]) <= island.radius + EPS) heights.push(island.y);
  }
  for (const b of map.bridges) {
    if (x >= b.x[0] - EPS && x <= b.x[1] + EPS && z >= b.z[0] - EPS && z <= b.z[1] + EPS) heights.push(b.y);
  }
  const r = Math.hypot(x, z);
  for (const tier of map.tiers) {
    if (tier.kind === 'disc' ? r <= tier.r + EPS
      : r >= tier.r0 - EPS && r <= tier.r1 + EPS && (!tier.zPositive || z > 0)) heights.push(tier.y);
  }
  for (const ramp of map.ramps) {
    const a = ramp.angle_deg * Math.PI / 180;
    const along = x * Math.cos(a) + z * Math.sin(a);
    const across = -x * Math.sin(a) + z * Math.cos(a);
    if (along >= ramp.r_top - EPS && along <= ramp.r_bottom + EPS && Math.abs(across) <= ramp.width / 2 + EPS) {
      heights.push(ramp.y_bottom + (ramp.r_bottom - along) / (ramp.r_bottom - ramp.r_top)
        * (ramp.y_top - ramp.y_bottom));
    }
  }
  return heights;
}

export function groundAt(map, x, z, feetY = Infinity) {
  const heights = surfacesAt(map, x, z).filter((y) => y <= feetY + 0.25 + EPS);
  return heights.length ? Math.max(...heights) : null;
}

export function isWall(map, x, z, feetY) {
  return surfacesAt(map, x, z).some((y) => y > feetY + 0.25 + EPS)
    || towerAt(map, x, z, feetY);
}

export function towerAt(map, x, z, y) {
  return map.towers.some((t) => Math.hypot(x - t.center[0], z - t.center[1]) < t.radius - EPS
    && y < t.y0 + t.height && y + 1.6 > t.y0);
}

// Check a movement segment too, so fast motion cannot tunnel through the tower.
export function blocked(map, from, to, { flying = false } = {}) {
  const distance = Math.hypot(to[0] - from[0], to[2] - from[2]);
  const samples = Math.max(1, Math.ceil(distance / 0.1));
  for (let i = 1; i <= samples; i += 1) {
    const t = i / samples;
    const x = from[0] + (to[0] - from[0]) * t;
    const z = from[2] + (to[2] - from[2]) * t;
    const y = from[1] + (to[1] - from[1]) * t;
    if (flying ? !containsXZ(map, x, z) || towerAt(map, x, z, y) : isWall(map, x, z, y)) return true;
  }
  return false;
}
