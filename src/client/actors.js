// Nhân vật: Mây (người chơi), Bóng Mực, đom đóm. Vị trí nhận theo tọa độ sim (xem scene.js).
import * as THREE from 'three';
import { SHADE_Y } from '../sim/world.js';

const _c = new THREE.Color();

function blobShadow(radius, opacity = 0.35) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 20),
    new THREE.MeshBasicMaterial({ color: 0x05020c, transparent: true, opacity, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.03;
  return m;
}

// ---------------------------------------------------------------- Mây
export function createPlayerView(root, glowTex) {
  const group = new THREE.Group(); // đặt tại (x,0,z), xoay theo hướng đi
  const inner = new THREE.Group(); // nhấp nhô, nhảy
  group.add(inner);
  const shadow = blobShadow(0.75);
  const shadowHolder = new THREE.Group(); // không xoay theo hướng
  shadowHolder.add(shadow);

  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xf4f0ff, emissive: 0x4a4478, emissiveIntensity: 0.55, roughness: 1,
  });
  const puff = (r, x, y, z, sy = 1) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), cloudMat);
    m.position.set(x, y, z);
    m.scale.y = sy;
    inner.add(m);
    return m;
  };
  // thân: nhiều cục mây
  puff(0.58, 0, 0.62, 0, 0.9);
  puff(0.4, 0.5, 0.5, 0.05);
  puff(0.4, -0.5, 0.5, 0.05);
  puff(0.34, 0.25, 0.33, -0.3);
  puff(0.34, -0.25, 0.33, 0.32);
  // đầu
  const head = puff(0.44, 0, 1.3, 0.05);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1b1030 });
  const eyeGeo = new THREE.SphereGeometry(0.06, 8, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.16, 1.33, 0.4);
  eyeR.position.set(0.16, 1.33, 0.4);
  eyeL.scale.set(1, 1.3, 0.6);
  eyeR.scale.set(1, 1.3, 0.6);
  const cheekMat = new THREE.MeshBasicMaterial({ color: 0xffa6a0, transparent: true, opacity: 0.7 });
  const cheekGeo = new THREE.SphereGeometry(0.07, 8, 6);
  const cheekL = new THREE.Mesh(cheekGeo, cheekMat);
  const cheekR = new THREE.Mesh(cheekGeo, cheekMat);
  cheekL.position.set(-0.27, 1.22, 0.33);
  cheekR.position.set(0.27, 1.22, 0.33);
  cheekL.scale.set(1.3, 0.8, 0.5);
  cheekR.scale.set(1.3, 0.8, 0.5);
  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI),
    eyeMat,
  );
  mouth.position.set(0, 1.2, 0.43);
  mouth.rotation.z = Math.PI;
  inner.add(eyeL, eyeR, cheekL, cheekR, mouth);

  // nón lá
  const strawMat = new THREE.MeshStandardMaterial({
    color: 0xe0bd72, emissive: 0x5a3d12, emissiveIntensity: 0.45, roughness: 0.85,
  });
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.82, 0.5, 28), strawMat);
  hat.position.set(0, 1.84, 0.02);
  const hatRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.8, 0.03, 6, 36),
    new THREE.MeshStandardMaterial({ color: 0xb98e48, roughness: 0.9 }),
  );
  hatRim.rotation.x = Math.PI / 2;
  hatRim.position.set(0, 1.6, 0.02);
  const hatTip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), strawMat);
  hatTip.position.set(0, 2.1, 0.02);
  inner.add(hat, hatRim, hatTip);

  // đèn lồng nhỏ treo trên cây sào bên phải (+X sim)
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 1.35, 6),
    new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.9 }),
  );
  stick.position.set(0.72, 1.0, 0.1);
  stick.rotation.z = -0.28;
  inner.add(stick);
  const lanternMat = new THREE.MeshStandardMaterial({
    color: 0xffb04a, emissive: 0xff8a20, emissiveIntensity: 2.4, roughness: 0.5,
  });
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), lanternMat);
  lantern.scale.y = 1.2;
  const lanternPos = new THREE.Vector3(0.98, 1.38, 0.12);
  lantern.position.copy(lanternPos);
  inner.add(lantern);
  const lanternCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.1, 0.06, 8),
    new THREE.MeshStandardMaterial({ color: 0x6b1f18 }),
  );
  lanternCap.position.set(0.98, 1.6, 0.12);
  inner.add(lanternCap);
  const lanternGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffa040, transparent: true, opacity: 0.85,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  lanternGlow.scale.set(1.9, 1.9, 1);
  lanternGlow.position.copy(lanternPos);
  inner.add(lanternGlow);
  const light = new THREE.PointLight(0xffa04a, 30, 16, 2);
  light.position.copy(lanternPos);
  inner.add(light);

  root.add(group, shadowHolder);

  const st = { angle: 0, bob: 0, squash: 0 };

  return {
    group,
    light,
    // pos: tọa độ sim đã nội suy; moving: 0..1; faceAngle: radian; visible: nhấp nháy khi bất tử
    update(pos, faceAngle, speed01, t, dt, blink, flash) {
      group.position.set(pos[0], 0, pos[2]);
      shadowHolder.position.set(pos[0], 0, pos[2]);
      // quay mượt về hướng đi
      let d = faceAngle - st.angle;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      st.angle += d * Math.min(1, dt * 12);
      group.rotation.y = st.angle;

      st.bob += dt * (3 + speed01 * 7);
      const hover = 0.16 + Math.sin(st.bob) * (0.03 + 0.05 * speed01);
      inner.position.y = pos[1] + hover;
      const air = pos[1] > 0.05;
      const sq = air ? 0.06 : Math.sin(st.bob * 2) * 0.03 * speed01;
      inner.scale.set(1 - sq, 1 + sq, 1 - sq);
      inner.rotation.z = Math.sin(st.bob * 0.5) * 0.04 * speed01;
      inner.visible = !blink;
      const s = Math.max(0.4, 1 - pos[1] * 0.12);
      shadow.scale.setScalar(s);
      shadow.material.opacity = 0.35 * s;
      light.intensity = 30 + 40 * flash + 3 * Math.sin(t * 8);
      lanternGlow.material.opacity = 0.7 + 0.15 * Math.sin(t * 8) + 0.3 * flash;
      head.rotation.z = Math.sin(t * 1.7) * 0.04;
    },
  };
}

// ---------------------------------------------------------------- Bóng Mực
const SHADE_COLOR = new THREE.Color(0x190d2c);
const SHADE_EMIT = new THREE.Color(0x2f1257);
const STUN_COLOR = new THREE.Color(0x9a8cc4);
const STUN_EMIT = new THREE.Color(0x6c5a9e);

export function createShadeView(root, glowTex, id) {
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);
  const mat = new THREE.MeshStandardMaterial({
    color: SHADE_COLOR, emissive: SHADE_EMIT, emissiveIntensity: 0.55, roughness: 0.75,
    transparent: true, opacity: 0.96,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.85, 22, 16), mat);
  body.scale.set(1, 0.92, 1);
  inner.add(body);
  const blobs = [];
  const blobGeo = new THREE.SphereGeometry(0.36, 12, 10);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(blobGeo, mat);
    inner.add(m);
    blobs.push({ m, a: (i / n) * Math.PI * 2, ph: i * 1.3 + (id.length ? id.charCodeAt(id.length - 1) : 0) });
  }
  // đầu "giọt mực" nhô lên
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), mat);
  top.position.set(0, 0.8, -0.05);
  inner.add(top);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xe9deff });
  const eyeGeo = new THREE.SphereGeometry(0.14, 10, 8);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.3, 0.22, 0.74);
  eyeR.position.set(0.3, 0.22, 0.74);
  inner.add(eyeL, eyeR);
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x120820 });
  const pupilGeo = new THREE.SphereGeometry(0.06, 8, 6);
  const pL = new THREE.Mesh(pupilGeo, pupilMat);
  const pR = new THREE.Mesh(pupilGeo, pupilMat);
  pL.position.set(-0.3, 0.2, 0.86);
  pR.position.set(0.3, 0.2, 0.86);
  inner.add(pL, pR);

  const aura = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0x3b1670, transparent: true, opacity: 0.4, depthWrite: false,
  }));
  aura.scale.set(4.6, 4.6, 1);
  inner.add(aura);

  const shadow = blobShadow(1.0, 0.4);
  const holder = new THREE.Group();
  holder.add(shadow);
  root.add(group, holder);

  const seed = (id.charCodeAt(id.length - 1) || 1) * 1.7;
  let stun = 0;

  return {
    group,
    holder,
    dispose() {
      root.remove(group, holder);
      mat.dispose();
      aura.material.dispose();
    },
    update(pos, stunned, faceAngle, t, dt) {
      stun += ((stunned ? 1 : 0) - stun) * Math.min(1, dt * 8);
      const jx = stun > 0.5 ? (Math.sin(t * 60 + seed) * 0.05) : 0;
      const jz = stun > 0.5 ? (Math.cos(t * 53 + seed) * 0.05) : 0;
      const y = pos[1] ?? SHADE_Y;
      group.position.set(pos[0] + jx, y, pos[2] + jz);
      holder.position.set(pos[0], 0, pos[2]);
      group.rotation.y = faceAngle;
      const wob = 1 + 0.07 * Math.sin(t * 4 + seed);
      inner.scale.set(wob, 2 - wob, wob);
      inner.position.y = Math.sin(t * 2.2 + seed) * 0.1;
      for (const b of blobs) {
        const w = Math.sin(t * 3 + b.ph);
        b.m.position.set(Math.sin(b.a) * (0.62 + 0.08 * w), -0.5 + 0.08 * w, Math.cos(b.a) * (0.62 + 0.08 * w));
        const s = 1 + 0.2 * w;
        b.m.scale.set(s, 1.1 - 0.2 * w, s);
      }
      _c.copy(SHADE_COLOR).lerp(STUN_COLOR, stun);
      mat.color.copy(_c);
      _c.copy(SHADE_EMIT).lerp(STUN_EMIT, stun);
      mat.emissive.copy(_c);
      mat.emissiveIntensity = 0.55 + 0.25 * stun;
      mat.opacity = 0.96 - 0.3 * stun;
      aura.material.opacity = 0.4 - 0.25 * stun;
      const eyeH = 1 - 0.8 * stun; // choáng thì mắt híp lại
      eyeL.scale.y = eyeR.scale.y = eyeH;
      pL.visible = pR.visible = stun < 0.5;
      inner.rotation.y = stun * Math.sin(t * 6 + seed) * 0.5;
      shadow.material.opacity = 0.4 - 0.2 * stun;
      shadow.scale.setScalar(1 + 0.05 * Math.sin(t * 4 + seed));
    },
  };
}

// ---------------------------------------------------------------- Đom đóm
export function createMoteView(root, glowTex, id) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff3b8 }),
  );
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffcf5a, transparent: true, opacity: 0.9,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.scale.set(1.3, 1.3, 1);
  group.add(core, glow);
  root.add(group);
  const phase = (parseInt(id.replace(/\D/g, ''), 10) || 1) * 2.399;
  return {
    group,
    dispose() {
      root.remove(group);
      glow.material.dispose();
      core.geometry.dispose();
      core.material.dispose();
    },
    update(pos, t) {
      const tw = 0.5 + 0.5 * Math.sin(t * 5 + phase);
      group.position.set(
        pos[0] + Math.sin(t * 0.9 + phase) * 0.12,
        0.8 + Math.sin(t * 1.7 + phase) * 0.15,
        pos[2] + Math.cos(t * 0.8 + phase) * 0.12,
      );
      glow.scale.setScalar(1.0 + 0.55 * tw);
      glow.material.opacity = 0.55 + 0.45 * tw;
      core.scale.setScalar(0.85 + 0.3 * tw);
    },
  };
}
