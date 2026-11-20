// Cảnh: trời sao, biển mây, địa hình theo bản đồ, Đèn Lồng Lớn, ánh sáng chung.
//
// Quy ước trục: sim dùng hệ "W = +Z, D = +X khi yaw 0". Camera nhìn về +Z trong hệ Three.js
// (tay phải) thì bên phải màn hình là -X. Để D luôn sang phải màn hình, mọi vật thể thế giới
// nằm trong group `root` có scale.x = -1 (tọa độ trong root = tọa độ sim). Camera nằm ngoài
// root nên khi đặt camera phải đổi x -> -x (xem main.js).
import * as THREE from 'three';
import { PAL, ambientIntensity } from './palette.js';
import { mulberry } from './textures.js';
import { buildTerrain } from './terrain.js';

const _c = new THREE.Color();
const LAMP_OFF = new THREE.Color(PAL.lampOff);
const LAMP_ON = new THREE.Color(PAL.lampOn);

export function createStage(canvas, tuning, glowTex) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(PAL.fog);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(PAL.fog, 0.0105);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1500);
  camera.position.set(0, 6, -10);

  const root = new THREE.Group();
  root.scale.x = -1; // xem ghi chú đầu file
  scene.add(root);

  const rand = mulberry(20261120);

  // ---------- Ánh sáng ----------
  // Ánh sáng môi trường = 0.15 + 0.55 × (đèn sáng / tổng đèn). Three r155+ dùng đơn vị vật lý nên nhân π
  // để cùng độ sáng với công thức; hemisphere + trăng là ánh sáng nền cố định cho dễ nhìn.
  const ambient = new THREE.AmbientLight(0xd8dcf0, ambientIntensity(0, 1) * Math.PI);
  const hemi = new THREE.HemisphereLight(0x7f8fbf, PAL.sky, 1.1);
  const moon = new THREE.DirectionalLight(0xc0c8f0, 1.2);
  moon.position.set(-40, 60, 30);
  root.add(ambient, hemi, moon);

  // ---------- Bầu trời (đi theo người chơi để không có thị sai) ----------
  const skyGroup = new THREE.Group();
  root.add(skyGroup);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(PAL.sky) },
      mid: { value: new THREE.Color(PAL.sky).lerp(new THREE.Color(PAL.fog), 0.6) },
      bottom: { value: new THREE.Color(PAL.fog) },
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
        vec3 c = mix(bottom, mid, smoothstep(-0.25, 0.1, h));
        c = mix(c, top, smoothstep(0.08, 0.8, h));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), skyMat);
  sky.renderOrder = -10;
  skyGroup.add(sky);

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
    skyGroup.add(new THREE.Points(geo, new THREE.PointsMaterial({
      size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true,
      opacity: 0.9, depthWrite: false, fog: false,
    })));
  }
  {
    const dir = new THREE.Vector3(-0.45, 0.55, 0.7).normalize();
    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(22, 24, 16),
      new THREE.MeshBasicMaterial({ color: PAL.lampCore, fog: false }),
    );
    moonMesh.position.copy(dir).multiplyScalar(560);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: PAL.moteHalo, transparent: true, opacity: 0.5,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    halo.scale.set(190, 190, 1);
    halo.position.copy(moonMesh.position);
    skyGroup.add(moonMesh, halo);
  }
  const seaFloor = new THREE.Mesh(
    new THREE.CircleGeometry(900, 48),
    new THREE.MeshBasicMaterial({ color: PAL.sea }),
  );
  seaFloor.rotation.x = -Math.PI / 2;
  seaFloor.position.y = -40;
  skyGroup.add(seaFloor);

  // ---------- Biển mây + địa hình (dựng lại mỗi Đêm) ----------
  let terrain = null;
  let cloudGroup = null;
  let cloudMesh = null;
  const cloudMat = new THREE.MeshStandardMaterial({ color: PAL.sea, emissive: PAL.sea, emissiveIntensity: 0.55, roughness: 1 });

  function buildClouds(map) {
    if (cloudGroup) {
      root.remove(cloudGroup);
      cloudMesh.geometry.dispose();
      cloudMesh.dispose();
    }
    cloudGroup = new THREE.Group();
    root.add(cloudGroup);
    let minX = Infinity; let maxX = -Infinity;
    for (const i of map.islands) { minX = Math.min(minX, i.center[0] - i.radius); maxX = Math.max(maxX, i.center[0] + i.radius); }
    const cx = (minX + maxX) / 2;
    const span = (maxX - minX) / 2 + 190;
    const count = 170;
    cloudMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 7), cloudMat, count);
    const m = new THREE.Matrix4(); const q = new THREE.Quaternion();
    const s = new THREE.Vector3(); const p = new THREE.Vector3();
    const r2 = mulberry(1234 + (map.night || 1));
    let n = 0;
    for (let tries = 0; tries < count * 4 && n < count; tries++) {
      const x = cx + (r2() * 2 - 1) * span;
      const z = (r2() * 2 - 1) * span;
      const y = -12 + r2() * 8;
      let ok = true;
      for (const i of map.islands) if (Math.hypot(x - i.center[0], z - i.center[1]) < i.radius + 6) { ok = false; break; }
      if (!ok) continue;
      const w = 6 + r2() * 12 + Math.hypot(x - cx, z) * 0.04;
      p.set(x, y, z);
      s.set(w, 2 + r2() * 3.5, w * (0.7 + r2() * 0.5));
      q.setFromEuler(new THREE.Euler(0, r2() * Math.PI, 0));
      m.compose(p, q, s);
      cloudMesh.setMatrixAt(n, m);
      _c.setHex(PAL.sea).offsetHSL(0, 0, (r2() - 0.4) * 0.07);
      cloudMesh.setColorAt(n, _c);
      n++;
    }
    cloudMesh.count = n;
    cloudGroup.add(cloudMesh);
  }

  // ---------- Đèn Lồng Lớn ----------
  // Chỉ 3 PointLight dùng chung, gán cho 3 đèn đã sáng gần người chơi nhất (số đèn cố định nên không
  // phải biên dịch lại shader và đỡ tốn GPU); các đèn còn lại vẫn sáng nhờ vật liệu phát sáng và quầng.
  const LIGHT_POOL = 3;
  const lightPool = Array.from({ length: LIGHT_POOL }, () => {
    const l = new THREE.PointLight(PAL.lampOn, 0, 34, 2);
    root.add(l);
    return { light: l, target: 0 };
  });
  const lanternViews = new Map();
  const safeR = tuning.safe_radius;
  const cost = tuning.lantern_cost;
  const stoneGeo = new THREE.CylinderGeometry(1.0, 1.2, 0.3, 24);
  const poleGeo = new THREE.CylinderGeometry(0.1, 0.14, 3.1, 10);
  const bodyGeo = new THREE.SphereGeometry(0.62, 22, 16);
  const coreGeo = new THREE.SphereGeometry(0.34, 14, 10);
  const ringGeo = new THREE.TorusGeometry(0.58, 0.04, 6, 24);
  const capTopGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.15, 14);
  const capBotGeo = new THREE.CylinderGeometry(0.2, 0.3, 0.12, 14);
  const tasselGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5);
  const pipGeo = new THREE.SphereGeometry(0.1, 10, 8);
  const safeRingGeo = new THREE.RingGeometry(safeR - 0.3, safeR, 96);
  const safeDiscGeo = new THREE.CircleGeometry(safeR, 64);
  const woodMat = new THREE.MeshStandardMaterial({ color: PAL.wood, roughness: 0.9 });
  const capMat = new THREE.MeshStandardMaterial({ color: PAL.scarf, roughness: 0.7 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: PAL.lampOff, roughness: 1, flatShading: true });
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
      color: PAL.lampOff, emissive: PAL.lampOn, emissiveIntensity: 0.0, roughness: 0.55,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.scale.set(1, 1.15, 1);
    const coreMat = new THREE.MeshBasicMaterial({ color: PAL.lampCore, transparent: true, opacity: 0 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.scale.set(1, 1.2, 1);
    const r1 = new THREE.Mesh(ringGeo, capMat); r1.rotation.x = Math.PI / 2; r1.position.y = 0.33;
    const r2 = new THREE.Mesh(ringGeo, capMat); r2.rotation.x = Math.PI / 2; r2.position.y = -0.33;
    const capTop = new THREE.Mesh(capTopGeo, capMat); capTop.position.y = 0.8;
    const capBot = new THREE.Mesh(capBotGeo, capMat); capBot.position.y = -0.78;
    const tassel = new THREE.Mesh(tasselGeo, capMat); tassel.position.y = -1.08;
    const hook = new THREE.Mesh(tasselGeo, woodMat); hook.position.y = 1.05; hook.scale.y = 0.8;
    head.add(body, core, r1, r2, capTop, capBot, tassel, hook);
    g.add(head);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: PAL.lampOn, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    halo.scale.set(9, 9, 1);
    halo.position.y = 3.75;
    g.add(halo);

    const ringMat = new THREE.MeshBasicMaterial({
      color: PAL.lampOn, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const safeRing = new THREE.Mesh(safeRingGeo, ringMat);
    safeRing.rotation.x = -Math.PI / 2; safeRing.position.y = 0.07;
    const discMat = new THREE.MeshBasicMaterial({
      color: PAL.lampOn, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const safeDisc = new THREE.Mesh(safeDiscGeo, discMat);
    safeDisc.rotation.x = -Math.PI / 2; safeDisc.position.y = 0.05;
    const wave = new THREE.Mesh(safeRingGeo, ringMat.clone());
    wave.rotation.x = -Math.PI / 2; wave.position.y = 0.08;
    g.add(safeDisc, safeRing, wave);

    const beamMat = new THREE.MeshBasicMaterial({
      color: PAL.lampOn, transparent: true, opacity: 0.08, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 23;
    g.add(beam);

    const pips = [];
    for (let i = 0; i < cost; i++) {
      const a = (i / cost) * Math.PI * 2;
      const m = new THREE.MeshStandardMaterial({
        color: PAL.lampOff, emissive: PAL.moteHalo, emissiveIntensity: 0, roughness: 0.5,
      });
      const p = new THREE.Mesh(pipGeo, m);
      p.position.set(Math.sin(a) * 1.5, 0.4, Math.cos(a) * 1.5);
      g.add(p);
      pips.push(m);
    }
    root.add(g);
    return { id: l.id, group: g, head, bodyMat, coreMat, halo, ringMat, discMat, wave, beamMat, pips,
      lit: 0, target: 0, phase: index * 1.7 };
  }

  function clearLanterns() {
    for (const v of lanternViews.values()) root.remove(v.group);
    lanternViews.clear();
  }

  function updateLanterns(list, dt, t, focus) {
    let litCount = 0;
    const cands = [];
    list.forEach((l, i) => {
      let v = lanternViews.get(l.id);
      if (!v) { v = makeLantern(l, i); lanternViews.set(l.id, v); }
      v.target = l.lit ? 1 : 0;
      v.lit += (v.target - v.lit) * Math.min(1, dt * 3.2);
      if (l.lit) litCount++;
      const k = v.lit;
      const flick = 1 + 0.07 * Math.sin(t * 9 + v.phase) + 0.04 * Math.sin(t * 23 + v.phase * 2);
      v.bodyMat.color.copy(LAMP_OFF).lerp(LAMP_ON, k); // tắt #5B5F6E, sáng #FFB347
      v.bodyMat.emissiveIntensity = 2.0 * k * flick;
      v.coreMat.opacity = k * 0.95; // lõi #FFE9B0
      if (k > 0.02) {
        const lp = v.group.position;
        const d2 = focus ? (lp.x - focus[0]) ** 2 + (lp.z - focus[2]) ** 2 : 0;
        cands.push({ v, d2, power: 190 * k * flick });
      }
      v.halo.material.opacity = 0.75 * k * (0.9 + 0.1 * flick);
      v.halo.scale.setScalar(7 + 2 * k);
      v.ringMat.opacity = 0.5 * k;
      v.discMat.opacity = 0.1 * k;
      v.beamMat.opacity = 0.04 + 0.1 * k + 0.02 * Math.sin(t * 2 + v.phase);
      const w = (t * 0.35 + v.phase) % 1;
      v.wave.scale.setScalar(0.25 + 0.75 * w);
      v.wave.material.opacity = 0.35 * k * (1 - w);
      v.head.rotation.z = Math.sin(t * 1.3 + v.phase) * 0.03 * (1 - k * 0.5);
      const dep = l.lit ? cost : l.deposited;
      for (let p = 0; p < v.pips.length; p++) {
        const on = p < dep;
        v.pips[p].emissiveIntensity += ((on ? 1.6 : 0) - v.pips[p].emissiveIntensity) * Math.min(1, dt * 8);
        v.pips[p].color.setHex(on ? PAL.moteHalo : PAL.lampOff);
      }
    });
    cands.sort((a, b) => a.d2 - b.d2);
    lightPool.forEach((slot, i) => {
      const c = cands[i];
      if (c) {
        slot.light.position.set(c.v.group.position.x, c.v.group.position.y + 3.75, c.v.group.position.z);
        slot.target = c.power;
      } else slot.target = 0;
      const e = slot.light.intensity;
      slot.light.intensity = e + (slot.target - e) * Math.min(1, dt * 8);
    });
    return litCount;
  }

  // ---------- Ánh sáng chung ----------
  let glow = 0;
  let ambientValue = ambientIntensity(0, 1);
  function updateAmbience(targetGlow, dt, t, flash, snapNow) {
    glow = snapNow ? targetGlow : glow + (targetGlow - glow) * Math.min(1, dt * 1.5);
    ambientValue = 0.15 + 0.55 * glow; // công thức của ticket (lit/total đã làm mượt)
    ambient.intensity = ambientValue * Math.PI + 0.8 * flash;
    hemi.intensity = 1.1 + 0.4 * glow;
    moon.intensity = 1.2 + 0.8 * glow;
    if (terrain) terrain.update(t, glow);
    if (cloudGroup) cloudGroup.rotation.y = t * 0.004;
    return glow;
  }

  function loadMap(map) {
    if (terrain) terrain.dispose();
    terrain = buildTerrain(map, root, glowTex);
    buildClouds(map);
    clearLanterns();
    glow = 0;
  }

  let renderScale = 1;
  // độ phân giải kết xuất thích ứng (giảm khi máy yếu để giữ FPS)
  function setRenderScale(s) {
    renderScale = s;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * s);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  return {
    renderer, scene, camera, root, lanternViews, skyGroup,
    loadMap, updateLanterns, updateAmbience, resize, setRenderScale,
    get renderScale() { return renderScale; },
    get glow() { return glow; },
    get ambient() { return ambientValue; },
  };
}
