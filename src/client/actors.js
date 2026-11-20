// Nhân vật: Mây (người chơi), Bóng Mực, Gió Lạc, Bùa Gió, đom đóm. Vị trí nhận theo tọa độ sim (xem scene.js).
import * as THREE from 'three';
import { PAL } from './palette.js';

const _c = new THREE.Color();

function blobShadow(radius, opacity = 0.35) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 20),
    new THREE.MeshBasicMaterial({ color: 0x05020c, transparent: true, opacity, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.04;
  return m;
}

// ---------------------------------------------------------------- Mây
export function createPlayerView(root, glowTex) {
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);
  const shadow = blobShadow(0.75);
  const shadowHolder = new THREE.Group();
  shadowHolder.add(shadow);

  // Chibi nguyên gốc: áo dài xòe hai tà, đầu lớn và tay/chân nhỏ.
  // Tất cả chi tiết đều là hình học; không dùng texture cho mặt/tóc/quần áo.
  const clothMat = new THREE.MeshStandardMaterial({
    color: PAL.cloud, emissive: PAL.cloud, emissiveIntensity: 0.16, roughness: 1,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: PAL.maySkin, emissive: PAL.maySkin, emissiveIntensity: 0.12, roughness: 0.9,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: PAL.mayHair, emissive: PAL.mayHair, emissiveIntensity: 0.22, roughness: 0.65,
  });
  const sphereGeo = new THREE.SphereGeometry(1, 16, 12);
  const ellipsoid = (parent, mat, pos, scale) => {
    const mesh = new THREE.Mesh(sphereGeo, mat);
    mesh.position.set(...pos);
    mesh.scale.set(...scale);
    parent.add(mesh);
    return mesh;
  };
  ellipsoid(inner, clothMat, [0, 0.82, 0], [0.29, 0.37, 0.23]);
  const tunic = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 0.62, 20), clothMat);
  tunic.position.y = 0.59;
  inner.add(tunic);
  // Hai tà cong, chừa khe bên hông; ống quần và hài lộ dưới vạt áo.
  for (const side of [-1, 1]) {
    const panel = ellipsoid(inner, clothMat, [0, 0.34, side * 0.17], [0.37, 0.3, 0.1]);
    panel.rotation.x = side * -0.08;
    ellipsoid(inner, clothMat, [side * 0.16, 0.16, 0], [0.105, 0.18, 0.12]);
    ellipsoid(inner, hairMat, [side * 0.16, 0.035, 0.07], [0.12, 0.075, 0.18]);
    const sleeve = ellipsoid(inner, clothMat, [side * 0.34, 0.8, 0], [0.16, 0.29, 0.16]);
    sleeve.rotation.z = side * 0.3;
    ellipsoid(inner, skinMat, [side * 0.42, 0.58, 0.04], [0.1, 0.115, 0.1]);
  }
  ellipsoid(inner, skinMat, [0, 1.08, 0.02], [0.14, 0.17, 0.13]);
  // Cả mặt và tóc cùng nghiêng theo đầu, giữ mắt/vạch má bám trên mặt.
  const head = new THREE.Group();
  head.position.set(0, 1.42, 0.05);
  inner.add(head);
  ellipsoid(head, skinMat, [0, 0, 0], [0.45, 0.43, 0.42]);
  ellipsoid(head, hairMat, [0, 0.015, -0.23], [0.46, 0.43, 0.25]);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.465, 20, 12, 0, Math.PI * 2, 0, 1.15), hairMat);
  hairCap.scale.set(1, 0.95, 0.94);
  head.add(hairCap);
  for (let i = -2; i <= 2; i++) {
    const bang = ellipsoid(head, hairMat,
      [i * 0.135, 0.22 + Math.abs(i) * 0.025, 0.33 - Math.abs(i) * 0.035],
      [0.095, i === 0 ? 0.16 : 0.18, 0.105]);
    bang.rotation.z = i * -0.18;
  }

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x241f35 });
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const side of [-1, 1]) {
    ellipsoid(head, eyeMat, [side * 0.155, 0.005, 0.393], [0.045, 0.065, 0.025]);
    ellipsoid(head, whiteMat, [side * 0.155 - 0.012, 0.024, 0.416], [0.012, 0.017, 0.008]);
    // Ba vạch sơn trắng nằm ngang trên mỗi má, nổi sát mặt cong.
    for (let j = 0; j < 3; j++) {
      const y = -0.075 - j * 0.047;
      const z = 0.42 * Math.sqrt(1 - (0.28 / 0.45) ** 2 - (y / 0.43) ** 2);
      const stripe = ellipsoid(head, whiteMat, [side * 0.28, y, z + 0.012], [0.065, 0.012, 0.013]);
      stripe.rotation.y = side * 0.65;
    }
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.009, 6, 12, Math.PI), eyeMat);
  mouth.position.set(0, -0.12, 0.405);
  mouth.rotation.z = Math.PI;
  head.add(mouth);

  const scarfMat = new THREE.MeshStandardMaterial({ color: PAL.scarf, roughness: 0.8, emissive: PAL.scarf, emissiveIntensity: 0.12 });
  const braids = [];
  const braidPart = new THREE.Object3D();
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.4, 1.46, -0.015);
    inner.add(pivot);
    // Hai chuỗi ellipsoid đan chéo; 18 mắt tết + 3 múi túm tóc, 1 draw call/bím.
    const plait = new THREE.InstancedMesh(sphereGeo, hairMat, 21);
    for (let j = 0; j < 9; j++) {
      for (let strand = 0; strand < 2; strand++) {
        const weave = (j % 2 === 0 ? 1 : -1) * (strand === 0 ? 1 : -1);
        braidPart.position.set(side * (0.035 + j * 0.011) + weave * 0.04, -j * 0.092, 0.09 + strand * 0.025);
        braidPart.scale.set(0.073 - j * 0.002, 0.08, 0.068 - j * 0.002);
        braidPart.rotation.z = weave * 0.55;
        braidPart.updateMatrix();
        plait.setMatrixAt(j * 2 + strand, braidPart.matrix);
      }
    }
    for (let j = 0; j < 3; j++) {
      braidPart.position.set(side * 0.13 + (j - 1) * 0.035, -0.9, 0.11);
      braidPart.scale.set(0.035, 0.115 - Math.abs(j - 1) * 0.02, 0.04);
      braidPart.rotation.z = (j - 1) * 0.28;
      braidPart.updateMatrix();
      plait.setMatrixAt(18 + j, braidPart.matrix);
    }
    pivot.add(plait);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 12), scarfMat);
    tie.rotation.x = Math.PI / 2;
    tie.position.set(side * 0.13, -0.79, 0.11);
    pivot.add(tie);
    braids.push(pivot);
  }

  // khăn đỏ #C8102E quanh cổ, hai đuôi khăn bay phía sau
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.08, 8, 20), scarfMat);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.set(0, 1.04, 0.02);
  inner.add(scarf);
  const tails = [];
  for (let i = 0; i < 2; i++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.6), scarfMat);
    t.geometry.translate(0, 0, -0.3);
    t.position.set(i === 0 ? -0.12 : 0.12, 0.96, -0.32);
    inner.add(t);
    tails.push(t);
  }

  const strawMat = new THREE.MeshStandardMaterial({
    color: 0xe0bd72, emissive: 0x5a3d12, emissiveIntensity: 0.4, roughness: 0.85,
  });
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.82, 0.5, 28), strawMat);
  hat.position.set(0, 2.02, 0.02);
  const hatRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.8, 0.03, 6, 36),
    new THREE.MeshStandardMaterial({ color: 0xb98e48, roughness: 0.9 }),
  );
  hatRim.rotation.x = Math.PI / 2;
  hatRim.position.set(0, 1.78, 0.02);
  const hatTip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), strawMat);
  hatTip.position.set(0, 2.28, 0.02);
  inner.add(hat, hatRim, hatTip);

  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 1.35, 6),
    new THREE.MeshStandardMaterial({ color: PAL.wood, roughness: 0.9 }),
  );
  stick.position.set(0.72, 1.0, 0.1);
  stick.rotation.z = -0.28;
  inner.add(stick);
  const lanternMat = new THREE.MeshStandardMaterial({
    color: PAL.lampOn, emissive: PAL.lampOn, emissiveIntensity: 2.0, roughness: 0.5,
  });
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), lanternMat);
  lantern.scale.y = 1.2;
  const lanternPos = new THREE.Vector3(0.98, 1.38, 0.12);
  lantern.position.copy(lanternPos);
  inner.add(lantern);
  const lanternCap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.06, 8), new THREE.MeshStandardMaterial({ color: PAL.scarf }));
  lanternCap.position.set(0.98, 1.6, 0.12);
  inner.add(lanternCap);
  const lanternGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: PAL.lampOn, transparent: true, opacity: 0.85,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  lanternGlow.scale.set(1.9, 1.9, 1);
  lanternGlow.position.copy(lanternPos);
  inner.add(lanternGlow);
  const light = new THREE.PointLight(PAL.lampOn, 30, 16, 2);
  light.position.copy(lanternPos);
  inner.add(light);

  // hào quang Bùa Gió (viền vàng) quanh chân khi có bùa
  const charmAura = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1.0, 36),
    new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  );
  charmAura.rotation.x = -Math.PI / 2;
  charmAura.position.y = 0.08;
  shadowHolder.add(charmAura);

  root.add(group, shadowHolder);
  const st = { angle: 0, bob: 0, stretch: 0 };

  return {
    group,
    update(pos, faceAngle, speed01, t, dt, blink, flash, extra = {}) {
      const gy = extra.groundY ?? 0;
      group.position.set(pos[0], 0, pos[2]);
      shadowHolder.position.set(pos[0], gy, pos[2]);
      let d = faceAngle - st.angle;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      st.angle += d * Math.min(1, dt * 12);
      group.rotation.y = st.angle;

      st.bob += dt * (3 + speed01 * 7);
      const hover = 0.16 + Math.sin(st.bob) * (0.03 + 0.05 * speed01);
      inner.position.y = pos[1] + hover;
      const airborne = pos[1] - gy > 0.15;
      st.stretch += ((extra.dashing ? 1 : 0) - st.stretch) * Math.min(1, dt * 18);
      const sq = airborne ? 0.06 : Math.sin(st.bob * 2) * 0.03 * speed01;
      inner.scale.set(1 - sq - 0.12 * st.stretch, 1 + sq - 0.1 * st.stretch, 1 - sq + 0.35 * st.stretch);
      inner.rotation.z = Math.sin(st.bob * 0.5) * 0.04 * speed01;
      inner.visible = !blink;
      const h = Math.max(0, pos[1] - gy);
      const s = Math.max(0.4, 1 - h * 0.12);
      shadow.scale.setScalar(s);
      shadow.material.opacity = 0.35 * s;
      light.intensity = 30 + 40 * flash + 3 * Math.sin(t * 8);
      lanternGlow.material.opacity = 0.7 + 0.15 * Math.sin(t * 8) + 0.3 * flash;
      head.rotation.z = Math.sin(t * 1.7) * 0.04;
      for (let i = 0; i < braids.length; i++) {
        const side = i === 0 ? -1 : 1;
        braids[i].rotation.x = -0.08 - 0.28 * speed01 + Math.sin(st.bob + i * 1.6) * (0.025 + 0.12 * speed01) - 0.3 * st.stretch;
        braids[i].rotation.z = side * (0.04 + Math.sin(st.bob * 0.8 + i) * (0.025 + 0.1 * speed01));
      }
      const flutter = 0.25 + 0.6 * speed01 + (extra.charm ? 0.4 : 0);
      tails[0].rotation.y = Math.sin(t * 9) * 0.35 * flutter;
      tails[1].rotation.y = Math.sin(t * 9 + 1.7) * 0.35 * flutter;
      tails[0].rotation.x = -0.15 - 0.3 * flutter * (0.5 + 0.5 * Math.sin(t * 7));
      tails[1].rotation.x = -0.15 - 0.3 * flutter * (0.5 + 0.5 * Math.sin(t * 7 + 1));
      charmAura.material.opacity = extra.charm ? 0.55 + 0.25 * Math.sin(t * 6) : 0;
      charmAura.rotation.z = t * 1.5;
      charmAura.scale.setScalar(1 + 0.1 * Math.sin(t * 5));
    },
  };
}

// ---------------------------------------------------------------- Bóng Mực
const SHADE_COLOR = new THREE.Color(PAL.shade);
const STUN_COLOR = new THREE.Color(PAL.shadeStun);

export function createShadeView(root, glowTex, id, initialState) {
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);
  const mat = new THREE.MeshStandardMaterial({
    color: SHADE_COLOR, emissive: PAL.shadeRim, emissiveIntensity: 0.22, roughness: 0.75,
    transparent: true, opacity: 0.97,
  });
  // viền #7A3CFF: vỏ lớn hơn một chút, chỉ thấy mặt trong
  const rimMat = new THREE.MeshBasicMaterial({
    color: PAL.shadeRim, transparent: true, opacity: 0.55, side: THREE.BackSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.85, 22, 16), mat);
  body.scale.set(1, 0.92, 1);
  const rim = new THREE.Mesh(new THREE.SphereGeometry(0.95, 22, 16), rimMat);
  rim.scale.set(1, 0.92, 1);
  inner.add(body, rim);
  const blobs = [];
  const blobGeo = new THREE.SphereGeometry(0.36, 12, 10);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(blobGeo, mat);
    inner.add(m);
    blobs.push({ m, a: (i / n) * Math.PI * 2, ph: i * 1.3 + (id.length ? id.charCodeAt(id.length - 1) : 0) });
  }
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), mat);
  top.position.set(0, 0.8, -0.05);
  inner.add(top);

  const eyeMat = new THREE.MeshBasicMaterial({ color: PAL.shadeRim });
  const eyeGeo = new THREE.SphereGeometry(0.14, 10, 8);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.3, 0.22, 0.74);
  eyeR.position.set(0.3, 0.22, 0.74);
  inner.add(eyeL, eyeR);
  const pupilMat = new THREE.MeshBasicMaterial({ color: PAL.shade });
  const pupilGeo = new THREE.SphereGeometry(0.06, 8, 6);
  const pL = new THREE.Mesh(pupilGeo, pupilMat);
  const pR = new THREE.Mesh(pupilGeo, pupilMat);
  pL.position.set(-0.3, 0.2, 0.86);
  pR.position.set(0.3, 0.2, 0.86);
  inner.add(pL, pR);

  const aura = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: PAL.shadeRim, transparent: true, opacity: 0.3, depthWrite: false,
  }));
  aura.scale.set(4.6, 4.6, 1);
  inner.add(aura);

  const shadow = blobShadow(1.0, 0.4);
  const holder = new THREE.Group();
  holder.add(shadow);
  root.add(group, holder);

  // Vệt sáng nhỏ bay từ đèn vào Bóng đang hút dầu, không thêm nguồn sáng.
  const drainGeo = new THREE.BufferGeometry();
  const drainPositions = new Float32Array(8 * 3);
  drainGeo.setAttribute('position', new THREE.BufferAttribute(drainPositions, 3).setUsage(THREE.DynamicDrawUsage));
  const drainMat = new THREE.PointsMaterial({ map: glowTex, color: PAL.lampCore,
    size: 0.3, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
  const drainStream = new THREE.Points(drainGeo, drainMat);
  drainStream.frustumCulled = false;
  drainStream.visible = false;
  root.add(drainStream);

  const seed = (id.charCodeAt(id.length - 1) || 1) * 1.7;
  let stun = 0;
  let spawn = initialState === 'spawning' ? 0 : 1;
  let recoil = 0;

  return {
    group,
    dispose() {
      root.remove(group, holder, drainStream);
      mat.dispose(); rimMat.dispose(); aura.material.dispose(); eyeMat.dispose();
      drainGeo.dispose(); drainMat.dispose();
    },
    // state: spawning | wander | chase | recoil | stunned | drain
    update(pos, state, groundY, faceAngle, t, dt, distinguishableColors = false, drainPos = null) {
      const rimColor = distinguishableColors ? PAL.shadeAccessible : PAL.shadeRim;
      if (rimMat.color.getHex() !== rimColor) {
        rimMat.color.setHex(rimColor);
        eyeMat.color.setHex(rimColor);
        mat.emissive.setHex(rimColor);
        aura.material.color.setHex(rimColor);
      }
      drainStream.visible = state === 'drain' && !!drainPos;
      if (drainStream.visible) {
        for (let i = 0; i < drainPositions.length / 3; i++) {
          const k = (t * 0.75 + i / 8) % 1;
          const arc = Math.sin(k * Math.PI);
          drainPositions[i * 3] = drainPos[0] + (pos[0] - drainPos[0]) * k + Math.sin(t * 3 + i) * 0.12 * arc;
          drainPositions[i * 3 + 1] = drainPos[1] + 3.75 + (pos[1] - drainPos[1] - 3.75) * k + arc * 0.3;
          drainPositions[i * 3 + 2] = drainPos[2] + (pos[2] - drainPos[2]) * k + Math.cos(t * 3 + i) * 0.12 * arc;
        }
        drainGeo.attributes.position.needsUpdate = true;
        drainMat.opacity = 0.45 + 0.15 * Math.sin(t * Math.PI * 2);
      }
      const stunned = state === 'stunned';
      stun += ((stunned ? 1 : 0) - stun) * Math.min(1, dt * 8);
      recoil += ((state === 'recoil' ? 1 : 0) - recoil) * Math.min(1, dt * 10);
      if (state === 'spawning') spawn = Math.min(0.9, spawn + dt * 1.8);
      else spawn += (1 - spawn) * Math.min(1, dt * 10);
      const jx = stun > 0.5 ? Math.sin(t * 60 + seed) * 0.05 : 0;
      const jz = stun > 0.5 ? Math.cos(t * 53 + seed) * 0.05 : 0;
      group.position.set(pos[0] + jx, pos[1], pos[2] + jz);
      holder.position.set(pos[0], groundY, pos[2]);
      group.rotation.y = faceAngle;
      const wob = 1 + 0.07 * Math.sin(t * 4 + seed) + 0.1 * recoil * Math.sin(t * 30);
      const sc = 0.35 + 0.65 * spawn;
      inner.scale.set(wob * sc, (2 - wob) * sc, wob * sc);
      inner.position.y = Math.sin(t * 2.2 + seed) * 0.1;
      for (const b of blobs) {
        const w = Math.sin(t * 3 + b.ph);
        b.m.position.set(Math.sin(b.a) * (0.62 + 0.08 * w), -0.5 + 0.08 * w, Math.cos(b.a) * (0.62 + 0.08 * w));
        const s = 1 + 0.2 * w;
        b.m.scale.set(s, 1.1 - 0.2 * w, s);
      }
      mat.color.copy(SHADE_COLOR).lerp(STUN_COLOR, stun); // thân #120A1A, choáng #3A3450
      mat.emissiveIntensity = 0.22 * (1 - stun) + 0.05 * stun;
      mat.opacity = (0.97 - 0.2 * stun) * (0.3 + 0.7 * spawn);
      rimMat.opacity = (0.55 - 0.35 * stun) * spawn;
      aura.material.opacity = (0.3 - 0.2 * stun) * spawn;
      eyeL.scale.y = eyeR.scale.y = 1 - 0.8 * stun;
      pL.visible = pR.visible = stun < 0.5;
      inner.rotation.y = stun * Math.sin(t * 6 + seed) * 0.5;
      shadow.material.opacity = (0.4 - 0.2 * stun) * spawn;
      shadow.scale.setScalar(1 + 0.05 * Math.sin(t * 4 + seed));
    },
  };
}

// ---------------------------------------------------------------- Đom đóm
// Giữ API từng view cho main.js, nhưng vẽ cả đàn bằng 4 InstancedMesh/root:
// thân + đầu + râu, hai cánh, bụng sáng, quầng. Không thêm PointLight/texture.
// Pool lớn dần nếu scenario có thêm đom đóm rơi; không cắt bớt thực thể của sim.
const motePools = new WeakMap();

function createMotePool(root) {
  const sphere = new THREE.SphereGeometry(1, 10, 8);
  const haloGeo = new THREE.PlaneGeometry(1, 1);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x635b52, roughness: 0.9, emissive: 0x635b52, emissiveIntensity: 0.2 });
  const wingMat = new THREE.MeshBasicMaterial({ color: 0xe2eee8, transparent: true, opacity: 0.32, depthWrite: false });
  const coreMat = new THREE.MeshBasicMaterial({ color: PAL.moteCore, toneMapped: false });
  // Quầng tròn mềm tự tính trong shader, luôn hướng camera như sprite cũ.
  const haloMat = new THREE.ShaderMaterial({
    uniforms: { haloColor: { value: new THREE.Color(PAL.moteHalo) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false,
    vertexShader: `
      varying vec2 haloUv;
      varying float intensity;
      void main() {
        haloUv = uv;
        intensity = instanceColor.r;
        vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        center.xy += position.xy * length(instanceMatrix[0].xyz);
        gl_Position = projectionMatrix * center;
      }
    `,
    fragmentShader: `
      uniform vec3 haloColor;
      varying vec2 haloUv;
      varying float intensity;
      void main() {
        float r = length(haloUv - 0.5) * 2.0;
        float alpha = exp(-r * r * 5.5) * (1.0 - smoothstep(0.7, 1.0, r));
        gl_FragColor = vec4(haloColor, alpha * intensity * 0.65);
        #include <colorspace_fragment>
      }
    `,
  });
  const layers = [
    { geo: sphere, mat: bodyMat, parts: 4 },
    { geo: sphere, mat: wingMat, parts: 2 },
    { geo: sphere, mat: coreMat, parts: 1 },
    { geo: haloGeo, mat: haloMat, parts: 1 },
  ];
  const entries = [];
  const local = new THREE.Object3D();
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  let capacity = 0;

  function resize(n) {
    for (const layer of layers) {
      const old = layer.mesh;
      const mesh = new THREE.InstancedMesh(layer.geo, layer.mat, n * layer.parts);
      mesh.name = ['mote-body', 'mote-wings', 'mote-core', 'mote-halo'][layers.indexOf(layer)];
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false; // cả đàn trải khắp đảo, không dùng bound mặc định ở gốc
      mesh.count = entries.length * layer.parts;
      if (layer.mat === haloMat) {
        // instanceColor mang cường độ riêng; material/geometry vẫn dùng chung.
        mesh.setColorAt(0, color.setRGB(1, 1, 1));
        mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      }
      if (old) {
        for (let i = 0; i < old.count; i++) {
          old.getMatrixAt(i, matrix);
          mesh.setMatrixAt(i, matrix);
          if (old.instanceColor) { old.getColorAt(i, color); mesh.setColorAt(i, color); }
        }
        root.remove(old);
        old.dispose();
      }
      layer.mesh = mesh;
      root.add(mesh);
    }
    capacity = n;
  }

  function put(layerIndex, slot, part, group, x, y, z, sx, sy, sz, rz = 0) {
    local.position.set(x, y, z);
    local.scale.set(sx, sy, sz);
    local.rotation.set(0, 0, rz);
    local.updateMatrix();
    matrix.multiplyMatrices(group.matrix, local.matrix);
    const layer = layers[layerIndex];
    layer.mesh.setMatrixAt(slot * layer.parts + part, matrix);
    layer.mesh.instanceMatrix.needsUpdate = true;
  }

  return {
    add() {
      if (entries.length === capacity) resize(Math.max(32, capacity * 2));
      const entry = { slot: entries.length };
      entries.push(entry);
      // Chưa update thì ẩn slot mới, tránh hiện ở gốc đảo trong một frame.
      matrix.makeScale(0, 0, 0);
      for (const layer of layers) {
        layer.mesh.count = entries.length * layer.parts;
        for (let part = 0; part < layer.parts; part++) layer.mesh.setMatrixAt(entry.slot * layer.parts + part, matrix);
        layer.mesh.instanceMatrix.needsUpdate = true;
      }
      return entry;
    },
    remove(entry) {
      if (entry.slot < 0) return;
      const slot = entry.slot;
      const last = entries.pop();
      if (last !== entry) {
        entries[slot] = last;
        for (const layer of layers) {
          for (let part = 0; part < layer.parts; part++) {
            const to = slot * layer.parts + part;
            const from = last.slot * layer.parts + part;
            layer.mesh.getMatrixAt(from, matrix);
            layer.mesh.setMatrixAt(to, matrix);
            if (layer.mesh.instanceColor) {
              layer.mesh.getColorAt(from, color);
              layer.mesh.setColorAt(to, color);
              layer.mesh.instanceColor.needsUpdate = true;
            }
          }
        }
        last.slot = slot;
      }
      entry.slot = -1;
      for (const layer of layers) {
        layer.mesh.count = entries.length * layer.parts;
        layer.mesh.instanceMatrix.needsUpdate = true;
      }
      if (!entries.length) {
        for (const layer of layers) { root.remove(layer.mesh); layer.mesh.dispose(); layer.mat.dispose(); }
        sphere.dispose(); haloGeo.dispose();
        motePools.delete(root);
      }
    },
    update(entry, group, t, phase, tw, blink, dropped) {
      const slot = entry.slot;
      if (slot < 0) return;
      group.updateMatrix();
      put(0, slot, 0, group, 0, 0.025, 0.065, 0.075, 0.085, 0.115);
      put(0, slot, 1, group, 0, 0.045, 0.185, 0.078, 0.075, 0.075);
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        put(0, slot, 2 + i, group, side * 0.045, 0.13, 0.22, 0.009, 0.075, 0.009, side * -0.4);
        const flap = 0.25 + Math.sin(t * 65 + phase) * 0.65;
        put(1, slot, i, group, side * (0.04 + 0.115 * Math.cos(flap)), 0.06 + 0.115 * Math.sin(flap), 0.015,
          0.155, 0.013, 0.09, side * flap);
      }
      const pulse = (0.92 + 0.12 * tw) * (0.5 + 0.5 * blink);
      put(2, slot, 0, group, 0, -0.025, -0.105, 0.11 * pulse, 0.115 * pulse, 0.145 * pulse);
      const glowSize = (dropped ? 1.5 : 1.0) + 0.55 * tw;
      put(3, slot, 0, group, 0, -0.025, -0.105, glowSize, glowSize, glowSize);
      layers[3].mesh.setColorAt(slot, color.setRGB((0.55 + 0.45 * tw) * blink, 1, 1));
      layers[3].mesh.instanceColor.needsUpdate = true;
    },
  };
}

export function createMoteView(root, glowTex, id) {
  let pool = motePools.get(root);
  if (!pool) { pool = createMotePool(root); motePools.set(root, pool); }
  // group chỉ giữ transform của view, mesh thực được gộp vào pool của root.
  const group = new THREE.Group();
  const entry = pool.add();
  const phase = (parseInt(id.replace(/\D/g, ''), 10) || 1) * 2.399;
  return {
    group,
    dispose() { pool.remove(entry); },
    // kind: 'random' | 'dropped'; ttl: giây còn lại (null nếu không có)
    update(pos, t, kind, ttl) {
      const dropped = kind === 'dropped';
      let blink = 1;
      if (dropped && ttl != null && ttl < 3) blink = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 18));
      const tw = 0.5 + 0.5 * Math.sin(t * (dropped ? 8 : 5) + phase);
      group.position.set(
        pos[0] + Math.sin(t * 0.9 + phase) * 0.12,
        pos[1] + 0.8 + Math.sin(t * 1.7 + phase) * 0.15,
        pos[2] + Math.cos(t * 0.8 + phase) * 0.12,
      );
      group.rotation.y = phase + Math.sin(t * 0.65 + phase) * 0.4;
      pool.update(entry, group, t, phase, tw, blink, dropped);
    },
  };
}

// ---------------------------------------------------------------- Gió Lạc: dải lụa xám xanh #8FA3B8
export function createDrifterView(root, glowTex, id) {
  const group = new THREE.Group();
  const N = 16;
  const verts = new Float32Array((N + 1) * 2 * 3);
  const idx = [];
  for (let i = 0; i < N; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({
    color: PAL.drifter, side: THREE.DoubleSide, transparent: true, opacity: 0.88, depthWrite: false,
  });
  const ribbon = new THREE.Mesh(geo, mat);
  ribbon.frustumCulled = false;
  const head = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: PAL.drifter, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  head.scale.set(1.8, 1.8, 1);
  const loot = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: PAL.moteHalo, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  loot.scale.set(1.4, 1.4, 1);
  loot.position.set(0, 0.2, 0);
  group.add(ribbon, head, loot);
  const shadow = blobShadow(0.8, 0.15);
  const holder = new THREE.Group();
  holder.add(shadow);
  root.add(group, holder);
  const phase = (parseInt(id.replace(/\D/g, ''), 10) || 1) * 1.9;
  let fade = 1;

  return {
    group,
    dispose() {
      root.remove(group, holder);
      geo.dispose(); mat.dispose(); head.material.dispose(); loot.material.dispose();
    },
    update(pos, state, stolen, groundY, heading, t, dt) {
      const flee = state === 'flee';
      const chase = state === 'chase';
      const removed = state === 'removed';
      fade += ((removed ? 0 : 1) - fade) * Math.min(1, dt * 6);
      group.visible = fade > 0.02;
      group.position.set(pos[0], pos[1], pos[2]);
      holder.position.set(pos[0], groundY, pos[2]);
      group.rotation.y = heading;
      const amp = chase ? 0.55 : flee ? 0.45 : 0.3;
      const spd = chase ? 11 : flee ? 9 : 4;
      for (let i = 0; i <= N; i++) {
        const s = i / N;
        const z = -s * 3.4;
        const cx = Math.sin(t * spd - s * 7 + phase) * amp * s * 1.4;
        const cy = Math.sin(t * spd * 0.8 - s * 5 + phase) * 0.28 * s;
        const w = 0.34 * (1 - s * 0.75);
        verts[i * 6] = cx; verts[i * 6 + 1] = cy - w; verts[i * 6 + 2] = z;
        verts[i * 6 + 3] = cx; verts[i * 6 + 4] = cy + w; verts[i * 6 + 5] = z;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = (flee ? 0.6 : 0.88) * fade;
      head.material.opacity = (chase ? 1.0 : 0.6) * fade;
      loot.material.opacity = stolen > 0 ? (0.7 + 0.3 * Math.sin(t * 10)) * fade : 0;
      shadow.material.opacity = 0.15 * fade;
    },
  };
}

// ---------------------------------------------------------------- Bùa Gió: lá bùa đỏ viền vàng
export function createCharmView(root, glowTex, id, pos) {
  const group = new THREE.Group();
  const border = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.92, 0.04),
    new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: PAL.gold, emissiveIntensity: 0.5, roughness: 0.5 }),
  );
  const paper = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.8, 0.06),
    new THREE.MeshStandardMaterial({ color: PAL.scarf, emissive: PAL.scarf, emissiveIntensity: 0.25, roughness: 0.7 }),
  );
  const glyphMat = new THREE.MeshBasicMaterial({ color: PAL.gold });
  const g1 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.08), glyphMat); g1.position.y = 0.18;
  const g2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.08), glyphMat);
  const g3 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.08), glyphMat); g3.position.y = -0.18;
  group.add(border, paper, g1, g2, g3);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: PAL.gold, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.scale.set(2.4, 2.4, 1);
  group.add(glow);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.6, 28),
    new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(pos[0], pos[1] + 0.06, pos[2]);
  root.add(group, ring);
  const phase = (parseInt(id.replace(/\D/g, ''), 10) || 1) * 1.3;
  return {
    group,
    dispose() { root.remove(group, ring); },
    update(available, t) {
      group.visible = available;
      ring.material.opacity = available ? 0.35 : 0.12;
      ring.scale.setScalar(1 + 0.1 * Math.sin(t * 3 + phase));
      group.position.set(pos[0], pos[1] + 1.15 + Math.sin(t * 2 + phase) * 0.15, pos[2]);
      group.rotation.y = t * 1.6 + phase;
      group.rotation.z = Math.sin(t * 1.3 + phase) * 0.15;
    },
  };
}
