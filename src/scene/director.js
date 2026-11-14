import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../utils/noise.js';

export const TOTAL_CYCLE_SECONDS = 92;

export const ACTS = [
  { name: 'FIRST LIGHT', roman: 'ACT I', start: 0, end: 18 },
  { name: 'GATHERING STORM', roman: 'ACT II', start: 18, end: 34 },
  { name: 'TWIN DRAGONS', roman: 'ACT III', start: 34, end: 50 },
  { name: 'CELESTIAL HELIX', roman: 'ACT IV', start: 50, end: 64 },
  { name: 'ELEMENTAL CLASH', roman: 'ACT V', start: 64, end: 78 },
  { name: 'DAWN RENEWAL', roman: 'ACT VI', start: 78, end: 92 }
];

export const VISTAS = [
  { name: 'Sanctuary Wide', pos: [0, 8.8, 46.5], target: [0, 18.8, -14] },
  { name: 'Spire Guardian', pos: [-9.0, 26.5, 11.0], target: [0.6, 37.5, -26.5] },
  { name: 'Lakeside Pavilion', pos: [0.5, 5.2, 24.5], target: [8.5, 7.2, 3.0] },
  { name: 'Clash Arena', pos: [0.0, 14.0, 45.0], target: [0.0, 26.5, -8.0] }
];

/**
 * Generates an array of N spine points along a smooth parametric curve.
 */
function sampleSpireCoil(outPts, count, center, time, headY, tailY, turns, radiusBase, phase, swayAmp = 0.65) {
  for (let i = 0; i < count; i++) {
    const s = i / (count - 1);
    const y = lerp(headY, tailY, s) + Math.sin(time * 1.45 + s * 6.0) * swayAmp * (1 - s * 0.5);
    const theta = phase + s * Math.PI * 2 * turns + Math.sin(time * 0.9 + s * 3.0) * 0.14;
    const r = radiusBase + Math.sin(s * Math.PI) * 1.85 + Math.cos(s * 7.0 - time * 1.2) * 0.35;

    // Slight proud head crane forward toward the valley
    const headPull = smoothstep(0.18, 0.0, s) * 2.6;

    outPts[i].set(
      center.x + Math.cos(theta) * r,
      y,
      center.z + Math.sin(theta) * r + headPull
    );
  }
}

function sampleGlideCurve(outPts, count, time, p0, p1, p2, p3, waveAmp = 1.6) {
  const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
  const pt = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < count; i++) {
    const s = i / (count - 1);
    curve.getPoint(s, pt);
    curve.getTangent(s, tan);
    side.crossVectors(tan, up).normalize();

    const wave = Math.sin(s * 9.5 - time * 3.2) * waveAmp * (0.3 + 0.7 * Math.sin(s * Math.PI));
    const lift = Math.cos(s * 6.5 - time * 2.5) * waveAmp * 0.45;
    outPts[i].copy(pt).addScaledVector(side, wave).addScaledVector(up, lift);
  }
}

function sampleDoubleHelix(outPts, count, time, center, angleOffset, baseY, topY, radius) {
  for (let i = 0; i < count; i++) {
    const s = i / (count - 1);
    const spiral = angleOffset + time * 1.25 - s * Math.PI * 3.1;
    const r = radius * (0.78 + 0.25 * Math.sin(s * Math.PI)) + Math.sin(s * 8.0 + time * 3.0) * 0.6;
    const y = lerp(topY, baseY, s) + Math.sin(time * 2.0 + s * 4.5) * 1.2;
    outPts[i].set(
      center.x + Math.cos(spiral) * r,
      y,
      center.z + Math.sin(spiral) * r
    );
  }
}

function blendSpines(outPts, ptsA, ptsB, t) {
  const k = smoothstep(0, 1, t);
  for (let i = 0; i < outPts.length; i++) {
    outPts[i].lerpVectors(ptsA[i], ptsB[i], k);
  }
}

/**
 * Evaluates full 6-Act choreography, atmosphere, lightning, camera, and audio triggers.
 */
export function createDirector(spineCount) {
  const redPts = Array.from({ length: spineCount }, () => new THREE.Vector3());
  const whitePts = Array.from({ length: spineCount }, () => new THREE.Vector3());
  const tmpA = Array.from({ length: spineCount }, () => new THREE.Vector3());
  const tmpB = Array.from({ length: spineCount }, () => new THREE.Vector3());
  const tmpC = Array.from({ length: spineCount }, () => new THREE.Vector3());
  const tmpD = Array.from({ length: spineCount }, () => new THREE.Vector3());

  const spireCenter = new THREE.Vector3(0.6, 0, -26.5);
  const helixCenter = new THREE.Vector3(0, 0, -8.0);

  let lastLightningTime = -10;
  let lightningIntensity = 0;
  const lightningPos = new THREE.Vector3(-12, 74, -124);

  let roarTimer = 0;
  let prevActIdx = 0;

  const camPos = new THREE.Vector3(0, 9.8, 44);
  const camTarget = new THREE.Vector3(0, 21.5, -18);

  const skyMorningZenith = new THREE.Color('#224b92');
  const skyMorningHorizon = new THREE.Color('#cf9f7c');
  const skyStormZenith = new THREE.Color('#191f30');
  const skyStormHorizon = new THREE.Color('#3b404e');
  const skyDawnZenith = new THREE.Color('#2b4a8c');
  const skyDawnHorizon = new THREE.Color('#ebb182');

  const sunMorningCol = new THREE.Color('#ffe0ad');
  const sunStormCol = new THREE.Color('#8ba3c4');
  const cloudMorningSun = new THREE.Color('#fff1dc');
  const cloudMorningShadow = new THREE.Color('#5b677c');
  const cloudStormSun = new THREE.Color('#7a879b');
  const cloudStormShadow = new THREE.Color('#252a36');

  const fogMorning = new THREE.Color('#c8a890');
  const fogStorm = new THREE.Color('#323947');

  const outSkyZenith = new THREE.Color();
  const outSkyHorizon = new THREE.Color();
  const outSunColor = new THREE.Color();
  const outCloudSun = new THREE.Color();
  const outCloudShadow = new THREE.Color();
  const outFogColor = new THREE.Color();
  const outMistColor = new THREE.Color();
  const outSunDir = new THREE.Vector3();

  function triggerRoar() {
    roarTimer = 2.8;
  }

  function getActIndex(cycleT) {
    for (let i = 0; i < ACTS.length; i++) {
      if (cycleT >= ACTS[i].start && cycleT < ACTS[i].end) return i;
    }
    return 0;
  }

  function update(dt, elapsed, cycleT) {
    const actIdx = getActIndex(cycleT);
    const actChanged = actIdx !== prevActIdx;
    prevActIdx = actIdx;

    if (roarTimer > 0) roarTimer = Math.max(0, roarTimer - dt);
    const manualRoar = smoothstep(0, 0.35, roarTimer) * smoothstep(2.8, 1.8, roarTimer);

    // ------------------------------------------------------------------
    // 1. ATMOSPHERIC / WEATHER ENVELOPE ACROSS 92s LOOP
    // ------------------------------------------------------------------
    const stormIn = smoothstep(18, 32, cycleT);
    const stormOut = 1.0 - smoothstep(76, 87, cycleT);
    const stormFactor = stormIn * stormOut;

    const rainIntensity = smoothstep(23, 33, cycleT) * (1.0 - smoothstep(74, 83, cycleT));
    const windStrength = 1.0 + stormFactor * 1.45;
    const dawnGlow = smoothstep(78, 86, cycleT) * (1.0 - smoothstep(88, 92, cycleT));

    // Periodic lightning flashes during Acts II-V
    let triggeredThunder = false;
    if (stormFactor > 0.38 && elapsed - lastLightningTime > 4.2) {
      const triggerSeed = Math.sin(elapsed * 1.73 + actIdx * 3.1);
      if (triggerSeed > 0.72) {
        lastLightningTime = elapsed;
        lightningIntensity = 1.0;
        lightningPos.set(-16 + Math.sin(elapsed) * 18, 65 + Math.cos(elapsed * 2) * 18, -124);
        triggeredThunder = true;
      }
    }
    lightningIntensity = Math.max(0, lightningIntensity - dt * 2.8);

    // Sun angle from front-upper-right so cliffs, gate, maples & dragon pop with 3D sunlit relief
    const sunElev = lerp(0.62, 0.30, stormFactor) + dawnGlow * 0.08;
    const sunAzim = lerp(0.56, 0.22, stormFactor) - dawnGlow * 0.2;
    const sunDepth = lerp(0.54, 0.28, stormFactor);
    outSunDir.set(sunAzim, sunElev, sunDepth).normalize();

    outSkyZenith.copy(skyMorningZenith).lerp(skyStormZenith, stormFactor);
    outSkyHorizon.copy(skyMorningHorizon).lerp(skyStormHorizon, stormFactor);
    if (dawnGlow > 0.01) {
      outSkyZenith.lerp(skyDawnZenith, dawnGlow * 0.65);
      outSkyHorizon.lerp(skyDawnHorizon, dawnGlow * 0.75);
    }

    outSunColor.copy(sunMorningCol).lerp(sunStormCol, stormFactor * 0.85);
    outCloudSun.copy(cloudMorningSun).lerp(cloudStormSun, stormFactor);
    outCloudShadow.copy(cloudMorningShadow).lerp(cloudStormShadow, stormFactor);
    outFogColor.copy(fogMorning).lerp(fogStorm, stormFactor);
    outMistColor.set('#f5efe8').lerp(new THREE.Color('#6f7b8e'), stormFactor * 0.75);

    // ------------------------------------------------------------------
    // 2. DRAGON SPINE CHOREOGRAPHY
    // ------------------------------------------------------------------
    // Canonical pose A: Crimson Loong coiled around hero central karst spire
    sampleSpireCoil(tmpA, spineCount, spireCenter, elapsed, 48.0, 21.5, 1.75, 5.2, 1.35 + Math.sin(elapsed * 0.32) * 0.35, 0.45);

    // Canonical pose B: Crimson Loong gliding low across lake & gate
    const gPhase = clamp((cycleT - 18) / 16, 0, 1);
    sampleGlideCurve(
      tmpB,
      spineCount,
      elapsed,
      new THREE.Vector3(-12 + Math.sin(gPhase * Math.PI) * 18, 12.5 + Math.sin(gPhase * Math.PI * 2) * 3.5, 6.5 - gPhase * 4.0),
      new THREE.Vector3(-18 + gPhase * 12, 16.5, -2.5),
      new THREE.Vector3(-6 + gPhase * 6, 22.0, -10.5),
      new THREE.Vector3(8, 28.0, -21.0),
      1.75
    );

    // Canonical pose C: Twin dragons face-off (Crimson on left, Frost on right)
    sampleGlideCurve(
      tmpC,
      spineCount,
      elapsed,
      new THREE.Vector3(-12.5, 30.5 + Math.sin(elapsed * 1.6) * 1.4, -3.5),
      new THREE.Vector3(-18.5, 25.0, -7.5),
      new THREE.Vector3(-13.5, 20.5, -13.0),
      new THREE.Vector3(-22.0, 15.5, -19.5),
      1.4
    );

    sampleGlideCurve(
      tmpD,
      spineCount,
      elapsed + 0.8,
      new THREE.Vector3(12.5, 30.5 + Math.cos(elapsed * 1.5) * 1.4, -3.5),
      new THREE.Vector3(19.0, 26.5, -7.0),
      new THREE.Vector3(14.5, 21.5, -13.5),
      new THREE.Vector3(24.0, 16.0, -20.5),
      1.4
    );

    let whiteVisible = false;
    let redJaw = 0.14 + manualRoar * 0.65;
    let redThroat = manualRoar * 1.4;
    let whiteJaw = 0.14;
    let whiteThroat = 0.0;
    let clashIntensity = 0.0;

    if (cycleT < 18) {
      // Act I: First Light — coiled around hero spire, framing mossy bank, framing maples, lake, pavilions, gate & cloud colossus
      for (let i = 0; i < spineCount; i++) redPts[i].copy(tmpA[i]);
      camPos.set(Math.sin(cycleT * 0.12) * 1.8, lerp(7.6, 8.8, cycleT / 18), lerp(48.5, 44.5, cycleT / 18));
      camTarget.set(0, lerp(16.6, 17.8, cycleT / 18), -14);
    } else if (cycleT < 34) {
      // Act II: Gathering Storm — unfurls down over lake & gate
      const t = (cycleT - 18) / 16;
      const blendIn = smoothstep(0.0, 0.25, t);
      const blendOut = smoothstep(0.75, 1.0, t);
      if (t < 0.75) {
        blendSpines(redPts, tmpA, tmpB, blendIn);
      } else {
        blendSpines(redPts, tmpB, tmpC, blendOut);
      }
      if (t > 0.72) {
        whiteVisible = true;
        const dropIn = smoothstep(0.72, 1.0, t);
        for (let i = 0; i < spineCount; i++) {
          whitePts[i].copy(tmpD[i]).add(new THREE.Vector3(12 * (1 - dropIn), 24 * (1 - dropIn), -16 * (1 - dropIn)));
        }
      }
      camPos.set(lerp(-4.0, 4.8, t), lerp(9.0, 10.2, t), lerp(44.0, 42.5, t));
      camTarget.set(lerp(-1.0, 0.5, t), lerp(18.0, 21.0, t), -14.0);
    } else if (cycleT < 50) {
      // Act III: Twin Dragons face-off across the stormy gorge
      whiteVisible = true;
      const t = (cycleT - 34) / 16;
      if (t < 0.78) {
        for (let i = 0; i < spineCount; i++) {
          redPts[i].copy(tmpC[i]);
          whitePts[i].copy(tmpD[i]);
        }
      } else {
        // Begin spiraling into helix
        const ht = smoothstep(0.78, 1.0, t);
        sampleDoubleHelix(tmpA, spineCount, elapsed, helixCenter, 0, 18, 42, 9.2);
        sampleDoubleHelix(tmpB, spineCount, elapsed, helixCenter, Math.PI, 18, 42, 9.2);
        blendSpines(redPts, tmpC, tmpA, ht);
        blendSpines(whitePts, tmpD, tmpB, ht);
      }
      redJaw = Math.max(redJaw, 0.36 + 0.16 * Math.sin(elapsed * 4.0));
      whiteJaw = 0.36 + 0.16 * Math.cos(elapsed * 4.0);
      camPos.set(lerp(3.2, -2.5, t), lerp(11.0, 13.5, t), lerp(44.5, 43.5, t));
      camTarget.set(0, lerp(22.0, 26.5, t), -10.0);
    } else if (cycleT < 64) {
      // Act IV: Celestial Double Helix ascent
      whiteVisible = true;
      const t = (cycleT - 50) / 14;
      const rise = smoothstep(0, 1, t);
      sampleDoubleHelix(redPts, spineCount, elapsed, helixCenter, 0, 17 + rise * 6, 42 + rise * 7, 9.4);
      sampleDoubleHelix(whitePts, spineCount, elapsed, helixCenter, Math.PI, 17 + rise * 6, 42 + rise * 7, 9.4);

      if (t > 0.78) {
        const pull = smoothstep(0.78, 1.0, t);
        blendSpines(redPts, redPts, tmpC, pull);
        blendSpines(whitePts, whitePts, tmpD, pull);
      }
      redJaw = Math.max(redJaw, 0.42);
      whiteJaw = 0.42;
      camPos.set(Math.sin(t * Math.PI) * 5.0, lerp(13.5, 16.0, t), lerp(44.5, 43.0, t));
      camTarget.set(0, lerp(27.5, 31.0, t), -10.0);
    } else if (cycleT < 78) {
      // Act V: Elemental Clash — opposing stances + dual beams + central plasma clash!
      whiteVisible = true;
      const t = (cycleT - 64) / 14;
      sampleGlideCurve(
        redPts,
        spineCount,
        elapsed,
        new THREE.Vector3(-9.5, 29.8 + Math.sin(elapsed * 2.2) * 0.65, -4.0),
        new THREE.Vector3(-16.8, 27.5, -8.0),
        new THREE.Vector3(-13.8, 21.0, -13.5),
        new THREE.Vector3(-22.0, 16.0, -18.5),
        1.2
      );
      sampleGlideCurve(
        whitePts,
        spineCount,
        elapsed + 1.1,
        new THREE.Vector3(9.5, 29.8 + Math.cos(elapsed * 2.1) * 0.65, -4.0),
        new THREE.Vector3(16.8, 27.5, -8.0),
        new THREE.Vector3(13.8, 21.0, -13.5),
        new THREE.Vector3(22.0, 16.0, -18.5),
        1.2
      );

      // Charge -> Beam Clash -> Radiant Climax
      const beamOn = smoothstep(0.10, 0.24, t) * (1.0 - smoothstep(0.85, 1.0, t));
      clashIntensity = beamOn;
      redJaw = Math.max(redJaw, 0.28 + beamOn * 0.56);
      whiteJaw = 0.28 + beamOn * 0.56;
      redThroat = Math.max(redThroat, 0.6 + beamOn * 1.4);
      whiteThroat = 0.6 + beamOn * 1.4;

      const shake = beamOn * 0.22;
      camPos.set(
        Math.sin(elapsed * 37.0) * shake,
        13.5 + Math.cos(elapsed * 43.0) * shake * 0.7,
        45.5 - beamOn * 2.0
      );
      camTarget.set(0, 26.0, -7.5);
    } else {
      // Act VI: Dawn Renewal — Frost dragon ascends into clouds, Crimson Loong returns to spire!
      const t = (cycleT - 78) / 14;
      whiteVisible = t < 0.45;
      if (whiteVisible) {
        const flyAway = smoothstep(0.0, 0.45, t);
        for (let i = 0; i < spineCount; i++) {
          whitePts[i].copy(tmpD[i]).add(new THREE.Vector3(flyAway * 22, flyAway * 28, -flyAway * 30));
        }
      }

      const returnT = smoothstep(0.05, 0.92, t);
      sampleGlideCurve(
        tmpB,
        spineCount,
        elapsed,
        new THREE.Vector3(-8 + returnT * 8, 26 + returnT * 14, -6 - returnT * 16),
        new THREE.Vector3(-12 + returnT * 12, 22 + returnT * 12, -14 - returnT * 10),
        new THREE.Vector3(-6 + returnT * 6, 20 + returnT * 8, -20 - returnT * 6),
        new THREE.Vector3(0, 18 + returnT * 6, -25),
        1.1
      );
      blendSpines(redPts, tmpB, tmpA, smoothstep(0.45, 0.98, t));

      camPos.set(0, lerp(13.0, 8.4, t), lerp(44.5, 47.5, t));
      camTarget.set(0, lerp(25.0, 18.2, t), -15.0);
    }

    // Add subtle manual roar shake if triggered
    if (manualRoar > 0.05) {
      camPos.x += Math.sin(elapsed * 31) * manualRoar * 0.16;
      camPos.y += Math.cos(elapsed * 29) * manualRoar * 0.12;
    }

    return {
      actIdx,
      actChanged,
      act: ACTS[actIdx],
      redPts,
      whitePts,
      whiteVisible,
      redJaw,
      redThroat,
      whiteJaw,
      whiteThroat,
      clashIntensity,
      manualRoar,
      stormFactor,
      rainIntensity,
      windStrength,
      dawnGlow,
      lightningIntensity,
      lightningPos,
      triggeredThunder,
      outSunDir,
      outSunColor,
      outSkyZenith,
      outSkyHorizon,
      outCloudSun,
      outCloudShadow,
      outFogColor,
      outMistColor,
      camPos,
      camTarget
    };
  }

  return {
    update,
    triggerRoar,
    getActIndex
  };
}
