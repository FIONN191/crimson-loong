import * as THREE from 'three';
import { fbm2, ridged2, mulberry32, clamp } from '../utils/noise.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finalizeTexture(canvas, {
  repeatX = 1,
  repeatY = 1,
  srgb = true,
  wrap = THREE.RepeatWrapping,
  anisotropy = 8
} = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = wrap;
  tex.wrapT = wrap;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Stratified Zhangjiajie karst limestone/sandstone rock albedo + bump map.
 */
export function createRockTextures() {
  const size = 512;
  const albedoC = makeCanvas(size, size);
  const bumpC = makeCanvas(size, size);
  const aCtx = albedoC.getContext('2d');
  const bCtx = bumpC.getContext('2d');
  const aImg = aCtx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Seamless periodic sampling via trig wrapping
      const nx = Math.cos(u * Math.PI * 2) * 1.6;
      const nz = Math.sin(u * Math.PI * 2) * 1.6;

      const macro = fbm2(nx * 2.2 + 4.1, v * 5.0 + nz * 0.8, 5);
      const strata = Math.sin(v * 68.0 + macro * 6.5 + fbm2(nx * 4.5, v * 12.0, 3) * 3.0);
      const cracks = ridged2(nx * 3.8 + 11.3, v * 16.0 + nz * 1.4, 4);
      const verticalDrip = fbm2(nx * 9.5 + 2.7, v * 2.4, 3);
      const mossMask = clamp((fbm2(nx * 3.4 - 5.2, v * 4.8 + 3.1, 4) * 0.5 + 0.5 - 0.52) * 3.8, 0, 1);

      const shade = 0.52 + macro * 0.24 + strata * 0.09 - (1 - cracks) * 0.16;
      const dripDark = clamp(verticalDrip * 0.5 + 0.5, 0, 1);

      // Warm sandstone-limestone palette with weathered crevices and moss patches
      let r = clamp((132 * shade - dripDark * 26) * 1.04, 22, 230);
      let g = clamp((122 * shade - dripDark * 22) * 1.01, 22, 220);
      let b = clamp((109 * shade - dripDark * 18) * 0.98, 22, 208);

      // Mineral rust / iron hints on strata ledges
      const iron = clamp((strata - 0.35) * 0.6, 0, 1);
      r += iron * 22;
      g += iron * 9;

      // Subtle emerald-olive cliff moss
      if (mossMask > 0.05) {
        const m = mossMask * 0.58;
        r = r * (1 - m) + 56 * m;
        g = g * (1 - m) + 92 * m;
        b = b * (1 - m) + 42 * m;
      }

      const idx = (y * size + x) * 4;
      aImg.data[idx] = r;
      aImg.data[idx + 1] = g;
      aImg.data[idx + 2] = b;
      aImg.data[idx + 3] = 255;

      const hVal = clamp((0.5 + strata * 0.22 + (cracks - 0.5) * 0.45 + macro * 0.25) * 255, 0, 255);
      bImg.data[idx] = hVal;
      bImg.data[idx + 1] = hVal;
      bImg.data[idx + 2] = hVal;
      bImg.data[idx + 3] = 255;
    }
  }
  aCtx.putImageData(aImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  return {
    map: finalizeTexture(albedoC, { repeatX: 2, repeatY: 3, srgb: true }),
    bumpMap: finalizeTexture(bumpC, { repeatX: 2, repeatY: 3, srgb: false })
  };
}

/**
 * Mossy lakeside earth & weathered stone-flecked ground texture.
 */
export function createMossGroundTextures() {
  const size = 512;
  const albedoC = makeCanvas(size, size);
  const bumpC = makeCanvas(size, size);
  const aCtx = albedoC.getContext('2d');
  const bCtx = bumpC.getContext('2d');
  const aImg = aCtx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const n1 = fbm2(u * 8.0, v * 8.0, 5);
      const n2 = fbm2(u * 22.0 + 9.2, v * 22.0 + 3.4, 3);
      const pebbles = ridged2(u * 14.0, v * 14.0, 3);

      const lush = clamp(n1 * 0.65 + 0.52, 0, 1);
      const r = clamp(54 + (1 - lush) * 52 + n2 * 16 + pebbles * 14, 18, 175);
      const g = clamp(72 + lush * 48 + n2 * 18 + pebbles * 10, 24, 180);
      const b = clamp(32 + (1 - lush) * 18 + n2 * 10, 12, 110);

      const idx = (y * size + x) * 4;
      aImg.data[idx] = r;
      aImg.data[idx + 1] = g;
      aImg.data[idx + 2] = b;
      aImg.data[idx + 3] = 255;

      const hVal = clamp((0.5 + n1 * 0.25 + n2 * 0.18 + (pebbles - 0.5) * 0.25) * 255, 0, 255);
      bImg.data[idx] = hVal;
      bImg.data[idx + 1] = hVal;
      bImg.data[idx + 2] = hVal;
      bImg.data[idx + 3] = 255;
    }
  }
  aCtx.putImageData(aImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  return {
    map: finalizeTexture(albedoC, { repeatX: 6, repeatY: 6, srgb: true }),
    bumpMap: finalizeTexture(bumpC, { repeatX: 6, repeatY: 6, srgb: false })
  };
}

/**
 * Overlapping iridescent Chinese dragon scale texture + sharp bump/roughness maps.
 * Supports 'crimson' (vermilion lacquer + gold rim) and 'frost' (pearl ice-azure).
 */
export function createDragonScaleTextures(variant = 'crimson') {
  const size = 512;
  const albedoC = makeCanvas(size, size);
  const bumpC = makeCanvas(size, size);
  const roughC = makeCanvas(size, size);

  const aCtx = albedoC.getContext('2d');
  const bCtx = bumpC.getContext('2d');
  const rCtx = roughC.getContext('2d');

  const isCrimson = variant === 'crimson';
  aCtx.fillStyle = isCrimson ? '#4b0908' : '#7ea3c4';
  aCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#202020';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#909090';
  rCtx.fillRect(0, 0, size, size);

  const cols = 14;
  const rows = 18;
  const cellW = size / cols;
  const cellH = size / rows;
  const rng = mulberry32(isCrimson ? 108 : 209);

  for (let row = -1; row <= rows + 1; row++) {
    const offsetX = (row % 2) * (cellW * 0.5);
    for (let col = -1; col <= cols + 1; col++) {
      // Tile seamlessly horizontally
      for (const wrapDx of [-size, 0, size]) {
        const cx = col * cellW + offsetX + wrapDx;
        const cy = row * cellH;
        if (cx < -cellW * 1.5 || cx > size + cellW * 1.5) continue;

        const rx = cellW * 0.58;
        const ry = cellH * 0.88;
        const jitter = (rng() - 0.5) * 0.08;

        // Albedo gradient per scale
        const grad = aCtx.createRadialGradient(cx, cy - ry * 0.18, ry * 0.08, cx, cy + ry * 0.1, ry);
        if (isCrimson) {
          grad.addColorStop(0, `rgb(${Math.round(248 + jitter * 40)}, ${Math.round(78 + jitter * 40)}, 42)`);
          grad.addColorStop(0.58, `rgb(${Math.round(188 + jitter * 30)}, 24, 22)`);
          grad.addColorStop(0.88, '#7a0d0e');
          grad.addColorStop(1, '#3d0607');
        } else {
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.5, '#d8eeff');
          grad.addColorStop(0.86, '#90bcdb');
          grad.addColorStop(1, '#5882a8');
        }

        aCtx.save();
        aCtx.beginPath();
        aCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        aCtx.fillStyle = grad;
        aCtx.fill();

        // Subtle rim highlight along lower edge of scale
        aCtx.strokeStyle = isCrimson ? 'rgba(255, 194, 110, 0.32)' : 'rgba(220, 248, 255, 0.65)';
        aCtx.lineWidth = 1.6;
        aCtx.stroke();
        aCtx.restore();

        // Central keel ridge inside each scale
        aCtx.save();
        aCtx.beginPath();
        aCtx.moveTo(cx, cy - ry * 0.55);
        aCtx.lineTo(cx, cy + ry * 0.72);
        aCtx.strokeStyle = isCrimson ? 'rgba(255, 150, 90, 0.25)' : 'rgba(255, 255, 255, 0.45)';
        aCtx.lineWidth = 1.5;
        aCtx.stroke();
        aCtx.restore();

        // Bump map dome + keel
        const bGrad = bCtx.createRadialGradient(cx, cy - ry * 0.12, 1, cx, cy, ry);
        bGrad.addColorStop(0, '#f2f2f2');
        bGrad.addColorStop(0.65, '#a8a8a8');
        bGrad.addColorStop(0.95, '#3a3a3a');
        bGrad.addColorStop(1, '#121212');
        bCtx.beginPath();
        bCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        bCtx.fillStyle = bGrad;
        bCtx.fill();

        bCtx.beginPath();
        bCtx.moveTo(cx, cy - ry * 0.45);
        bCtx.lineTo(cx, cy + ry * 0.72);
        bCtx.strokeStyle = '#ffffff';
        bCtx.lineWidth = 2.0;
        bCtx.stroke();

        // Smooth glossy center, rougher edge crevice
        const rGrad = rCtx.createRadialGradient(cx, cy - ry * 0.15, 1, cx, cy, ry);
        rGrad.addColorStop(0, isCrimson ? '#3e3e3e' : '#2a2a2a');
        rGrad.addColorStop(0.75, '#666666');
        rGrad.addColorStop(1, '#d8d8d8');
        rCtx.beginPath();
        rCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        rCtx.fillStyle = rGrad;
        rCtx.fill();
      }
    }
  }

  return {
    map: finalizeTexture(albedoC, { repeatX: 2.5, repeatY: 16, srgb: true }),
    bumpMap: finalizeTexture(bumpC, { repeatX: 2.5, repeatY: 16, srgb: false }),
    roughnessMap: finalizeTexture(roughC, { repeatX: 2.5, repeatY: 16, srgb: false })
  };
}

/**
 * Ribbed traditional Chinese glazed dark-slate/charcoal ceramic roof tiles.
 */
export function createRoofTileTextures() {
  const w = 256;
  const h = 256;
  const albedoC = makeCanvas(w, h);
  const bumpC = makeCanvas(w, h);
  const aCtx = albedoC.getContext('2d');
  const bCtx = bumpC.getContext('2d');

  const cols = 12;
  const rows = 8;
  const cw = w / cols;
  const rh = h / rows;

  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    for (let c = 0; c < cols; c++) {
      const x = c * cw;
      const g = aCtx.createLinearGradient(x, y, x + cw, y);
      g.addColorStop(0, '#1e1c1f');
      g.addColorStop(0.35, '#423b3c');
      g.addColorStop(0.65, '#2b2628');
      g.addColorStop(1, '#181517');
      aCtx.fillStyle = g;
      aCtx.fillRect(x, y, cw, rh);

      // Horizontal tile step shadow
      aCtx.fillStyle = 'rgba(10, 6, 7, 0.55)';
      aCtx.fillRect(x, y + rh - 3, cw, 3);
      aCtx.fillStyle = 'rgba(195, 165, 130, 0.14)';
      aCtx.fillRect(x, y, cw, 2);

      // Bump rib
      const bg = bCtx.createLinearGradient(x, y, x + cw, y);
      bg.addColorStop(0, '#333');
      bg.addColorStop(0.5, '#eee');
      bg.addColorStop(1, '#282828');
      bCtx.fillStyle = bg;
      bCtx.fillRect(x, y, cw, rh);
      bCtx.fillStyle = '#141414';
      bCtx.fillRect(x, y + rh - 3, cw, 3);
    }
  }

  return {
    map: finalizeTexture(albedoC, { repeatX: 4, repeatY: 2, srgb: true }),
    bumpMap: finalizeTexture(bumpC, { repeatX: 4, repeatY: 2, srgb: false })
  };
}

/**
 * Warm glowing Chinese wooden lattice window screen (albedo + emissiveMap).
 */
export function createShojiLatticeTextures() {
  const size = 256;
  const mapC = makeCanvas(size, size);
  const emC = makeCanvas(size, size);
  const mCtx = mapC.getContext('2d');
  const eCtx = emC.getContext('2d');

  // Warm paper glow
  const pGrad = mCtx.createRadialGradient(size * 0.5, size * 0.5, 10, size * 0.5, size * 0.5, size * 0.72);
  pGrad.addColorStop(0, '#ffe4a8');
  pGrad.addColorStop(0.6, '#f4b562');
  pGrad.addColorStop(1, '#c97834');
  mCtx.fillStyle = pGrad;
  mCtx.fillRect(0, 0, size, size);

  const eGrad = eCtx.createRadialGradient(size * 0.5, size * 0.5, 10, size * 0.5, size * 0.5, size * 0.72);
  eGrad.addColorStop(0, '#ffdf9a');
  eGrad.addColorStop(0.7, '#ea9b42');
  eGrad.addColorStop(1, '#8a4416');
  eCtx.fillStyle = eGrad;
  eCtx.fillRect(0, 0, size, size);

  // Dark lacquered wooden lattice bars
  const drawGrid = (ctx, barColor) => {
    ctx.strokeStyle = barColor;
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, size - 8, size - 8);
    ctx.lineWidth = 4;
    const steps = 6;
    for (let i = 1; i < steps; i++) {
      const p = (i / steps) * size;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
    // Decorative inner corner motif
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, size - 48, size - 48);
  };

  drawGrid(mCtx, '#2c110d');
  drawGrid(eCtx, '#090302');

  return {
    map: finalizeTexture(mapC, { repeatX: 1, repeatY: 1, srgb: true }),
    emissiveMap: finalizeTexture(emC, { repeatX: 1, repeatY: 1, srgb: true })
  };
}

/**
 * Ornate gilded calligraphy signboard plaque reading "赤 龍" for the Shanmen gate.
 */
export function createPlaqueTexture(title = '赤 龍') {
  const w = 512;
  const h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');

  // Deep obsidian lacquer background
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1e090a');
  bg.addColorStop(0.5, '#0e0405');
  bg.addColorStop(1, '#1a0708');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Ornate gilded double border
  ctx.strokeStyle = '#d9a44c';
  ctx.lineWidth = 14;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.strokeStyle = '#ffdf92';
  ctx.lineWidth = 3;
  ctx.strokeRect(26, 26, w - 52, h - 52);

  // Corner studs
  for (const [sx, sy] of [[34, 34], [w - 34, 34], [34, h - 34], [w - 34, h - 34]]) {
    ctx.fillStyle = '#ffd57e';
    ctx.beginPath();
    ctx.arc(sx, sy, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Glowing imperial gold calligraphy
  ctx.save();
  ctx.shadowColor = 'rgba(255, 195, 76, 0.85)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ffdf88';
  ctx.font = 'bold 132px "Songti SC", "STSong", "Noto Serif SC", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, w / 2, h / 2 + 6);
  ctx.restore();

  return finalizeTexture(c, { repeatX: 1, repeatY: 1, srgb: true, wrap: THREE.ClampToEdgeWrapping });
}

/**
 * Crisp 5-lobed Chinese autumn maple leaf sprite (alpha cutout + vein shading).
 */
export function createMapleLeafTexture() {
  const size = 256;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const cx = size * 0.5;
  const cy = size * 0.56;

  // Draw 5 crisp pointed lobes around base
  const lobes = [
    { angle: -Math.PI * 0.5, len: 108, width: 28 },      // Center top
    { angle: -Math.PI * 0.5 - 0.72, len: 92, width: 25 }, // Upper left
    { angle: -Math.PI * 0.5 + 0.72, len: 92, width: 25 }, // Upper right
    { angle: -Math.PI * 0.5 - 1.42, len: 62, width: 20 }, // Lower left
    { angle: -Math.PI * 0.5 + 1.42, len: 62, width: 20 }  // Lower right
  ];

  // Radial bright white-cream base so instance colors tint cleanly
  const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy - 20, 118);
  grad.addColorStop(0, '#fff7e8');
  grad.addColorStop(0.55, '#ffffff');
  grad.addColorStop(1, '#dedede');
  ctx.fillStyle = grad;

  for (const lobe of lobes) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(lobe.angle + Math.PI * 0.5);
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.bezierCurveTo(-lobe.width, -lobe.len * 0.25, -lobe.width * 0.72, -lobe.len * 0.72, 0, -lobe.len);
    ctx.bezierCurveTo(lobe.width * 0.72, -lobe.len * 0.72, lobe.width, -lobe.len * 0.25, 0, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Central palm + stem
  ctx.beginPath();
  ctx.arc(cx, cy - 8, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#c8c8c8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 4);
  ctx.lineTo(cx, cy + 42);
  ctx.stroke();

  // Subtle leaf veins
  ctx.strokeStyle = 'rgba(130, 80, 60, 0.28)';
  ctx.lineWidth = 2;
  for (const lobe of lobes) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(lobe.angle) * lobe.len * 0.78, cy + Math.sin(lobe.angle) * lobe.len * 0.78);
    ctx.stroke();
  }

  return finalizeTexture(c, { repeatX: 1, repeatY: 1, srgb: true, wrap: THREE.ClampToEdgeWrapping });
}

/**
 * Layered evergreen mountain pine needle fan spray sprite (alpha cutout).
 */
export function createPineClusterTexture() {
  const size = 256;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const rng = mulberry32(4242);
  const clusters = [
    [128, 128, 62],
    [76, 134, 48],
    [180, 136, 48],
    [100, 94, 46],
    [156, 96, 46]
  ];

  for (const [cx, cy, radius] of clusters) {
    const needles = 46;
    for (let i = 0; i < needles; i++) {
      const a = (i / needles) * Math.PI * 2 + (rng() - 0.5) * 0.12;
      const len = radius * (0.62 + rng() * 0.45);
      const ex = cx + Math.cos(a) * len;
      const ey = cy + Math.sin(a) * len * 0.78;
      const g = ctx.createLinearGradient(cx, cy, ex, ey);
      g.addColorStop(0, '#182b18');
      g.addColorStop(0.65, '#2b4d28');
      g.addColorStop(1, '#587c38');
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
  }

  return finalizeTexture(c, { repeatX: 1, repeatY: 1, srgb: true, wrap: THREE.ClampToEdgeWrapping });
}

/**
 * Soft gaussian mist / cloud sprite for valley mist & waterfall spray.
 */
export function createSoftMistTexture() {
  const size = 256;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const ny = (y / size) * 2 - 1;
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * 2 - 1;
      const r = Math.hypot(nx, ny);
      const n = fbm2(nx * 2.5 + 3.1, ny * 2.5 - 1.7, 4) * 0.25;
      const falloff = clamp(1 - Math.pow(clamp(r + n * 0.35, 0, 1), 1.8), 0, 1);
      const alpha = Math.pow(falloff, 1.55) * 255;
      const idx = (y * size + x) * 4;
      img.data[idx] = 255;
      img.data[idx + 1] = 255;
      img.data[idx + 2] = 255;
      img.data[idx + 3] = alpha;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finalizeTexture(c, { repeatX: 1, repeatY: 1, srgb: true, wrap: THREE.ClampToEdgeWrapping });
}

/**
 * Crisp glowing radial spark / lantern halo sprite.
 */
export function createSparkTexture() {
  const size = 128;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.22, 'rgba(255,244,210,0.85)');
  g.addColorStop(0.55, 'rgba(255,180,100,0.22)');
  g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finalizeTexture(c, { repeatX: 1, repeatY: 1, srgb: true, wrap: THREE.ClampToEdgeWrapping });
}
