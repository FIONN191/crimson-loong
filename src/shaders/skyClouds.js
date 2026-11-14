import * as THREE from 'three';

const skyVertexShader = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vec4 clip = projectionMatrix * viewMatrix * wp;
    clip.z = clip.w * 0.999995;
    gl_Position = clip;
  }
`;

const skyFragmentShader = /* glsl */ `
  precision highp float;

  varying vec3 vWorldPos;

  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uZenithColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uCloudSunColor;
  uniform vec3 uCloudShadowColor;
  uniform float uStormFactor;
  uniform float uCloudDensity;
  uniform float uLightningIntensity;
  uniform vec3 uLightningPos;
  uniform float uClashGlow;
  uniform vec3 uClashPos;
  uniform float uStarVisibility;
  uniform int uCloudSteps;

  float ign(vec2 p) {
    vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
    return fract(magic.z * fract(dot(p, magic.xy)));
  }

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);
    float nxy0 = mix(nx00, nx10, f.y);
    float nxy1 = mix(nx01, nx11, f.y);
    return mix(nxy0, nxy1, f.z);
  }

  // Multi-scale sculpted cauliflower cumulus lobes (crisp billowing puffs, not blurry fog)
  float cumulusBillow(vec3 p) {
    float sum = 0.0;
    float amp = 0.50;
    for (int i = 0; i < 5; i++) {
      float n = vnoise(p);
      // Inverted folded ridges create authentic billowing cumulus puffs
      float puff = 1.0 - abs(n * 2.0 - 1.0);
      puff = pow(max(puff, 1e-4), 1.35);
      sum += amp * puff;
      p = p * 2.12 + vec3(17.3, 9.7, 13.1);
      amp *= 0.48;
    }
    return sum;
  }

  vec2 intersectTower(vec3 ro, vec3 rd, vec3 centerXZ, float rad, float yMin, float yMax) {
    vec2 oc = ro.xz - centerXZ.xz;
    float a = dot(rd.xz, rd.xz);
    float b = dot(oc, rd.xz);
    float c = dot(oc, oc) - rad * rad;
    float disc = b * b - a * c;
    if (disc < 0.0 || a < 1e-5) return vec2(-1.0);
    float sq = sqrt(disc);
    float t0 = (-b - sq) / a;
    float t1 = (-b + sq) / a;

    float dy = abs(rd.y) < 1e-4 ? (rd.y >= 0.0 ? 1e-4 : -1e-4) : rd.y;
    float ty0 = (yMin - ro.y) / dy;
    float ty1 = (yMax - ro.y) / dy;
    if (ty0 > ty1) {
      float tmp = ty0; ty0 = ty1; ty1 = tmp;
    }
    t0 = max(t0, ty0);
    t1 = min(t1, ty1);
    return vec2(max(t0, 0.0), t1);
  }

  float sampleCloudTower(vec3 p) {
    // Primary monumental cumulonimbus tower directly behind central/left spires
    vec3 c1 = vec3(-16.0 - smoothstep(25.0, 125.0, p.y) * 5.0, 0.0, -108.0);
    float r1 = 34.0 + smoothstep(20.0, 95.0, p.y) * 16.0 - smoothstep(115.0, 152.0, p.y) * 16.0;
    float d1 = length(p.xz - c1.xz) / max(r1, 1.0);
    float hMask1 = smoothstep(8.0, 22.0, p.y) * (1.0 - smoothstep(126.0, 155.0, p.y));
    float base1 = clamp(1.0 - d1 * d1, 0.0, 1.0) * hMask1;

    // Right shoulder flanking cumulonimbus rising above right canyon ridge
    vec3 c2 = vec3(58.0, 0.0, -118.0);
    float r2 = 28.0 + smoothstep(18.0, 75.0, p.y) * 10.0 - smoothstep(82.0, 110.0, p.y) * 14.0;
    float d2 = length(p.xz - c2.xz) / max(r2, 1.0);
    float hMask2 = smoothstep(10.0, 24.0, p.y) * (1.0 - smoothstep(86.0, 112.0, p.y));
    float base2 = clamp(1.0 - d2 * d2, 0.0, 1.0) * hMask2;

    float envelope = max(base1, base2 * 0.92);
    if (envelope <= 0.02) return 0.0;

    // Higher-frequency cauliflower lobes for crisp billowing cumulus texture
    vec3 warp = vec3(
      vnoise(p * 0.045) - 0.5,
      vnoise(p * 0.045 + 11.4) - 0.5,
      vnoise(p * 0.045 + 23.8) - 0.5
    ) * 8.5;
    vec3 q = (p + warp) * 0.072 + vec3(uTime * 0.008, -uTime * 0.018, 0.0);
    float billows = cumulusBillow(q);

    // Crisp eroded cloud silhouette
    float raw = envelope * 1.18 + billows * 0.78 - 0.88;
    return max(raw * 1.85 * uCloudDensity, 0.0);
  }

  float hgPhase(float cosTheta, float g) {
    float g2 = g * g;
    float denom = max(1.0 + g2 - 2.0 * g * cosTheta, 0.001);
    return (1.0 - g2) / (4.0 * 3.14159265 * pow(denom, 1.5));
  }

  void main() {
    vec3 ro = cameraPosition;
    vec3 rd = normalize(vWorldPos - cameraPosition);

    float up = clamp(rd.y, 0.0, 1.0);
    float horizonMix = pow(max(1.0 - up, 1e-5), 2.35);

    vec3 sky = mix(uZenithColor, uHorizonColor, horizonMix);

    vec3 sunD = normalize(uSunDir);
    float sunCos = dot(rd, sunD);
    float sunHalo = pow(max(sunCos, 1e-5), 14.0) * (1.0 - uStormFactor * 0.78);
    float sunDisc = smoothstep(0.9982, 0.9994, sunCos) * (1.0 - uStormFactor * 0.92);
    sky += uSunColor * (sunHalo * 0.28 + sunDisc * 1.7);

    if (uStarVisibility > 0.01 && rd.y > 0.1) {
      vec3 starCell = floor(rd * 240.0);
      float sRand = hash31(starCell);
      if (sRand > 0.995) {
        vec3 starCenter = normalize(starCell + 0.5);
        float dStar = length(rd - starCenter) * 240.0;
        float twinkle = 0.65 + 0.35 * sin(uTime * 2.4 + sRand * 80.0);
        sky += vec3(0.85, 0.92, 1.0) * smoothstep(0.28, 0.02, dStar) * uStarVisibility * twinkle * 0.65;
      }
    }

    // Raymarch towering cumulonimbus cloud colossus with dramatic sidelit chiaroscuro
    vec2 hit1 = intersectTower(ro, rd, vec3(-16.0, 0.0, -108.0), 56.0, 6.0, 156.0);
    vec2 hit2 = intersectTower(ro, rd, vec3(58.0, 0.0, -118.0), 44.0, 8.0, 114.0);

    float tMin = 1e9;
    float tMax = -1.0;
    if (hit1.y > hit1.x) {
      tMin = min(tMin, hit1.x);
      tMax = max(tMax, hit1.y);
    }
    if (hit2.y > hit2.x) {
      tMin = min(tMin, hit2.x);
      tMax = max(tMax, hit2.y);
    }

    if (tMax > tMin && rd.y > -0.05) {
      int steps = clamp(uCloudSteps, 14, 42);
      float span = min(tMax - tMin, 125.0);
      float dt = span / float(steps);
      float jitter = ign(gl_FragCoord.xy);

      // Dramatic side-top lighting vector across the cloud cauliflower lobes
      vec3 cloudLightDir = normalize(vec3(0.76, 0.56, 0.32));
      float cloudPhase = mix(hgPhase(dot(rd, cloudLightDir), 0.35), hgPhase(dot(rd, cloudLightDir), -0.2), 0.35);

      float transmittance = 1.0;
      vec3 accumLight = vec3(0.0);

      for (int i = 0; i < 42; i++) {
        if (i >= steps || transmittance < 0.015) break;
        float t = tMin + (float(i) + jitter) * dt;
        vec3 p = ro + rd * t;
        float dens = sampleCloudTower(p);

        if (dens > 0.004) {
          float lightOptical = 0.0;
          lightOptical += sampleCloudTower(p + cloudLightDir * 4.5) * 4.5;
          lightOptical += sampleCloudTower(p + cloudLightDir * 11.0) * 6.5;
          lightOptical += sampleCloudTower(p + cloudLightDir * 22.0) * 10.0;

          float shadow = exp(-lightOptical * 0.34);
          float powder = 1.0 - exp(-dens * 3.2);
          float heightGrad = smoothstep(8.0, 70.0, p.y);

          vec3 directLight = uCloudSunColor * shadow * (1.05 + cloudPhase * 0.9) * mix(0.7, 1.3, powder);
          vec3 ambientLight = uCloudShadowColor * (0.42 + 0.58 * heightGrad);

          if (uLightningIntensity > 0.01) {
            float dBolt = length(p - uLightningPos);
            ambientLight += vec3(0.72, 0.88, 1.18) * exp(-dBolt * 0.03) * uLightningIntensity * 2.6;
          }

          if (uClashGlow > 0.01) {
            float dClash = length(p - uClashPos);
            ambientLight += vec3(1.15, 0.85, 0.62) * exp(-dClash * 0.018) * uClashGlow * 1.3;
          }

          vec3 stepColor = directLight + ambientLight;
          float stepAlpha = 1.0 - exp(-dens * dt * 0.42);
          accumLight += transmittance * stepColor * stepAlpha;
          transmittance *= (1.0 - stepAlpha);
        }
      }

      float cloudOpacity = clamp((1.0 - transmittance) * smoothstep(-0.02, 0.08, rd.y), 0.0, 1.0);
      if (cloudOpacity > 0.002) {
        vec3 cloudFinal = accumLight / max(1.0 - transmittance, 0.001);
        sky = mix(sky, cloudFinal, cloudOpacity);
      }
    }

    if (uStormFactor > 0.01) {
      vec3 stormHaze = mix(vec3(0.14, 0.17, 0.23), vec3(0.24, 0.27, 0.34), horizonMix);
      sky = mix(sky, stormHaze, uStormFactor * 0.28 * horizonMix);
    }

    gl_FragColor = vec4(max(sky, vec3(0.0)), 1.0);
  }
`;

export function createSkyClouds() {
  const geo = new THREE.SphereGeometry(520, 48, 32);
  const uniforms = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.56, 0.62, 0.54).normalize() },
    uSunColor: { value: new THREE.Color('#ffe0ad') },
    uZenithColor: { value: new THREE.Color('#194691') },
    uHorizonColor: { value: new THREE.Color('#c8a288') },
    uCloudSunColor: { value: new THREE.Color('#fff5e4') },
    uCloudShadowColor: { value: new THREE.Color('#4d5a72') },
    uStormFactor: { value: 0 },
    uCloudDensity: { value: 1.32 },
    uLightningIntensity: { value: 0 },
    uLightningPos: { value: new THREE.Vector3(-12, 72, -108) },
    uClashGlow: { value: 0 },
    uClashPos: { value: new THREE.Vector3(0, 28, -6) },
    uStarVisibility: { value: 0.08 },
    uCloudSteps: { value: 36 }
  };

  const mat = new THREE.ShaderMaterial({
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;

  return { mesh, uniforms, material: mat };
}
