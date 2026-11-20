// Dựng địa hình từ dữ liệu bản đồ (định dạng design mục 3) và tính độ cao mặt đất cho bóng đổ.
// Mọi tọa độ là tọa độ sim; group cha có scale.x = -1 (xem scene.js).
import * as THREE from 'three';
import { PAL } from './palette.js';
import { makeGroundTexture, makePlankTexture, mulberry } from './textures.js';

// Độ cao mặt đất cao nhất ≤ feetY + 0.25 tại (x, z), hoặc null nếu là khoảng không.
export function groundHeight(map, x, z, feetY) {
  const lim = feetY + 0.25;
  let best = null;
  const take = (y) => { if (y <= lim && (best === null || y > best)) best = y; };
  for (const i of map.islands || []) {
    if (Math.hypot(x - i.center[0], z - i.center[1]) <= i.radius) take(i.y ?? 0);
  }
  for (const b of map.bridges || []) {
    if (x >= b.x[0] && x <= b.x[1] && z >= b.z[0] && z <= b.z[1]) take(b.y ?? 0);
  }
  const r = Math.hypot(x, z);
  for (const t of map.tiers || []) {
    if (t.kind === 'disc' ? r <= t.r : (r >= t.r0 && r <= t.r1 && (!t.zPositive || z > 0))) take(t.y);
  }
  for (const rp of map.ramps || []) {
    const a = (rp.angle_deg * Math.PI) / 180;
    const dx = Math.cos(a); const dz = Math.sin(a);
    const along = x * dx + z * dz;
    const across = -x * dz + z * dx;
    const lo = Math.min(rp.r_top, rp.r_bottom); const hi = Math.max(rp.r_top, rp.r_bottom);
    if (Math.abs(across) <= rp.width / 2 && along >= lo && along <= hi) {
      take(rp.y_top + ((along - rp.r_top) / (rp.r_bottom - rp.r_top)) * (rp.y_bottom - rp.y_top));
    }
  }
  return best;
}

// quaternion cho vật có trục Z cục bộ dọc theo `dir`, trục X nằm ngang (không dùng lookAt vì cha bị lật gương)
function orientAlong(dir) {
  const z = dir.clone().normalize();
  const x = new THREE.Vector3(0, 1, 0).cross(z).normalize();
  const y = z.clone().cross(x);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

export function buildTerrain(map, root, glowTex) {
  const group = new THREE.Group();
  root.add(group);
  const rand = mulberry(7000 + (map.night || 1));
  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };

  const grassTex = track(makeGroundTexture(rand));
  const plankTex = track(makePlankTexture());
  const grassMat = track(new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 }));
  const grassFlat = track(new THREE.MeshStandardMaterial({ color: PAL.grass, roughness: 0.95 }));
  const sandMat = track(new THREE.MeshStandardMaterial({ color: PAL.sand, roughness: 1 }));
  const woodMat = track(new THREE.MeshStandardMaterial({ color: PAL.wood, roughness: 0.9 }));
  const rockMat = track(new THREE.MeshStandardMaterial({ color: PAL.wood, roughness: 1, flatShading: true }));

  // ---- đảo
  for (const isl of map.islands) {
    const [cx, cz] = isl.center;
    const R = isl.radius;
    const g = new THREE.Group();
    g.position.set(cx, isl.y ?? 0, cz);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.97, 3, 72), [woodMat, grassMat, woodMat]);
    top.position.y = -1.5;
    const bottom = new THREE.Mesh(new THREE.ConeGeometry(R * 0.97, R * 0.55, 36, 3), rockMat);
    bottom.rotation.x = Math.PI;
    bottom.position.y = -3 - R * 0.275;
    const lip = new THREE.Mesh(
      new THREE.RingGeometry(R - 0.9, R, 72),
      new THREE.MeshStandardMaterial({ color: PAL.sand, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    );
    lip.rotation.x = -Math.PI / 2;
    lip.position.y = 0.03;
    g.add(top, bottom, lip);
    for (let i = 0; i < Math.round(R / 4); i++) {
      const a = rand() * Math.PI * 2;
      const r = R * (0.3 + rand() * 0.55);
      const h = 3 + rand() * R * 0.15;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.8 + rand() * 1.4, h, 7), rockMat);
      spike.rotation.x = Math.PI;
      spike.position.set(Math.cos(a) * r, -3 - (R - r) * 0.2 - h / 2 - 1, Math.sin(a) * r);
      g.add(spike);
    }
    group.add(g);
  }

  // ---- cầu tre
  for (const b of map.bridges || []) {
    const len = b.x[1] - b.x[0];
    const wid = b.z[1] - b.z[0];
    const tex = plankTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, len / 0.9);
    const mat = track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    // hộp có chiều dài dọc Z cục bộ -> xoay về dọc X
    const m = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.3, len), [woodMat, woodMat, mat, woodMat, woodMat, woodMat]);
    m.rotation.y = Math.PI / 2;
    m.position.set((b.x[0] + b.x[1]) / 2, (b.y ?? 0) - 0.15, (b.z[0] + b.z[1]) / 2);
    group.add(m);
    // dây thừng chạy dọc hai bên (trang trí, không phải lan can) và cọc nhỏ ở hai đầu
    const ropeGeo = new THREE.CylinderGeometry(0.05, 0.05, len, 6);
    for (const sz of [b.z[0], b.z[1]]) {
      const rope = new THREE.Mesh(ropeGeo, woodMat);
      rope.rotation.z = Math.PI / 2;
      rope.position.set((b.x[0] + b.x[1]) / 2, -0.2, sz);
      group.add(rope);
    }
    for (const sx of [b.x[0], b.x[1]]) {
      for (const sz of [b.z[0], b.z[1]]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.7, 8), woodMat);
        post.position.set(sx, 0.2, sz);
        group.add(post);
      }
    }
  }

  // ---- tầng (vách đứng)
  for (const t of map.tiers || []) {
    if (t.kind === 'disc') {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(t.r, t.r, t.y, 56), [sandMat, grassFlat, sandMat]);
      m.position.y = t.y / 2;
      group.add(m);
    } else {
      const shape = new THREE.Shape();
      if (t.zPositive) {
        shape.moveTo(t.r1, 0);
        shape.absarc(0, 0, t.r1, 0, Math.PI, false);
        shape.lineTo(-t.r0, 0);
        shape.absarc(0, 0, t.r0, Math.PI, 0, true);
        shape.closePath();
      } else {
        shape.absarc(0, 0, t.r1, 0, Math.PI * 2, false);
        const hole = new THREE.Path();
        hole.absarc(0, 0, t.r0, 0, Math.PI * 2, true);
        shape.holes.push(hole);
      }
      const geo = track(new THREE.ExtrudeGeometry(shape, { depth: t.y, bevelEnabled: false, curveSegments: 48 }));
      const m = new THREE.Mesh(geo, [grassFlat, sandMat]);
      m.rotation.x = Math.PI / 2; // (sx, sy, sz) -> (x, -sz, sy): sy thành +Z, bề dày đi xuống
      m.position.y = t.y;
      group.add(m);
    }
  }

  // ---- dốc
  for (const rp of map.ramps || []) {
    const a = (rp.angle_deg * Math.PI) / 180;
    const dx = Math.cos(a); const dz = Math.sin(a);
    const bot = new THREE.Vector3(dx * rp.r_bottom, rp.y_bottom, dz * rp.r_bottom);
    const topP = new THREE.Vector3(dx * rp.r_top, rp.y_top, dz * rp.r_top);
    const v = topP.clone().sub(bot);
    const len = v.length();
    const q = orientAlong(v);
    const tex = plankTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, len / 0.9);
    const mat = track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    const m = new THREE.Mesh(new THREE.BoxGeometry(rp.width, 0.3, len), [woodMat, woodMat, mat, woodMat, woodMat, woodMat]);
    m.quaternion.copy(q);
    const mid = bot.clone().add(topP).multiplyScalar(0.5);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    m.position.copy(mid).addScaledVector(up, -0.15);
    group.add(m);
    // hai thanh bên cho thấy rõ đường dốc
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, len), woodMat);
      rail.quaternion.copy(q);
      const side = new THREE.Vector3(1, 0, 0).applyQuaternion(q).multiplyScalar(s * (rp.width / 2 + 0.07));
      rail.position.copy(mid).add(side).addScaledVector(up, 0.02);
      group.add(rail);
    }
    // chân chống đỡ phía dưới
    const prop = new THREE.Mesh(new THREE.BoxGeometry(rp.width, 0.4, 0.4), woodMat);
    prop.position.set(topP.x, topP.y / 2, topP.z);
    prop.scale.y = Math.max(0.1, topP.y);
    group.add(prop);
  }

  // ---- tháp chuông
  for (const tw of map.towers || []) {
    const g = new THREE.Group();
    g.position.set(tw.center[0], tw.y0, tw.center[1]);
    const baseH = tw.height * 0.75;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(tw.radius * 0.9, tw.radius, baseH, 20), woodMat);
    body.position.y = baseH / 2;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(tw.radius * 0.95, tw.radius * 0.95, 0.3, 20), sandMat);
    band.position.y = baseH * 0.5;
    const band2 = band.clone();
    band2.position.y = baseH - 0.15;
    g.add(body, band, band2);
    const belfryH = tw.height - baseH;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, belfryH, 8), woodMat);
      p.position.set(Math.cos(a) * tw.radius * 0.8, baseH + belfryH / 2, Math.sin(a) * tw.radius * 0.8);
      g.add(p);
    }
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(tw.radius * 1.35, 2.2, 20),
      new THREE.MeshStandardMaterial({ color: PAL.scarf, roughness: 0.8 }),
    );
    roof.position.y = tw.height + 1.1;
    const bellMat = track(new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: PAL.gold, emissiveIntensity: 0.25, metalness: 0.5, roughness: 0.4 }));
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.8), bellMat);
    bell.position.y = baseH + belfryH * 0.5;
    const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), bellMat);
    clapper.position.y = bell.position.y - 0.7;
    g.add(roof, bell, clapper);
    group.add(g);
    group.userData.bell = bell;
  }

  // ---- bục nhảy
  const pads = [];
  for (const p of map.pads || []) {
    const g = new THREE.Group();
    g.position.set(p.pos[0], p.pos[1], p.pos[2]);
    const goldMat = track(new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: PAL.gold, emissiveIntensity: 0.55, roughness: 0.5 }));
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(p.radius, p.radius * 1.05, 0.16, 28), goldMat);
    disc.position.y = 0.08;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(p.radius * 0.45, p.radius * 0.6, 28),
      new THREE.MeshBasicMaterial({ color: PAL.lampCore, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.175;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(p.radius * 0.7, p.radius, 5, 18, 1, true),
      new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    beam.position.y = 2.5;
    const arrows = new THREE.Group();
    arrows.rotation.y = Math.atan2(p.dir[0], p.dir[1]);
    const arrowMat = new THREE.MeshBasicMaterial({ color: PAL.lampCore });
    const arrowList = [];
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 4), arrowMat);
      c.rotation.x = Math.PI / 2; // đỉnh nón hướng +Z cục bộ
      c.position.set(0, 0.3 + i * 0.5, 0);
      arrows.add(c);
      arrowList.push(c);
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: PAL.gold, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(4, 4, 1);
    halo.position.y = 0.6;
    g.add(disc, ring, beam, arrows, halo);
    group.add(g);
    pads.push({ g, arrowList, halo, ring, p });
  }

  // ---- trang trí: cỏ, hoa, đá (chỉ client; PRNG riêng, không liên quan sim)
  const tierR = (map.tiers || []).reduce((m, t) => Math.max(m, t.kind === 'disc' ? t.r : t.r1), 0);
  const free = (x, z) => {
    const r = Math.hypot(x, z);
    if (map.tiers && map.tiers.length && r < tierR + 1.5) return false;
    for (const b of map.bridges || []) if (x > b.x[0] - 2 && x < b.x[1] + 2 && z > b.z[0] - 2.5 && z < b.z[1] + 2.5) return false;
    for (const rp of map.ramps || []) {
      const a = (rp.angle_deg * Math.PI) / 180;
      const along = x * Math.cos(a) + z * Math.sin(a);
      const across = -x * Math.sin(a) + z * Math.cos(a);
      if (along > rp.r_top - 2 && along < rp.r_bottom + 2 && Math.abs(across) < rp.width / 2 + 1.5) return false;
    }
    for (const l of map.lanterns || []) if (Math.hypot(x - l.pos[0], z - l.pos[2]) < 1.8) return false;
    for (const p of map.pads || []) if (Math.hypot(x - p.pos[0], z - p.pos[2]) < 2.2) return false;
    return true;
  };
  const scatter = (count, minR, margin, fn) => {
    let n = 0;
    for (let i = 0; i < count; i++) {
      const isl = map.islands[Math.floor(rand() * map.islands.length)];
      for (let tries = 0; tries < 12; tries++) {
        const a = rand() * Math.PI * 2;
        const rr = minR + Math.sqrt(rand()) * (isl.radius - margin - minR);
        const x = isl.center[0] + Math.cos(a) * rr;
        const z = isl.center[1] + Math.sin(a) * rr;
        if (free(x, z)) { fn(n, x, z); n++; break; }
      }
    }
    return n;
  };
  const area = map.islands.reduce((s, i) => s + i.radius * i.radius, 0);
  const dummy = new THREE.Object3D();
  const tc = Math.round(area * 0.2);
  const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.05, 0.4, 3), track(new THREE.MeshStandardMaterial({ roughness: 1 })), tc);
  const c = new THREE.Color();
  tufts.count = scatter(tc, 1, 1, (i, x, z) => {
    const h = 0.4 + rand() * 0.8;
    dummy.position.set(x, h * 0.2, z);
    dummy.rotation.set((rand() - 0.5) * 0.4, rand() * 6, (rand() - 0.5) * 0.4);
    dummy.scale.set(1, h, 1);
    dummy.updateMatrix();
    tufts.setMatrixAt(i, dummy.matrix);
    c.setHex(PAL.grass).offsetHSL((rand() - 0.5) * 0.05, 0.05, 0.04 + rand() * 0.12);
    tufts.setColorAt(i, c);
  });
  group.add(tufts);

  const fc = Math.round(area * 0.04);
  const flowerMat = track(new THREE.MeshStandardMaterial({ color: PAL.moteCore, emissive: PAL.moteHalo, emissiveIntensity: 0.4, roughness: 0.6 }));
  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), flowerMat, fc);
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 5), grassFlat, fc);
  const nf = scatter(fc, 2, 1.5, (i, x, z) => {
    dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    dummy.position.set(x, 0.42, z); dummy.updateMatrix(); flowers.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 0.2, z); dummy.updateMatrix(); stems.setMatrixAt(i, dummy.matrix);
  });
  flowers.count = stems.count = nf;
  group.add(flowers, stems);

  const sc = Math.round(area * 0.012);
  const stones = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.5, 0), track(new THREE.MeshStandardMaterial({ color: PAL.lampOff, roughness: 1, flatShading: true })), sc);
  stones.count = scatter(sc, 3, 1, (i, x, z) => {
    const s = 0.4 + rand() * 1.0;
    dummy.position.set(x, s * 0.2, z);
    dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    dummy.scale.set(s, s * (0.6 + rand() * 0.4), s);
    dummy.updateMatrix();
    stones.setMatrixAt(i, dummy.matrix);
  });
  group.add(stones);

  return {
    group,
    flowerMat,
    update(t, glow) {
      flowerMat.emissiveIntensity = 0.4 + 1.0 * glow;
      for (const p of pads) {
        p.arrowList.forEach((a, i) => {
          const k = (t * 1.6 - i * 0.3) % 1;
          a.position.y = 0.3 + ((t * 1.2 + i * 0.5) % 1.5);
          a.scale.setScalar(0.6 + 0.4 * Math.sin(k * Math.PI));
        });
        p.halo.material.opacity = 0.55 + 0.25 * Math.sin(t * 3);
        p.ring.scale.setScalar(1 + 0.08 * Math.sin(t * 4));
      }
      const bell = group.userData.bell;
      if (bell) bell.rotation.z = Math.sin(t * 1.2) * 0.12;
    },
    dispose() {
      root.remove(group);
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material && !disposables.includes(o.material)) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      disposables.forEach((d) => d.dispose());
    },
  };
}
