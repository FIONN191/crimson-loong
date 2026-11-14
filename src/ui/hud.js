import { ACTS, TOTAL_CYCLE_SECONDS } from '../scene/director.js';

export function createHUD({
  onToggleSound,
  onTogglePause,
  onToggleOrbit,
  onCycleVista,
  onTriggerRoar,
  onToggleQuality,
  onSelectAct,
  onScrub
}) {
  const loader = document.getElementById('loader');
  const loaderStatus = document.getElementById('loader-status');
  const soundBtn = document.getElementById('sound-btn');
  const soundLabel = document.getElementById('sound-label');
  const actNum = document.getElementById('act-num');
  const actTitle = document.getElementById('act-title');
  const timelineFill = document.getElementById('timeline-fill');
  const timelineScrub = document.getElementById('timeline-scrub');
  const pipBtns = Array.from(document.querySelectorAll('.act-pip'));

  const btnPause = document.getElementById('btn-pause');
  const btnCam = document.getElementById('btn-cam');
  const btnVista = document.getElementById('btn-vista');
  const btnRoar = document.getElementById('btn-roar');
  const btnQuality = document.getElementById('btn-quality');
  const btnHide = document.getElementById('btn-hide');

  let idleTimer = null;
  let zenMode = false;

  function wakeHUD() {
    document.body.classList.remove('hud-idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      document.body.classList.add('hud-idle');
    }, 4500);
  }

  window.addEventListener('pointermove', wakeHUD, { passive: true });
  window.addEventListener('pointerdown', wakeHUD, { passive: true });
  wakeHUD();

  soundBtn.addEventListener('click', () => onToggleSound());
  btnPause.addEventListener('click', () => onTogglePause());
  btnCam.addEventListener('click', () => onToggleOrbit());
  btnVista.addEventListener('click', () => onCycleVista());
  btnRoar.addEventListener('click', () => onTriggerRoar());
  btnQuality.addEventListener('click', () => onToggleQuality());
  btnHide.addEventListener('click', () => toggleZen());

  pipBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.act);
      onSelectAct(idx);
    });
  });

  timelineScrub.addEventListener('click', (e) => {
    const rect = timelineScrub.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onScrub(frac * TOTAL_CYCLE_SECONDS);
  });

  function toggleZen() {
    zenMode = !zenMode;
    document.body.classList.toggle('zen-mode', zenMode);
  }

  window.addEventListener('keydown', (e) => {
    wakeHUD();
    if (e.code === 'Space') {
      e.preventDefault();
      onTogglePause();
    } else if (e.key === 'm' || e.key === 'M') {
      onToggleSound();
    } else if (e.key === 'o' || e.key === 'O') {
      onToggleOrbit();
    } else if (e.key === 'v' || e.key === 'V') {
      onCycleVista();
    } else if (e.key === 'f' || e.key === 'F') {
      onTriggerRoar();
    } else if (e.key === 'q' || e.key === 'Q') {
      onToggleQuality();
    } else if (e.key === 'h' || e.key === 'H') {
      toggleZen();
    } else if (e.key >= '1' && e.key <= '6') {
      onSelectAct(Number(e.key) - 1);
    }
  });

  return {
    setLoadStatus(text) {
      if (loaderStatus) loaderStatus.textContent = text;
    },
    hideLoader() {
      loader.classList.add('hidden');
    },
    setSoundUI(enabled, paused) {
      soundBtn.classList.toggle('active', enabled && !paused);
      if (paused) {
        soundLabel.textContent = 'paused';
      } else {
        soundLabel.textContent = enabled ? 'sound on' : 'click for sound';
      }
    },
    setPauseUI(paused) {
      btnPause.textContent = paused ? 'Resume' : 'Pause';
      btnPause.classList.toggle('active', paused);
    },
    setOrbitUI(orbitActive) {
      document.body.classList.toggle('orbit-active', orbitActive);
      btnCam.textContent = orbitActive ? 'Director' : 'Orbit';
      btnCam.classList.toggle('active', orbitActive);
    },
    setQualityUI(isUltra) {
      btnQuality.textContent = isUltra ? 'Ultra' : 'Balanced';
    },
    updateProgress(cycleT, actIdx) {
      const pct = (cycleT / TOTAL_CYCLE_SECONDS) * 100;
      timelineFill.style.width = `${pct.toFixed(2)}%`;

      const act = ACTS[actIdx];
      actNum.textContent = act.roman;
      actTitle.textContent = act.name;

      for (let i = 0; i < pipBtns.length; i++) {
        pipBtns[i].classList.toggle('active', i === actIdx);
      }
    }
  };
}
