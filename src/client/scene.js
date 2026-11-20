// Cảnh tĩnh: trời sao, biển mây, đảo, Đèn Lồng Lớn, ánh sáng chung.
//
// Quy ước trục: sim dùng hệ "W = +Z, D = +X khi yaw 0". Nếu camera nhìn về +Z trong hệ
// Three.js (tay phải) thì bên phải màn hình là -X. Để D luôn sang phải màn hình, mọi vật
// thể thế giới nằm trong group `root` có scale.x = -1 (tọa độ trong root = tọa độ sim).
// Camera nằm ngoài root, nên khi đặt camera phải đổi x -> -x (xem main.js).
import * as THREE from 'three';
import { ISLAND_RADIUS } from '../sim/world.js';
import { makeGroundTexture, mulberry } from './textures.js';

const FOG_DARK = new THREE.Color(0x160b2b);
const FOG_WARM = new THREE.Color(0x3a1b40);
const HEMI_SKY = new THREE.Color(0x8b7fd6);
const HEMI_SKY_WARM = new THREE.Color(0xc9a4c8);
const HEMI_GROUND = new THREE.Color(0x2e2438);
const LANTERN_UNLIT = new THREE.Color(0x35201f);
const LANTERN_LIT = new THREE.Color(0xffa23c);
const _c = new THREE.Color();

export function createStage(canvas, tuning, glowTex) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(FOG_DARK);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(FOG_DARK.getHex(), 0.011);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1500);
  camera.position.set(0, 6, -10);

  const root = new THREE.Group();
  root.scale.x = -1; // xem ghi chú đầu file
  scene.add(root);

  const rand = mulberry(20261120); // chỉ để rải trang trí, không liên quan sim

  // ---------- Ánh sáng ----------
  const hemi = new THREE.HemisphereLight(HEMI_SKY.getHex(), HEMI_GROUND.getHex(), 2.0);
  root.add(hemi);
  const moon = new THREE.DirectionalLight(0xa9b8ff, 1.2);
  moon.position.set(-40, 60, 30);
  root.add(moon);

  // ---------- Bầu trời ----------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x07031a) },
      mid: { value: new THREE.Color(0x24124a) },
      bottom: { value: FOG_DARK.clone() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 bottom;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 c = mix(bottom, mid, smoothstep(-0.25, 0.12, h));
        c = mix(c, top, smoothstep(0.1, 0.85, h));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), skyMat);
  sky.renderOrder = -10;
  root.add(sky);

  // sao
  {
    const n = 1100;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const y = 0.03 + rand() * 0.97;
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(1 - y * y);
      pos[i * 3] = Math.cos(a) * r * 650;
      pos[i * 3 + 1] = y * 650;
      pos[i * 3 + 2] = Math.sin(a) * r * 650;
      const warm = rand();
      _c.setRGB(0.85 + warm * 0.15, 0.85 + warm * 0.05, 0.8 + (1 - warm) * 0.2);
      col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true,
      opacity: 0.9, depthWrite: false, fog: false,
    }));
    root.add(stars);
  }

  // trăng
  {
    const dir = new THREE.Vector3(-0.45, 0.55, 0.7).normalize();
    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(22, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff1d0, fog: false }),
    );
    moonMesh.position.copy(dir).multiplyScalar(560);
    root.add(moonMesh);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffd9a0, transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    halo.scale.set(190, 190, 1);
    halo.position.copy(moonMesh.position);
    root.add(halo);
  }

  // đáy biển mây (che khoảng trống bên dưới)
  {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(900, 48),
      new THREE.MeshBasicMaterial({ color: 0x1c0f36 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -26;
    root.add(floor);
  }

  // ---------- Biển mây ----------
  const cloudGroup = new THREE.Group();
  root.add(cloudGroup);
  const cloudCount = 240;
  const cloudMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0x7a69a8, emissive: 0x2c2052, emissiveIntensity: 0.6, roughness: 1 }),
    cloudCount,
  );
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (let i = 0; i < cloudCount; i++) {
      const ang = rand() * Math.PI * 2;
      const rad = ISLAND_RADIUS + 3 + Math.pow(rand(), 0.7) * 190;
      const w = 6 + rand() * 12 + rad * 0.05;
      p.set(Math.cos(ang) * rad, -9 + rand() * 7 - rad * 0.015, Math.sin(ang) * rad);
      s.set(w, 2 + rand() * 3.5, w * (0.7 + rand() * 0.5));
      q.setFromEuler(new THREE.Euler(0, rand() * Math.PI, 0));
      m.compose(p, q, s);
      cloudMesh.setMatrixAt(i, m);
      _c.setHSL(0.72 + rand() * 0.06, 0.25, 0.42 + rand() * 0.14);
      cloudMesh.setColorAt(i, _c);
    }
  }
  cloudGroup.add(cloudMesh);

  // ---------- Đảo ----------
  const R = ISLAND_RADIUS;
  const groundTex = makeGroundTexture(rand);
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x4d6a4a, roughness: 1 });
  const topMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 });
  const islandTop = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R * 0.97, 3, 72),
    [sideMat, topMat, sideMat],
  );
  islandTop.position.y = -1.5;
  root.add(islandTop);

  const rockMat = new THREE.MeshStandardMaterial({ color: 0x5b4a5e, roughness: 1, flatShading: true });
  const islandBottom = new THREE.Mesh(new THREE.ConeGeometry(R * 0.97, 22, 36, 3), rockMat);
  islandBottom.rotation.x = Math.PI;
  islandBottom.position.y = -3 - 11;
  root.add(islandBottom);
  for (let i = 0; i < 12; i++) {
    const a = rand() * Math.PI * 2;
    const r = R * (0.35 + rand() * 0.5);
    const h = 4 + rand() * 7;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(1 + rand() * 1.8, h, 7), rockMat);
    spike.rotation.x = Math.PI;
    spike.position.set(Math.cos(a) * r, -3 - (R - r) * 0.2 - h / 2 - 1, Math.sin(a) * r);
    root.add(spike);
  }

  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(R, 0.4, 8, 120),
    new THREE.MeshStandardMaterial({ color: 0x5e8a58, roughness: 1 }),
  );
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0;
  root.add(lip);

  // cỏ, hoa, đá (trang trí, rải bằng PRNG riêng của client)
  const placeOnIsland = (minR, maxR) => {
    const a = rand() * Math.PI * 2;
    const r = minR + Math.sqrt(rand()) * (maxR - minR);
    return [Math.cos(a) * r, Math.sin(a) * r];
  };
  const dummy = new THREE.Object3D();

  const tuftCount = 900;
  const tufts = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.05, 0.4, 3),
    new THREE.MeshStandardMaterial({ roughness: 1 }),
    tuftCount,
  );
  for (let i = 0; i < tuftCount; i++) {
    const [x, z] = placeOnIsland(1.5, R - 0.8);
    const h = 0.4 + rand() * 0.8;
    dummy.position.set(x, h * 0.2, z);
    dummy.rotation.set((rand() - 0.5) * 0.4, rand() * 6, (rand() - 0.5) * 0.4);
    dummy.scale.set(1, h, 1);
    dummy.updateMatrix();
    tufts.setMatrixAt(i, dummy.matrix);
    _c.setHSL(0.27 + rand() * 0.08, 0.4, 0.28 + rand() * 0.15);
    tufts.setColorAt(i, _c);
  }
  root.add(tufts);

  const flowerCount = 70;
  const flowerMat = new THREE.MeshStandardMaterial({
    color: 0xffe9a0, emissive: 0xffc860, emissiveIntensity: 0.4, roughness: 0.6,
  });
  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), flowerMat, flowerCount);
  const stems = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.4, 5),
    new THREE.MeshStandardMaterial({ color: 0x3f6a3d, roughness: 1 }),
    flowerCount,
  );
  for (let i = 0; i < flowerCount; i++) {
    const [x, z] = placeOnIsland(2, R - 1.5);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.position.set(x, 0.42, z);
    dummy.updateMatrix();
    flowers.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 0.2, z);
    dummy.updateMatrix();
    stems.setMatrixAt(i, dummy.matrix);
  }
  root.add(flowers, stems);

  const stoneCount = 24;
  const stones = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.5, 0),
    new THREE.MeshStandardMaterial({ color: 0x7a7088, roughness: 1, flatShading: true }),
    stoneCount,
  );
  for (let i = 0; i < stoneCount; i++) {
    const [x, z] = placeOnIsland(3, R - 1);
    const s = 0.4 + rand() * 1.0;
    dummy.position.set(x, s * 0.2, z);
    dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    dummy.scale.set(s, s * (0.6 + rand() * 0.4), s);
    dummy.updateMatrix();
    stones.setMatrixAt(i, dummy.matrix);
  }
  root.add(stones);

  // ---------- Đèn Lồng Lớn ----------
  const lanternViews = new Map();
  const safeR = tuning.safe_radius;
  const cost = tuning.lantern_cost;

  const stoneGeo = new THREE.CylinderGeometry(1.0, 1.2, 0.3, 24);
  const poleGeo = new THREE.CylinderGeometry(0.1, 0.14, 3.1, 10);
  const bodyGeo = new THREE.SphereGeometry(0.62, 22, 16);
  const ringGeo = new THREE.TorusGeometry(0.58, 0.04, 6, 24);
  const capTopGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.15, 14);
  const capBotGeo = new THREE.CylinderGeometry(0.2, 0.3, 0.12, 14);
  const tasselGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5);
  const pipGeo = new THREE.SphereGeometry(0.11, 10, 8);
  const safeRingGeo = new THREE.RingGeometry(safeR - 0.3, safeR, 96);
  const safeDiscGeo = new THREE.CircleGeometry(safeR, 64);
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3226, roughness: 0.9 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0x6b1f18, roughness: 0.7 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x625870, roughness: 1, flatShading: true });
  const beamGeo = new THREE.CylinderGeometry(0.35, 0.9, 46, 16, 1, true);

  function makeLantern(l, index) {
    const g = new THREE.Group();
    g.position.set(l.pos[0], l.pos[1] || 0, l.pos[2]);

    const base = new THREE.Mesh(stoneGeo, stoneMat);
    base.position.y = 0.15;
    const pole = new THREE.Mesh(poleGeo, woodMat);
    pole.position.y = 1.7;
    g.add(base, pole);

    const head = new THREE.Group();
    head.position.y = 3.75;
    const bodyMat = new THREE.MeshStandardMaterial({
      color: LANTERN_UNLIT, emissive: 0xff7a1a, emissiveIntensity: 0.05, roughness: 0.55,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.scale.set(1, 1.15, 1);
    const r1 = new THREE.Mesh(ringGeo, redMat); r1.rotation.x = Math.PI / 2; r1.position.y = 0.33;
    const r2 = new THREE.Mesh(ringGeo, redMat); r2.rotation.x = Math.PI / 2; r2.position.y = -0.33;
    const capTop = new THREE.Mesh(capTopGeo, redMat); capTop.position.y = 0.8;
    const capBot = new THREE.Mesh(capBotGeo, redMat); capBot.position.y = -0.78;
    const tassel = new THREE.Mesh(tasselGeo, redMat); tassel.position.y = -1.08;
    const hook = new THREE.Mesh(tasselGeo, woodMat); hook.position.y = 1.05; hook.scale.y = 0.8;
    head.add(body, r1, r2, capTop, capBot, tassel, hook);
    g.add(head);

    const light = new THREE.PointLight(0xff9a3c, 0, 34, 2);
    light.position.y = 3.75;
    g.add(light);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xff9a3c, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    halo.scale.set(9, 9, 1);
    halo.position.y = 3.75;
    g.add(halo);

    // vùng an toàn
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffa23c, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const safeRing = new THREE.Mesh(safeRingGeo, ringMat);
    safeRing.rotation.x = -Math.PI / 2;
    safeRing.position.y = 0.07;
    const discMat = new THREE.MeshBasicMaterial({
      color: 0xff9a3c, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const safeDisc = new THREE.Mesh(safeDiscGeo, discMat);
    safeDisc.rotation.x = -Math.PI / 2;
    safeDisc.position.y = 0.05;
    const wave = new THREE.Mesh(safeRingGeo, ringMat.clone());
    wave.rotation.x = -Math.PI / 2;
    wave.position.y = 0.08;
    g.add(safeDisc, safeRing, wave);

    // chùm sáng để dễ tìm đèn từ xa
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffb060, transparent: true, opacity: 0.08, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 23;
    g.add(beam);

    // tiến độ nạp: các hạt nhỏ quanh chân đèn
    const pips = [];
    for (let i = 0; i < cost; i++) {
      const a = (i / cost) * Math.PI * 2;
      const m = new THREE.MeshStandardMaterial({
        color: 0x3a2f3f, emissive: 0xffc060, emissiveIntensity: 0, roughness: 0.5,
      });
      const p = new THREE.Mesh(pipGeo, m);
      p.position.set(Math.sin(a) * 1.5, 0.4, Math.cos(a) * 1.5);
      g.add(p);
      pips.push(m);
    }

    root.add(g);
    return {
      id: l.id, group: g, head, bodyMat, light, halo, ringMat, discMat, wave, beamMat, pips,
      lit: 0, target: 0, phase: index * 1.7,
    };
  }

  const nearestSet = new Set();
  function updateLanterns(list, dt, t) {
    nearestSet.clear();
    let litCount = 0;
    list.forEach((l, i) => {
      let v = lanternViews.get(l.id);
      if (!v) { v = makeLantern(l, i); lanternViews.set(l.id, v); }
      v.group.position.set(l.pos[0], l.pos[1] || 0, l.pos[2]);
      v.target = l.lit ? 1 : 0;
      v.lit += (v.target - v.lit) * Math.min(1, dt * 3.2);
      if (l.lit) litCount++;
      const k = v.lit;
      const flick = 1 + 0.07 * Math.sin(t * 9 + v.phase) + 0.04 * Math.sin(t * 23 + v.phase * 2);
      _c.copy(LANTERN_UNLIT).lerp(LANTERN_LIT, k);
      v.bodyMat.color.copy(_c);
      v.bodyMat.emissiveIntensity = 0.05 + 2.4 * k * flick;
      v.light.intensity = 190 * k * flick;
      v.halo.material.opacity = 0.75 * k * (0.9 + 0.1 * flick);
      v.halo.scale.setScalar(7 + 2 * k);
      v.ringMat.opacity = 0.5 * k;
      v.discMat.opacity = 0.1 * k;
      v.beamMat.opacity = 0.05 + 0.1 * k + 0.02 * Math.sin(t * 2 + v.phase);
      v.beamMat.color.setHex(k > 0.5 ? 0xffa850 : 0xc9b8ff);
      // sóng lan chậm từ đèn ra mép vùng an toàn
      const w = ((t * 0.35 + v.phase) % 1);
      v.wave.scale.setScalar(0.25 + 0.75 * w);
      v.wave.material.opacity = 0.35 * k * (1 - w);
      v.head.rotation.z = Math.sin(t * 1.3 + v.phase) * 0.03 * (1 - k * 0.5);
      const dep = l.lit ? cost : l.deposited;
      for (let p = 0; p < v.pips.length; p++) {
        const on = p < dep;
        v.pips[p].emissiveIntensity += ((on ? 1.6 : 0) - v.pips[p].emissiveIntensity) * Math.min(1, dt * 8);
        v.pips[p].color.setHex(on ? 0xffd27a : 0x3a2f3f);
      }
    });
    return litCount;
  }

  // ---------- Ánh sáng chung theo số đèn đã thắp ----------
  let glow = 0;
  function updateAmbience(targetGlow, dt, t, flash) {
    glow += (targetGlow - glow) * Math.min(1, dt * 1.5);
    hemi.intensity = 2.0 + 2.0 * glow + 0.8 * flash;
    hemi.color.copy(HEMI_SKY).lerp(HEMI_SKY_WARM, glow);
    moon.intensity = 1.2 + 1.6 * glow;
    _c.copy(FOG_DARK).lerp(FOG_WARM, glow);
    scene.fog.color.copy(_c);
    scene.fog.density = 0.011 - 0.003 * glow;
    renderer.setClearColor(_c);
    skyMat.uniforms.bottom.value.copy(_c);
    skyMat.uniforms.mid.value.setHex(0x24124a).lerp(_c.setHex(0x4a2250), glow * 0.8);
    flowerMat.emissiveIntensity = 0.4 + 1.0 * glow;
    cloudGroup.rotation.y = t * 0.006;
    return glow;
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  return {
    renderer, scene, camera, root, lanternViews,
    updateLanterns, updateAmbience, resize,
    get glow() { return glow; },
  };
}
