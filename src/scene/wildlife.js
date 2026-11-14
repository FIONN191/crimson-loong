import * as THREE from 'three';
import { mulberry32 } from '../utils/noise.js';

/**
 * Animated soaring White Cranes & Valley Mist Billows.
 */
export function createWildlifeAndMist(scene, mistTexture) {
  const group = new THREE.Group();
  scene.add(group);

  const rng = mulberry32(7711);

  // ------------------------------------------------------------------
  // 1. FLOCK OF SOARING WHITE CRANES
  // ------------------------------------------------------------------
  const craneCount = 12;
  const craneUniformTime = { value: 0 };

  // Build graceful curved V-wing bird silhouette
  const wingGeo = new THREE.BufferGeometry();
  const verts = new Float32Array([
    // Body center spine (0..3)
    0.0, 0.0, 0.55,    // beak tip
    0.0, 0.04, 0.0,    // torso
    0.0, 0.02, -0.45,  // tail
    // Left wing inner & tip
    -0.38, 0.08, 0.08,
    -0.88, 0.04, -0.18,
    // Right wing inner & tip
    0.38, 0.08, 0.08,
    0.88, 0.04, -0.18
  ]);
  const indices = [
    0, 1, 3,
    1, 2, 3,
    1, 4, 3,
    0, 5, 1,
    1, 5, 2,
    1, 6, 5
  ];
  wingGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  wingGeo.setIndex(indices);
  wingGeo.computeVertexNormals();

  const craneMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fbfaf6'),
    emissive: new THREE.Color('#3a3228'),
    emissiveIntensity: 0.12,
    roughness: 0.6,
    side: THREE.DoubleSide
  });

  craneMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = craneUniformTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float span = abs(position.x);
        if (span > 0.05) {
          float flap = sin(uTime * 5.2 + float(gl_InstanceID) * 1.37);
          transformed.y += flap * span * 0.42;
        }`
      );
  };

  const craneInst = new THREE.InstancedMesh(wingGeo, craneMat, craneCount);
  craneInst.frustumCulled = false;
  group.add(craneInst);

  const craneOrbits = [];
  for (let i = 0; i < craneCount; i++) {
    craneOrbits.push({
      cx: (rng() - 0.5) * 16,
      cy: 26 + rng() * 20,
      cz: -28 + (rng() - 0.5) * 16,
      rx: 9 + rng() * 14,
      rz: 7 + rng() * 12,
      speed: (0.14 + rng() * 0.14) * (i % 2 === 0 ? 1 : -1),
      phase: rng() * Math.PI * 2,
      scale: 0.72 + rng() * 0.45
    });
  }

  // ------------------------------------------------------------------
  // 2. VALLEY MIST BILLOWS (Waterfall Splash + Canyon Drift)
  // ------------------------------------------------------------------
  const mistCount = 34;
  const mistSprites = [];
  const mistMatBase = new THREE.SpriteMaterial({
    map: mistTexture,
    color: new THREE.Color('#eef2f6'),
    transparent: true,
    opacity: 0.24,
    depthWrite: false
  });

  for (let i = 0; i < mistCount; i++) {
    const isWaterfallMist = i < 10;
    const mat = mistMatBase.clone();
    const sprite = new THREE.Sprite(mat);

    const basePos = isWaterfallMist
      ? new THREE.Vector3((rng() - 0.5) * 8.5, 1.4 + rng() * 3.5, -10.5 + (rng() - 0.5) * 3.5)
      : new THREE.Vector3((rng() - 0.5) * 46, 12.5 + rng() * 16, -24 + (rng() - 0.5) * 26);

    const size = isWaterfallMist ? 6.5 + rng() * 5.5 : 14.0 + rng() * 12.0;
    sprite.scale.set(size * 1.35, size * 0.8, 1);
    sprite.position.copy(basePos);
    group.add(sprite);

    mistSprites.push({
      sprite,
      mat,
      basePos,
      isWaterfallMist,
      phase: rng() * Math.PI * 2,
      speed: 0.25 + rng() * 0.35,
      baseOpacity: isWaterfallMist ? 0.28 : 0.13
    });
  }

  const dummy = new THREE.Object3D();
  const cPos = new THREE.Vector3();
  const cNext = new THREE.Vector3();

  return {
    group,
    update(time, stormFactor, mistColor) {
      craneUniformTime.value = time;

      // Update soaring cranes
      for (let i = 0; i < craneCount; i++) {
        const o = craneOrbits[i];
        const a = time * o.speed + o.phase;
        const da = a + o.speed * 0.08;

        cPos.set(
          o.cx + Math.cos(a) * o.rx,
          o.cy + Math.sin(time * 0.6 + o.phase) * 1.4,
          o.cz + Math.sin(a) * o.rz
        );
        cNext.set(
          o.cx + Math.cos(da) * o.rx,
          o.cy + Math.sin((time + 0.08) * 0.6 + o.phase) * 1.4,
          o.cz + Math.sin(da) * o.rz
        );

        dummy.position.copy(cPos);
        dummy.lookAt(cNext);
        dummy.scale.setScalar(o.scale * (1.0 - stormFactor * 0.25));
        dummy.updateMatrix();
        craneInst.setMatrixAt(i, dummy.matrix);
      }
      craneInst.instanceMatrix.needsUpdate = true;
      // Cranes tuck lower/fewer visible in peak storm
      craneInst.visible = stormFactor < 0.88;

      // Update valley mist puffs
      for (const m of mistSprites) {
        if (m.isWaterfallMist) {
          m.sprite.position.set(
            m.basePos.x + Math.sin(time * m.speed + m.phase) * 1.6,
            m.basePos.y + ((time * 0.8 + m.phase) % 2.4),
            m.basePos.z + Math.cos(time * 0.7 + m.phase) * 1.1
          );
          m.mat.opacity = m.baseOpacity * (0.9 + 0.3 * stormFactor);
        } else {
          m.sprite.position.set(
            m.basePos.x + Math.sin(time * 0.14 * m.speed + m.phase) * 6.5,
            m.basePos.y + Math.cos(time * 0.18 + m.phase) * 1.2,
            m.basePos.z
          );
          m.mat.opacity = m.baseOpacity * (0.75 + 0.85 * stormFactor);
        }
        m.mat.color.copy(mistColor);
      }
    }
  };
}
