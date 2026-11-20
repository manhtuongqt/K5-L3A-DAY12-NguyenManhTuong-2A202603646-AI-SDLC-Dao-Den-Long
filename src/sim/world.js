import { MAPS } from './maps.js';
// Phase 1 compatibility exports; the authoritative layouts now live in maps.js.
export const ISLAND_RADIUS = MAPS[1].islands[0].radius;
export const SHADE_Y = 1;
export const LANTERN_POSITIONS = Object.freeze(MAPS[1].lanterns.map(({ pos }) => Object.freeze([...pos])));
