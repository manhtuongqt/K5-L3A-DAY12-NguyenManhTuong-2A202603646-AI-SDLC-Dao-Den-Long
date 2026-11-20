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

// Mặt cỏ của đảo: nền cỏ #2F5D50 có đốm sáng tối nhẹ.
export function makeGroundTexture(rand, size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  x.fillStyle = '#2f5d50';
  x.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const px = rand() * size;
    const py = rand() * size;
    const r = 6 + rand() * 26;
    const light = rand() < 0.5;
    x.fillStyle = light
      ? `rgba(150, 200, 120, ${0.03 + rand() * 0.05})`
      : `rgba(10, 30, 30, ${0.05 + rand() * 0.07})`;
    x.beginPath();
    x.arc(px, py, r, 0, Math.PI * 2);
    x.fill();
  }
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

// Ván gỗ (cầu tre, dốc): nền gỗ #6B4A2F, khe tối giữa các tấm ván, lặp theo chiều dài.
export function makePlankTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#6b4a2f';
  x.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 40; i++) {
    x.fillStyle = `rgba(30,15,5,${0.05 + (i % 5) * 0.015})`;
    x.fillRect((i * 37) % 128, 6 + (i * 11) % 58, 30, 1);
  }
  x.fillStyle = 'rgba(25,12,4,0.85)';
  x.fillRect(0, 0, 128, 4); // khe giữa hai ván liên tiếp (vuông góc chiều đi)
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
