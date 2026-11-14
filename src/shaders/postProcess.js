import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const CinematicFXShader = {
  uniforms: {
    tDiffuse: { value: null },
    uClashCenter: { value: new THREE.Vector2(0.5, 0.55) },
    uClashRadial: { value: 0.0 },
    uSunScreen: { value: new THREE.Vector2(0.62, 0.72) },
    uSunScatter: { value: 0.14 },
    uStormFactor: { value: 0.0 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform vec2 uClashCenter;
    uniform float uClashRadial;
    uniform vec2 uSunScreen;
    uniform float uSunScatter;
    uniform float uStormFactor;

    varying vec2 vUv;

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      vec3 col = base.rgb;

      // Radial light-ray burst during dragon beam clash
      if (uClashRadial > 0.004) {
        vec2 delta = (vUv - uClashCenter) * 0.018 * uClashRadial;
        vec3 rays = vec3(0.0);
        vec2 suv = vUv;
        float weight = 1.0;
        for (int i = 0; i < 12; i++) {
          suv -= delta;
          vec3 s = texture2D(tDiffuse, clamp(suv, vec2(0.001), vec2(0.999))).rgb;
          // Extract only bright clash/beam energy
          float lum = dot(s, vec3(0.2126, 0.7152, 0.0722));
          s *= smoothstep(0.75, 2.2, lum);
          rays += s * weight;
          weight *= 0.88;
        }
        col += rays * 0.11 * uClashRadial;
      }

      // Subtle atmospheric golden-peach halo near sun position
      if (uSunScatter > 0.005) {
        float dSun = length((vUv - uSunScreen) * vec2(1.4, 1.0));
        float halo = exp(-dSun * 3.4) * uSunScatter * (1.0 - uStormFactor * 0.8);
        col += vec3(1.0, 0.78, 0.52) * halo * 0.28;
      }

      // Gentle optical vignette
      vec2 vc = vUv - 0.5;
      float vig = 1.0 - dot(vc, vc) * 0.34;
      col *= clamp(vig, 0.62, 1.0);

      // Subtle shadow warmth / storm cool split-tint
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 shadowTint = mix(vec3(1.02, 0.98, 0.96), vec3(0.92, 0.96, 1.08), uStormFactor);
      col = mix(col * shadowTint, col, smoothstep(0.05, 0.6, lum));

      gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
    }
  `
};

export function createPostPipeline(renderer, scene, camera) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = renderer.getPixelRatio();

  const rt = new THREE.WebGLRenderTarget(
    Math.max(1, Math.floor(width * dpr)),
    Math.max(1, Math.floor(height * dpr)),
    {
      type: THREE.HalfFloatType,
      samples: 4
    }
  );

  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(dpr);
  composer.setSize(width, height);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    0.34, // strength
    0.52, // radius
    0.86  // threshold: only emissive lanterns, eyes, sun, clash glow bloom
  );
  composer.addPass(bloomPass);

  const fxPass = new ShaderPass(CinematicFXShader);
  composer.addPass(fxPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  return {
    composer,
    bloomPass,
    fxUniforms: fxPass.uniforms,
    setSize(w, h, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(w, h);
      bloomPass.resolution.set(w, h);
    }
  };
}
