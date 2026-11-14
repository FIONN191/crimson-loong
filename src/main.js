import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import {
  createRockTextures,
  createMossGroundTextures,
  createDragonScaleTextures,
  createRoofTileTextures,
  createShojiLatticeTextures,
  createPlaqueTexture,
  createMapleLeafTexture,
  createPineClusterTexture,
  createSoftMistTexture,
  createSparkTexture
} from './textures/proceduralTextures.js';
import { createSkyClouds } from './shaders/skyClouds.js';
import { createWaterAndWaterfall } from './shaders/water.js';
import { createPostPipeline } from './shaders/postProcess.js';
import { createEnvironment } from './scene/environment.js';
import { createArchitecture } from './scene/architecture.js';
import { createFoliage } from './scene/foliage.js';
import { createDragon, createClashVFX } from './scene/dragon.js';
import { createWildlifeAndMist } from './scene/wildlife.js';
import { createDirector, ACTS, VISTAS, TOTAL_CYCLE_SECONDS } from './scene/director.js';
import { createSoundEngine } from './audio/soundEngine.js';
import { createHUD } from './ui/hud.js';

const canvas = document.getElementById('c');

// Renderer setup: ACES Filmic HDR tone mapping + crisp soft shadows
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#c8a890', 0.0036);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.35, 650);
camera.position.set(0, 7.6, 48.5);

// OrbitControls (enabled smoothly when user toggles Free Orbit mode)
const orbit = new OrbitControls(camera, canvas);
orbit.enableDamping = true;
orbit.dampingFactor = 0.055;
orbit.maxPolarAngle = Math.PI * 0.495;
orbit.minDistance = 8;
orbit.maxDistance = 120;
orbit.target.set(0, 18.2, -15);
orbit.enabled = false;

// Lighting Rig (front-upper-right key sunlight + generous canyon bounce for rich cliff/maple relief)
const sunLight = new THREE.DirectionalLight('#ffe0ad', 3.4);
sunLight.position.set(42, 48, 40);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 5;
sunLight.shadow.camera.far = 210;
sunLight.shadow.camera.left = -58;
sunLight.shadow.camera.right = 58;
sunLight.shadow.camera.top = 58;
sunLight.shadow.camera.bottom = -42;
sunLight.shadow.bias = -0.0004;
sunLight.shadow.normalBias = 0.04;
scene.add(sunLight);

const hemiLight = new THREE.HemisphereLight('#a8c8f5', '#68543d', 1.32);
scene.add(hemiLight);

const rimFillLight = new THREE.DirectionalLight('#ffd7b0', 0.92);
rimFillLight.position.set(-34, 24, 38);
scene.add(rimFillLight);

// State
let isPaused = false;
let isOrbit = false;
let isUltra = true;
let vistaIdx = 0;
let cycleTime = 0;
let elapsed = 0;

// Subtle mouse parallax in Cinematic Director mode
const pointerParallax = new THREE.Vector2(0, 0);
const pointerTarget = new THREE.Vector2(0, 0);
window.addEventListener('pointermove', (e) => {
  pointerTarget.x = (e.clientX / window.innerWidth - 0.5) * 2;
  pointerTarget.y = (e.clientY / window.innerHeight - 0.5) * 2;
}, { passive: true });

// Build Procedural Assets Synchronously then reveal
const sound = createSoundEngine();

const hud = createHUD({
  onToggleSound() {
    const next = sound.setEnabled(!sound.isEnabled());
    hud.setSoundUI(next, isPaused);
  },
  onTogglePause() {
    isPaused = !isPaused;
    sound.setPaused(isPaused);
    hud.setPauseUI(isPaused);
    hud.setSoundUI(sound.isEnabled(), isPaused);
  },
  onToggleOrbit() {
    isOrbit = !isOrbit;
    orbit.enabled = isOrbit;
    hud.setOrbitUI(isOrbit);
  },
  onCycleVista() {
    vistaIdx = (vistaIdx + 1) % VISTAS.length;
    const v = VISTAS[vistaIdx];
    isOrbit = true;
    orbit.enabled = true;
    camera.position.set(v.pos[0], v.pos[1], v.pos[2]);
    orbit.target.set(v.target[0], v.target[1], v.target[2]);
    orbit.update();
    hud.setOrbitUI(true);
  },
  onTriggerRoar() {
    director.triggerRoar();
    if (!sound.isEnabled()) {
      sound.setEnabled(true);
      hud.setSoundUI(true, isPaused);
    }
    sound.playDragonRoar();
  },
  onToggleQuality() {
    isUltra = !isUltra;
    const dpr = isUltra ? Math.min(window.devicePixelRatio || 1, 2) : 1.0;
    renderer.setPixelRatio(dpr);
    post.setSize(window.innerWidth, window.innerHeight, dpr);
    water.setResolution(window.innerWidth, window.innerHeight, isUltra);
    sky.uniforms.uCloudSteps.value = isUltra ? 36 : 22;
    hud.setQualityUI(isUltra);
  },
  onSelectAct(idx) {
    const act = ACTS[idx];
    if (act) cycleTime = act.start + 0.5;
  },
  onScrub(t) {
    cycleTime = ((t % TOTAL_CYCLE_SECONDS) + TOTAL_CYCLE_SECONDS) % TOTAL_CYCLE_SECONDS;
  }
});

// Generate all procedural textures in memory (zero external requests)
const textures = {
  rock: createRockTextures(),
  mossGround: createMossGroundTextures(),
  crimsonScale: createDragonScaleTextures('crimson'),
  frostScale: createDragonScaleTextures('frost'),
  roof: createRoofTileTextures(),
  shoji: createShojiLatticeTextures(),
  plaque: createPlaqueTexture('赤 龍'),
  mapleLeaf: createMapleLeafTexture(),
  pineCluster: createPineClusterTexture(),
  mist: createSoftMistTexture(),
  spark: createSparkTexture()
};

const sky = createSkyClouds();
scene.add(sky.mesh);

const water = createWaterAndWaterfall(scene);
const env = createEnvironment(scene, textures);
const arch = createArchitecture(scene, textures);
const foliage = createFoliage(scene, textures, env.spireTops);
const wildlife = createWildlifeAndMist(scene, textures.mist);

const crimsonDragon = createDragon(scene, textures.crimsonScale, 'crimson');
const frostDragon = createDragon(scene, textures.frostScale, 'frost');
const clashVFX = createClashVFX(scene, textures.spark);
const director = createDirector(crimsonDragon.spineCount);
const post = createPostPipeline(renderer, scene, camera);

water.setResolution(window.innerWidth, window.innerHeight, isUltra);

// Handle responsive resize cleanly
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = isUltra ? Math.min(window.devicePixelRatio || 1, 2) : 1.0;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h);
  post.setSize(w, h, dpr);
  water.setResolution(w, h, isUltra);
});

const tmpSunScreen = new THREE.Vector3();
const tmpClashScreen = new THREE.Vector3();
const clock = new THREE.Clock();

// Pre-warm initial frame before lifting calligraphic curtain
function stepSimulation(dt) {
  elapsed += dt;
  cycleTime = (cycleTime + dt) % TOTAL_CYCLE_SECONDS;

  const state = director.update(dt, elapsed, cycleTime);

  // Sync Sky, Sun & Atmospheric Fog
  sky.uniforms.uTime.value = elapsed;
  sky.uniforms.uSunDir.value.copy(state.outSunDir);
  sky.uniforms.uSunColor.value.copy(state.outSunColor);
  sky.uniforms.uZenithColor.value.copy(state.outSkyZenith);
  sky.uniforms.uHorizonColor.value.copy(state.outSkyHorizon);
  sky.uniforms.uCloudSunColor.value.copy(state.outCloudSun);
  sky.uniforms.uCloudShadowColor.value.copy(state.outCloudShadow);
  sky.uniforms.uStormFactor.value = state.stormFactor;
  sky.uniforms.uLightningIntensity.value = state.lightningIntensity;
  sky.uniforms.uLightningPos.value.copy(state.lightningPos);
  sky.uniforms.uClashGlow.value = state.clashIntensity;

  sunLight.position.copy(state.outSunDir).multiplyScalar(78);
  sunLight.color.copy(state.outSunColor);
  sunLight.intensity = 3.4 - state.stormFactor * 1.9 + state.lightningIntensity * 2.2;
  hemiLight.intensity = 1.32 - state.stormFactor * 0.45 + state.lightningIntensity * 0.65;

  scene.fog.color.copy(state.outFogColor);
  scene.fog.density = 0.0036 + state.stormFactor * 0.0024;

  // Update Dragons
  crimsonDragon.update(state.redPts, elapsed, {
    jawOpen: state.redJaw,
    throatBoost: state.redThroat
  });

  frostDragon.root.visible = state.whiteVisible;
  if (state.whiteVisible || elapsed < 0.05) {
    frostDragon.update(state.whiteVisible ? state.whitePts : state.redPts, elapsed, {
      jawOpen: state.whiteJaw,
      throatBoost: state.whiteThroat
    });
  }

  // Update Clash Beams & Plasma Sphere
  const clashCenter = clashVFX.update(
    elapsed,
    crimsonDragon.mouthWorldPos,
    frostDragon.mouthWorldPos,
    state.clashIntensity,
    camera
  );
  sky.uniforms.uClashPos.value.copy(clashCenter);

  // Update Environment Systems
  arch.update(elapsed, state.windStrength, state.stormFactor * 0.85 + state.dawnGlow * 0.35);
  foliage.update(dt, elapsed, state.windStrength, state.rainIntensity, state.clashIntensity + state.manualRoar);
  wildlife.update(elapsed, state.stormFactor, state.outMistColor);

  // Update Water & Waterfall Uniforms
  water.waterUniforms.uTime.value = elapsed;
  water.waterUniforms.uSunDir.value.copy(state.outSunDir);
  water.waterUniforms.uSunColor.value.copy(state.outSunColor);
  water.waterUniforms.uStormFactor.value = state.stormFactor;
  water.waterUniforms.uClashGlow.value = state.clashIntensity;
  water.waterfallUniforms.uTime.value = elapsed;
  water.waterfallUniforms.uSunColor.value.copy(state.outSunColor);
  water.waterfallUniforms.uStormFactor.value = state.stormFactor;

  // Update Camera (Cinematic Director with subtle mouse parallax vs Free Orbit)
  pointerParallax.lerp(pointerTarget, Math.min(1, dt * 4));
  if (!isOrbit) {
    camera.position.set(
      state.camPos.x + pointerParallax.x * 1.4,
      state.camPos.y - pointerParallax.y * 0.75,
      state.camPos.z
    );
    camera.lookAt(state.camTarget);
    orbit.target.copy(state.camTarget);
  } else {
    orbit.update();
  }

  // Project Sun & Clash Centers into Screen UV for PostFX
  tmpSunScreen.copy(state.outSunDir).multiplyScalar(300).add(camera.position).project(camera);
  post.fxUniforms.uSunScreen.value.set(tmpSunScreen.x * 0.5 + 0.5, tmpSunScreen.y * 0.5 + 0.5);
  post.fxUniforms.uSunScatter.value = tmpSunScreen.z < 1.0 ? 0.16 : 0.0;
  post.fxUniforms.uStormFactor.value = state.stormFactor;

  tmpClashScreen.copy(clashCenter).project(camera);
  post.fxUniforms.uClashCenter.value.set(tmpClashScreen.x * 0.5 + 0.5, tmpClashScreen.y * 0.5 + 0.5);
  post.fxUniforms.uClashRadial.value = state.clashIntensity * 0.95;

  post.bloomPass.strength = 0.26 + state.clashIntensity * 0.16 + state.manualRoar * 0.10;

  // Update Audio & HUD
  sound.update(dt, state);
  hud.updateProgress(cycleTime, state.actIdx);
}

// Run 1 warm-up step + render, then lift loading curtain
stepSimulation(0.016);
water.renderReflection(renderer, camera, sky.uniforms, isUltra);
post.composer.render();
requestAnimationFrame(() => hud.hideLoader());

function animate() {
  requestAnimationFrame(animate);
  const rawDt = Math.min(clock.getDelta(), 0.05);
  const dt = isPaused ? 0 : rawDt;

  if (!isPaused) {
    stepSimulation(dt);
  } else if (isOrbit) {
    orbit.update();
  }

  water.renderReflection(renderer, camera, sky.uniforms, isUltra);
  post.composer.render();
}

animate();
