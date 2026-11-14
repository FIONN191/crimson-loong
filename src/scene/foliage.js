import * as THREE from 'three';
import { mulberry32, clamp } from '../utils/noise.js';
import { getTerrainHeight } from './environment.js';

function applyWindSway(material, timeUniform, windUniform, amplitude = 0.12) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.uniforms.uWind = windUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWind;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 wpApprox = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float phase = wpApprox.x * 0.45 + wpApprox.z * 0.37;
          float gust = sin(uTime * 1.9 + phase) * 0.65 + cos(uTime * 3.3 + phase * 1.7) * 0.35;
          float swayMask = clamp(uv.y, 0.0, 1.0);
          transformed.x += gust * ${amplitude.toFixed(3)} * uWind * swayMask;
          transformed.z += cos(uTime * 2.1 + phase * 1.3) * ${(amplitude * 0.65).toFixed(3)} * uWind * swayMask;
        #endif`
      );
  };
}

/**
 * Creates a crossed 2-card cluster geometry so foliage reads richly from every angle.
 */
function createCrossCardGeo(w, h) {
  const p1 = new THREE.PlaneGeometry(w, h);
  const p2 = new THREE.PlaneGeometry(w, h);
  p2.rotateY(Math.PI * 0.5);

  const g1 = p1.toNonIndexed();
  const g2 = p2.toNonIndexed();
  const count = g1.attributes.position.count + g2.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const norm = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);

  pos.set(g1.attributes.position.array, 0);
  pos.set(g2.attributes.position.array, g1.attributes.position.array.length);
  norm.set(g1.attributes.normal.array, 0);
  norm.set(g2.attributes.normal.array, g1.attributes.normal.array.length);
  uv.set(g1.attributes.uv.array, 0);
  uv.set(g2.attributes.uv.array, g1.attributes.uv.array.length);

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return merged;
}

export function createFoliage(scene, textures, spireTops) {
  const group = new THREE.Group();
  scene.add(group);

  const uTime = { value: 0 };
  const uWind = { value: 1.0 };
  const rng = mulberry32(202611);

  const barkMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#3b251c'),
    roughness: 0.92,
    metalness: 0.02
  });

  // ------------------------------------------------------------------
  // 1. TWISTED-TRUNK AUTUMN MAPLES
  // ------------------------------------------------------------------
  const mapleSpots = [
    // Left foreground & bank framing the vista
    { x: -14.8, y: getTerrainHeight(-14.8, 21.5), z: 21.5, s: 1.5, lean: 0.48 },
    { x: -19.5, y: getTerrainHeight(-19.5, 17.5), z: 17.5, s: 1.65, lean: 0.55 },
    { x: -10.5, y: getTerrainHeight(-10.5, 24.5), z: 24.5, s: 0.92, lean: 0.22, amber: true },
    // Right foreground sweeping scarlet canopy
    { x: 14.5, y: getTerrainHeight(14.5, 20.0), z: 20.0, s: 1.62, lean: -0.55 },
    { x: 19.5, y: getTerrainHeight(19.5, 16.5), z: 16.5, s: 1.72, lean: -0.48 },
    { x: 18.2, y: getTerrainHeight(18.2, 26.5), z: 26.5, s: 1.32, lean: -0.35 },
    // Waterfall base & cliff outcrops
    { x: -3.2, y: 0.9, z: -7.5, s: 1.05, lean: 0.15 },
    { x: -14.2, y: 7.9, z: 2.2, s: 0.95, lean: 0.25 },
    // Sanctuary upper terrace maples
    { x: -10.8, y: 16.0, z: -12.8, s: 1.3, lean: 0.18 },
    { x: 11.0, y: 15.8, z: -13.0, s: 1.32, lean: -0.22 },
    { x: -24.5, y: 18.2, z: -15.5, s: 1.35, lean: 0.2 },
    { x: 25.2, y: 17.6, z: -16.2, s: 1.35, lean: -0.2 },
    // Spire shoulder clinging maples
    { x: -9.8, y: 39.0, z: -31.0, s: 1.15, lean: 0.2 },
    { x: -3.0, y: 31.0, z: -26.5, s: 0.95, lean: -0.35 }
  ];

  const mapleMatrices = [];
  const mapleColors = [];
  const dummy = new THREE.Object3D();
  const cTmp = new THREE.Color();

  const maplePalette = [
    '#d92418', '#eb3e1c', '#c41916', '#f26a1b', '#f59824', '#dd2f22'
  ];

  for (const m of mapleSpots) {
    const treeGroup = new THREE.Group();
    treeGroup.position.set(m.x, m.y - 0.15, m.z);

    const h = 4.8 * m.s;
    const p0 = new THREE.Vector3(0, 0, 0);
    const p1 = new THREE.Vector3(m.lean * 1.1 * m.s, h * 0.42, (rng() - 0.5) * 0.8);
    const p2 = new THREE.Vector3(m.lean * 2.1 * m.s, h * 0.85, (rng() - 0.5) * 1.2);
    const trunkCurve = new THREE.CatmullRomCurve3([p0, p1, p2]);
    const trunkGeo = new THREE.TubeGeometry(trunkCurve, 10, 0.24 * m.s, 7, false);
    // Taper trunk
    const tp = trunkGeo.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      const vy = tp.getY(i);
      const t = clamp(vy / h, 0, 1);
      const cPt = trunkCurve.getPoint(clamp(t, 0, 1));
      const scale = 1.0 - t * 0.65;
      tp.setX(i, cPt.x + (tp.getX(i) - cPt.x) * scale);
      tp.setZ(i, cPt.z + (tp.getZ(i) - cPt.z) * scale);
    }
    trunkGeo.computeVertexNormals();
    const trunkMesh = new THREE.Mesh(trunkGeo, barkMat);
    trunkMesh.castShadow = true;
    treeGroup.add(trunkMesh);

    // 6 Spreading gnarled branches with dense lush maple canopies
    const bCount = 6;
    for (let b = 0; b < bCount; b++) {
      const ang = (b / bCount) * Math.PI * 2 + rng() * 0.65;
      const startPt = trunkCurve.getPoint(0.48 + rng() * 0.44);
      const endPt = new THREE.Vector3(
        startPt.x + Math.cos(ang) * (2.1 + rng() * 1.5) * m.s,
        startPt.y + (0.85 + rng() * 1.35) * m.s,
        startPt.z + Math.sin(ang) * (2.1 + rng() * 1.5) * m.s
      );
      const bMid = new THREE.Vector3().lerpVectors(startPt, endPt, 0.5);
      bMid.y += 0.35 * m.s;
      const bCurve = new THREE.CatmullRomCurve3([startPt, bMid, endPt]);
      const bMesh = new THREE.Mesh(new THREE.TubeGeometry(bCurve, 6, 0.085 * m.s, 5, false), barkMat);
      bMesh.castShadow = true;
      treeGroup.add(bMesh);

      // Add 24 crisp 5-lobed leaf cluster cards per branch
      for (let k = 0; k < 24; k++) {
        const bt = 0.35 + rng() * 0.65;
        const center = bCurve.getPoint(bt);
        dummy.position.set(
          m.x + center.x + (rng() - 0.5) * 2.1 * m.s,
          m.y + center.y + (rng() - 0.35) * 1.35 * m.s,
          m.z + center.z + (rng() - 0.5) * 2.1 * m.s
        );
        dummy.rotation.set(
          (rng() - 0.5) * 0.7,
          rng() * Math.PI * 2,
          (rng() - 0.5) * 0.7
        );
        const cardScale = (0.95 + rng() * 0.75) * m.s;
        dummy.scale.setScalar(cardScale);
        dummy.updateMatrix();
        mapleMatrices.push(dummy.matrix.clone());

        const hex = m.amber ? '#f0a626' : maplePalette[Math.floor(rng() * maplePalette.length)];
        cTmp.set(hex).offsetHSL((rng() - 0.5) * 0.03, 0, (rng() - 0.5) * 0.08);
        mapleColors.push(cTmp.clone());
      }
    }

    group.add(treeGroup);
  }

  const mapleCardGeo = createCrossCardGeo(1.45, 1.45);
  const mapleMat = new THREE.MeshStandardMaterial({
    map: textures.mapleLeaf,
    alphaTest: 0.36,
    side: THREE.DoubleSide,
    roughness: 0.72,
    metalness: 0.02
  });
  applyWindSway(mapleMat, uTime, uWind, 0.14);

  const mapleInst = new THREE.InstancedMesh(mapleCardGeo, mapleMat, mapleMatrices.length);
  mapleInst.castShadow = true;
  mapleInst.receiveShadow = true;
  for (let i = 0; i < mapleMatrices.length; i++) {
    mapleInst.setMatrixAt(i, mapleMatrices[i]);
    mapleInst.setColorAt(i, mapleColors[i]);
  }
  mapleInst.instanceMatrix.needsUpdate = true;
  mapleInst.instanceColor.needsUpdate = true;
  group.add(mapleInst);

  // ------------------------------------------------------------------
  // 2. GNARLED MOUNTAIN PINE TREES (Canyon Cliffs & Spire Summits)
  // ------------------------------------------------------------------
  const pineSpots = [];
  for (const s of spireTops) {
    pineSpots.push({ x: s.x, y: s.y - 0.2, z: s.z, s: 1.25 });
    pineSpots.push({ x: s.x + s.radius * 0.45, y: s.y - 3.8, z: s.z + 0.5, s: 0.95 });
  }
  // Left & right steep canyon cliff pines
  const cliffPines = [
    [-25.5, 18.0, 12.0, 1.45], [-26.0, 27.5, 4.0, 1.55], [-24.5, 36.0, -5.0, 1.4],
    [-23.5, 42.0, -14.0, 1.3], [26.0, 16.5, 11.0, 1.35], [27.5, 25.0, 2.0, 1.5],
    [25.5, 34.0, -10.0, 1.3]
  ];
  for (const [px, py, pz, ps] of cliffPines) {
    pineSpots.push({ x: px, y: py, z: pz, s: ps });
  }

  const pineMatrices = [];
  const pineColors = [];
  for (const p of pineSpots) {
    const trunkH = 4.2 * p.s;
    const tCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(p.x, p.y, p.z),
      new THREE.Vector3(p.x + (rng() - 0.5) * 1.1 * p.s, p.y + trunkH * 0.55, p.z + (rng() - 0.5) * 0.9),
      new THREE.Vector3(p.x + (rng() - 0.5) * 1.6 * p.s, p.y + trunkH, p.z + (rng() - 0.5) * 1.0)
    ]);
    const tMesh = new THREE.Mesh(new THREE.TubeGeometry(tCurve, 6, 0.16 * p.s, 5, false), barkMat);
    group.add(tMesh);

    // 4 Horizontal layered bonsai-style pine foliage pads
    for (let pad = 0; pad < 4; pad++) {
      const pt = tCurve.getPoint(0.42 + (pad / 3) * 0.58);
      const padRadius = (1.6 - pad * 0.22) * p.s;
      for (let c = 0; c < 6; c++) {
        const a = (c / 6) * Math.PI * 2 + rng() * 0.5;
        const r = rng() * padRadius;
        dummy.position.set(
          pt.x + Math.cos(a) * r,
          pt.y + (rng() - 0.3) * 0.45 * p.s,
          pt.z + Math.sin(a) * r
        );
        dummy.rotation.set(
          (rng() - 0.5) * 0.45,
          rng() * Math.PI * 2,
          (rng() - 0.5) * 0.45
        );
        dummy.scale.set(1.65 * p.s, 0.95 * p.s, 1.65 * p.s);
        dummy.updateMatrix();
        pineMatrices.push(dummy.matrix.clone());
        cTmp.set('#2c4d26').offsetHSL((rng() - 0.5) * 0.04, 0, (rng() - 0.5) * 0.08);
        pineColors.push(cTmp.clone());
      }
    }
  }

  const pineCardGeo = createCrossCardGeo(1.5, 1.1);
  const pineMat = new THREE.MeshStandardMaterial({
    map: textures.pineCluster,
    alphaTest: 0.32,
    side: THREE.DoubleSide,
    roughness: 0.82
  });
  applyWindSway(pineMat, uTime, uWind, 0.07);

  const pineInst = new THREE.InstancedMesh(pineCardGeo, pineMat, pineMatrices.length);
  pineInst.castShadow = true;
  pineInst.receiveShadow = true;
  for (let i = 0; i < pineMatrices.length; i++) {
    pineInst.setMatrixAt(i, pineMatrices[i]);
    pineInst.setColorAt(i, pineColors[i]);
  }
  pineInst.instanceMatrix.needsUpdate = true;
  pineInst.instanceColor.needsUpdate = true;
  group.add(pineInst);

  // ------------------------------------------------------------------
  // 3. DENSE FOREGROUND 3D GRASS MEADOW
  // ------------------------------------------------------------------
  const grassCount = 8600;
  // Tapered curved grass blade
  const bladeGeo = new THREE.BufferGeometry();
  const bladeVerts = new Float32Array([
    -0.06, 0.0, 0.0,
     0.06, 0.0, 0.0,
     0.045, 0.35, 0.03,
    -0.045, 0.35, 0.03,
     0.0, 0.78, 0.11
  ]);
  const bladeUvs = new Float32Array([
    0, 0, 1, 0, 1, 0.5, 0, 0.5, 0.5, 1
  ]);
  const bladeIdx = [0, 1, 2, 0, 2, 3, 3, 2, 4];
  bladeGeo.setAttribute('position', new THREE.BufferAttribute(bladeVerts, 3));
  bladeGeo.setAttribute('uv', new THREE.BufferAttribute(bladeUvs, 2));
  bladeGeo.setIndex(bladeIdx);
  bladeGeo.computeVertexNormals();

  const grassMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffffff'),
    roughness: 0.76,
    side: THREE.DoubleSide
  });
  applyWindSway(grassMat, uTime, uWind, 0.18);

  const grassInst = new THREE.InstancedMesh(bladeGeo, grassMat, grassCount);
  grassInst.receiveShadow = true;
  let placedGrass = 0;
  let attempts = 0;
  while (placedGrass < grassCount && attempts < grassCount * 4) {
    attempts++;
    const gx = (rng() - 0.5) * 64;
    const gz = 14.5 + rng() * 36.0;
    const gy = getTerrainHeight(gx, gz);
    if (gy < 0.22) continue;

    dummy.position.set(gx, gy - 0.03, gz);
    dummy.rotation.set((rng() - 0.5) * 0.22, rng() * Math.PI * 2, (rng() - 0.5) * 0.22);
    const gh = 0.65 + rng() * 0.95;
    dummy.scale.set(0.85 + rng() * 0.6, gh, 1);
    dummy.updateMatrix();
    grassInst.setMatrixAt(placedGrass, dummy.matrix);

    // Rich moss emerald to golden autumn grass tip palette
    if (rng() > 0.78) {
      cTmp.set('#9c7b2c').offsetHSL(0, 0, (rng() - 0.5) * 0.1);
    } else {
      cTmp.set('#46682c').offsetHSL((rng() - 0.5) * 0.04, 0, (rng() - 0.5) * 0.12);
    }
    grassInst.setColorAt(placedGrass, cTmp);
    placedGrass++;
  }
  grassInst.count = placedGrass;
  grassInst.instanceMatrix.needsUpdate = true;
  grassInst.instanceColor.needsUpdate = true;
  group.add(grassInst);

  // ------------------------------------------------------------------
  // 4. CRISP 5-LOBED FALLEN MAPLE LEAVES (Ground Carpet + Water Floaters)
  // ------------------------------------------------------------------
  const fallenCount = 720;
  const fallenGeo = new THREE.PlaneGeometry(0.44, 0.44);
  fallenGeo.rotateX(-Math.PI / 2);
  const fallenMat = new THREE.MeshStandardMaterial({
    map: textures.mapleLeaf,
    alphaTest: 0.4,
    roughness: 0.75,
    side: THREE.DoubleSide
  });

  const fallenInst = new THREE.InstancedMesh(fallenGeo, fallenMat, fallenCount);
  fallenInst.receiveShadow = true;
  let placedFallen = 0;
  attempts = 0;
  while (placedFallen < fallenCount && attempts < fallenCount * 4) {
    attempts++;
    const isWater = placedFallen < 85;
    const lx = (rng() - 0.5) * (isWater ? 42 : 56);
    const lz = isWater ? -7 + rng() * 20 : 15 + rng() * 34;
    const ly = isWater ? 0.025 : getTerrainHeight(lx, lz);
    if (!isWater && ly < 0.28) continue;

    dummy.position.set(lx, ly + 0.025, lz);
    dummy.rotation.set((rng() - 0.5) * 0.15, rng() * Math.PI * 2, (rng() - 0.5) * 0.15);
    const sc = 0.65 + rng() * 0.85;
    dummy.scale.set(sc, sc, sc);
    dummy.updateMatrix();
    fallenInst.setMatrixAt(placedFallen, dummy.matrix);

    const hex = maplePalette[Math.floor(rng() * maplePalette.length)];
    cTmp.set(hex).offsetHSL(0, 0, (rng() - 0.5) * 0.1);
    fallenInst.setColorAt(placedFallen, cTmp);
    placedFallen++;
  }
  fallenInst.count = placedFallen;
  fallenInst.instanceMatrix.needsUpdate = true;
  fallenInst.instanceColor.needsUpdate = true;
  group.add(fallenInst);

  // ------------------------------------------------------------------
  // 5. SWIRLING WIND-BORNE AUTUMN LEAVES
  // ------------------------------------------------------------------
  const swirlCount = 380;
  const swirlGeo = new THREE.PlaneGeometry(0.36, 0.36);
  const swirlMat = new THREE.MeshStandardMaterial({
    map: textures.mapleLeaf,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
    roughness: 0.65
  });
  const swirlInst = new THREE.InstancedMesh(swirlGeo, swirlMat, swirlCount);
  const swirlData = [];
  for (let i = 0; i < swirlCount; i++) {
    swirlData.push({
      x: (rng() - 0.5) * 62,
      y: 1.5 + rng() * 38,
      z: -24 + rng() * 68,
      speed: 0.7 + rng() * 1.4,
      phase: rng() * Math.PI * 2,
      scale: 0.65 + rng() * 0.9
    });
    cTmp.set(maplePalette[Math.floor(rng() * maplePalette.length)]);
    swirlInst.setColorAt(i, cTmp);
  }
  swirlInst.instanceColor.needsUpdate = true;
  group.add(swirlInst);

  // ------------------------------------------------------------------
  // 6. STORM RAIN STREAKS (Soft Tapered Droplets during Storm & Clash)
  // ------------------------------------------------------------------
  const rainCount = 1400;
  const rainGeo = new THREE.PlaneGeometry(0.02, 1.4);
  const rainMat = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0.0 }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 wp = instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float xFade = sin(vUv.x * 3.14159);
        float yFade = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
        gl_FragColor = vec4(0.75, 0.85, 0.96, xFade * yFade * uOpacity);
      }
    `
  });
  const rainInst = new THREE.InstancedMesh(rainGeo, rainMat, rainCount);
  rainInst.frustumCulled = false;
  const rainData = [];
  for (let i = 0; i < rainCount; i++) {
    rainData.push({
      x: (rng() - 0.5) * 68,
      y: rng() * 48,
      z: -25 + rng() * 72,
      vel: 36 + rng() * 18
    });
  }
  rainInst.visible = false;
  group.add(rainInst);

  // ------------------------------------------------------------------
  // 7. LUMINOUS EMBERS & SPIRIT MOTES
  // ------------------------------------------------------------------
  const emberCount = 260;
  const emberPos = new Float32Array(emberCount * 3);
  const emberPhase = new Float32Array(emberCount);
  for (let i = 0; i < emberCount; i++) {
    emberPos[i * 3] = (rng() - 0.5) * 46;
    emberPos[i * 3 + 1] = 1.0 + rng() * 36;
    emberPos[i * 3 + 2] = -26 + rng() * 56;
    emberPhase[i] = rng() * Math.PI * 2;
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  const emberMat = new THREE.PointsMaterial({
    map: textures.spark,
    color: new THREE.Color('#ffbe66'),
    size: 0.52,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const emberPoints = new THREE.Points(emberGeo, emberMat);
  group.add(emberPoints);

  return {
    group,
    update(dt, time, windStrength, rainIntensity, emberBoost) {
      uTime.value = time;
      uWind.value = windStrength;

      // Update swirling maple leaves
      for (let i = 0; i < swirlCount; i++) {
        const s = swirlData[i];
        s.x += (0.85 * windStrength + Math.sin(time * 0.9 + s.phase) * 0.7) * dt;
        s.y -= (0.75 + Math.cos(time * 1.4 + s.phase) * 0.25) * dt;
        s.z += Math.cos(time * 0.7 + s.phase) * 0.5 * dt;

        if (s.y < 0.2 || s.x > 34) {
          s.y = 26 + ((i * 7) % 18);
          s.x = -32 + ((i * 13) % 52);
        }

        dummy.position.set(s.x, s.y, s.z);
        dummy.rotation.set(
          time * 1.8 * s.speed + s.phase,
          time * 2.2 * s.speed,
          Math.sin(time * 1.5 + s.phase)
        );
        dummy.scale.setScalar(s.scale);
        dummy.updateMatrix();
        swirlInst.setMatrixAt(i, dummy.matrix);
      }
      swirlInst.instanceMatrix.needsUpdate = true;

      // Update storm rain streaks
      if (rainIntensity > 0.02) {
        rainInst.visible = true;
        rainMat.uniforms.uOpacity.value = rainIntensity * 0.48;
        for (let i = 0; i < rainCount; i++) {
          const r = rainData[i];
          r.y -= r.vel * dt;
          r.x += 4.2 * windStrength * dt;
          if (r.y < 0) {
            r.y = 46;
            r.x = ((i * 19) % 68) - 34;
          }
          dummy.position.set(r.x, r.y, r.z);
          dummy.rotation.set(0, 0, -0.14 * windStrength);
          dummy.scale.set(1, 0.8 + rainIntensity * 0.55, 1);
          dummy.updateMatrix();
          rainInst.setMatrixAt(i, dummy.matrix);
        }
        rainInst.instanceMatrix.needsUpdate = true;
      } else {
        rainInst.visible = false;
      }

      // Gently drift embers/spirit motes
      const ep = emberGeo.attributes.position;
      for (let i = 0; i < emberCount; i++) {
        let ex = ep.getX(i) + Math.sin(time * 0.8 + emberPhase[i]) * 0.45 * dt;
        let ey = ep.getY(i) + (0.65 + emberBoost * 1.6) * dt;
        let ez = ep.getZ(i) + Math.cos(time * 0.6 + emberPhase[i]) * 0.35 * dt;
        if (ey > 42) ey = 1.0;
        ep.setXYZ(i, ex, ey, ez);
      }
      ep.needsUpdate = true;
      emberMat.opacity = clamp(0.42 + emberBoost * 0.55, 0.25, 0.95);
      emberMat.size = 0.46 + emberBoost * 0.28;
    }
  };
}
