/* ============================================
   El Día Biwenger — Lógica de juego
   Pantalla 1: Bienvenida
   Pantalla 2: Instrucciones
   ============================================ */

(() => {
  'use strict';

  // ---------- Paleta pixel-art ----------
  const PALETTE = {
    '.': null,                // transparente
    'H': '#2a1810',           // pelo oscuro
    'h': '#3d2a1a',           // pelo corto/cuero cabelludo
    'S': '#f4c89e',           // piel base
    's': '#d4a578',           // piel sombra
    'e': '#1a0e08',           // ojo cerrado
    'n': '#c89878',           // sombra de nariz
    'm': '#7a2828',           // boca
    'B': '#1a0e08',           // barba oscura
    'b': '#3d2418',           // barba media
    'J': '#0e0e1f',           // chaqueta negra
    'j': '#1f1f3a',           // chaqueta highlight
    'K': '#d4b896',           // jersey beige
    'k': '#a89070',           // jersey sombra
    'P': '#5a3a7a',           // morado manta
    'R': '#7a2222',           // rojo sofá
    'W': '#0a0a0a',           // correa reloj
    'w': '#3a4a5a',           // pantalla reloj
    'O': '#fce200',           // detalle amarillo
  };

  // ---------- Sprites ----------
  // Personaje 1: Víctor (barba + jersey beige)
  const SPRITE_VICTOR = [
    '................',
    '.....HHHHHHH....',
    '....HHHHHHHHH...',
    '...HHHHHHHHHHH..',
    '..HHHSSSSSSSHH..',
    '..HHSSSSSSSSSH..',
    '..HHSSSSSSSSSH..',
    '..HHSeeSSSSeeS..',
    '..HSSSSSSSSSSS..',
    '..HSSSSnnSSSSS..',
    '..HSSSBmmBSSSS..',
    '..HSBBBBBBBBSS..',
    '...BBBBBBBBBB...',
    '...JJJJJJJJJJ...',
    '..JKKKKKKKKKKJ..',
    '.JKKKKKKKKKKKKJ.',
    '.JKKKKKKKKKKKKJ.',
    '.JKKKKKKKKKKKKJ.',
    '.JKKKKKKKKKKKKJ.',
    '..JJJJJJJJJJJJ..',
  ];

  // Personaje 2: Nava (pelo corto + smartwatch)
  const SPRITE_NAVA = [
    '................',
    '......hhhhh.....',
    '.....hhhhhhh....',
    '....hhSSSSShh...',
    '...hSSSSSSSSh...',
    '..hSSSSSSSSSSh..',
    '..SSSSSSSSSSSS..',
    '..SSeeSSSSeeSS..',
    '..SSSSSSSSSSSS..',
    '..SSSSnnSSSSSS..',
    '..SSSBmmBSSSSS..',
    '..SSBBBBBBSSSS..',
    '...BBBBBBBBSS...',
    '...JJJJJJJJJJ...',
    '..JJJJJJJJJJJJ..',
    '.JJJJJJJJJJJJJJ.',
    '.JWwJJJJJJJJJJJ.',
    '.JJJJJJJJJJJJJJ.',
    '.JJJJJJJJJJJJJJ.',
    '..JJJJJJJJJJJJ..',
  ];

  /** Dibuja un sprite en un canvas */
  function drawSprite(canvas, sprite, scale) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const offsetX = Math.floor((canvas.width - sprite[0].length * scale) / 2);
    const offsetY = Math.floor((canvas.height - sprite.length * scale) / 2);

    for (let y = 0; y < sprite.length; y++) {
      for (let x = 0; x < sprite[y].length; x++) {
        const ch = sprite[y][x];
        const color = PALETTE[ch];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(offsetX + x * scale, offsetY + y * scale, scale, scale);
      }
    }
  }

  /** Calcula la escala adecuada para encajar el sprite en el canvas */
  function fitScale(canvas, sprite) {
    const sx = Math.floor(canvas.width / sprite[0].length);
    const sy = Math.floor(canvas.height / sprite.length);
    return Math.max(1, Math.min(sx, sy));
  }

  // ---------- Render personajes ----------
  function renderCharacters() {
    const c1 = document.getElementById('char1');
    const c2 = document.getElementById('char2');
    const ci = document.getElementById('char-icon');

    if (c1) drawSprite(c1, SPRITE_VICTOR, fitScale(c1, SPRITE_VICTOR));
    if (c2) drawSprite(c2, SPRITE_NAVA, fitScale(c2, SPRITE_NAVA));
    if (ci) drawSprite(ci, SPRITE_VICTOR, fitScale(ci, SPRITE_VICTOR));
  }

  // ---------- Navegación entre pantallas ----------
  const screens = {
    welcome: document.getElementById('welcome-screen'),
    instructions: document.getElementById('instructions-screen'),
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
    // Aquí se enlazará con el primer nivel del juego (próximo paso)
    alert('Siguiente pantalla en construcción. ¡Pronto!');
  });

  bindButton('back-btn', () => {
    playClickSound();
    showScreen('welcome');
  });

  // ---------- Init ----------
  function init() {
    renderCharacters();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // re-render si la ventana cambia (orientación)
  window.addEventListener('resize', renderCharacters);
})();
