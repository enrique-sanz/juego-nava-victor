/* ============================================
   El Día Biwenger — Lógica de juego
   Pantalla 1: Bienvenida
   Pantalla 2: Instrucciones
   ============================================ */

(() => {
  'use strict';

  // ---------- Estado del juego ----------
  const state = {
    selectedCharacter: null, // 'victor' | 'nava'
  };

  // ---------- Navegación entre pantallas ----------
  const screens = {
    welcome: document.getElementById('welcome-screen'),
    instructions: document.getElementById('instructions-screen'),
    select: document.getElementById('select-screen'),
  };

  function showScreen(name) {
    Object.values(screens).forEach(s => s && s.classList.remove('active'));
    if (screens[name]) screens[name].classList.add('active');
  }

  // ---------- Sonidos retro (WebAudio) ----------
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    return audioCtx;
  }

  function beep(freq = 440, duration = 0.08, type = 'square', volume = 0.1) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  function playStartSound() {
    beep(523, 0.1);
    setTimeout(() => beep(659, 0.1), 90);
    setTimeout(() => beep(784, 0.15), 180);
  }

  function playClickSound() {
    beep(660, 0.05, 'square', 0.08);
  }

  // ---------- Listeners ----------
  function bindButton(id, handler) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      handler();
    });
  }

  bindButton('start-btn', () => {
    playStartSound();
    showScreen('instructions');
  });

  bindButton('continue-btn', () => {
    playClickSound();
    showScreen('select');
  });

  bindButton('back-btn', () => {
    playClickSound();
    showScreen('welcome');
  });

  bindButton('select-back-btn', () => {
    playClickSound();
    showScreen('instructions');
  });

  // ---------- Selección de personaje ----------
  const NAMES = { victor: 'VICTOR', nava: 'NAVA' };
  const playBtn = document.getElementById('play-btn');
  const selectedNameEl = document.getElementById('selected-name');
  const cards = document.querySelectorAll('.char-card');

  function selectCharacter(id) {
    state.selectedCharacter = id;
    cards.forEach(c => c.classList.toggle('selected', c.dataset.character === id));
    if (selectedNameEl) selectedNameEl.textContent = NAMES[id] || '---';
    if (playBtn) playBtn.disabled = false;
    beep(740, 0.06, 'square', 0.1);
    setTimeout(() => beep(880, 0.08, 'square', 0.1), 60);
  }

  cards.forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      selectCharacter(card.dataset.character);
    });
  });

  bindButton('play-btn', () => {
    if (!state.selectedCharacter) return;
    playStartSound();
    // Aquí se enlazará con el primer nivel del juego (próximo paso)
    alert('¡' + NAMES[state.selectedCharacter] + ' listo! Primer nivel en construcción.');
  });
})();
