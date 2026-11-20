import { mulberry32 } from './rng.js';

// Uniform by area within each annulus, using a stream separate from the sim.
export function makeBenchScenario(seed) {
  const random = mulberry32(seed);
  const position = (min, max) => {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(min * min + random() * (max * max - min * min));
    return [radius * Math.cos(angle), 0, radius * Math.sin(angle)];
  };
  return {
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    player: { pos: [0, 0, 0] },
    shades: Array.from({ length: 200 }, (_, i) => ({
      id: `S${i + 1}`, pos: position(4, 37), state: 'wander',
    })),
    motes: Array.from({ length: 100 }, () => position(3, 38)),
    lanterns: ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true, fuel: 100 })),
  };
}
