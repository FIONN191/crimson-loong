import * as THREE from 'three';
import { clamp } from '../utils/noise.js';

/**
 * Generates a sleek tapered flowing silk-flame lock geometry for dragon mane & tail plumes.
 */
function createManeTuftGeo() {
  const geo = new THREE.PlaneGeometry(0.24, 1.35, 2, 7);
  geo.translate(0, 0.675, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const t = y / 1.35;
    // Narrow to delicate pointed hair tip & sweep gracefully backward
    pos.setX(i, x * Math.pow(Math.max(0, 1.0 - t), 0.72));
    pos.setZ(i, Math.sin(t * Math.PI * 0.85) * 0.14 - t * t * 0.65);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a swept-back dorsal ridge spine fin geometry.
 */
function createDorsalSpineGeo() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.15, 0.45, 0.04, 0.95);
  shape.quadraticCurveTo(-0.22, 0.55, -0.34, 0.0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 2
  });
  geo.translate(0, 0, -0.04);
  geo.rotateY(Math.PI * 0.5);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a curved tapered antler horn via CatmullRomCurve3.
 */
function createTaperedTube(points, radiusStart, radiusEnd, tubularSeg = 16, radialSeg = 8) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, tubularSeg, 1.0, radialSeg, false);
  const pos = geo.attributes.position;
  const ringVerts = radialSeg + 1;
  const center = new THREE.Vector3();
  const v = new THREE.Vector3();

  for (let i = 0; i <= tubularSeg; i++) {
    const t = i / tubularSeg;
    curve.getPointAt(t, center);
    const r = radiusStart * (1 - t) + radiusEnd * t;
    for (let j = 0; j < ringVerts; j++) {
      const idx = i * ringVerts + j;
      v.fromBufferAttribute(pos, idx);
      v.sub(center).multiplyScalar(r).add(center);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a complete articulated Imperial Chinese Loong (Crimson or Frost).
 */
export function createDragon(scene, scaleTextures, variant = 'crimson') {
  const isCrimson = variant === 'crimson';
  const root = new THREE.Group();
  scene.add(root);

  const SPINE_COUNT = 88;
  const RADIAL_SEG = 20;

  // Palette definitions
  const colors = isCrimson
    ? {
        bodyTint: '#ffffff',
        bellyA: new THREE.Color('#f4dfb6'),
        bellyB: new THREE.Color('#c79b64'),
        limb: '#b9201a',
        mane: '#ebae38',
        maneEmissive: '#592606',
        horn: '#f0c262',
        eye: '#ffaa1c',
        throat: '#ff5514',
        claw: '#1c1210',
        light: '#ff7028'
      }
    : {
        bodyTint: '#ffffff',
        bellyA: new THREE.Color('#e8f4ff'),
        bellyB: new THREE.Color('#9abbd6'),
        limb: '#bdd8f0',
        mane: '#e6f5ff',
        maneEmissive: '#3876a8',
        horn: '#d6eeff',
        eye: '#5ce8ff',
        throat: '#48dcff',
        claw: '#243a4d',
        light: '#68d4ff'
      };

  // ------------------------------------------------------------------
  // 1. DYNAMIC RIBBED SERPENTINE BODY MESH
  // ------------------------------------------------------------------
  const bodyGeo = new THREE.BufferGeometry();
  const vertCount = SPINE_COUNT * (RADIAL_SEG + 1);
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const vColors = new Float32Array(vertCount * 3);
  const indices = [];

  for (let i = 0; i < SPINE_COUNT; i++) {
    const s = i / (SPINE_COUNT - 1);
    // Ribbed ventral scutes along belly
    const bellyRib = 0.88 + 0.12 * Math.sin(s * Math.PI * 2 * 44);
    for (let j = 0; j <= RADIAL_SEG; j++) {
      const u = j / RADIAL_SEG;
      const theta = u * Math.PI * 2;
      const idx = i * (RADIAL_SEG + 1) + j;

      uvs[idx * 2] = u;
      uvs[idx * 2 + 1] = s;

      // Dorsal (cos > 0) uses scale texture; ventral (cos < -0.35) blends to belly plates
      const cosT = Math.cos(theta);
      const bellyBlend = clamp((-cosT - 0.25) / 0.45, 0, 1);

      const scaleCol = new THREE.Color(1, 1, 1);
      const bCol = colors.bellyA.clone().lerp(colors.bellyB, 1.0 - bellyRib);
      scaleCol.lerp(bCol, bellyBlend);

      vColors[idx * 3] = scaleCol.r;
      vColors[idx * 3 + 1] = scaleCol.g;
      vColors[idx * 3 + 2] = scaleCol.b;
    }
  }

  for (let i = 0; i < SPINE_COUNT - 1; i++) {
    for (let j = 0; j < RADIAL_SEG; j++) {
      const a = i * (RADIAL_SEG + 1) + j;
      const b = (i + 1) * (RADIAL_SEG + 1) + j;
      const c = (i + 1) * (RADIAL_SEG + 1) + (j + 1);
      const d = i * (RADIAL_SEG + 1) + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  const normAttr = new THREE.BufferAttribute(normals, 3);
  normAttr.setUsage(THREE.DynamicDrawUsage);

  bodyGeo.setAttribute('position', posAttr);
  bodyGeo.setAttribute('normal', normAttr);
  bodyGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  bodyGeo.setAttribute('color', new THREE.BufferAttribute(vColors, 3));
  bodyGeo.setIndex(indices);

  const bodyMat = new THREE.MeshStandardMaterial({
    map: scaleTextures.map,
    bumpMap: scaleTextures.bumpMap,
    bumpScale: 0.24,
    roughnessMap: scaleTextures.roughnessMap,
    roughness: isCrimson ? 0.36 : 0.28,
    metalness: isCrimson ? 0.28 : 0.35,
    vertexColors: true
  });

  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.frustumCulled = false;
  root.add(bodyMesh);

  // ------------------------------------------------------------------
  // 2. DORSAL RIDGE SPINES & FLOWING MANE INSTANCES
  // ------------------------------------------------------------------
  const spineCountInst = 74;
  const spineMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colors.horn),
    emissive: new THREE.Color(colors.maneEmissive),
    emissiveIntensity: 0.32,
    roughness: 0.38,
    metalness: 0.45
  });
  const spineInst = new THREE.InstancedMesh(createDorsalSpineGeo(), spineMat, spineCountInst);
  spineInst.castShadow = true;
  spineInst.frustumCulled = false;
  root.add(spineInst);

  // Flowing golden / frost mane tufts (neck crest, dorsal fringe, tail fan)
  const maneUniformTime = { value: 0 };
  const maneMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colors.mane),
    emissive: new THREE.Color(colors.maneEmissive),
    emissiveIntensity: isCrimson ? 0.35 : 0.45,
    roughness: 0.42,
    metalness: 0.24,
    side: THREE.DoubleSide
  });
  maneMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = maneUniformTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float tip = clamp(position.y / 1.35, 0.0, 1.0);
        float phase = float(gl_InstanceID) * 0.37;
        transformed.x += sin(uTime * 5.6 + phase + tip * 3.0) * 0.14 * tip;
        transformed.z += cos(uTime * 4.8 + phase * 1.3) * 0.1 * tip;`
      );
  };

  const maneCount = 340;
  const maneInst = new THREE.InstancedMesh(createManeTuftGeo(), maneMat, maneCount);
  maneInst.frustumCulled = false;
  root.add(maneInst);

  // Precompute deterministic placement metadata for each mane hair tuft
  const maneSpecs = [];
  for (let i = 0; i < maneCount; i++) {
    let s;
    let angle = 0;
    let scale = 1.0;
    if (i < 95) {
      // Thick royal neck & shoulder mane collar
      s = 0.015 + (i / 95) * 0.14;
      angle = ((i * 7) % 13 - 6) * 0.26;
      scale = 1.15 - (s / 0.16) * 0.25;
    } else if (i < 260) {
      // Continuous dorsal mane ridge down the spine
      s = 0.14 + ((i - 95) / 165) * 0.78;
      angle = ((i % 3) - 1) * 0.22;
      scale = 0.85 - s * 0.45;
    } else {
      // Sweeping fanned tail plume
      s = 0.90 + ((i - 260) / (maneCount - 260)) * 0.095;
      angle = ((i % 7) - 3) * 0.45;
      scale = 0.9 + (s - 0.9) * 4.5;
    }
    maneSpecs.push({
      spineIdx: clamp(Math.floor(s * (SPINE_COUNT - 2)), 1, SPINE_COUNT - 2),
      angle,
      scale,
      tiltBack: 0.72 + ((i * 13) % 10) * 0.04
    });
  }

  // ------------------------------------------------------------------
  // 3. SCULPTED ARTICULATED LOONG HEAD
  // ------------------------------------------------------------------
  const headGroup = new THREE.Group();
  root.add(headGroup);

  const headSkinMat = new THREE.MeshStandardMaterial({
    map: scaleTextures.map,
    bumpMap: scaleTextures.bumpMap,
    bumpScale: 0.16,
    color: new THREE.Color(isCrimson ? '#eb3223' : '#e6f4ff'),
    roughness: 0.34,
    metalness: 0.26
  });

  const hornMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colors.horn),
    emissive: new THREE.Color(isCrimson ? '#4a2604' : '#326699'),
    emissiveIntensity: 0.3,
    roughness: 0.26,
    metalness: 0.55
  });

  const eyeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colors.eye),
    emissive: new THREE.Color(colors.eye),
    emissiveIntensity: 3.0,
    roughness: 0.1
  });

  const throatMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colors.throat),
    emissive: new THREE.Color(colors.throat),
    emissiveIntensity: 1.5,
    roughness: 0.3
  });

  const fangMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fbf4e6'),
    roughness: 0.25,
    metalness: 0.1
  });

  // Note: Head local +Z points forward along dragon flight direction
  // Sculpted angular cranium dome
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(1.12, 18, 14), headSkinMat);
  cranium.scale.set(0.92, 0.78, 1.35);
  cranium.position.set(0, 0.22, 0.45);
  headGroup.add(cranium);

  // Sleek tapered upper dragon snout ridge
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.84, 2.25, 14), headSkinMat);
  snout.rotation.x = Math.PI * 0.5;
  snout.scale.set(1.06, 1.0, 0.58);
  snout.position.set(0, 0.16, 1.78);
  headGroup.add(snout);

  // Sculpted flared nostrils & nasal crest instead of bulbous sphere
  const nasalCrest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.26, 0.75), headSkinMat);
  nasalCrest.position.set(0, 0.34, 2.55);
  nasalCrest.rotation.x = 0.22;
  headGroup.add(nasalCrest);
  for (const sx of [-1, 1]) {
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), headSkinMat);
    nostril.scale.set(0.9, 0.75, 1.4);
    nostril.position.set(sx * 0.24, 0.28, 2.75);
    headGroup.add(nostril);
  }

  for (const sx of [-1, 1]) {
    // Fierce sculpted brow ridges
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.24, 1.1), headSkinMat);
    brow.position.set(sx * 0.68, 0.68, 1.05);
    brow.rotation.set(-0.18, sx * 0.22, -sx * 0.32);
    headGroup.add(brow);

    // Glowing HDR dragon eyes
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), eyeMat);
    eye.position.set(sx * 0.76, 0.42, 1.15);
    headGroup.add(eye);

    // Vertical slit pupil
    const pupil = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.28, 0.08),
      new THREE.MeshBasicMaterial({ color: '#090304' })
    );
    pupil.position.set(sx * 0.92, 0.42, 1.24);
    headGroup.add(pupil);

    // Upper curved fangs
    const fang = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.46, 8), fangMat);
    fang.position.set(sx * 0.42, -0.15, 2.35);
    fang.rotation.x = Math.PI;
    headGroup.add(fang);

    // Secondary molar teeth row
    for (let t = 0; t < 4; t++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 6), fangMat);
      tooth.position.set(sx * 0.52, -0.08, 1.35 + t * 0.24);
      tooth.rotation.x = Math.PI;
      headGroup.add(tooth);
    }

    // Sweeping S-curved Branching Antler Horns
    const mainAntler = createTaperedTube(
      [
        new THREE.Vector3(sx * 0.48, 0.72, 0.35),
        new THREE.Vector3(sx * 0.85, 1.65, -0.55),
        new THREE.Vector3(sx * 1.18, 2.55, -1.65),
        new THREE.Vector3(sx * 0.95, 3.45, -2.55)
      ],
      0.19,
      0.035,
      18,
      8
    );
    headGroup.add(new THREE.Mesh(mainAntler, hornMat));

    const browTine = createTaperedTube(
      [
        new THREE.Vector3(sx * 0.78, 1.48, -0.35),
        new THREE.Vector3(sx * 1.12, 1.98, 0.25),
        new THREE.Vector3(sx * 1.28, 2.55, 0.58)
      ],
      0.1,
      0.025,
      10,
      6
    );
    headGroup.add(new THREE.Mesh(browTine, hornMat));

    // Cheek flame/whisker mane spikes framing the head
    for (let m = 0; m < 5; m++) {
      const tuft = new THREE.Mesh(createManeTuftGeo(), maneMat);
      tuft.position.set(sx * (0.95 + m * 0.05), 0.1 - m * 0.14, 0.65 - m * 0.22);
      tuft.rotation.set(-0.9 - m * 0.08, sx * 0.55, -sx * (0.65 + m * 0.12));
      tuft.scale.setScalar(0.95);
      headGroup.add(tuft);
    }
  }

  // Articulated Lower Jaw + Throat Glow
  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, -0.18, 0.55);
  headGroup.add(jawPivot);

  const lowerJaw = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.74, 1.95, 12), headSkinMat);
  lowerJaw.rotation.x = Math.PI * 0.5;
  lowerJaw.scale.set(1.0, 1.0, 0.52);
  lowerJaw.position.set(0, -0.1, 1.05);
  jawPivot.add(lowerJaw);

  for (const sx of [-1, 1]) {
    const lFang = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.36, 8), fangMat);
    lFang.position.set(sx * 0.35, 0.15, 1.78);
    jawPivot.add(lFang);

    // Chin beard tufts
    const beard = new THREE.Mesh(createManeTuftGeo(), maneMat);
    beard.position.set(sx * 0.22, -0.25, 1.55);
    beard.rotation.set(Math.PI * 0.72, 0, sx * 0.18);
    beard.scale.setScalar(0.72);
    jawPivot.add(beard);
  }

  // Glowing inner mouth throat ember core
  const throatOrb = new THREE.Mesh(new THREE.SphereGeometry(0.44, 10, 8), throatMat);
  throatOrb.position.set(0, 0.02, 0.75);
  headGroup.add(throatOrb);

  // Flowing Silk Barbels / Dragon Whiskers (updated dynamically with wave motion)
  const whiskerCurves = [
    [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
    [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  ];
  const whiskerMeshes = [];
  for (let w = 0; w < 2; w++) {
    const geo = createTaperedTube(
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.8, 0.1, -0.5),
        new THREE.Vector3(1.6, 0.3, -1.6),
        new THREE.Vector3(2.2, 0.1, -2.8)
      ],
      0.045,
      0.01,
      14,
      6
    );
    const mesh = new THREE.Mesh(geo, hornMat);
    headGroup.add(mesh);
    whiskerMeshes.push(mesh);
  }

  // Dynamic Head Glow Light
  const headLight = new THREE.PointLight(colors.light, 8, 22, 1.5);
  headLight.position.set(0, 0.6, 2.2);
  headGroup.add(headLight);

  // ------------------------------------------------------------------
  // 4. FOUR ARTICULATED FIVE-CLAWED IMPERIAL LIMBS
  // ------------------------------------------------------------------
  const limbMat = new THREE.MeshStandardMaterial({
    map: scaleTextures.map,
    color: new THREE.Color(colors.limb),
    roughness: 0.42,
    metalness: 0.2
  });
  const clawMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colors.claw),
    roughness: 0.25,
    metalness: 0.45
  });

  function buildImperialLimb(sideSign) {
    const shoulder = new THREE.Group();
    root.add(shoulder);

    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 1.65, 10), limbMat);
    upperArm.position.set(0, -0.78, 0);
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -1.55, 0);
    shoulder.add(elbow);

    // Elbow flame/mane plume
    const elbowTuft = new THREE.Mesh(createManeTuftGeo(), maneMat);
    elbowTuft.rotation.set(-0.95, 0, sideSign * 0.25);
    elbowTuft.scale.setScalar(0.82);
    elbow.add(elbowTuft);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.17, 1.45, 10), limbMat);
    forearm.position.set(0, -0.68, 0.18);
    forearm.rotation.x = -0.25;
    forearm.castShadow = true;
    elbow.add(forearm);

    const wrist = new THREE.Group();
    wrist.position.set(0, -1.36, 0.36);
    elbow.add(wrist);

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), limbMat);
    wrist.add(palm);

    // Five imperial talons (4 splayed forward + 1 rear dewclaw)
    for (let c = 0; c < 5; c++) {
      const talon = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.62, 6), clawMat);
      if (c < 4) {
        const spread = (c - 1.5) * 0.36;
        talon.position.set(Math.sin(spread) * 0.26, -0.22, Math.cos(spread) * 0.28);
        talon.rotation.set(Math.PI * 0.68, 0, -spread * 0.7);
      } else {
        talon.position.set(-sideSign * 0.16, -0.18, -0.2);
        talon.rotation.set(-Math.PI * 0.65, 0, sideSign * 0.4);
      }
      wrist.add(talon);
    }

    return { shoulder, elbow, wrist, sideSign };
  }

  const limbs = [
    { ...buildImperialLimb(-1), spineIdx: 17, phaseOffset: 0.0 },
    { ...buildImperialLimb(1), spineIdx: 17, phaseOffset: Math.PI },
    { ...buildImperialLimb(-1), spineIdx: 48, phaseOffset: Math.PI * 0.5 },
    { ...buildImperialLimb(1), spineIdx: 48, phaseOffset: Math.PI * 1.5 }
  ];

  // ------------------------------------------------------------------
  // 5. SPINE FRAME & MESH UPDATE FUNCTION
  // ------------------------------------------------------------------
  const tangents = Array.from({ length: SPINE_COUNT }, () => new THREE.Vector3());
  const normalsFrame = Array.from({ length: SPINE_COUNT }, () => new THREE.Vector3());
  const binormals = Array.from({ length: SPINE_COUNT }, () => new THREE.Vector3());
  const tmpRotQ = new THREE.Quaternion();
  const tmpMat4 = new THREE.Matrix4();
  const tmpScale = new THREE.Vector3();
  const tmpPos = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  const tmpBasis = new THREE.Matrix4();
  const tmpUp = new THREE.Vector3(0, 1, 0);
  const vPos = new THREE.Vector3();
  const vNorm = new THREE.Vector3();

  function radiusAt(s) {
    if (s < 0.08) return 0.76 + (s / 0.08) * 0.42;
    if (s < 0.35) return 1.18 + Math.sin(((s - 0.08) / 0.27) * Math.PI) * 0.14;
    return Math.max(0.065, 1.18 * Math.pow(Math.max(0, 1 - (s - 0.35) / 0.65), 0.92));
  }

  const mouthWorldPos = new THREE.Vector3();

  function update(spinePoints, time, {
    jawOpen = 0.14,
    throatBoost = 0.0,
    scaleFactor = 1.0,
    upHint = tmpUp
  } = {}) {
    maneUniformTime.value = time;

    // Compute tangents along spine
    for (let i = 0; i < SPINE_COUNT; i++) {
      if (i === 0) {
        tangents[i].subVectors(spinePoints[0], spinePoints[1]).normalize();
      } else if (i === SPINE_COUNT - 1) {
        tangents[i].subVectors(spinePoints[i - 1], spinePoints[i]).normalize();
      } else {
        tangents[i].subVectors(spinePoints[i - 1], spinePoints[i + 1]).normalize();
      }
    }

    // Seed twist-free Bishop frame at head (index 0)
    const t0 = tangents[0];
    const n0 = normalsFrame[0].copy(upHint);
    n0.addScaledVector(t0, -n0.dot(t0));
    if (n0.lengthSq() < 1e-4) n0.set(1, 0, 0);
    n0.normalize();
    binormals[0].crossVectors(t0, n0).normalize();

    // Propagate frame cleanly with minimal-twist quaternion transport
    for (let i = 1; i < SPINE_COUNT; i++) {
      tmpRotQ.setFromUnitVectors(tangents[i - 1], tangents[i]);
      normalsFrame[i].copy(normalsFrame[i - 1]).applyQuaternion(tmpRotQ).normalize();
      // Gently pull toward world up so horizontal flights stay belly-down naturally
      normalsFrame[i].lerp(upHint, 0.045);
      normalsFrame[i].addScaledVector(tangents[i], -normalsFrame[i].dot(tangents[i])).normalize();
      binormals[i].crossVectors(tangents[i], normalsFrame[i]).normalize();
    }

    // Update serpentine body rings
    for (let i = 0; i < SPINE_COUNT; i++) {
      const s = i / (SPINE_COUNT - 1);
      const rBase = radiusAt(s) * scaleFactor;
      const p = spinePoints[i];
      const n = normalsFrame[i];
      const b = binormals[i];
      const rib = 1.0 + 0.03 * Math.sin(s * Math.PI * 2 * 44);

      for (let j = 0; j <= RADIAL_SEG; j++) {
        const theta = (j / RADIAL_SEG) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        // Flatten belly slightly for realistic serpentine cross-section
        const bellyFlat = cosT < -0.2 ? 0.86 : 1.0;
        const rN = rBase * bellyFlat * rib;
        const rB = rBase * 1.06;

        vNorm
          .copy(n).multiplyScalar(cosT)
          .addScaledVector(b, sinT)
          .normalize();

        vPos
          .copy(p)
          .addScaledVector(n, cosT * rN)
          .addScaledVector(b, sinT * rB);

        const idx = i * (RADIAL_SEG + 1) + j;
        posAttr.setXYZ(idx, vPos.x, vPos.y, vPos.z);
        normAttr.setXYZ(idx, vNorm.x, vNorm.y, vNorm.z);
      }
    }
    posAttr.needsUpdate = true;
    normAttr.needsUpdate = true;

    // Update dorsal ridge spines
    for (let i = 0; i < spineCountInst; i++) {
      const si = 2 + i;
      const s = si / (SPINE_COUNT - 1);
      const r = radiusAt(s) * scaleFactor * 0.92;
      tmpPos.copy(spinePoints[si]).addScaledVector(normalsFrame[si], r);
      tmpBasis.makeBasis(binormals[si], normalsFrame[si], tangents[si]);
      tmpQ.setFromRotationMatrix(tmpBasis);
      const spScale = scaleFactor * (0.95 - s * 0.65);
      tmpScale.set(spScale, spScale * 1.15, spScale);
      tmpMat4.compose(tmpPos, tmpQ, tmpScale);
      spineInst.setMatrixAt(i, tmpMat4);
    }
    spineInst.instanceMatrix.needsUpdate = true;

    // Update flowing mane & tail plume instances
    for (let i = 0; i < maneCount; i++) {
      const spec = maneSpecs[i];
      const si = spec.spineIdx;
      const s = si / (SPINE_COUNT - 1);
      const r = radiusAt(s) * scaleFactor * 0.9;

      // Rotate around spine tangent by spec.angle
      vNorm
        .copy(normalsFrame[si]).multiplyScalar(Math.cos(spec.angle))
        .addScaledVector(binormals[si], Math.sin(spec.angle))
        .normalize();

      tmpPos.copy(spinePoints[si]).addScaledVector(vNorm, r);
      // Point outward & sweep backward along -tangents[si]
      vPos.copy(vNorm).addScaledVector(tangents[si], -spec.tiltBack).normalize();
      tmpBasis.makeBasis(
        binormals[si],
        vPos,
        new THREE.Vector3().crossVectors(binormals[si], vPos).normalize()
      );
      tmpQ.setFromRotationMatrix(tmpBasis);
      const sc = spec.scale * scaleFactor;
      tmpScale.set(sc, sc * 1.12, sc);
      tmpMat4.compose(tmpPos, tmpQ, tmpScale);
      maneInst.setMatrixAt(i, tmpMat4);
    }
    maneInst.instanceMatrix.needsUpdate = true;

    // Update articulated Head at spinePoints[0]
    headGroup.position.copy(spinePoints[0]);
    tmpBasis.makeBasis(
      new THREE.Vector3().copy(binormals[0]).negate(),
      normalsFrame[0],
      tangents[0]
    );
    headGroup.quaternion.setFromRotationMatrix(tmpBasis);
    headGroup.scale.setScalar(scaleFactor);

    jawPivot.rotation.x = jawOpen;
    throatMat.emissiveIntensity = 1.1 + throatBoost * 4.5;
    eyeMat.emissiveIntensity = 2.6 + throatBoost * 2.5;
    headLight.intensity = 6.0 + throatBoost * 24.0;

    // Animate silk whiskers gently waving in local head space
    for (let w = 0; w < 2; w++) {
      const sx = w === 0 ? -1 : 1;
      const flutter = Math.sin(time * 4.8 + w * 1.8) * 0.25;
      const flutterY = Math.cos(time * 3.7 + w * 1.4) * 0.22;
      whiskerMeshes[w].rotation.set(flutterY * 0.2, sx * (0.38 + flutter * 0.15), sx * 0.18);
      whiskerMeshes[w].position.set(sx * 0.42, 0.14, 2.62);
    }

    // Compute world position of open mouth for breath/beam emission
    mouthWorldPos.set(0, -0.05, 2.35).applyMatrix4(headGroup.matrixWorld);

    // Update 4 articulated limbs
    for (const limb of limbs) {
      const si = limb.spineIdx;
      const s = si / (SPINE_COUNT - 1);
      const r = radiusAt(s) * scaleFactor * 0.82;

      tmpPos
        .copy(spinePoints[si])
        .addScaledVector(binormals[si], limb.sideSign * r)
        .addScaledVector(normalsFrame[si], -r * 0.45);

      limb.shoulder.position.copy(tmpPos);
      tmpBasis.makeBasis(
        new THREE.Vector3().copy(binormals[si]).negate(),
        normalsFrame[si],
        tangents[si]
      );
      limb.shoulder.quaternion.setFromRotationMatrix(tmpBasis);
      limb.shoulder.scale.setScalar(scaleFactor);

      const swim = Math.sin(time * 2.8 + limb.phaseOffset);
      limb.shoulder.rotation.z = limb.sideSign * (0.48 + swim * 0.26);
      limb.shoulder.rotation.x = 0.28 + Math.cos(time * 2.8 + limb.phaseOffset) * 0.25;
      limb.elbow.rotation.x = -0.68 + swim * 0.22;
      limb.wrist.rotation.x = 0.35 + throatBoost * 0.25;
    }
  }

  return {
    root,
    spineCount: SPINE_COUNT,
    mouthWorldPos,
    update
  };
}

/**
 * Dual Elemental Breath Beams + Central Clash Plasma Orb & Shockwave Rings.
 */
export function createClashVFX(scene, sparkTex) {
  const group = new THREE.Group();
  scene.add(group);

  // Crimson helical plasma fire beam
  const fireUniforms = {
    uTime: { value: 0 },
    uIntensity: { value: 0 },
    uColorCore: { value: new THREE.Color('#fff1bd') },
    uColorEdge: { value: new THREE.Color('#ff4414') }
  };

  const beamShaderMat = (uniforms) =>
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        uniform float uTime;
        void main() {
          vUv = uv;
          vec3 pos = position;
          float ripple = sin(uv.y * 28.0 - uTime * 18.0) * 0.18;
          pos.x += ripple * sin(uv.x * 6.2831);
          pos.z += ripple * cos(uv.x * 6.2831);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uIntensity;
        uniform vec3 uColorCore;
        uniform vec3 uColorEdge;
        void main() {
          float pulse = 0.65 + 0.35 * sin(vUv.y * 24.0 - uTime * 22.0 + vUv.x * 6.2831);
          float edgeFade = sin(vUv.y * 3.14159);
          vec3 col = mix(uColorEdge, uColorCore, pulse * 0.85);
          float alpha = clamp(edgeFade * pulse * uIntensity * 1.45, 0.0, 1.0);
          gl_FragColor = vec4(col * (1.2 + uIntensity * 1.8), alpha);
        }
      `
    });

  const fireBeamGeo = new THREE.CylinderGeometry(0.45, 0.85, 1.0, 14, 24, true);
  fireBeamGeo.translate(0, 0.5, 0);
  fireBeamGeo.rotateX(Math.PI * 0.5);
  const fireBeam = new THREE.Mesh(fireBeamGeo, beamShaderMat(fireUniforms));
  group.add(fireBeam);

  // Frost dragon cyan-white lightning beam
  const frostUniforms = {
    uTime: { value: 0 },
    uIntensity: { value: 0 },
    uColorCore: { value: new THREE.Color('#ffffff') },
    uColorEdge: { value: new THREE.Color('#42d4ff') }
  };
  const frostBeam = new THREE.Mesh(fireBeamGeo, beamShaderMat(frostUniforms));
  group.add(frostBeam);

  // Jagged electric arc strands along frost beam
  const boltCount = 3;
  const boltPts = 18;
  const boltLines = [];
  const boltMat = new THREE.LineBasicMaterial({
    color: new THREE.Color('#9beeff'),
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending
  });
  for (let b = 0; b < boltCount; b++) {
    const pos = new Float32Array(boltPts * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const line = new THREE.Line(geo, boltMat);
    line.frustumCulled = false;
    group.add(line);
    boltLines.push(line);
  }

  // Central colliding Plasma Clash Orb + Soft GLSL Shockwave Halo
  const clashOrbMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float fres = clamp(dot(normalize(vNormal), normalize(vViewDir)), 0.0, 1.0);
        float core = pow(max(fres, 1e-4), 2.4);
        vec3 col = mix(vec3(1.0, 0.45, 0.16), vec3(1.0, 0.94, 0.82), core);
        float alpha = core * uIntensity * 0.88;
        gl_FragColor = vec4(col * 1.05, alpha);
      }
    `
  });
  const clashOrb = new THREE.Mesh(new THREE.SphereGeometry(1.75, 24, 18), clashOrbMat);
  group.add(clashOrb);

  function createSoftShockRing(hexColor) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(hexColor) },
        uOpacity: { value: 0 }
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          float r = length(vUv - 0.5) * 2.0;
          float band = exp(-pow((r - 0.72) * 7.5, 2.0));
          gl_FragColor = vec4(uColor * 1.35, band * uOpacity);
        }
      `
    });
  }

  const shockRing1 = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 7.2), createSoftShockRing('#ffbf78'));
  const shockRing2 = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 7.2), createSoftShockRing('#72e6ff'));
  group.add(shockRing1, shockRing2);

  // Burst sparks radiating from clash core
  const sparkCount = 160;
  const sparkPos = new Float32Array(sparkCount * 3);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({
    map: sparkTex,
    color: new THREE.Color('#ffe19c'),
    size: 1.4,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
  sparkPoints.frustumCulled = false;
  group.add(sparkPoints);

  const clashLight = new THREE.PointLight('#ffd2a0', 0, 90, 1.3);
  group.add(clashLight);

  const clashCenter = new THREE.Vector3();
  const dirTmp = new THREE.Vector3();

  function positionBeam(beam, start, end, radiusScale) {
    const dist = start.distanceTo(end);
    beam.position.copy(start);
    beam.lookAt(end);
    beam.scale.set(radiusScale, radiusScale, Math.max(dist, 0.1));
  }

  function update(time, redMouth, whiteMouth, intensity, camera) {
    if (intensity <= 0.01) {
      group.visible = false;
      return clashCenter;
    }
    group.visible = true;

    fireUniforms.uTime.value = time;
    fireUniforms.uIntensity.value = intensity;
    frostUniforms.uTime.value = time * 1.2;
    frostUniforms.uIntensity.value = intensity;

    clashCenter.lerpVectors(redMouth, whiteMouth, 0.5);
    const breathRadius = 0.65 + intensity * 0.9;

    positionBeam(fireBeam, redMouth, clashCenter, breathRadius);
    positionBeam(frostBeam, whiteMouth, clashCenter, breathRadius);

    // Update crackling lightning strands from whiteMouth -> clashCenter
    boltMat.opacity = clamp(intensity * 1.1, 0, 1);
    for (let b = 0; b < boltCount; b++) {
      const attr = boltLines[b].geometry.attributes.position;
      for (let p = 0; p < boltPts; p++) {
        const t = p / (boltPts - 1);
        dirTmp.lerpVectors(whiteMouth, clashCenter, t);
        const jitter = Math.sin(t * Math.PI) * 1.25 * intensity;
        dirTmp.x += Math.sin(time * 28.0 + p * 3.1 + b * 2.4) * jitter;
        dirTmp.y += Math.cos(time * 32.0 + p * 2.7 + b * 1.9) * jitter;
        dirTmp.z += Math.sin(time * 24.0 + p * 4.3 - b * 2.1) * jitter;
        attr.setXYZ(p, dirTmp.x, dirTmp.y, dirTmp.z);
      }
      attr.needsUpdate = true;
    }

    // Clash orb & soft shockwave halos (kept crisp so dragons remain clearly visible around the core)
    const pulse = 1.0 + Math.sin(time * 22.0) * 0.12;
    clashOrb.position.copy(clashCenter);
    clashOrb.scale.setScalar((0.72 + intensity * 0.88) * pulse);
    clashOrbMat.uniforms.uTime.value = time;
    clashOrbMat.uniforms.uIntensity.value = clamp(intensity, 0, 1);

    const ringPhase1 = (time * 1.35) % 1.0;
    const ringPhase2 = (time * 1.35 + 0.5) % 1.0;
    shockRing1.position.copy(clashCenter);
    shockRing1.lookAt(camera.position);
    shockRing1.scale.setScalar(0.45 + ringPhase1 * 1.45 * intensity);
    shockRing1.material.uniforms.uOpacity.value = (1.0 - ringPhase1) * intensity * 0.65;

    shockRing2.position.copy(clashCenter);
    shockRing2.lookAt(camera.position);
    shockRing2.scale.setScalar(0.45 + ringPhase2 * 1.45 * intensity);
    shockRing2.material.uniforms.uOpacity.value = (1.0 - ringPhase2) * intensity * 0.65;

    // Radiating sparks
    const sAttr = sparkGeo.attributes.position;
    for (let i = 0; i < sparkCount; i++) {
      const life = ((time * 1.8 + i * 0.061) % 1.0);
      const a1 = i * 2.39996;
      const a2 = (i * 1.13) % Math.PI;
      const r = life * 11.5 * intensity;
      sAttr.setXYZ(
        i,
        clashCenter.x + Math.cos(a1) * Math.sin(a2) * r,
        clashCenter.y + Math.cos(a2) * r,
        clashCenter.z + Math.sin(a1) * Math.sin(a2) * r
      );
    }
    sAttr.needsUpdate = true;
    sparkMat.opacity = clamp(intensity * 0.9, 0, 0.95);

    clashLight.position.copy(clashCenter);
    clashLight.intensity = intensity * 85.0 * pulse;

    return clashCenter;
  }

  return {
    group,
    clashCenter,
    update
  };
}
