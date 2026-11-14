import * as THREE from 'three';

const waterVertexShader = /* glsl */ `
  uniform float uTime;
  uniform mat4 uTextureMatrix;

  varying vec4 vProjCoords;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float swell = sin(wp.x * 0.28 + uTime * 1.1) * cos(wp.z * 0.34 - uTime * 0.85) * 0.035;
    wp.y += swell;
    vWorldPos = wp.xyz;
    vProjCoords = uTextureMatrix * wp;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const waterFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uReflectMap;
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uWaterDeepColor;
  uniform vec3 uWaterShallowColor;
  uniform float uStormFactor;
  uniform float uClashGlow;
  uniform vec3 uClashColor;

  varying vec4 vProjCoords;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float waveHeight(vec2 p) {
    float h = 0.0;
    h += sin(p.x * 1.45 + uTime * 1.6 + p.y * 0.5) * 0.22;
    h += cos(p.y * 1.95 - uTime * 1.35 + p.x * 0.35) * 0.18;
    h += (vnoise(p * 1.65 + vec2(uTime * 0.24, -uTime * 0.18)) - 0.5) * 0.55;
    h += (vnoise(p * 4.2 - vec2(uTime * 0.38, uTime * 0.29)) - 0.5) * 0.26;

    float dFalls = length(p - vec2(0.0, -10.2));
    float fallsWave = sin(dFalls * 3.4 - uTime * 5.2) * exp(-dFalls * 0.11) * 0.45;
    h += fallsWave;

    if (uStormFactor > 0.05) {
      vec2 cell = floor(p * 1.4);
      vec2 local = fract(p * 1.4) - 0.5;
      float rnd = hash21(cell);
      float phase = fract(uTime * 1.35 + rnd);
      float r = phase * 0.48;
      float ring = exp(-abs(length(local) - r) * 26.0) * (1.0 - phase) * uStormFactor;
      h += ring * 0.55;
    }

    return h;
  }

  void main() {
    vec2 p = vWorldPos.xz;
    float eps = 0.09;
    float hC = waveHeight(p);
    float hX = waveHeight(p + vec2(eps, 0.0));
    float hZ = waveHeight(p + vec2(0.0, eps));
    vec3 normal = normalize(vec3((hC - hX) * 0.38, 1.0, (hC - hZ) * 0.38));

    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float ndotv = clamp(dot(normal, viewDir), 0.0, 0.999);
    float fresnel = clamp(0.08 + 0.92 * pow(max(1.0 - ndotv, 1e-4), 3.2), 0.0, 0.94);

    vec2 reflUV = vProjCoords.xy / max(vProjCoords.w, 0.0001);
    reflUV += normal.xz * vec2(0.042, 0.052);
    reflUV = clamp(reflUV, vec2(0.003), vec2(0.997));
    vec3 reflection = clamp(texture2D(uReflectMap, reflUV).rgb, vec3(0.0), vec3(4.0));

    float dFalls = length(p - vec2(0.0, -10.2));
    float shallowMix = smoothstep(3.0, 26.0, dFalls);
    vec3 waterBody = mix(uWaterShallowColor, uWaterDeepColor, shallowMix);

    float caustic = pow(max(vnoise(p * 2.1 + vec2(uTime * 0.35, -uTime * 0.28)), 1e-4), 3.0);
    waterBody += vec3(0.11, 0.21, 0.16) * caustic * (1.0 - uStormFactor * 0.65);

    vec3 col = mix(waterBody, reflection, fresnel * 0.85 + 0.15);

    vec3 sunD = normalize(uSunDir);
    vec3 halfVec = normalize(sunD + viewDir);
    float spec = pow(max(dot(normal, halfVec), 1e-4), 140.0);
    col += uSunColor * spec * (1.15 - uStormFactor * 0.78);

    float leftLantern = exp(-length(p - vec2(-12.2, 4.5)) * 0.24);
    float rightLantern = exp(-length(p - vec2(13.6, 7.6)) * 0.24);
    float lanternRipple = 0.65 + 0.35 * sin(hC * 10.0 + uTime * 3.0);
    col += vec3(1.0, 0.45, 0.18) * (leftLantern + rightLantern) * 0.32 * lanternRipple;

    if (uClashGlow > 0.01) {
      col += uClashColor * uClashGlow * (0.14 + fresnel * 0.32);
    }

    float fallsFoam = exp(-dFalls * 0.34) * (0.55 + 0.45 * vnoise(p * 3.6 - vec2(0.0, uTime * 2.4)));
    float foamMask = clamp(fallsFoam * 1.45, 0.0, 0.94);
    col = mix(col, mix(vec3(0.90, 0.96, 0.97), vec3(0.60, 0.68, 0.76), uStormFactor * 0.5), foamMask);

    gl_FragColor = vec4(max(col, vec3(0.0)), 0.96);
  }
`;

const waterfallVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  uniform float uTime;

  void main() {
    vUv = uv;
    vec3 pos = position;
    float fallT = 1.0 - uv.y;
    pos.z += sin(fallT * 3.14159) * 0.85 + fallT * 0.55;
    pos.z += sin(uv.x * 18.0 + uTime * 6.5) * 0.08 * fallT;
    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const waterfallFragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  varying vec3 vWorldPos;

  uniform float uTime;
  uniform vec3 uSunColor;
  uniform float uStormFactor;

  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    float fall = 1.0 - vUv.y;
    vec2 uv1 = vec2(vUv.x * 7.5, vUv.y * 3.2 + uTime * 1.9);
    vec2 uv2 = vec2(vUv.x * 16.0 + 2.3, vUv.y * 5.8 + uTime * 3.1);

    float streak1 = vnoise(uv1);
    float streak2 = vnoise(uv2);
    float streaks = streak1 * 0.58 + streak2 * 0.42;

    float sideFade = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
    float bottomFoam = smoothstep(0.60, 1.0, fall);
    float topLip = smoothstep(0.0, 0.10, fall);

    float foam = smoothstep(0.28, 0.76, streaks + bottomFoam * 0.42);
    vec3 waterBase = mix(vec3(0.48, 0.66, 0.68), vec3(0.32, 0.42, 0.50), uStormFactor * 0.55);
    vec3 whiteFoam = mix(vec3(0.96, 0.98, 0.99) * (0.85 + 0.25 * uSunColor), vec3(0.70, 0.78, 0.88), uStormFactor * 0.5);

    vec3 col = mix(waterBase, whiteFoam, foam);
    float alpha = clamp((0.40 + foam * 0.58) * sideFade * topLip, 0.0, 0.95);
    if (alpha < 0.04) discard;

    gl_FragColor = vec4(col, alpha);
  }
`;

export function createWaterAndWaterfall(scene) {
  const reflectRT = new THREE.WebGLRenderTarget(512, 512, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    type: THREE.HalfFloatType
  });

  const textureMatrix = new THREE.Matrix4();
  const mirrorCam = new THREE.PerspectiveCamera();

  const lakeGeo = new THREE.PlaneGeometry(110, 70, 32, 24);
  lakeGeo.rotateX(-Math.PI / 2);

  const waterUniforms = {
    uReflectMap: { value: reflectRT.texture },
    uTextureMatrix: { value: textureMatrix },
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.55, 0.62, 0.52).normalize() },
    uSunColor: { value: new THREE.Color('#ffdfb0') },
    uWaterDeepColor: { value: new THREE.Color('#1d5250') },
    uWaterShallowColor: { value: new THREE.Color('#347b6e') },
    uStormFactor: { value: 0 },
    uClashGlow: { value: 0 },
    uClashColor: { value: new THREE.Color('#ffd3a8') }
  };

  const lakeMat = new THREE.ShaderMaterial({
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    uniforms: waterUniforms,
    transparent: true
  });

  const lakeMesh = new THREE.Mesh(lakeGeo, lakeMat);
  lakeMesh.position.set(0, 0, 5);
  lakeMesh.renderOrder = 2;
  scene.add(lakeMesh);

  const fallGeo = new THREE.PlaneGeometry(5.6, 12.2, 24, 32);
  const waterfallUniforms = {
    uTime: { value: 0 },
    uSunColor: { value: new THREE.Color('#ffdfb0') },
    uStormFactor: { value: 0 }
  };
  const fallMat = new THREE.ShaderMaterial({
    vertexShader: waterfallVertexShader,
    fragmentShader: waterfallFragmentShader,
    uniforms: waterfallUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const mainFall = new THREE.Mesh(fallGeo, fallMat);
  mainFall.position.set(0, 5.7, -11.35);
  mainFall.renderOrder = 3;
  scene.add(mainFall);

  const sideFallGeo = new THREE.PlaneGeometry(1.4, 10.6, 12, 20);
  const sideFall = new THREE.Mesh(sideFallGeo, fallMat);
  sideFall.position.set(-16.2, 5.1, -9.2);
  sideFall.rotation.y = 0.25;
  sideFall.renderOrder = 3;
  scene.add(sideFall);

  const tmpVec = new THREE.Vector3();
  const tmpTarget = new THREE.Vector3();

  function renderReflection(renderer, activeCamera, skyUniforms, ultra) {
    mirrorCam.fov = activeCamera.fov;
    mirrorCam.aspect = activeCamera.aspect;
    mirrorCam.near = activeCamera.near;
    mirrorCam.far = activeCamera.far;
    mirrorCam.updateProjectionMatrix();

    mirrorCam.position.copy(activeCamera.position);
    mirrorCam.position.y = -mirrorCam.position.y;

    activeCamera.getWorldDirection(tmpVec);
    tmpTarget.copy(activeCamera.position).add(tmpVec);
    tmpTarget.y = -tmpTarget.y;

    mirrorCam.up.set(0, 1, 0);
    mirrorCam.lookAt(tmpTarget);
    mirrorCam.updateMatrixWorld();

    textureMatrix.set(
      0.5, 0.0, 0.0, 0.5,
      0.0, 0.5, 0.0, 0.5,
      0.0, 0.0, 0.5, 0.5,
      0.0, 0.0, 0.0, 1.0
    );
    textureMatrix.multiply(mirrorCam.projectionMatrix);
    textureMatrix.multiply(mirrorCam.matrixWorldInverse);

    const prevSteps = skyUniforms.uCloudSteps.value;
    skyUniforms.uCloudSteps.value = ultra ? 16 : 12;

    lakeMesh.visible = false;
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(reflectRT);
    renderer.clear();
    renderer.render(scene, mirrorCam);
    renderer.setRenderTarget(prevTarget);
    lakeMesh.visible = true;

    skyUniforms.uCloudSteps.value = prevSteps;
  }

  return {
    lakeMesh,
    waterUniforms,
    waterfallUniforms,
    reflectRT,
    renderReflection,
    setResolution(w, h, ultra) {
      const targetSize = ultra ? Math.min(768, Math.max(384, Math.floor(w * 0.45))) : 384;
      const ratio = h / Math.max(w, 1);
      reflectRT.setSize(targetSize, Math.max(256, Math.round(targetSize * ratio)));
    }
  };
}
