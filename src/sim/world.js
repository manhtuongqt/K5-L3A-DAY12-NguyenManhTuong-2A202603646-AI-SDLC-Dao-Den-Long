export const ISLAND_RADIUS = 40;
export const SHADE_Y = 1.0;

export const LANTERN_POSITIONS = Object.freeze(
  Array.from({ length: 5 }, (_, index) => {
    const angle = (index * 72 * Math.PI) / 180;
    return Object.freeze([
      Math.round(25 * Math.sin(angle) * 1000) / 1000 || 0,
      0,
      Math.round(25 * Math.cos(angle) * 1000) / 1000 || 0,
    ]);
  }),
);
