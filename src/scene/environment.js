import * as THREE from 'three';
import { fbm2, fbm3, ridged2, mulberry32, clamp, smoothstep } from '../utils/noise.js';

/**
 * Computes foreground meadow & underwater lake-bed terrain height at (x, z).
 * Ensures smooth organic shoreline around z ~ 21..24 and clean lake basin below y = 0.
 */
export function getTerrainHeight(x, z) {
  const undulate =
    fbm2(x * 0.055 + 2.1, z * 0.055 - 1.4, 4) * 1.15 +
    fbm2(x * 0.14 - 4.2, z * 0.14 + 3.1, 3) * 0.35;

  // Natural curved shoreline around z = 16.5 + organic bay wave so foreground bank anchors frame bottom
  const shoreCurve = 16.5 + Math.sin(x * 0.12 + 0.6) * 2.5 + Math.cos(x * 0.25) * 1.0;
  const shoreT = smoothstep(shoreCurve - 3.2, shoreCurve + 6.5, z);

  // Subtle rise toward left & right valley walls
  const bankRise = Math.pow(clamp((Math.abs(x) - 16.0) / 28.0, 0, 1), 1.6) * 6.5;
  const backMeadowRise = smoothstep(26.0, 56.0, z) * 1.9;

  const meadowH = 0.48 + undulate * 0.65 + backMeadowRise + bankRise;
  const lakeBedH = -2.6 + undulate * 0.45;

  return lakeBedH + (meadowH - lakeBedH) * shoreT;
}

/**
 * Builds a displaced stratified Zhangjiajie karst limestone pillar.
 */
function createKarstPillarGeo(radBottom, radTop, height, seed, radialSeg = 48, heightSeg = 64) {
  const geo = new THREE.CylinderGeometry(radTop, radBottom, height, radialSeg, heightSeg, false);
  geo.translate(0, height * 0.5, 0);

  const pos = geo.attributes.position;
  const colArr = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const sOff = seed * 17.31;

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const yNorm = clamp(v.y / height, 0, 1);
    const radialDist = Math.hypot(v.x, v.z);
    if (radialDist > 0.001) {
      const angle = Math.atan2(v.z, v.x);
      const cx = Math.cos(angle) * 1.4;
      const cz = Math.sin(angle) * 1.4;

      // Vertical cliff flutes & angular limestone ledges (avoid wavy accordion sine bands)
      const macro = fbm3(cx * 0.65 + sOff, v.y * 0.045, cz * 0.65 - sOff, 4);
      const ledgeStep = Math.floor(v.y * 0.45 + macro * 2.2);
      const ledge = (fbm2(ledgeStep * 1.7 + sOff, angle * 0.6, 2)) * 0.11;
      const flutes = (ridged2(angle * 3.1 + sOff, v.y * 0.055, 3) - 0.5) * 0.34;
      const crownPinch = 1.0 - smoothstep(0.88, 1.0, yNorm) * 0.16;

      const scale = clamp((1.0 + macro * 0.28 + ledge + flutes) * crownPinch, 0.58, 1.48);
      v.x *= scale;
      v.z *= scale;
    } else {
      v.y += fbm2(v.x * 0.3 + sOff, v.z * 0.3, 3) * 0.9;
    }

    pos.setXYZ(i, v.x, v.y, v.z);

    // Sun-kissed warm sandstone variation + green mossy top cap
    const baseDark = smoothstep(0.0, 0.16, yNorm);
    const topMoss = smoothstep(0.86, 0.98, yNorm);
    const cragAO = clamp(0.74 + 0.28 * baseDark + fbm2(v.x * 0.22 + sOff, v.y * 0.12, 2) * 0.16, 0.54, 1.08);
    colArr[i * 3] = cragAO * (1 - topMoss * 0.28);
    colArr[i * 3 + 1] = cragAO * (1 + topMoss * 0.08);
    colArr[i * 3 + 2] = cragAO * (1 - topMoss * 0.36);
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds craggy mossy cliff wall slabs or rocky headlands.
 */
function createCliffMassGeo(w, h, d, seed, segW = 24, segH = 26, segD = 16) {
  const geo = new THREE.BoxGeometry(w, h, d, segW, segH, segD);
  const pos = geo.attributes.position;
  const colArr = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const sOff = seed * 11.7;

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const ny = (v.y + h * 0.5) / h;

    const disp = fbm3(v.x * 0.08 + sOff, v.y * 0.11, v.z * 0.08 - sOff, 4);
    const strata = Math.sin(v.y * 1.2 + disp * 3.5) * 0.45;
    const ridge = (ridged2(v.x * 0.12 + sOff, v.y * 0.15, 3) - 0.5) * 2.1;

    // Taper gently toward top and widen base
    const taper = 1.08 - ny * 0.18;
    v.x = v.x * taper + disp * 2.1 + ridge * 0.7;
    v.z = v.z * taper + disp * 1.9 + strata * 0.65;
    if (ny > 0.92) {
      v.y += disp * 0.8;
    }

    pos.setXYZ(i, v.x, v.y, v.z);

    // Wet water-line darkening at base, emerald moss on top shelves
    const wetBase = smoothstep(0.04, 0.22, ny);
    const topMoss = smoothstep(0.84, 0.99, ny);
    const shade = clamp(0.55 + 0.45 * wetBase + disp * 0.16, 0.35, 1.05);
    colArr[i * 3] = shade * (1 - topMoss * 0.32);
    colArr[i * 3 + 1] = shade * (1 + topMoss * 0.12);
    colArr[i * 3 + 2] = shade * (1 - topMoss * 0.4);
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  geo.computeVertexNormals();
  return geo;
}

export function createEnvironment(scene, textures) {
  const group = new THREE.Group();
  scene.add(group);

  const rockMat = new THREE.MeshStandardMaterial({
    map: textures.rock.map,
    bumpMap: textures.rock.bumpMap,
    bumpScale: 0.68,
    color: new THREE.Color('#c8baa8'),
    roughness: 0.86,
    metalness: 0.04,
    vertexColors: true
  });

  const groundMat = new THREE.MeshStandardMaterial({
    map: textures.mossGround.map,
    bumpMap: textures.mossGround.bumpMap,
    bumpScale: 0.45,
    roughness: 0.92,
    metalness: 0.02,
    vertexColors: true
  });

  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.rock.map,
    bumpMap: textures.rock.bumpMap,
    bumpScale: 0.32,
    color: new THREE.Color('#c2b7aa'),
    roughness: 0.84,
    metalness: 0.06
  });

  // 1. Foreground Shore + Submerged Lake Bed Terrain
  const terrainGeo = new THREE.PlaneGeometry(124, 96, 110, 84);
  terrainGeo.rotateX(-Math.PI / 2);
  terrainGeo.translate(0, 0, 12); // spans z = -36..60
  const tPos = terrainGeo.attributes.position;
  const tColors = new Float32Array(tPos.count * 3);

  for (let i = 0; i < tPos.count; i++) {
    const x = tPos.getX(i);
    const z = tPos.getZ(i);
    const h = getTerrainHeight(x, z);
    tPos.setY(i, h);

    const wet = smoothstep(-0.4, 0.55, h);
    const pathNoise = fbm2(x * 0.12, z * 0.12, 3);
    const warmMoss = clamp(0.5 + pathNoise * 0.45, 0, 1);

    tColors[i * 3] = (0.36 + warmMoss * 0.34) * (0.45 + 0.55 * wet);
    tColors[i * 3 + 1] = (0.44 + warmMoss * 0.28) * (0.5 + 0.5 * wet);
    tColors[i * 3 + 2] = (0.28 + warmMoss * 0.14) * (0.48 + 0.52 * wet);
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(tColors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMesh = new THREE.Mesh(terrainGeo, groundMat);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = true;
  group.add(terrainMesh);

  // Foreground shoreline mossy boulders
  const rng = mulberry32(9001);
  const boulderSpots = [
    [-10.5, 22.8, 1.5], [-16.2, 23.6, 2.2], [-22.4, 24.5, 2.8],
    [10.2, 22.4, 1.6], [17.4, 24.2, 2.4], [24.0, 26.5, 3.1],
    [-4.2, 1.5, 2.6], [5.4, 2.4, 2.2] // Mossy lake islets near waterfall!
  ];
  for (const [bx, bz, rad] of boulderSpots) {
    const bGeo = new THREE.IcosahedronGeometry(rad, 3);
    const bp = bGeo.attributes.position;
    const bc = new Float32Array(bp.count * 3);
    for (let i = 0; i < bp.count; i++) {
      const vx = bp.getX(i);
      const vy = bp.getY(i);
      const vz = bp.getZ(i);
      const n = fbm3(vx * 0.9 + bx, vy * 0.9, vz * 0.9 + bz, 3);
      bp.setXYZ(i, vx * (1 + n * 0.32), vy * 0.58 * (1 + n * 0.24), vz * (1 + n * 0.32));
      const moss = smoothstep(0.05, 0.5, vy / rad);
      bc[i * 3] = 0.65 - moss * 0.25;
      bc[i * 3 + 1] = 0.68 - moss * 0.08;
      bc[i * 3 + 2] = 0.58 - moss * 0.32;
    }
    bGeo.setAttribute('color', new THREE.BufferAttribute(bc, 3));
    bGeo.computeVertexNormals();
    const bMesh = new THREE.Mesh(bGeo, rockMat);
    const groundY = bz > 18 ? getTerrainHeight(bx, bz) + rad * 0.16 : 0.12;
    bMesh.position.set(bx, groundY, bz);
    bMesh.rotation.y = rng() * Math.PI * 2;
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    group.add(bMesh);
  }

  // 2. Left & Right Framing Canyon Cliff Walls
  const leftWall1 = new THREE.Mesh(createCliffMassGeo(28, 66, 62, 1.4), rockMat);
  leftWall1.position.set(-37, 29, 4);
  leftWall1.castShadow = true;
  leftWall1.receiveShadow = true;
  group.add(leftWall1);

  const leftWall2 = new THREE.Mesh(createCliffMassGeo(26, 52, 42, 2.7), rockMat);
  leftWall2.position.set(-34, 22, -26);
  leftWall2.castShadow = true;
  leftWall2.receiveShadow = true;
  group.add(leftWall2);

  const rightWall1 = new THREE.Mesh(createCliffMassGeo(28, 56, 64, 3.9), rockMat);
  rightWall1.position.set(38, 24, 6);
  rightWall1.castShadow = true;
  rightWall1.receiveShadow = true;
  group.add(rightWall1);

  const rightWall2 = new THREE.Mesh(createCliffMassGeo(26, 48, 42, 4.8), rockMat);
  rightWall2.position.set(34, 20, -24);
  rightWall2.castShadow = true;
  rightWall2.receiveShadow = true;
  group.add(rightWall2);

  // 3. Central Gorged Waterfall Terrace Wall & Stone Viaduct Arch
  const leftTerraceCliff = new THREE.Mesh(createCliffMassGeo(22, 18.5, 16, 5.5), rockMat);
  leftTerraceCliff.position.set(-14.6, 8.2, -14.5);
  leftTerraceCliff.castShadow = true;
  leftTerraceCliff.receiveShadow = true;
  group.add(leftTerraceCliff);

  const rightTerraceCliff = new THREE.Mesh(createCliffMassGeo(22, 17.5, 16, 6.2), rockMat);
  rightTerraceCliff.position.set(15.2, 7.8, -14.8);
  rightTerraceCliff.castShadow = true;
  rightTerraceCliff.receiveShadow = true;
  group.add(rightTerraceCliff);

  // Central stone waterfall sluice bridge (leaves clean arched opening at x in [-3, 3], y in [0, 12.2])
  const viaductGroup = new THREE.Group();
  viaductGroup.position.set(0, 0, -12.0);
  group.add(viaductGroup);

  const leftPier = new THREE.Mesh(createCliffMassGeo(4.8, 15.6, 8.2, 7.1, 10, 16, 10), stoneMat);
  leftPier.position.set(-5.2, 7.6, -0.8);
  leftPier.castShadow = true;
  leftPier.receiveShadow = true;
  viaductGroup.add(leftPier);

  const rightPier = new THREE.Mesh(createCliffMassGeo(4.8, 15.6, 8.2, 7.7, 10, 16, 10), stoneMat);
  rightPier.position.set(5.2, 7.6, -0.8);
  rightPier.castShadow = true;
  rightPier.receiveShadow = true;
  viaductGroup.add(rightPier);

  // Back recessed rocky wall behind the waterfall curtain
  const sluiceBack = new THREE.Mesh(createCliffMassGeo(9.5, 15.6, 3.6, 8.3, 12, 16, 6), rockMat);
  sluiceBack.position.set(0, 7.6, -2.5);
  sluiceBack.receiveShadow = true;
  viaductGroup.add(sluiceBack);

  // Carved Stone Arch Bridge Lintels & Deck above waterfall
  const bridgeDeck = new THREE.Mesh(new THREE.BoxGeometry(15.5, 2.2, 6.6), stoneMat);
  bridgeDeck.position.set(0, 14.5, -0.8);
  bridgeDeck.castShadow = true;
  bridgeDeck.receiveShadow = true;
  viaductGroup.add(bridgeDeck);

  // Curved Stone Arch Ring facing lake
  const archGeo = new THREE.TorusGeometry(3.15, 0.58, 12, 28, Math.PI);
  const archMesh = new THREE.Mesh(archGeo, stoneMat);
  archMesh.position.set(0, 10.7, 2.35);
  archMesh.castShadow = true;
  viaductGroup.add(archMesh);

  // Upper Sanctuary Plaza Floor extending back behind gate
  const plazaFloor = new THREE.Mesh(new THREE.BoxGeometry(58, 2.2, 24), stoneMat);
  plazaFloor.position.set(0, 14.5, -21);
  plazaFloor.receiveShadow = true;
  group.add(plazaFloor);

  // Left Outcrop Pavilion Cliff Headland (x = -12.5, z = 4.5, top y = 7.9)
  const leftOutcrop = new THREE.Mesh(createKarstPillarGeo(5.8, 4.6, 8.4, 9.4, 28, 22), rockMat);
  leftOutcrop.position.set(-12.5, -0.5, 4.5);
  leftOutcrop.castShadow = true;
  leftOutcrop.receiveShadow = true;
  group.add(leftOutcrop);

  // 4. Towering Hero & Flanking Karst Stone Spires
  const spireSpecs = [
    // Hero Central Spire behind the gate — Crimson Loong coils around this!
    { x: 0.6, y: 12.0, z: -26.5, rBot: 4.9, rTop: 3.1, h: 45.0, seed: 11.2, hero: true },
    // Left tall spire
    { x: -19.5, y: 12.0, z: -38.5, rBot: 5.2, rTop: 2.9, h: 46.5, seed: 14.6 },
    // Left shoulder spire
    { x: -10.5, y: 12.0, z: -32.0, rBot: 3.9, rTop: 2.2, h: 33.5, seed: 18.1 },
    // Right spire
    { x: 17.5, y: 12.0, z: -35.5, rBot: 4.8, rTop: 2.7, h: 39.0, seed: 22.5 },
    // Distant misty valley spires for layered atmospheric depth
    { x: -34.0, y: 8.0, z: -68.0, rBot: 7.4, rTop: 4.0, h: 60.0, seed: 29.4 },
    { x: 35.0, y: 8.0, z: -64.0, rBot: 6.8, rTop: 3.8, h: 55.0, seed: 33.8 },
    { x: 8.5, y: 6.0, z: -78.0, rBot: 6.2, rTop: 3.1, h: 52.0, seed: 37.2 },
    { x: -14.0, y: 6.0, z: -88.0, rBot: 7.5, rTop: 3.8, h: 64.0, seed: 41.7 }
  ];

  const spireTops = [];
  for (const s of spireSpecs) {
    const geo = createKarstPillarGeo(s.rBot, s.rTop, s.h, s.seed);
    const mesh = new THREE.Mesh(geo, rockMat);
    mesh.position.set(s.x, s.y, s.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    spireTops.push({
      x: s.x,
      y: s.y + s.h - 0.5,
      z: s.z,
      radius: s.rTop,
      hero: Boolean(s.hero)
    });
  }

  return {
    group,
    spireTops,
    heroSpire: { x: 0.6, z: -26.5, baseY: 16.0, topY: 57.0, radius: 4.2 }
  };
}
