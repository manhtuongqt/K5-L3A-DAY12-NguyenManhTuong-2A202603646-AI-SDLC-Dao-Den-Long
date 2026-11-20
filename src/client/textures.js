// Texture tự vẽ bằng canvas, không tải asset ngoài.
import * as THREE from 'three';

export function makeGlowTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.22, 'rgba(255,255,255,0.65)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.16)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Mặt cỏ của đảo: nền xanh rêu có đốm sáng tối và một vệt đất ở giữa.
export function makeGroundTexture(rand, size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  x.fillStyle = '#3d6046';
  x.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const px = rand() * size;
    const py = rand() * size;
    const r = 6 + rand() * 26;
    const light = rand() < 0.5;
    x.fillStyle = light
      ? `rgba(150, 190, 100, ${0.05 + rand() * 0.08})`
      : `rgba(20, 40, 40, ${0.07 + rand() * 0.1})`;
    x.beginPath();
    x.arc(px, py, r, 0, Math.PI * 2);
    x.fill();
  }
  // vệt đất quanh tâm (chỗ Mây xuất phát)
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.06);
  g.addColorStop(0, 'rgba(120, 92, 64, 0.85)');
  g.addColorStop(1, 'rgba(120, 92, 64, 0)');
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
