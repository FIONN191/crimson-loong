import * as THREE from 'three';

/**
 * Generates a traditional curved Chinese pagoda roof with concave slope
 * and upturned flying eaves (飛檐) at the four corners.
 */
function createPagodaRoofGeo(width, depth, height, cornerFlare = 0.72, seg = 22) {
  const geo = new THREE.PlaneGeometry(width, depth, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const nx = Math.min(1, Math.abs(x) / (width * 0.5));
    const nz = Math.min(1, Math.abs(z) / (depth * 0.5));
    const m = Math.min(1, Math.max(nx, nz));

    // Concave roof curve + gentle upturned sweep at corners (clamped to prevent NaN)
    const slope = Math.pow(Math.max(0, 1 - m), 1.55) * height;
    const cornerBoost = Math.pow(Math.max(0, nx * nz), 1.65) * cornerFlare;
    const edgeCurl = Math.pow(Math.max(0, m), 3.2) * cornerFlare * 0.25;
    // Slight ridge hip emphasis along diagonals
    const hip = Math.exp(-Math.abs(nx - nz) * 8.0) * 0.08 * m;

    pos.setY(i, slope + cornerBoost + edgeCurl + hip);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a swaying cloth banner or sheer silk curtain material.
 */
function createClothMaterial(color, opacity = 1.0, emissiveColor = '#000000', emissiveIntensity = 0.0) {
  const uniforms = {
    uTime: { value: 0 },
    uWind: { value: 1.0 },
    uColor: { value: new THREE.Color(color) },
    uEmissive: { value: new THREE.Color(emissiveColor) },
    uEmissiveIntensity: { value: emissiveIntensity },
    uOpacity: { value: opacity }
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: opacity < 0.99,
    side: THREE.DoubleSide,
    depthWrite: opacity >= 0.99,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uWind;
      varying vec2 vUv;
      varying vec3 vNormal;

      void main() {
        vUv = uv;
        vec3 pos = position;
        float hang = 1.0 - uv.y; // 0 at pinned top rod, 1 at free bottom hem
        float wave1 = sin(hang * 5.2 - uTime * 3.1 + pos.x * 1.4) * 0.16 * hang * uWind;
        float wave2 = cos(hang * 8.5 - uTime * 4.7 + uv.x * 4.0) * 0.06 * hang * uWind;
        pos.z += wave1 + wave2;
        pos.x += sin(hang * 3.2 - uTime * 2.2) * 0.08 * hang * uWind;

        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uEmissive;
      uniform float uEmissiveIntensity;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormal;

      void main() {
        float fold = 0.72 + 0.28 * sin(vUv.x * 38.0);
        vec3 col = uColor * fold + uEmissive * uEmissiveIntensity;
        // Soft sheer silk vertical weave edge
        float edgeGlow = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
        col = mix(col * 1.12, col, edgeGlow);
        gl_FragColor = vec4(col, uOpacity * (0.65 + 0.35 * fold));
      }
    `
  });

  return mat;
}

export function createArchitecture(scene, textures) {
  const group = new THREE.Group();
  scene.add(group);

  const roofMat = new THREE.MeshStandardMaterial({
    map: textures.roof.map,
    bumpMap: textures.roof.bumpMap,
    bumpScale: 0.28,
    roughness: 0.58,
    metalness: 0.14,
    side: THREE.DoubleSide
  });

  const vermilionMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#9f1a16'),
    roughness: 0.45,
    metalness: 0.12
  });

  const darkTimberMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2c1512'),
    roughness: 0.75,
    metalness: 0.05
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#e6b85c'),
    emissive: new THREE.Color('#704008'),
    emissiveIntensity: 0.22,
    roughness: 0.34,
    metalness: 0.78
  });

  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.rock.map,
    bumpMap: textures.rock.bumpMap,
    bumpScale: 0.22,
    color: new THREE.Color('#cfc6ba'),
    roughness: 0.85
  });

  const shojiMat = new THREE.MeshStandardMaterial({
    map: textures.shoji.map,
    emissiveMap: textures.shoji.emissiveMap,
    emissive: new THREE.Color('#ffaa42'),
    emissiveIntensity: 0.72,
    roughness: 0.7
  });

  const lanternBodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ff3e1a'),
    emissive: new THREE.Color('#ff4d18'),
    emissiveIntensity: 2.0,
    roughness: 0.4
  });

  const stringLanternMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ff9d3b'),
    emissive: new THREE.Color('#ff7a22'),
    emissiveIntensity: 2.1,
    roughness: 0.35
  });

  const silkCurtainMat = createClothMaterial('#eadfd2', 0.48, '#ffd4a3', 0.08);
  const bannerMat = createClothMaterial('#e4a634', 0.96, '#8f4c10', 0.14);

  const swingingLanterns = [];
  const lanternLights = [];

  function addHangingLantern(parent, x, y, z, scale = 1.0, phase = 0) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);

    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.018 * scale, 0.018 * scale, 0.48 * scale, 6), darkTimberMat);
    cord.position.y = -0.24 * scale;
    pivot.add(cord);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.18 * scale, 0.08 * scale, 10), goldMat);
    cap.position.y = -0.48 * scale;
    pivot.add(cap);

    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.26 * scale, 12, 10), lanternBodyMat);
    orb.scale.set(1.0, 1.28, 1.0);
    orb.position.y = -0.74 * scale;
    pivot.add(orb);

    const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.07 * scale, 0.26 * scale, 8), vermilionMat);
    tassel.position.y = -1.12 * scale;
    pivot.add(tassel);

    parent.add(pivot);
    swingingLanterns.push({ pivot, phase });
    return pivot;
  }

  function addRoofWithFinials(parent, w, d, h, y, flare = 0.72) {
    const roofGroup = new THREE.Group();
    roofGroup.position.y = y;

    const roof = new THREE.Mesh(createPagodaRoofGeo(w, d, h, flare), roofMat);
    roof.castShadow = true;
    roof.receiveShadow = true;
    roofGroup.add(roof);

    // Under-eave red timber trim box
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 0.24, d * 0.72), darkTimberMat);
    trim.position.y = 0.02;
    roofGroup.add(trim);

    // Golden ridge crest beam
    const ridgeLen = Math.max(w * 0.42, 1.2);
    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, ridgeLen, 8), goldMat);
    ridge.rotation.z = Math.PI / 2;
    ridge.position.y = h + 0.06;
    roofGroup.add(ridge);

    // Sculpted Chiwen corner finials
    for (const sx of [-1, 1]) {
      const finial = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.48, 6), goldMat);
      finial.position.set(sx * ridgeLen * 0.5, h + 0.25, 0);
      finial.rotation.z = -sx * 0.35;
      roofGroup.add(finial);
    }

    parent.add(roofGroup);
    return roofGroup;
  }

  // ------------------------------------------------------------------
  // 1. CENTRAL SHANMEN / PAIFANG GATE ("赤 龍")
  // ------------------------------------------------------------------
  const gate = new THREE.Group();
  gate.position.set(0, 15.6, -13.2);
  group.add(gate);

  // Stepped stone foundation
  const gateBase = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.8, 4.4), stoneMat);
  gateBase.position.y = 0.4;
  gateBase.receiveShadow = true;
  gateBase.castShadow = true;
  gate.add(gateBase);

  // 4 Vermilion pillars with carved stone drum plinths
  const pillarXs = [-5.1, -2.05, 2.05, 5.1];
  for (const px of pillarXs) {
    for (const pz of [-1.05, 1.05]) {
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.45, 12), stoneMat);
      plinth.position.set(px, 1.02, pz);
      gate.add(plinth);

      const hCol = Math.abs(px) < 3 ? 4.9 : 3.9;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, hCol, 12), vermilionMat);
      col.position.set(px, 1.2 + hCol * 0.5, pz);
      col.castShadow = true;
      gate.add(col);
    }
  }

  // Crossbeams & Dougong frieze
  const lowerBeam = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.48, 2.4), vermilionMat);
  lowerBeam.position.set(0, 4.45, 0);
  lowerBeam.castShadow = true;
  gate.add(lowerBeam);

  const upperBeam = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.5, 2.4), vermilionMat);
  upperBeam.position.set(0, 6.45, 0);
  upperBeam.castShadow = true;
  gate.add(upperBeam);

  // Glowing gilded "赤 龍" Calligraphy Plaque cleanly framed ABOVE lower roof eaves & BELOW upper roof!
  const plaqueMat = new THREE.MeshStandardMaterial({
    map: textures.plaque,
    emissiveMap: textures.plaque,
    emissive: new THREE.Color('#ffd373'),
    emissiveIntensity: 0.65,
    roughness: 0.35,
    metalness: 0.35
  });
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.56, 0.24), plaqueMat);
  plaque.position.set(0, 5.55, 1.85);
  gate.add(plaque);

  // Gate Double-Tiered Upturned Roofs (lower eaves sit at y=4.65 cleanly beneath plaque, upper roof at y=6.65 above)
  addRoofWithFinials(gate, 13.8, 3.6, 1.35, 4.55, 0.85);
  addRoofWithFinials(gate, 8.2, 4.0, 1.8, 6.65, 0.95);

  // Gate Hanging Lanterns
  addHangingLantern(gate, -3.55, 4.45, 1.1, 1.05, 0.4);
  addHangingLantern(gate, 3.55, 4.45, 1.1, 1.05, 1.7);
  addHangingLantern(gate, -5.6, 4.7, 1.5, 0.85, 2.4);
  addHangingLantern(gate, 5.6, 4.7, 1.5, 0.85, 3.1);

  // Central Gate Warm Point Light
  const gateLight = new THREE.PointLight('#ff8438', 12, 24, 1.5);
  gateLight.position.set(0, 4.6, 2.2);
  gate.add(gateLight);
  lanternLights.push({ light: gateLight, base: 12, phase: 0.2 });

  // Flowing Golden Sanctuary Banners flanking the gate & upper terraces
  const bannerPositions = [
    [-7.4, 19.6, -12.6, 0.25],
    [7.4, 19.6, -12.6, -0.22],
    [-14.5, 21.8, -13.2, 0.18],
    [15.2, 20.6, -13.6, -0.28]
  ];
  for (const [bx, by, bz, tilt] of bannerPositions) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 4.4, 8), darkTimberMat);
    pole.position.set(bx, by, bz);
    pole.rotation.z = tilt;
    group.add(pole);

    const flagGeo = new THREE.PlaneGeometry(0.85, 3.4, 4, 14);
    const flag = new THREE.Mesh(flagGeo, bannerMat);
    flag.position.set(bx - Math.sin(tilt) * 0.6 + 0.42, by + 0.45, bz);
    flag.rotation.z = tilt * 0.65;
    group.add(flag);
  }

  // ------------------------------------------------------------------
  // 2. LEFT & RIGHT CLIFFSIDE SANCTUARY HALLS
  // ------------------------------------------------------------------
  function buildCliffHall(x, y, z, rotY, scale = 1.0) {
    const hall = new THREE.Group();
    hall.position.set(x, y, z);
    hall.rotation.y = rotY;
    hall.scale.setScalar(scale);

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(8.6, 1.1, 6.2), stoneMat);
    plinth.position.y = 0.55;
    plinth.receiveShadow = true;
    plinth.castShadow = true;
    hall.add(plinth);

    // Lower hall with glowing lattice shoji walls
    const body1 = new THREE.Mesh(new THREE.BoxGeometry(7.2, 2.9, 5.0), shojiMat);
    body1.position.y = 2.55;
    body1.castShadow = true;
    hall.add(body1);

    // Corner red pillars
    for (const cx of [-3.65, 3.65]) {
      for (const cz of [-2.55, 2.55]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 3.1, 10), vermilionMat);
        p.position.set(cx, 2.6, cz);
        hall.add(p);
      }
    }

    addRoofWithFinials(hall, 9.8, 7.2, 1.4, 3.95, 0.78);

    // Second story pavilion
    const body2 = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.3, 3.8), shojiMat);
    body2.position.y = 5.45;
    body2.castShadow = true;
    hall.add(body2);

    addRoofWithFinials(hall, 7.6, 5.8, 1.55, 6.55, 0.85);

    addHangingLantern(hall, -3.9, 3.85, 2.9, 0.9, x);
    addHangingLantern(hall, 3.9, 3.85, 2.9, 0.9, x + 1.5);

    const hallLight = new THREE.PointLight('#ff9242', 14, 24, 1.5);
    hallLight.position.set(0, 3.5, 3.6);
    hall.add(hallLight);
    lanternLights.push({ light: hallLight, base: 14, phase: x });

    group.add(hall);
    return hall;
  }

  buildCliffHall(-19.5, 17.0, -14.8, 0.28, 1.0);
  buildCliffHall(20.6, 16.4, -15.2, -0.32, 1.02);

  // String Lantern Garlands curving from Left Hall -> Gate -> Right Hall
  const garlandSpans = [
    [new THREE.Vector3(-15.5, 19.8, -13.2), new THREE.Vector3(-5.6, 19.6, -12.2)],
    [new THREE.Vector3(5.6, 19.6, -12.2), new THREE.Vector3(16.2, 19.2, -13.6)]
  ];
  for (const [pA, pB] of garlandSpans) {
    const curvePts = [];
    const count = 11;
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const p = new THREE.Vector3().lerpVectors(pA, pB, t);
      p.y -= Math.sin(t * Math.PI) * 1.35;
      curvePts.push(p);
      if (i > 0 && i < count) {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), stringLanternMat);
        bulb.position.copy(p).add(new THREE.Vector3(0, -0.18, 0));
        group.add(bulb);
      }
    }
    const cordGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curvePts), 24, 0.025, 6, false);
    group.add(new THREE.Mesh(cordGeo, darkTimberMat));
  }

  // ------------------------------------------------------------------
  // 3. LEFT OUTCROP PAVILION & RIGHT LAKESIDE WATER PAVILION (亭)
  // ------------------------------------------------------------------
  function buildWaterPavilion(x, y, z, rotY, hasLakeSteps = false) {
    const pav = new THREE.Group();
    pav.position.set(x, y, z);
    pav.rotation.y = rotY;

    // Stone base & submerged foundation if lakeside
    const baseH = hasLakeSteps ? 3.2 : 0.7;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(5.6, baseH, 5.6), stoneMat);
    plinth.position.y = hasLakeSteps ? -baseH * 0.5 + 0.45 : 0.35;
    plinth.receiveShadow = true;
    plinth.castShadow = true;
    pav.add(plinth);

    if (hasLakeSteps) {
      // Stepped stone stairs descending into the lake water
      for (let s = 0; s < 5; s++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.45, 0.75), stoneMat);
        step.position.set(0, 0.15 - s * 0.42, 3.1 + s * 0.52);
        step.receiveShadow = true;
        pav.add(step);
      }
    }

    // Carved stone corner balustrade railings
    const railOffsets = [
      [0, -2.55, 5.0, 0.22],
      [-2.55, 0, 0.22, 5.0],
      [2.55, 0, 0.22, 5.0]
    ];
    for (const [rx, rz, rw, rd] of railOffsets) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.65, rd), stoneMat);
      rail.position.set(rx, 0.85, rz);
      rail.castShadow = true;
      pav.add(rail);
    }

    // 4 Vermilion corner columns
    for (const cx of [-2.1, 2.1]) {
      for (const cz of [-2.1, 2.1]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 3.2, 10), vermilionMat);
        col.position.set(cx, 2.1, cz);
        col.castShadow = true;
        pav.add(col);
      }
    }

    // Slender tied-back sheer silk drapes framing pillars (never blocking pavilion interior!)
    const curtainGeo = new THREE.PlaneGeometry(0.68, 2.65, 8, 12);
    const cPos = curtainGeo.attributes.position;
    for (let ci = 0; ci < cPos.count; ci++) {
      const cy = cPos.getY(ci);
      const waist = 1.0 - Math.exp(-Math.pow(cy + 0.15, 2) * 2.2) * 0.42;
      cPos.setX(ci, cPos.getX(ci) * waist);
    }
    curtainGeo.computeVertexNormals();

    const leftCurtain = new THREE.Mesh(curtainGeo, silkCurtainMat);
    leftCurtain.position.set(-1.62, 2.25, 2.12);
    pav.add(leftCurtain);

    const rightCurtain = new THREE.Mesh(curtainGeo, silkCurtainMat);
    rightCurtain.position.set(1.62, 2.25, 2.12);
    pav.add(rightCurtain);

    // Interior warm glowing lantern hanging inside pavilion opening
    addHangingLantern(pav, 0, 3.35, 0, 0.95, x * 0.7 + 0.5);

    // Decorative carved timber lintel beam above pavilion opening
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.34, 4.5), darkTimberMat);
    lintel.position.y = 3.45;
    pav.add(lintel);

    // Double-tiered upturned pagoda roof
    addRoofWithFinials(pav, 7.2, 7.2, 1.35, 3.55, 0.92);
    addRoofWithFinials(pav, 4.4, 4.4, 1.3, 4.65, 0.85);

    // Ornate golden roof spire finial (BaoDing)
    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.9, 10), goldMat);
    finial.position.y = 6.25;
    pav.add(finial);

    // Swinging red lanterns on all 4 corners
    for (const [lx, lz] of [[-2.9, 2.9], [2.9, 2.9], [-2.9, -2.9], [2.9, -2.9]]) {
      addHangingLantern(pav, lx, 3.62, lz, 0.88, lx + lz + x);
    }

    // Warm glowing interior lantern light
    const pavLight = new THREE.PointLight('#ff7e30', 11, 18, 1.6);
    pavLight.position.set(0, 2.8, 0.6);
    pav.add(pavLight);
    lanternLights.push({ light: pavLight, base: 11, phase: z });

    group.add(pav);
    return pav;
  }

  buildWaterPavilion(-12.5, 7.85, 4.5, 0.22, false);
  buildWaterPavilion(13.8, 2.25, 7.6, -0.34, true);

  return {
    group,
    update(time, windStrength, nightBoost) {
      silkCurtainMat.uniforms.uTime.value = time;
      silkCurtainMat.uniforms.uWind.value = windStrength;
      bannerMat.uniforms.uTime.value = time;
      bannerMat.uniforms.uWind.value = windStrength * 1.25;

      for (const { pivot, phase } of swingingLanterns) {
        pivot.rotation.z = Math.sin(time * 1.55 + phase) * 0.085 * windStrength;
        pivot.rotation.x = Math.cos(time * 1.25 + phase * 1.3) * 0.055 * windStrength;
      }

      const glowScale = 1.0 + nightBoost * 0.65;
      lanternBodyMat.emissiveIntensity = 1.85 * glowScale;
      stringLanternMat.emissiveIntensity = 2.0 * glowScale;
      shojiMat.emissiveIntensity = 0.65 * glowScale;

      for (const item of lanternLights) {
        const flicker = 0.92 + 0.08 * Math.sin(time * 6.4 + item.phase);
        item.light.intensity = item.base * glowScale * flicker;
      }
    }
  };
}
