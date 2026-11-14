/**
 * 100% Procedural Web Audio API soundscape:
 * - Stereo valley reverb impulse response
 * - Pentatonic Guzheng plucked strings & breathy Dizi bamboo flute
 * - Taiko war drums & storm thunder cracks
 * - Continuous waterfall roar, mountain wind & rain
 * - Layered formant-swept Dragon Roar & Elemental Clash resonance
 */
export function createSoundEngine() {
  let ctx = null;
  let masterGain = null;
  let reverbNode = null;
  let windGain = null;
  let windFilter = null;
  let rainGain = null;
  let clashGain = null;
  let clashOsc = null;

  let enabled = false;
  let paused = false;
  let noteTimer = 0;
  let stepIndex = 0;

  const calmScale = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25, 739.99, 880.0];
  const stormScale = [293.66, 349.23, 392.0, 440.0, 523.25, 587.33, 698.46, 783.99];
  const melodyPattern = [0, 2, 4, 5, 4, 2, 1, 3, 5, 6, 5, 4, 2, 1, 0, 2];

  function createNoiseBuffer(audioCtx, seconds = 3.0, pink = true) {
    const length = Math.floor(audioCtx.sampleRate * seconds);
    const buffer = audioCtx.createBuffer(2, length, audioCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        if (pink) {
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.07;
          b6 = white * 0.115926;
        } else {
          data[i] = white;
        }
      }
    }
    return buffer;
  }

  function createReverbImpulse(audioCtx, duration = 2.6) {
    const length = Math.floor(audioCtx.sampleRate * duration);
    const impulse = audioCtx.createBuffer(2, length, audioCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.4);
      }
    }
    return impulse;
  }

  function init() {
    if (ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    ctx = new AudioCtx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.0001;
    masterGain.connect(ctx.destination);

    reverbNode = ctx.createConvolver();
    reverbNode.buffer = createReverbImpulse(ctx, 2.5);
    const revGain = ctx.createGain();
    revGain.gain.value = 0.38;
    reverbNode.connect(revGain);
    revGain.connect(masterGain);

    const pinkNoise = createNoiseBuffer(ctx, 4.0, true);

    // Continuous Waterfall + Canyon Wind Bed
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = pinkNoise;
    windSrc.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 340;
    windFilter.Q.value = 0.65;
    windGain = ctx.createGain();
    windGain.gain.value = 0.14;
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(masterGain);
    windSrc.start();

    // Storm Rain Bed
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = createNoiseBuffer(ctx, 3.0, false);
    rainSrc.loop = true;
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 2100;
    rainFilter.Q.value = 0.55;
    rainGain = ctx.createGain();
    rainGain.gain.value = 0.0;
    rainSrc.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(masterGain);
    rainSrc.start();

    // Beam Clash Sub-Harmonic Hum
    clashOsc = ctx.createOscillator();
    clashOsc.type = 'sawtooth';
    clashOsc.frequency.value = 73.42;
    const clashFilter = ctx.createBiquadFilter();
    clashFilter.type = 'lowpass';
    clashFilter.frequency.value = 320;
    clashGain = ctx.createGain();
    clashGain.gain.value = 0.0;
    clashOsc.connect(clashFilter);
    clashFilter.connect(clashGain);
    clashGain.connect(masterGain);
    clashGain.connect(reverbNode);
    clashOsc.start();
  }

  function playGuzhengNote(freq, gainVal = 0.09) {
    if (!ctx || !enabled) return;
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq * 2.0, now);

    // Subtle traditional string pitch bend on attack
    osc1.frequency.exponentialRampToValueAtTime(freq * 1.008, now + 0.04);
    osc1.frequency.exponentialRampToValueAtTime(freq, now + 0.28);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 6.5, now);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.4, now + 1.8);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(gainVal, now + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(env);
    env.connect(masterGain);
    env.connect(reverbNode);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 2.5);
    osc2.stop(now + 2.5);
  }

  function playDiziNote(freq, duration = 1.6) {
    if (!ctx || !enabled) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 0.985, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.14);

    // Gentle bamboo flute vibrato
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 5.2;
    lfoGain.gain.value = freq * 0.012;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.045, now + 0.25);
    env.gain.setValueAtTime(0.042, now + duration - 0.35);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(env);
    env.connect(masterGain);
    env.connect(reverbNode);

    osc.start(now);
    lfo.start(now);
    osc.stop(now + duration + 0.05);
    lfo.stop(now + duration + 0.05);
  }

  function playTaiko() {
    if (!ctx || !enabled) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(112, now);
    osc.frequency.exponentialRampToValueAtTime(44, now + 0.38);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.22, now + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);

    osc.connect(env);
    env.connect(masterGain);
    env.connect(reverbNode);
    osc.start(now);
    osc.stop(now + 1.0);
  }

  function playThunder() {
    if (!ctx || !enabled) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = createNoiseBuffer(ctx, 2.8, true);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(750, now);
    filter.frequency.exponentialRampToValueAtTime(85, now + 2.4);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.32, now + 0.06);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 2.7);

    src.connect(filter);
    filter.connect(env);
    env.connect(masterGain);
    env.connect(reverbNode);
    src.start(now);
    src.stop(now + 2.8);
  }

  function playDragonRoar() {
    if (!ctx || !enabled) return;
    const now = ctx.currentTime;

    // Deep resonant roar carrier + FM growl
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    carrier.type = 'sawtooth';
    mod.type = 'triangle';
    carrier.frequency.setValueAtTime(108, now);
    carrier.frequency.exponentialRampToValueAtTime(52, now + 2.3);
    mod.frequency.setValueAtTime(34, now);
    modGain.gain.value = 46;

    mod.connect(modGain);
    modGain.connect(carrier.frequency);

    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.Q.value = 2.6;
    formant.frequency.setValueAtTime(360, now);
    formant.frequency.exponentialRampToValueAtTime(135, now + 2.2);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.24, now + 0.22);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

    carrier.connect(formant);
    formant.connect(env);
    env.connect(masterGain);
    env.connect(reverbNode);

    carrier.start(now);
    mod.start(now);
    carrier.stop(now + 2.6);
    mod.stop(now + 2.6);
  }

  function setEnabled(flag) {
    init();
    enabled = flag;
    if (!ctx) return false;
    if (enabled && ctx.state === 'suspended') {
      ctx.resume();
    }
    const target = enabled && !paused ? 0.85 : 0.0001;
    masterGain.gain.setTargetAtTime(target, ctx.currentTime, 0.25);
    return enabled;
  }

  function setPaused(p) {
    paused = p;
    if (!ctx || !masterGain) return;
    const target = enabled && !paused ? 0.85 : 0.0001;
    masterGain.gain.setTargetAtTime(target, ctx.currentTime, 0.15);
  }

  function update(dt, state) {
    if (!ctx || !enabled || paused) return;

    const now = ctx.currentTime;
    windGain.gain.setTargetAtTime(0.11 + state.stormFactor * 0.12, now, 0.3);
    windFilter.frequency.setTargetAtTime(320 + state.windStrength * 160, now, 0.3);
    rainGain.gain.setTargetAtTime(state.rainIntensity * 0.18, now, 0.25);
    clashGain.gain.setTargetAtTime(state.clashIntensity * 0.14, now, 0.08);
    clashOsc.frequency.setTargetAtTime(73.42 + state.clashIntensity * 22.0, now, 0.1);

    if (state.triggeredThunder) {
      playThunder();
    }

    // Procedural Pentatonic Score Sequencer
    const interval = state.stormFactor > 0.45 ? 0.46 : 0.72;
    noteTimer += dt;
    if (noteTimer >= interval) {
      noteTimer -= interval;
      const scale = state.stormFactor > 0.45 ? stormScale : calmScale;
      const degree = melodyPattern[stepIndex % melodyPattern.length];
      const freq = scale[degree % scale.length];

      playGuzhengNote(freq, state.stormFactor > 0.45 ? 0.075 : 0.09);

      if (stepIndex % 4 === 0 && state.stormFactor < 0.65) {
        playDiziNote(scale[(degree + 4) % scale.length] * 2, 1.8);
      }
      if (state.stormFactor > 0.45 && stepIndex % 2 === 0) {
        playTaiko();
      }
      stepIndex++;
    }
  }

  return {
    isEnabled: () => enabled,
    setEnabled,
    setPaused,
    playDragonRoar,
    update
  };
}
