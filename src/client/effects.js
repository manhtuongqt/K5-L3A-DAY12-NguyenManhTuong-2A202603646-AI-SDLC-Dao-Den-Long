// Hiệu ứng ngắn: vòng sáng tỏa, bùng sáng, tia lửa nhỏ. Tọa độ sim.
import * as THREE from 'three';

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
  function ring(pos, radius, life, color = 0xffd27a) {
    const m = new THREE.Mesh(ringGeo, additive(color, 0.9));
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos[0], 0.1, pos[2]);
    addMesh(m, life, (e, k) => {
      const ease = 1 - Math.pow(1 - k, 3);
      e.mesh.scale.setScalar(Math.max(0.01, radius * ease));
      e.mesh.material.opacity = 0.9 * (1 - k);
    });
  }

  function dome(pos, radius, life, color = 0xffc860) {
    const m = new THREE.Mesh(domeGeo, additive(color, 0.3));
    m.position.set(pos[0], 0, pos[2]);
    addMesh(m, life, (e, k) => {
      const ease = 1 - Math.pow(1 - k, 3);
      e.mesh.scale.setScalar(Math.max(0.01, radius * ease));
      e.mesh.material.opacity = 0.3 * (1 - k) * (1 - k);
    });
  }

  function glowPop(pos, size, life, color = 0xffd27a, height = 1.0) {
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

  function sparks(pos, count = 7, color = 0xffd36a) {
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

  return {
    state,
    pulse(pos) {
      ring(pos, pulseR, 0.75);
      ring(pos, pulseR * 0.7, 0.55, 0xfff0c0);
      dome(pos, pulseR, 0.7);
      glowPop(pos, 7, 0.5, 0xfff0c0, 1.2);
      state.flash = 1;
    },
    pickup(pos) {
      sparks(pos, 6);
      glowPop(pos, 2.6, 0.35, 0xffe9a0, 1.2);
    },
    deposit(lanternPos) {
      sparks(lanternPos, 8, 0xffb454);
      glowPop(lanternPos, 4, 0.5, 0xffa040, 3.7);
    },
    lanternLit(lanternPos, safeRadius) {
      ring(lanternPos, safeRadius, 1.2, 0xffa23c);
      ring(lanternPos, safeRadius * 0.55, 0.9, 0xffe0a0);
      glowPop(lanternPos, 14, 1.0, 0xffa23c, 3.7);
      sparks(lanternPos, 22, 0xffc060);
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
