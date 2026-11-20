// Hiệu ứng ngắn: vòng sáng tỏa, bùng sáng, tia lửa nhỏ. Tọa độ sim.
import * as THREE from 'three';
import { PAL } from './palette.js';

const ringGeo = new THREE.RingGeometry(0.9, 1, 72);
const domeGeo = new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2);

export function createEffects(root, tuning, glowTex) {
  const list = [];
  const pulseR = tuning.pulse_radius;
  const state = { flash: 0 };

  function addMesh(mesh, life, onUpdate) {
    root.add(mesh);
    list.push({ mesh, age: 0, life, onUpdate });
  }

  function additive(color, opacity) {
    return new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
  }

  // vòng sáng lan ra tới pulse_radius khi tỏa sáng
  function ring(pos, radius, life, color = PAL.moteHalo) {
    const m = new THREE.Mesh(ringGeo, additive(color, 0.9));
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos[0], 0.1, pos[2]);
    addMesh(m, life, (e, k) => {
      const ease = 1 - Math.pow(1 - k, 3);
      e.mesh.scale.setScalar(Math.max(0.01, radius * ease));
      e.mesh.material.opacity = 0.9 * (1 - k);
    });
  }

  function dome(pos, radius, life, color = PAL.lampOn) {
    const m = new THREE.Mesh(domeGeo, additive(color, 0.3));
    m.position.set(pos[0], 0, pos[2]);
    addMesh(m, life, (e, k) => {
      const ease = 1 - Math.pow(1 - k, 3);
      e.mesh.scale.setScalar(Math.max(0.01, radius * ease));
      e.mesh.material.opacity = 0.3 * (1 - k) * (1 - k);
    });
  }

  function glowPop(pos, size, life, color = PAL.moteHalo, height = 1.0) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color, transparent: true, opacity: 1,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    s.position.set(pos[0], (pos[1] || 0) + height, pos[2]);
    addMesh(s, life, (e, k) => {
      e.mesh.scale.setScalar(size * (0.3 + 0.9 * k));
      e.mesh.material.opacity = 1 - k;
    });
  }

  function sparks(pos, count = 7, color = PAL.moteHalo) {
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color, transparent: true, opacity: 1,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 2.2;
      const v = [Math.cos(a) * sp, 2.5 + Math.random() * 2, Math.sin(a) * sp];
      s.position.set(pos[0], (pos[1] || 0) + 1.0, pos[2]);
      addMesh(s, 0.7, (e, k, dt) => {
        v[1] -= 7 * dt;
        e.mesh.position.x += v[0] * dt;
        e.mesh.position.y = Math.max(0.1, e.mesh.position.y + v[1] * dt);
        e.mesh.position.z += v[2] * dt;
        e.mesh.scale.setScalar(0.5 * (1 - k) + 0.1);
        e.mesh.material.opacity = 1 - k;
      });
    }
  }

  // vệt lướt: vài bóng mờ của Mây rải ngược hướng lướt
  function dash(pos, angle) {
    const dx = Math.sin(angle); const dz = Math.cos(angle);
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: PAL.cloud, transparent: true, opacity: 0.8,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      s.position.set(pos[0] - dx * i * 0.5, (pos[1] || 0) + 0.9, pos[2] - dz * i * 0.5);
      addMesh(s, 0.35 + i * 0.03, (e, k) => {
        e.mesh.scale.setScalar(1.8 * (1 - k * 0.6));
        e.mesh.material.opacity = 0.6 * (1 - k);
      });
    }
  }

  return {
    state,
    dash,
    pulse(pos) {
      ring(pos, pulseR, 0.75);
      ring(pos, pulseR * 0.7, 0.55, PAL.lampCore);
      dome(pos, pulseR, 0.7);
      glowPop(pos, 7, 0.5, PAL.lampCore, 1.2);
      state.flash = 1;
    },
    pickup(pos) {
      sparks(pos, 6);
      glowPop(pos, 2.6, 0.35, PAL.moteCore, 1.2);
    },
    deposit(lanternPos) {
      sparks(lanternPos, 8, PAL.lampOn);
      glowPop(lanternPos, 4, 0.5, PAL.lampOn, 3.7);
    },
    lanternLit(lanternPos, safeRadius) {
      ring(lanternPos, safeRadius, 1.2, PAL.lampOn);
      ring(lanternPos, safeRadius * 0.55, 0.9, PAL.lampCore);
      glowPop(lanternPos, 14, 1.0, PAL.lampOn, 3.7);
      sparks(lanternPos, 22, PAL.moteHalo);
      state.flash = Math.max(state.flash, 0.5);
    },
    update(dt) {
      state.flash = Math.max(0, state.flash - dt * 2.5);
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        e.age += dt;
        const k = Math.min(1, e.age / e.life);
        e.onUpdate(e, k, dt);
        if (k >= 1) {
          root.remove(e.mesh);
          e.mesh.material.dispose();
          list.splice(i, 1);
        }
      }
    },
  };
}

// Lá bay khi gió (Đêm 3). intensity 0..1: 0.35 khi báo trước, 1 khi gió thổi.
export function createWindLeaves(root) {
  const N = 110;
  const mesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.3, 0.18),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.9, fog: true }),
    N,
  );
  mesh.frustumCulled = false;
  const base = [];
  const col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    base.push({ x: Math.random() * 60, y: Math.random() * 7 + 0.4, z: Math.random() * 60, ph: Math.random() * 6.28, sp: 0.6 + Math.random() });
    col.setHex(i % 3 === 0 ? PAL.gold : i % 3 === 1 ? 0x9ccf7a : PAL.sand);
    mesh.setColorAt(i, col);
  }
  mesh.visible = false;
  root.add(mesh);
  const d = new THREE.Object3D();
  let travel = 0;
  return {
    update(dt, t, playerPos, intensity, dirDeg) {
      mesh.visible = intensity > 0.01;
      if (!mesh.visible) return;
      mesh.count = Math.max(1, Math.round(N * Math.min(1, intensity)));
      const a = ((dirDeg ?? 40) * Math.PI) / 180;
      const speed = 5 + 13 * intensity;
      travel += dt * speed;
      const vx = Math.cos(a); const vz = Math.sin(a);
      for (let i = 0; i < mesh.count; i++) {
        const b = base[i];
        const wx = (((b.x + vx * travel * b.sp) % 60) + 60) % 60 - 30;
        const wz = (((b.z + vz * travel * b.sp) % 60) + 60) % 60 - 30;
        d.position.set(playerPos[0] + wx, playerPos[1] + b.y + Math.sin(t * 2 + b.ph) * 0.5, playerPos[2] + wz);
        d.rotation.set(t * 3 * b.sp + b.ph, t * 2 + b.ph, Math.atan2(vz, vx));
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
