/* ============================================
   El Día Biwenger — Lógica de juego
   Pantallas: Bienvenida → Instrucciones → Selección → Juego
   ============================================ */

(() => {
  'use strict';

  // ========================================================================
  // ESTADO Y CONSTANTES
  // ========================================================================
  const state = {
    selectedCharacter: null,    // 'victor' | 'nava'
    fullness: 0,                // 0-100, "BARRIGA"
    lives: 3,
    running: false,
    foods: [],                  // [{el, x, y, vx, vy, type, w, h}]
    lastSpawn: 0,
    spawnInterval: 1100,        // ms entre comidas (irá bajando)
    elapsedMs: 0,
    rafId: null,
    lastTime: 0,
    keys: { left: false, right: false },
    touch: { left: false, right: false },
    playerX: 0,                 // px, centro del jugador
    playerSpeed: 280,           // px/s
    eatTimer: 0,
  };

  const FACE_PATH = {
    victor: 'assets/victor-face.png',
    nava: 'assets/nava-face.png',
  };

  const NAMES = { victor: 'VICTOR', nava: 'NAVA' };

  // ========================================================================
  // NAVEGACIÓN ENTRE PANTALLAS
  // ========================================================================
  const screens = {
    welcome: document.getElementById('welcome-screen'),
    instructions: document.getElementById('instructions-screen'),
    select: document.getElementById('select-screen'),
    game: document.getElementById('game-screen'),
    game2: document.getElementById('game2-screen'),
    game3: document.getElementById('game3-screen'),
    game4: document.getElementById('game4-screen'),
    game5: document.getElementById('game5-screen'),
    'ending-win': document.getElementById('ending-win'),
    'ending-loss': document.getElementById('ending-loss'),
  };

  function showScreen(name) {
    Object.values(screens).forEach(s => s && s.classList.remove('active'));
    if (screens[name]) screens[name].classList.add('active');
  }

  // ========================================================================
  // SONIDOS RETRO (WebAudio)
  // ========================================================================
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
  function playClickSound() { beep(660, 0.05, 'square', 0.08); }
  function playEatSound()   { beep(880, 0.06, 'square', 0.12); setTimeout(() => beep(1175, 0.08, 'square', 0.1), 50); }
  function playMissSound()  { beep(180, 0.15, 'sawtooth', 0.12); }
  function playGameOver()   { beep(330, 0.2); setTimeout(() => beep(247, 0.2), 180); setTimeout(() => beep(196, 0.4), 360); }

  // ========================================================================
  // ICONOS EMOJI (estilo bitmoji)
  // ========================================================================
  const FOOD_EMOJI = {
    chuleton: '🥩',
    patatas: '🍟',
    calamar: '🦑',
    gamba: '🦐',
    hamburguesa: '🍔',
    pizza: '🍕',
    sangria: '🍷',
    cerveza: '🍺',
    pollo: '🍗',
    tarta: '🎂',
  };

  const OBSTACLE_EMOJI = {
    piedra: '🪨',
    charco: '💧',
    agujero: '🕳️',
    gato: '🐈',
    senal: '🚧',
    planta: '🪴',
  };

  /** Devuelve un <div> centrado mostrando un emoji al tamaño dado */
  function makeEmojiEl(emoji, sizePx) {
    const el = document.createElement('div');
    el.className = 'emoji-icon';
    el.style.fontSize = sizePx + 'px';
    el.style.lineHeight = '1';
    el.textContent = emoji;
    return el;
  }

  // ========================================================================
  // (Sprites pixel-art antiguos — preservados por compatibilidad)
  // ========================================================================
  const FOOD_PALETTE = {
    '.': null,
    '0': '#000000',
    '1': '#ffffff',
    '2': '#fce200', '3': '#ff8800', '4': '#ff3333', '5': '#aa1111',
    '6': '#7a4a2a', '7': '#5a2818', '8': '#3a1e10',
    '9': '#f4a880', 'a': '#d68855', 'b': '#b06030',
    'c': '#ffcc66', 'd': '#cc8833',
    'e': '#88dd55', 'f': '#226622',
    'g': '#ffeebb', 'h': '#cc9966',
    'i': '#ff77aa', 'j': '#cc4477',
    'k': '#aaaaaa', 'l': '#666666',
    'm': '#ffd700', 'n': '#dd2244',
    'o': '#993322', 'p': '#660011',
  };

  // 16x16 sprites — cada char es un índice de color
  const FOOD_SPRITES = {
    chuleton: [
      '................',
      '......111.......',
      '.....11k11......',
      '....1kkkk1......',
      '....1kkkk1......',
      '...77777777.....',
      '..7777777777....',
      '.7665566666677..',
      '.766665566677...',
      '.776655666677...',
      '.7766665666677..',
      '.7777666666677..',
      '..77666677777...',
      '...777777777....',
      '....77777.......',
      '................',
    ],
    patatas: [
      '................',
      '......22........',
      '....2.22.2......',
      '...22d2222.2....',
      '..2.222d22.2....',
      '..22dd2d22d2....',
      '...222222d22....',
      '....2dd22d22....',
      '....3333333.....',
      '...33333333.....',
      '...3lll3lll3....',
      '...3lll3lll3....',
      '...3lll3lll3....',
      '....333333......',
      '................',
      '................',
    ],
    calamar: [
      '................',
      '......eeee......',
      '.....eeeeee.....',
      '....ee0ee0ee....',
      '....eeeeeeee....',
      '.....eeeeee.....',
      '......eeee......',
      '.....e.ee.e.....',
      '....e..ee..e....',
      '...e..e.e..e....',
      '..e..e...e..e...',
      '.e..e.....e..e..',
      '....e.....e.....',
      '....e.....e.....',
      '.....e...e......',
      '................',
    ],
    gamba: [
      '................',
      '......i.........',
      '.....iii........',
      '....iiiii.......',
      '...iijjii.......',
      '...iijjjii......',
      '..iiijjiii......',
      '.iiiijjijii.....',
      '..iiiijjijii....',
      '...iiiijjijii...',
      '....iiiijjjii...',
      '.....iiiijjj....',
      '......iiiii.....',
      '.......iii......',
      '........i.......',
      '................',
    ],
    hamburguesa: [
      '................',
      '....ggggggg.....',
      '...gggcgcggg....',
      '..gggggcgcggg...',
      '..gggggggggg....',
      '..eeeeeeeeee....',
      '..oo7oo7oo7o....',
      '..oo777oo7oo....',
      '..ggggggggg.....',
      '..oo7777oo7.....',
      '..oo77oo7oo.....',
      '..hhhhhhhhh.....',
      '..hhhhhhhhh.....',
      '...hhhhhhh......',
      '................',
      '................',
    ],
    pizza: [
      '................',
      '......d.........',
      '.....ddd........',
      '....ddmd........',
      '...dd2mmd.......',
      '..ddmmnnmd......',
      '..d2mn2mmd......',
      '.dd2mmmmn2dd....',
      '.dddmnmmmm2d....',
      'ddc2mmm2nnmd....',
      'dddddddddddd....',
      '6666666666666...',
      '8888888888888...',
      '................',
      '................',
      '................',
    ],
    sangria: [
      '................',
      '..kkkkkkkkkk....',
      '..k.....k...k...',
      '..k.nnn.k...k...',
      '..k.nnn.k...k...',
      '..k.nnn.k...k...',
      '..kpnnnnk...k...',
      '..kpnnnnpk..k...',
      '..kpnnnnpk..k...',
      '..kppppppk..k...',
      '..kpppppppk.k...',
      '..kpppppppkk....',
      '..kkkkkkkkk.....',
      '...kkkkkkk......',
      '................',
      '................',
    ],
    cerveza: [
      '................',
      '..1111111111....',
      '..1111111111....',
      '..11111111111...',
      '..2222222222.k..',
      '..2c2c2c2c22.k..',
      '..2222222c2..k..',
      '..2c2222c222.k..',
      '..2222c22222.k..',
      '..2c2c22cc22.k..',
      '..2222222222.k..',
      '..d2d2d2d2dd....',
      '..ddddddddd.....',
      '...ddddddd......',
      '................',
      '................',
    ],
    pollo: [
      '................',
      '......dd........',
      '.....dccd.......',
      '....dccccd......',
      '...ddcccdd......',
      '...ddccdcd......',
      '...ddddddd......',
      '..ddddccdddd....',
      '.ddccccccddd....',
      '.dccccccccdd....',
      'ddccccccccccd...',
      'dcccdccdcccdd...',
      '.ddddddddddd....',
      '..ddddddddd.....',
      '...dddddd.......',
      '................',
    ],
    tarta: [
      '................',
      '.......2........',
      '......232.......',
      '......222.......',
      '.......1........',
      '.......1........',
      '..iiiiiiiiii....',
      '..i111iii11i....',
      '..iiiiiiiiii....',
      '..6c6c6c6c66....',
      '..66c66c66c6....',
      '..hh6h66h6h6....',
      '..hhhhhhhhhh....',
      '..kkkkkkkkkk....',
      '...kkkkkkkk.....',
      '................',
    ],
  };

  const FOOD_TYPES = Object.keys(FOOD_SPRITES);

  /** Renderiza un sprite a un canvas escalado */
  function renderFoodCanvas(spriteKey, scale = 4) {
    const sprite = FOOD_SPRITES[spriteKey];
    const w = sprite[0].length * scale;
    const h = sprite.length * scale;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < sprite.length; y++) {
      for (let x = 0; x < sprite[y].length; x++) {
        const ch = sprite[y][x];
        const color = FOOD_PALETTE[ch];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return canvas;
  }

  // ========================================================================
  // JUEGO: SPAWN, FÍSICA, COLISIÓN
  // ========================================================================
  // Valor según calorías: 1 (poco) a 5 (mucho). Tarta es especial: 10.
  const FOOD_VALUES = {
    gamba: 1,
    patatas: 2,
    calamar: 2,
    sangria: 3,
    cerveza: 3,
    hamburguesa: 4,
    pizza: 4,
    pollo: 4,
    chuleton: 5,
    tarta: 10,           // bonus
  };

  // Pesos de aparición (la tarta es rara)
  const FOOD_WEIGHTS = {
    gamba: 12, patatas: 12, calamar: 10,
    sangria: 10, cerveza: 10,
    hamburguesa: 10, pizza: 10, pollo: 10,
    chuleton: 8,
    tarta: 3,            // poco frecuente
  };

  const WEIGHTED_TYPES = (() => {
    const arr = [];
    for (const [k, w] of Object.entries(FOOD_WEIGHTS)) {
      for (let i = 0; i < w; i++) arr.push(k);
    }
    return arr;
  })();

  function pickFoodType() {
    return WEIGHTED_TYPES[Math.floor(Math.random() * WEIGHTED_TYPES.length)];
  }

  function getGameArea() { return document.getElementById('game-area'); }
  function getFoodLayer() { return document.getElementById('food-layer'); }
  function getPlayer() { return document.getElementById('player'); }
  function getJaw() { return document.getElementById('player-jaw'); }
  function getFullnessEl() { return document.getElementById('fullness'); }
  function getFullnessFill() { return document.getElementById('fullness-fill'); }
  function getLivesEl() { return document.getElementById('lives'); }
  function getOverlay() { return document.getElementById('game-overlay'); }

  function spawnFood() {
    const type = pickFoodType();
    const layer = getFoodLayer();
    const area = getGameArea();
    if (!layer || !area) return;

    const el = document.createElement('div');
    el.className = 'food-item';
    el.appendChild(makeEmojiEl(FOOD_EMOJI[type] || '🍴', 52));

    const w = 64, h = 64;
    const areaRect = area.getBoundingClientRect();
    // Spawn cerca del centro-arriba (donde está Jose) con dispersión horizontal
    const minX = 16;
    const maxX = areaRect.width - w - 16;
    const x = minX + Math.random() * (maxX - minX);
    const y = Math.max(140, areaRect.height * 0.18); // bajo Jose

    el.style.left = '0px';
    el.style.top = '0px';
    el.style.transform = `translate(${x}px, ${y}px)`;

    // velocidad inicial: dispersión horizontal aleatoria (rebotará en paredes)
    const baseSpeed = 140 + Math.min(180, state.elapsedMs / 1000 * 6);
    const vx = (Math.random() - 0.5) * 220;       // -110 a +110 px/s
    const vy = baseSpeed + Math.random() * 60;

    layer.appendChild(el);
    state.foods.push({ el, x, y, vx, vy, type, w, h, dead: false });
  }

  function updateFoods(dt) {
    const area = getGameArea();
    if (!area) return;
    const areaRect = area.getBoundingClientRect();

    const player = getPlayer();
    const playerRect = player ? player.getBoundingClientRect() : null;

    for (let i = state.foods.length - 1; i >= 0; i--) {
      const f = state.foods[i];
      if (f.dead) continue;

      f.x += f.vx * dt;
      f.y += f.vy * dt;
      // gravedad sutil
      f.vy += 60 * dt;

      // rebote en paredes laterales
      if (f.x <= 0) {
        f.x = 0;
        f.vx = Math.abs(f.vx);
      } else if (f.x + f.w >= areaRect.width) {
        f.x = areaRect.width - f.w;
        f.vx = -Math.abs(f.vx);
      }

      f.el.style.transform = `translate(${f.x}px, ${f.y}px)`;

      // colisión con la zona de la boca del jugador
      if (playerRect) {
        const fRect = {
          left: areaRect.left + f.x,
          top: areaRect.top + f.y,
          right: areaRect.left + f.x + f.w,
          bottom: areaRect.top + f.y + f.h,
        };
        // boca: 60-95% vertical de la cara, ancho central 60%
        const mouthLeft = playerRect.left + playerRect.width * 0.20;
        const mouthRight = playerRect.right - playerRect.width * 0.20;
        const mouthTop = playerRect.top + playerRect.height * 0.55;
        const mouthBottom = playerRect.top + playerRect.height * 0.92;
        const overlap =
          fRect.right > mouthLeft &&
          fRect.left < mouthRight &&
          fRect.bottom > mouthTop &&
          fRect.top < mouthBottom;

        if (overlap) {
          eatFood(f);
          continue;
        }
      }

      // fuera de pantalla por abajo: missed
      if (f.y > areaRect.height + 20) {
        missFood(f);
      }
    }
  }

  function eatFood(f) {
    f.dead = true;
    f.el.classList.add('caught');
    setTimeout(() => f.el.remove(), 250);
    const points = FOOD_VALUES[f.type] || 1;
    state.fullness = Math.min(100, state.fullness + points);
    showFloatingPoints(f.x + f.w / 2, f.y, points, f.type === 'tarta');
    updateHUD();
    triggerEatAnim();
    playEatSound();
    if (f.type === 'tarta') {
      // sonido especial para tarta
      setTimeout(() => beep(1568, 0.1, 'square', 0.12), 80);
    }
    if (state.fullness >= 100) endGame(true);
  }

  function showFloatingPoints(x, y, points, special) {
    const layer = getFoodLayer();
    if (!layer) return;
    const el = document.createElement('div');
    el.className = 'floating-points' + (special ? ' special' : '');
    el.textContent = '+' + points;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    layer.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  function missFood(f) {
    f.dead = true;
    f.el.classList.add('missed');
    setTimeout(() => f.el.remove(), 300);
    state.lives -= 1;
    updateHUD();
    playMissSound();
    if (state.lives <= 0) endGame(false);
  }

  function triggerEatAnim() {
    const jaw = getJaw();
    if (!jaw) return;
    jaw.classList.add('eating');
    state.eatTimer = 0.15; // segundos
  }

  function updateEatAnim(dt) {
    if (state.eatTimer > 0) {
      state.eatTimer -= dt;
      if (state.eatTimer <= 0) {
        const jaw = getJaw();
        if (jaw) jaw.classList.remove('eating');
      }
    }
  }

  function updateHUD() {
    const fn = getFullnessEl();
    if (fn) fn.textContent = String(state.fullness);
    const fill = getFullnessFill();
    if (fill) {
      fill.style.width = state.fullness + '%';
      fill.classList.toggle('full', state.fullness >= 100);
    }
    const l = getLivesEl();
    if (l) l.textContent = String(state.lives);
  }

  // ========================================================================
  // CONTROLES (touch + teclado)
  // ========================================================================
  function setupControls() {
    const left = document.getElementById('touch-left');
    const right = document.getElementById('touch-right');

    function bindZone(el, side) {
      if (!el) return;
      const start = (e) => {
        e.preventDefault();
        state.touch[side] = true;
        el.classList.add('active');
      };
      const end = (e) => {
        e.preventDefault();
        state.touch[side] = false;
        el.classList.remove('active');
      };
      el.addEventListener('touchstart', start, { passive: false });
      el.addEventListener('touchend', end, { passive: false });
      el.addEventListener('touchcancel', end, { passive: false });
      el.addEventListener('mousedown', start);
      el.addEventListener('mouseup', end);
      el.addEventListener('mouseleave', end);
    }

    bindZone(left, 'left');
    bindZone(right, 'right');

    // Teclado
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') state.keys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') state.keys.right = true;
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') state.keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') state.keys.right = false;
    });
  }

  function updatePlayer(dt) {
    const player = getPlayer();
    const area = getGameArea();
    if (!player || !area) return;

    const movingLeft = state.keys.left || state.touch.left;
    const movingRight = state.keys.right || state.touch.right;

    let dx = 0;
    if (movingLeft) dx -= state.playerSpeed * dt;
    if (movingRight) dx += state.playerSpeed * dt;

    state.playerX += dx;

    const areaRect = area.getBoundingClientRect();
    const halfW = player.offsetWidth / 2;
    state.playerX = Math.max(halfW, Math.min(areaRect.width - halfW, state.playerX));
    player.style.left = state.playerX + 'px';
    player.style.transform = 'translateX(-50%)';
  }

  // ========================================================================
  // LOOP DE JUEGO
  // ========================================================================
  function gameLoop(now) {
    if (!state.running) return;
    if (!state.lastTime) state.lastTime = now;
    const dt = Math.min(0.05, (now - state.lastTime) / 1000); // cap dt
    state.lastTime = now;
    state.elapsedMs += dt * 1000;

    // dificultad: bajar el intervalo de spawn con el tiempo
    state.spawnInterval = Math.max(450, 1100 - state.elapsedMs / 50);

    if (state.elapsedMs - state.lastSpawn >= state.spawnInterval) {
      spawnFood();
      state.lastSpawn = state.elapsedMs;
    }

    updatePlayer(dt);
    updateFoods(dt);
    updateEatAnim(dt);

    state.rafId = requestAnimationFrame(gameLoop);
  }

  // ========================================================================
  // FLUJO DEL JUEGO
  // ========================================================================
  function setPlayerFace(charId) {
    const path = FACE_PATH[charId];
    if (!path) return;
    const top = document.getElementById('player-face-top');
    const bottom = document.getElementById('player-face-bottom');
    if (top) top.src = path;
    if (bottom) bottom.src = path;
  }

  function startGame() {
    setPlayerFace(state.selectedCharacter);

    // limpiar estado
    state.fullness = 0;
    state.lives = 3;
    state.foods.forEach(f => f.el.remove());
    state.foods = [];
    state.elapsedMs = 0;
    state.lastSpawn = 0;
    state.lastTime = 0;
    updateHUD();

    // posicionar jugador en el centro
    requestAnimationFrame(() => {
      const area = getGameArea();
      if (area) state.playerX = area.getBoundingClientRect().width / 2;
    });

    // ocultar overlay y arrancar
    const overlay = getOverlay();
    if (overlay) overlay.classList.add('hidden');

    state.running = true;
    state.rafId = requestAnimationFrame(gameLoop);
  }

  function endGame(win) {
    state.running = false;
    if (state.rafId) cancelAnimationFrame(state.rafId);
    const overlay = getOverlay();
    const title = document.getElementById('overlay-title');
    const text = document.getElementById('overlay-text');
    const btn = document.getElementById('overlay-btn');
    if (win) {
      if (title) title.textContent = '¡PRUEBA 1 SUPERADA!';
      if (text) text.innerHTML = `BARRIGA AL <span style="color:var(--accent)">100%</span><br>AHORA TOCA TIRAR<br>MONEDAS A LOS CHUPITOS`;
      if (btn) btn.textContent = 'SIGUIENTE PRUEBA';
      btn.dataset.next = 'game2';
      playStartSound();
    } else {
      if (title) title.textContent = 'GAME OVER';
      if (text) text.innerHTML = `BARRIGA: <span style="color:var(--accent)">${state.fullness}%</span><br>${NAMES[state.selectedCharacter] || ''} NO LO LOGRÓ`;
      if (btn) btn.textContent = 'REINTENTAR';
      btn.dataset.next = 'retry1';
      playGameOver();
    }
    if (overlay) overlay.classList.remove('hidden');
  }

  // ========================================================================
  // BIND DE BOTONES
  // ========================================================================
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
    showScreen('game');
    setPlayerFace(state.selectedCharacter);
    // mostrar overlay con tutorial — se arrancará al pulsar EMPEZAR
    const overlay = getOverlay();
    const title = document.getElementById('overlay-title');
    const text = document.getElementById('overlay-text');
    const btn = document.getElementById('overlay-btn');
    if (title) title.textContent = '¡LISTO ' + (NAMES[state.selectedCharacter] || '') + '!';
    if (text) text.innerHTML = 'JOSE TE LANZARÁ COMIDA<br>PULSA IZQUIERDA O DERECHA<br>O USA LAS FLECHAS';
    if (btn) btn.textContent = 'EMPEZAR';
    if (overlay) overlay.classList.remove('hidden');
  });

  bindButton('overlay-btn', () => {
    playClickSound();
    const btn = document.getElementById('overlay-btn');
    const next = btn ? btn.dataset.next : '';
    if (next === 'game2') {
      showScreen('game2');
      startGame2();
    } else {
      startGame();
    }
  });

  // ========================================================================
  // PANTALLA 2 — CHUPITOS Y MONEDAS
  // ========================================================================
  // 10 chupitos: 1 en el centro y 9 alrededor en un anillo.
  // El más cercano al jugador (abajo del anillo, ángulo 90°) es la TRAMPA.
  const SHOTS_COUNT = 10;
  const SHOTS_DANGER_INDEX = 9;   // último = el más cercano (lo colocamos abajo)

  // Chupito 16x16 con sombreado 16-bit (3 niveles cristal + 4 niveles licor)
  const SHOT_PALETTE = {
    '.': null,
    // Outline
    'r': '#1a1622',
    'R': '#0d0a14',          // outline más oscuro
    // Cristal
    'c': '#ffffff',          // highlight
    'g': '#d8d8ec',          // glass base
    'h': '#7a7898',          // glass shadow
    'b': '#3a3a52',          // glass deep shadow
    // Licor amarillo (4 niveles)
    'L': '#fff7c2',          // brillo superficie
    'l': '#fce853',          // licor claro
    'y': '#f0c020',          // licor base
    'Y': '#c08a10',          // licor sombra
    'd': '#7a5008',          // licor profundo
    // Base / pie
    'k': '#7a7090',
    'K': '#3a3852',
    // Moneda dorada dentro (filled)
    'm': '#fce200',
    'M': '#aa7700',
    'D': '#604000',
    's': '#ffffd0',          // brillo moneda
  };

  const SHOT_SPRITE = [
    '................',
    '..rrrrrrrrrrrr..',
    '.rcgggggggggcr..',
    '.rgggggggggghR..',
    '.rgLLLLLLLLLgR..',
    '.rgLlllllllyhR..',
    '.rglllllllyyhR..',
    '.rgllllllyyYhR..',
    '.rgllllyyYYYhR..',
    '.rglyyyYYYYdhR..',
    '.rgyYYYYYdddhR..',
    '.rcgggggggggcR..',
    '..rrhhhhhhhrr...',
    '...rrkkkkkrr....',
    '....RKkkkKR.....',
    '.....RRRRR......',
  ];

  const SHOT_FILLED_SPRITE = [
    '................',
    '..rrrrrrrrrrrr..',
    '.rcgggggggggcr..',
    '.rgggggggggghR..',
    '.rgLLLLLLLLLgR..',
    '.rgLsssssssLhR..',  // brillo moneda en superficie
    '.rgLsmmmmmsLhR..',
    '.rgLmmmmmmmLhR..',
    '.rgmmmmmmmMMhR..',
    '.rglmMMMMMMMdhR.',
    '.rgyMMDDDDDdhR..',
    '.rcgggggggggcR..',
    '..rrhhhhhhhrr...',
    '...rrkkkkkrr....',
    '....RKkkkKR.....',
    '.....RRRRR......',
  ];

  // Moneda 16x16 con sombreado dorado (estilo SNES)
  const COIN_PALETTE = {
    '.': null,
    'r': '#3a2400',          // outline marrón oscuro
    'R': '#1a1000',          // outline más oscuro
    's': '#ffffe8',          // brillo blanco
    'c': '#fff4a0',          // gold highlight
    'm': '#fce200',          // gold base
    'M': '#c89010',          // gold mid shadow
    'd': '#7a5008',          // gold deep shadow
    'D': '#3a2400',          // gold darkest
  };

  const COIN_SPRITE = [
    '................',
    '......rrrrrr....',
    '....rrcccmmrr...',
    '...rsccmmmMMr...',
    '..rsccmmmmMMr...',
    '..rcmmmmmmMMr...',
    '.rcmmmmmmmMMdr..',
    '.rcmmmmmmMMMdr..',
    '.rcmmmmmMMMMdr..',
    '.rcmmmmMMMMddr..',
    '..rmmmMMMMddr...',
    '..rmmMMMMddRr...',
    '...rrMMddddR....',
    '....rrddddRR....',
    '......rrrrr.....',
    '................',
  ];

  function renderPalette(sprite, palette, scale) {
    const w = sprite[0].length * scale;
    const h = sprite.length * scale;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < sprite.length; y++) {
      for (let x = 0; x < sprite[y].length; x++) {
        const ch = sprite[y][x];
        const color = palette[ch];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return canvas;
  }

  // Estado pantalla 2
  const state2 = {
    running: false,
    lives: 3,
    shots: [],            // [{el, x, y, filled, danger}]
    coins: [],            // monedas en vuelo
    phase: 'aiming',      // 'aiming' | 'force' | 'flying' | 'idle'
    playerX: 0,
    playerVx: 180,        // px/s
    playerDir: 1,
    forceValue: 0,        // 0..1
    forceDir: 1,
    rafId: null,
    lastTime: 0,
  };

  function getGame2Area() { return document.getElementById('game2-area'); }
  function getShotsCluster() { return document.getElementById('shots-cluster'); }
  function getCoinLayer() { return document.getElementById('coin-layer'); }
  function getPlayer2() { return document.getElementById('player2'); }
  function getForceMeter() { return document.getElementById('force-meter'); }
  function getForceFill() { return document.getElementById('force-fill'); }
  function getOverlay2() { return document.getElementById('game2-overlay'); }
  function getShotsDoneEl() { return document.getElementById('shots-done'); }
  function getShotsFillEl() { return document.getElementById('shots-fill'); }
  function getLives2El() { return document.getElementById('lives2'); }
  function getP2Jaw() { return document.getElementById('p2-jaw'); }

  function setPlayer2Face(charId) {
    const path = FACE_PATH[charId];
    if (!path) return;
    const top = document.getElementById('p2-face-top');
    const bottom = document.getElementById('p2-face-bottom');
    if (top) top.src = path;
    if (bottom) bottom.src = path;
  }

  /**
   * Coloca los 9 chupitos en cuadrícula 3x3:
   *   A B C
   *   D E F      ← E es el centro
   *   G H I      ← H (abajo-centro) = trampa, el más cercano al jugador
   * Todos los chupitos están pegados (separación = ancho del chupito).
   */
  function placeShots() {
    const cluster = getShotsCluster();
    if (!cluster) return;
    cluster.innerHTML = '';
    state2.shots = [];

    const cw = cluster.clientWidth;
    const ch = cluster.clientHeight;
    const SHOT_W = 64;            // ancho del chupito = separación entre centros
    const SHOT_H = 64;
    const cx = cw / 2;
    // centramos verticalmente las 3 filas
    const totalHeight = 3 * SHOT_H;
    const startY = (ch - totalHeight) / 2 + SHOT_H / 2;

    const positions = [
      // Fila 1 (atrás)
      { x: cx - SHOT_W, y: startY + 0 * SHOT_H },
      { x: cx,          y: startY + 0 * SHOT_H },
      { x: cx + SHOT_W, y: startY + 0 * SHOT_H },
      // Fila 2 (centro)
      { x: cx - SHOT_W, y: startY + 1 * SHOT_H },
      { x: cx,          y: startY + 1 * SHOT_H, isCenter: true },
      { x: cx + SHOT_W, y: startY + 1 * SHOT_H },
      // Fila 3 (más cercana al jugador)
      { x: cx - SHOT_W, y: startY + 2 * SHOT_H },
      { x: cx,          y: startY + 2 * SHOT_H, isDanger: true },  // trampa
      { x: cx + SHOT_W, y: startY + 2 * SHOT_H },
    ];

    positions.forEach((pos, idx) => {
      const el = document.createElement('div');
      el.className = 'shot' + (pos.isDanger ? ' danger' : '');
      el.style.left = pos.x + 'px';
      el.style.top = pos.y + 'px';
      const glass = makeEmojiEl('🥃', 50);
      glass.classList.add('shot-glass');
      el.appendChild(glass);
      cluster.appendChild(el);
      state2.shots.push({
        el,
        glass,
        cx: pos.x,
        cy: pos.y,
        filled: false,
        danger: !!pos.isDanger,
        index: idx,
      });
    });
  }

  function updatePlayer2(dt) {
    const player = getPlayer2();
    const area = getGame2Area();
    if (!player || !area) return;
    const aw = area.clientWidth;
    const halfW = player.offsetWidth / 2;

    if (state2.phase === 'aiming') {
      state2.playerX += state2.playerVx * state2.playerDir * dt;
      if (state2.playerX < halfW) {
        state2.playerX = halfW;
        state2.playerDir = 1;
      } else if (state2.playerX > aw - halfW) {
        state2.playerX = aw - halfW;
        state2.playerDir = -1;
      }
      player.style.left = state2.playerX + 'px';
      player.style.transform = 'translateX(-50%)';
    }
  }

  function updateForce(dt) {
    if (state2.phase !== 'force') return;
    const speed = 1.4; // ciclos/seg
    state2.forceValue += state2.forceDir * speed * dt;
    if (state2.forceValue >= 1) { state2.forceValue = 1; state2.forceDir = -1; }
    else if (state2.forceValue <= 0) { state2.forceValue = 0; state2.forceDir = 1; }
    const fill = getForceFill();
    if (fill) fill.style.height = (state2.forceValue * 100) + '%';
  }

  function spawnCoin(force) {
    const player = getPlayer2();
    const area = getGame2Area();
    const layer = getCoinLayer();
    if (!player || !area || !layer) return;

    const playerRect = player.getBoundingClientRect();
    const areaRect = area.getBoundingClientRect();

    const x = playerRect.left + playerRect.width / 2 - areaRect.left - 16;
    const y = playerRect.top - areaRect.top - 16;

    const el = document.createElement('div');
    el.className = 'coin';
    el.appendChild(makeEmojiEl('🪙', 28));
    el.style.transform = `translate(${x}px, ${y}px)`;
    layer.appendChild(el);

    // Estilo curling: la moneda sube en línea recta con velocidad inicial
    // y se va frenando hasta pararse (no vuelve a caer).
    // Mapeo lineal force [0..1] → v0 [200..1000] px/s (negativo = arriba).
    const v0 = 200 + force * 800;
    state2.coins.push({ el, x, y, vy: -v0, vx: 0, locked: false });
  }

  function updateCoins(dt) {
    const area = getGame2Area();
    if (!area) return;
    const aw = area.clientWidth;
    const ah = area.clientHeight;
    // Fricción tipo curling: la moneda decelera hasta pararse, NO cae.
    const friction = 800;            // px/s² de deceleración

    for (let i = state2.coins.length - 1; i >= 0; i--) {
      const c = state2.coins[i];
      if (c.locked) continue;

      c.x += c.vx * dt;
      c.y += c.vy * dt;

      // Decelerar hacia 0 (sin volver a caer)
      if (c.vy < 0) c.vy = Math.min(0, c.vy + friction * dt);
      else if (c.vy > 0) c.vy = Math.max(0, c.vy - friction * dt);
      if (c.vx !== 0) {
        const sign = Math.sign(c.vx);
        c.vx -= sign * friction * dt;
        if (Math.sign(c.vx) !== sign) c.vx = 0;
      }

      c.el.style.transform = `translate(${c.x}px, ${c.y}px)`;

      // Overshoot por arriba de la pantalla → fallo
      if (c.y < -30) {
        c.locked = true;
        c.el.classList.add('miss');
        setTimeout(() => c.el.remove(), 2000);
        state2.coins.splice(i, 1);
        onCoinMissed();
        continue;
      }

      // Cuando la moneda se ha parado, comprobar dónde quedó
      if (c.vy === 0 && c.vx === 0) {
        c.locked = true;

        const cluster = getShotsCluster();
        const clusterRect = cluster.getBoundingClientRect();
        const areaRect = area.getBoundingClientRect();
        const coinCenterX = c.x + 16;
        const coinCenterY = c.y + 16;

        let hit = null;
        let bestDist = Infinity;
        for (const s of state2.shots) {
          if (s.filled) continue;
          const sx = clusterRect.left - areaRect.left + s.cx;
          const sy = clusterRect.top - areaRect.top + s.cy;
          const dx = coinCenterX - sx;
          const dy = coinCenterY - sy;
          const dist = Math.hypot(dx, dy);
          if (dist < 28 && dist < bestDist) {
            bestDist = dist;
            hit = s;
          }
        }

        // Quitamos la moneda del array ANTES de llamar a los handlers,
        // para que onCoinMissed vea length===0 y resetee la fase.
        state2.coins.splice(i, 1);

        if (hit) {
          c.el.classList.add('entering');
          setTimeout(() => c.el.remove(), 400);
          handleShotHit(hit);
        } else {
          // se quedó corta o entre chupitos: 2s visible y se desvanece
          c.el.classList.add('miss');
          setTimeout(() => c.el.remove(), 2000);
          onCoinMissed();
        }
      }
    }
  }

  function onCoinMissed() {
    if (state2.phase === 'flying' && state2.coins.length === 0) {
      beep(220, 0.1, 'sawtooth', 0.1);
      resetToAiming();
    }
  }

  function markShotFilled(shot) {
    shot.filled = true;
    shot.el.classList.add('filled');
    // overlay de moneda dentro del chupito
    if (!shot.coin) {
      const coin = makeEmojiEl('🪙', 22);
      coin.classList.add('shot-coin-overlay');
      shot.el.appendChild(coin);
      shot.coin = coin;
    }
  }

  function handleShotHit(shot) {
    if (shot.filled) {
      // ya estaba lleno, sin efecto
      resetToAiming();
      return;
    }
    if (shot.danger) {
      // ¡Tu chupito! pierdes vida
      markShotFilled(shot);
      state2.lives -= 1;
      updateHUD2();
      showToast('OH NO, ES TU CHUPITO\n¡BEBES TÚ!', true);
      playMissSound();
      if (state2.lives <= 0) {
        setTimeout(() => endGame2(false), 1900);
        return;
      }
      setTimeout(resetToAiming, 1900);
      return;
    }
    // Chupito normal: cuenta para la victoria
    markShotFilled(shot);
    updateHUD2();
    playEatSound();

    const filledNonDanger = state2.shots.filter(s => s.filled && !s.danger).length;
    if (filledNonDanger >= 8) {
      setTimeout(() => endGame2(true), 600);
      return;
    }
    resetToAiming();
  }

  function showToast(msg, danger) {
    const area = getGame2Area();
    if (!area) return;
    const t = document.createElement('div');
    t.className = 'game-toast';
    if (!danger) t.style.background = 'var(--green)';
    t.innerHTML = msg.replace(/\n/g, '<br>');
    area.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  }

  function updateHUD2() {
    const filledNonDanger = state2.shots.filter(s => s.filled && !s.danger).length;
    const done = getShotsDoneEl(); if (done) done.textContent = String(filledNonDanger);
    const fill = getShotsFillEl();
    if (fill) {
      fill.style.width = ((filledNonDanger / 8) * 100) + '%';
      fill.classList.toggle('full', filledNonDanger >= 8);
    }
    const l = getLives2El(); if (l) l.textContent = String(state2.lives);
  }

  function resetToAiming() {
    state2.phase = 'aiming';
    const meter = getForceMeter();
    if (meter) meter.classList.remove('active');
    const fill = getForceFill();
    if (fill) fill.classList.remove('locked');
    state2.forceValue = 0;
    state2.forceDir = 1;
  }

  function handleTap() {
    if (!state2.running) return;
    if (state2.phase === 'aiming') {
      state2.phase = 'force';
      const meter = getForceMeter();
      if (meter) meter.classList.add('active');
      beep(660, 0.06, 'square', 0.1);
    } else if (state2.phase === 'force') {
      state2.phase = 'flying';
      const fill = getForceFill();
      if (fill) fill.classList.add('locked');
      const meter = getForceMeter();
      setTimeout(() => { if (meter) meter.classList.remove('active'); }, 350);
      beep(880, 0.08, 'square', 0.12);
      spawnCoin(state2.forceValue);
    }
  }

  function setupTap() {
    const zone = document.getElementById('tap-zone');
    if (!zone) return;
    const handler = (e) => {
      e.preventDefault();
      handleTap();
    };
    zone.addEventListener('click', handler);
    zone.addEventListener('touchstart', handler, { passive: false });
  }

  function game2Loop(now) {
    if (!state2.running) return;
    if (!state2.lastTime) state2.lastTime = now;
    const dt = Math.min(0.05, (now - state2.lastTime) / 1000);
    state2.lastTime = now;

    updatePlayer2(dt);
    updateForce(dt);
    updateCoins(dt);

    state2.rafId = requestAnimationFrame(game2Loop);
  }

  function startGame2() {
    setPlayer2Face(state.selectedCharacter);
    placeShots();
    state2.lives = state.lives > 0 ? state.lives : 3;
    state2.shots.forEach(s => s.filled = false);
    updateHUD2();
    state2.coins.forEach(c => c.el.remove());
    state2.coins = [];
    state2.phase = 'aiming';
    state2.lastTime = 0;
    state2.playerX = (getGame2Area()?.clientWidth || 360) / 2;

    const overlay = getOverlay2();
    if (overlay) overlay.classList.add('hidden');

    state2.running = true;
    state2.rafId = requestAnimationFrame(game2Loop);
  }

  function endGame2(win) {
    state2.running = false;
    if (state2.rafId) cancelAnimationFrame(state2.rafId);
    const overlay = getOverlay2();
    const title = document.getElementById('overlay2-title');
    const text = document.getElementById('overlay2-text');
    const btn = document.getElementById('overlay2-btn');
    if (win) {
      if (title) title.textContent = '¡PRUEBA 2 SUPERADA!';
      if (text) text.innerHTML = `8 DE 9 CHUPITOS<br>¡SIGUE EN PIE!`;
      if (btn) btn.textContent = 'CONTINUAR';
      playStartSound();
    } else {
      if (title) title.textContent = 'GAME OVER';
      if (text) text.innerHTML = 'TE TOCÓ BEBER<br>DEMASIADAS VECES';
      if (btn) btn.textContent = 'REINTENTAR';
      playGameOver();
    }
    if (overlay) overlay.classList.remove('hidden');
  }

  bindButton('overlay2-btn', () => {
    playClickSound();
    const title = document.getElementById('overlay2-title');
    if (title && title.textContent.includes('SUPERADA')) {
      showScreen('game3');
      startGame3();
      return;
    }
    startGame2();
  });

  // ========================================================================
  // PANTALLA 3 — RULETA DEL CASINO
  // ========================================================================
  const RED_NUMBERS = new Set([
    1, 3, 5, 7, 9, 12, 14, 16, 18,
    19, 21, 23, 25, 27, 30, 32, 34, 36,
  ]);
  const HOT_NUMBERS = [8, 22]; // probabilidad ×10 (no se marca visualmente)

  // Orden estándar de la ruleta europea (37 slots)
  const WHEEL_ORDER = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
  ];
  const SLOT_ANGLE = 360 / WHEEL_ORDER.length;

  function colorOf(n) {
    if (n === 0) return 'green';
    return RED_NUMBERS.has(n) ? 'red' : 'black';
  }

  const state3 = {
    running: false,
    spinning: false,
    lives: 3,
    selected: null,
    ballAngle: 0,         // ángulo acumulado de la bola (siempre creciente)
  };

  function buildBetLayout() {
    const layout = document.getElementById('bet-layout');
    if (!layout) return;
    layout.innerHTML = '';

    // 0 (columna izquierda, ocupando 12 filas)
    const zero = document.createElement('button');
    zero.type = 'button';
    zero.className = 'bet-cell zero';
    zero.dataset.number = '0';
    zero.textContent = '0';
    zero.addEventListener('click', () => onBetClick(0));
    layout.appendChild(zero);

    // 1..36 en cuadrícula 3 col × 12 fil — sin marca para 8 y 22
    for (let n = 1; n <= 36; n++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'bet-cell ' + colorOf(n);
      cell.dataset.number = String(n);
      cell.textContent = String(n);
      cell.addEventListener('click', () => onBetClick(n));
      layout.appendChild(cell);
    }
  }

  /** Crea los 37 chips numerados alrededor de la rueda */
  function buildWheel() {
    const wheel = document.getElementById('wheel');
    if (!wheel) return;
    // limpia solo los chips existentes (preserva pseudo-elements)
    wheel.querySelectorAll('.wheel-num').forEach(n => n.remove());

    const radius = 86;  // radio donde se colocan los chips
    WHEEL_ORDER.forEach((n, i) => {
      const angle = i * SLOT_ANGLE;       // 0° = arriba, sentido horario
      const chip = document.createElement('div');
      chip.className = 'wheel-num ' + colorOf(n);
      chip.textContent = String(n);
      // truco: rotate(angle) translate(-radius) rotate(-angle) coloca el chip
      // a `radius` px del centro en la dirección `angle` y mantiene el texto recto
      chip.style.transform =
        `rotate(${angle}deg) translateY(-${radius}px) rotate(${-angle}deg)`;
      wheel.appendChild(chip);
    });
  }

  function onBetClick(n) {
    if (!state3.running || state3.spinning) return;
    state3.selected = n;
    document.querySelectorAll('.bet-cell').forEach(c => {
      const num = parseInt(c.dataset.number, 10);
      c.classList.toggle('selected', num === n);
      c.classList.add('locked');
    });
    const status = document.getElementById('bet-status');
    if (status) {
      status.textContent = 'GIRANDO LA RULETA...';
      status.className = 'bet-status spinning';
    }
    spinRoulette(n);
  }

  /** Selecciona un resultado con pesos: 8 y 22 ×10, resto ×1 */
  function pickRouletteResult() {
    const weights = new Array(37).fill(1);
    HOT_NUMBERS.forEach(n => weights[n] = 10);
    const total = weights.reduce((a, b) => a + b, 0); // 35 + 20 = 55
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return 0;
  }

  function spinRoulette(picked) {
    state3.spinning = true;
    const result = pickRouletteResult();
    const idx = WHEEL_ORDER.indexOf(result);
    const targetAngle = idx * SLOT_ANGLE;

    // La bola gira siempre hacia delante (ángulo creciente).
    // Calcula cuánto añadir al ángulo actual para acabar exactamente en
    // el slot del resultado tras N vueltas completas.
    const turns = 5;
    const currentMod = ((state3.ballAngle % 360) + 360) % 360;
    const delta = (turns * 360) + ((targetAngle - currentMod + 360) % 360);
    state3.ballAngle += delta;

    const orbit = document.getElementById('wheel-orbit');
    if (orbit) {
      orbit.classList.add('spinning');
      // forzamos reflow para que la transición se aplique al cambio
      void orbit.offsetWidth;
      orbit.style.transform = `rotate(${state3.ballAngle}deg)`;
    }

    playSpinSound();

    // Tras la animación, evaluar resultado
    setTimeout(() => showRouletteResult(result, picked), 4250);
  }

  function playSpinSound() {
    const ctx = getAudioCtx();
    if (!ctx) return;
    // Beeps decrecientes simulando el clic-clic-clic de la bola
    for (let i = 0; i < 14; i++) {
      const t = Math.pow(i / 13, 1.4) * 3.5;   // ralentiza al final
      setTimeout(() => beep(420 + Math.random() * 80, 0.04, 'square', 0.06), t * 1000);
    }
  }

  function showRouletteResult(num, picked) {
    const status = document.getElementById('bet-status');

    beep(880, 0.1, 'square', 0.12);

    setTimeout(() => {
      state3.spinning = false;
      if (num === picked) {
        if (status) {
          if (num === 22) status.textContent = '¡EL 22 DE ISCO!';
          else if (num === 8) status.textContent = '¡EL 8 DE IBAÑÉS!';
          else status.textContent = '¡ACERTASTE EL ' + num + '!';
          status.className = 'bet-status win';
        }
        playStartSound();
        setTimeout(() => endGame3(true), 1800);
      } else if (num === 0) {
        state3.lives -= 1;
        updateHUD3();
        if (status) {
          status.textContent = 'CERO. ¡PIERDES VIDA!';
          status.className = 'bet-status lose';
        }
        playMissSound();
        if (state3.lives <= 0) {
          setTimeout(() => endGame3(false), 1900);
          return;
        }
        setTimeout(resetForNextSpin, 1900);
      } else {
        if (status) {
          status.textContent = 'SALIÓ ' + num + '. SIGUE';
          status.className = 'bet-status lose';
        }
        playMissSound();
        setTimeout(resetForNextSpin, 1500);
      }
    }, 600);
  }

  function resetForNextSpin() {
    document.querySelectorAll('.bet-cell').forEach(c => {
      c.classList.remove('locked', 'selected');
    });
    const status = document.getElementById('bet-status');
    if (status) {
      status.textContent = 'ELIGE UN NÚMERO';
      status.className = 'bet-status';
    }
    state3.selected = null;
  }

  function updateHUD3() {
    const l = document.getElementById('lives3');
    if (l) l.textContent = String(state3.lives);
  }

  function startGame3() {
    buildBetLayout();
    buildWheel();
    state3.running = true;
    state3.spinning = false;
    state3.lives = (typeof state2 !== 'undefined' && state2.lives > 0) ? state2.lives : 3;
    state3.selected = null;
    state3.ballAngle = 0;
    updateHUD3();
    resetForNextSpin();
    const orbit = document.getElementById('wheel-orbit');
    if (orbit) {
      orbit.classList.remove('spinning');
      orbit.style.transition = 'none';
      orbit.style.transform = 'rotate(0deg)';
      // re-enable transition next frame
      requestAnimationFrame(() => { orbit.style.transition = ''; });
    }
    const overlay = document.getElementById('game3-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  function endGame3(win) {
    state3.running = false;
    const overlay = document.getElementById('game3-overlay');
    const title = document.getElementById('overlay3-title');
    const text = document.getElementById('overlay3-text');
    const btn = document.getElementById('overlay3-btn');
    if (win) {
      if (title) title.textContent = '¡PRUEBA 3 SUPERADA!';
      let html;
      if (state3.selected === 22) {
        html = '¡HAS ACERTADO<br>EL 22 DE ISCO!!';
      } else if (state3.selected === 8) {
        html = 'SÍ SEÑOR,<br>EL 8 DEL CAPITÁN<br>DE IBAÑÉS!!';
      } else {
        html = `EL ${state3.selected} ERA TU NÚMERO.<br>SIGUES VIVO`;
      }
      if (text) text.innerHTML = html;
      if (btn) btn.textContent = 'CONTINUAR';
      btn.dataset.next = 'next';
    } else {
      if (title) title.textContent = 'GAME OVER';
      if (text) text.innerHTML = 'EL CASINO TE GANÓ.<br>BEBES SOLO.';
      if (btn) btn.textContent = 'REINTENTAR';
      btn.dataset.next = 'retry';
    }
    if (overlay) overlay.classList.remove('hidden');
  }

  bindButton('overlay3-btn', () => {
    playClickSound();
    const btn = document.getElementById('overlay3-btn');
    const next = btn ? btn.dataset.next : '';
    if (next === 'next') {
      showScreen('game4');
      startGame4();
      return;
    }
    startGame3();
  });

  // ========================================================================
  // PANTALLA 4 — RUNNER: CODERE → GARITO
  // ========================================================================
  const OBSTACLE_PALETTE = {
    '.': null,
    // grises (piedra)
    'k': '#7a7a82', 'K': '#5a5a62', 'L': '#9a9aa2', 'D': '#3a3a40',
    // azules (charco)
    'b': '#4a8ec8', 'B': '#2a5a8c', 'C': '#7abeec', 'V': '#1a3a5a',
    // naranja (gato)
    'o': '#dd7a22', 'O': '#aa5511', 'y': '#ffcc66', 'g': '#0a0a0a',
    'p': '#ff9999', // hocico/orejas interior
    // rojo/blanco (señal)
    'r': '#cc2233', 'R': '#882222', 'W': '#fafafa', 'Q': '#888',
    's': '#5a3a1a', // poste señal/planta
    // verde (planta)
    'e': '#3a8a3a', 'E': '#1a5a1a', 'l': '#5acc5a', 'F': '#88dd44',
    // negro (agujero)
    'X': '#050505', 'x': '#1a1a1a', 'Y': '#2a2a2e',
  };

  const OBSTACLE_SPRITES = {
    piedra: [
      '................',
      '................',
      '.....KKkkk......',
      '....KkLLkkk.....',
      '...KkLLkkkkk....',
      '..KkkkkkLkkkD...',
      '..kkLkkkkkkkD...',
      '..LkkkkkkkkkD...',
      '..kkkkLkkkkkD...',
      '..kkkkkkkkkkD...',
      '...kkkkkkkkD....',
      '....DDkkkkD.....',
      '......DDDD......',
      '................',
    ],
    charco: [
      '................',
      '....bbbbB.......',
      '..bbBCBbbbb.....',
      '.bbCCBbbbbbBbb..',
      '.bCBbbbbbbbbbbb.',
      'bbbBbbbbbCBbbbb.',
      'bbbbbbbbbbbBbbb.',
      '.bbbbbBbbbbbbbb.',
      '.bbVbbbbbVbbbb..',
      '..bbbVbbbbbbb...',
      '...bbbbbbbb.....',
      '.....bbbb.......',
      '................',
      '................',
    ],
    agujero: [
      '................',
      '......KkkkkK....',
      '....KKxXXXxKK...',
      '...KxXXXXXXxK...',
      '..KxXXXXXXXXxK..',
      '..xXXXXXXXXXXx..',
      '..xXXXXXXXXXXx..',
      '..xXXXXXXXXXXx..',
      '..xXXXXXXXXXXx..',
      '..KxXXXXXXXXxK..',
      '...KxXXXXXXxK...',
      '....KKxXXxKK....',
      '......Kkkkk.....',
      '................',
    ],
    gato: [
      '...o..o.........',
      '...oooooo.......',
      '..oOoOoooo......',
      '..oogggoooo.....',
      '..oooopooo......',
      '..ooooooooo.....',
      '.ooooooooooo....',
      'oooooooooooo....',
      'ooo.oooo.ooo....',
      '.oo.ooo..oo.....',
      '................',
      '................',
      '................',
      '................',
    ],
    senal: [
      '.......W........',
      '......WWW.......',
      '.....WWrWW......',
      '....WrrrrrW.....',
      '...WrrrrrrrW....',
      '..WrrrWWWrrrW...',
      '.WrrrrWQWrrrrW..',
      '.WrrrrrWrrrrrW..',
      '..WrrrrrrrrrW...',
      '...WWWWWWWWW....',
      '.......ss.......',
      '.......ss.......',
      '.......ss.......',
      '.......ss.......',
    ],
    planta: [
      '................',
      '....e.....e.....',
      '...eEe...eEe....',
      '..eEFEeEEFEEe...',
      '..EFFFEFFFFEE...',
      '..eEElllllEEe...',
      '...eEElEEEEe....',
      '....eelllee.....',
      '......eee.......',
      '......sss.......',
      '......sss.......',
      '......sss.......',
      '................',
      '................',
    ],
  };

  const OBSTACLE_TYPES = Object.keys(OBSTACLE_EMOJI);

  const ROUTE_DURATION = 25;     // segundos
  const PLAYER4_W = 96;
  const PLAYER4_H = 132;

  const state4 = {
    running: false,
    lives: 3,
    elapsed: 0,
    speed: 220,
    obstacles: [],
    playerX: 0,
    playerSpeed: 300,
    spawnTimer: 0,
    spawnInterval: 1000,
    invuln: 0,
    rafId: null,
    lastTime: 0,
    bgY: 0,
  };

  function getGame4Area() { return document.getElementById('game4-area'); }
  function getObstaclesLayer() { return document.getElementById('obstacles'); }
  function getPlayer4() { return document.getElementById('player4'); }
  function getRoad() { return document.getElementById('road'); }

  function setPlayer4Face(charId) {
    const path = FACE_PATH[charId];
    if (!path) return;
    const top = document.getElementById('p4-face-top');
    const bottom = document.getElementById('p4-face-bottom');
    if (top) top.src = path;
    if (bottom) bottom.src = path;
  }

  function spawnObstacle() {
    const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    const layer = getObstaclesLayer();
    const area = getGame4Area();
    if (!layer || !area) return;

    const w = 56, h = 56;

    const el = document.createElement('div');
    el.className = 'obstacle';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.appendChild(makeEmojiEl(OBSTACLE_EMOJI[type] || '⬛', 44));

    const aw = area.clientWidth;
    // Spawn dentro del carril (entre los bordillos a 14px)
    const minX = 18;
    const maxX = aw - w - 18;
    const x = Math.max(minX, Math.min(maxX, minX + Math.random() * (maxX - minX)));
    const y = -h - 10;

    el.style.transform = `translate(${x}px, ${y}px)`;
    layer.appendChild(el);

    state4.obstacles.push({ el, x, y, w, h, type, dead: false });
  }

  function updateObstacles4(dt) {
    const area = getGame4Area();
    if (!area) return;
    const ah = area.clientHeight;

    const player = getPlayer4();
    const playerRect = player ? player.getBoundingClientRect() : null;
    const areaRect = area.getBoundingClientRect();

    for (let i = state4.obstacles.length - 1; i >= 0; i--) {
      const o = state4.obstacles[i];
      if (o.dead) continue;
      o.y += state4.speed * dt;
      o.el.style.transform = `translate(${o.x}px, ${o.y}px)`;

      // colisión (con margen interno para que no sea injusto)
      if (state4.invuln <= 0 && playerRect) {
        const obsRect = {
          left: areaRect.left + o.x + 6,
          top: areaRect.top + o.y + 6,
          right: areaRect.left + o.x + o.w - 6,
          bottom: areaRect.top + o.y + o.h - 6,
        };
        const hit =
          obsRect.right > playerRect.left + 18 &&
          obsRect.left < playerRect.right - 18 &&
          obsRect.bottom > playerRect.top + 30 &&
          obsRect.top < playerRect.bottom - 10;
        if (hit) {
          state4.lives -= 1;
          state4.invuln = 1.4;
          if (player) {
            player.classList.add('hit');
            setTimeout(() => player.classList.remove('hit'), 500);
          }
          playMissSound();
          updateHUD4();
          if (state4.lives <= 0) {
            endGame4(false);
            return;
          }
        }
      }

      if (o.y > ah + 20) {
        o.dead = true;
        o.el.remove();
        state4.obstacles.splice(i, 1);
      }
    }
  }

  function updatePlayer4(dt) {
    const player = getPlayer4();
    const area = getGame4Area();
    if (!player || !area) return;

    const movingLeft = state.keys.left || state.touch.left;
    const movingRight = state.keys.right || state.touch.right;
    let dx = 0;
    if (movingLeft) dx -= state4.playerSpeed * dt;
    if (movingRight) dx += state4.playerSpeed * dt;
    state4.playerX += dx;

    const aw = area.clientWidth;
    const halfW = PLAYER4_W / 2;
    state4.playerX = Math.max(20 + halfW, Math.min(aw - 20 - halfW, state4.playerX));
    player.style.left = state4.playerX + 'px';
    player.style.transform = 'translateX(-50%)';
  }

  function scrollRoad(dt) {
    const road = getRoad();
    if (!road) return;
    state4.bgY = (state4.bgY + state4.speed * dt) % 60;
    road.style.backgroundPosition = `center ${state4.bgY}px, 0 0`;
  }

  function updateLandmarks4() {
    const start = document.getElementById('landmark-start');
    const end   = document.getElementById('landmark-end');
    const area = getGame4Area();
    if (!area) return;
    const ah = area.clientHeight;
    const progress = Math.min(100, state4.elapsed / ROUTE_DURATION * 100);

    // Codere baja desde el top con el scroll inicial (visible 1.5s y se va)
    if (start) {
      const t = Math.min(1, state4.elapsed / 2);
      start.style.transform = `translateY(${t * (ah * 0.7)}px)`;
      start.style.opacity = state4.elapsed > 2.5 ? '0' : '1';
    }
    // Garito aparece desde arriba cuando queda menos del 20%
    if (end) {
      const remaining = 100 - progress;
      if (remaining < 25) {
        const t = (25 - remaining) / 25;          // 0 → 1
        end.style.transform = `translateY(${t * (ah * 0.55)}px)`;
        end.style.opacity = '1';
      } else {
        end.style.transform = 'translateY(-200px)';
        end.style.opacity = '0';
      }
    }
  }

  function updateHUD4() {
    const progress = Math.min(100, state4.elapsed / ROUTE_DURATION * 100);
    const fill = document.getElementById('route-fill');
    const pct = document.getElementById('route-pct');
    if (fill) {
      fill.style.width = progress + '%';
      fill.classList.toggle('full', progress >= 100);
    }
    if (pct) pct.textContent = String(Math.floor(progress));
    const lives = document.getElementById('lives4');
    if (lives) lives.textContent = String(state4.lives);
  }

  function game4Loop(now) {
    if (!state4.running) return;
    if (!state4.lastTime) state4.lastTime = now;
    const dt = Math.min(0.05, (now - state4.lastTime) / 1000);
    state4.lastTime = now;
    state4.elapsed += dt;

    // dificultad: velocidad sube de 220 a 380, spawn baja de 1100 a 500
    state4.speed = 220 + (state4.elapsed / ROUTE_DURATION) * 160;
    state4.spawnInterval = Math.max(500, 1100 - state4.elapsed * 25);

    if (state4.invuln > 0) state4.invuln -= dt;

    scrollRoad(dt);

    state4.spawnTimer += dt * 1000;
    if (state4.spawnTimer >= state4.spawnInterval) {
      state4.spawnTimer = 0;
      spawnObstacle();
    }

    updateObstacles4(dt);
    updatePlayer4(dt);
    updateLandmarks4();
    updateHUD4();

    if (state4.elapsed >= ROUTE_DURATION) {
      endGame4(true);
      return;
    }

    state4.rafId = requestAnimationFrame(game4Loop);
  }

  function startGame4() {
    setPlayer4Face(state.selectedCharacter || 'victor');
    state4.lives = (typeof state3 !== 'undefined' && state3.lives > 0) ? state3.lives : 3;
    state4.elapsed = 0;
    state4.speed = 220;
    state4.spawnTimer = 0;
    state4.spawnInterval = 1100;
    state4.invuln = 0;
    state4.lastTime = 0;
    state4.bgY = 0;
    state4.obstacles.forEach(o => o.el.remove());
    state4.obstacles = [];

    requestAnimationFrame(() => {
      const area = getGame4Area();
      if (area) state4.playerX = area.clientWidth / 2;
    });

    updateHUD4();

    const overlay = document.getElementById('game4-overlay');
    if (overlay) overlay.classList.add('hidden');

    state4.running = true;
    state4.rafId = requestAnimationFrame(game4Loop);
  }

  function endGame4(win) {
    state4.running = false;
    if (state4.rafId) cancelAnimationFrame(state4.rafId);
    const overlay = document.getElementById('game4-overlay');
    const title = document.getElementById('overlay4-title');
    const text = document.getElementById('overlay4-text');
    const btn = document.getElementById('overlay4-btn');
    if (win) {
      if (title) title.textContent = '¡LLEGASTE AL GARITO!';
      if (text) text.innerHTML = `${NAMES[state.selectedCharacter] || ''} HA LLEGADO<br>SANO Y SALVO AL GARITO`;
      if (btn) { btn.textContent = 'CONTINUAR'; btn.dataset.next = 'next'; }
      playStartSound();
    } else {
      if (title) title.textContent = 'GAME OVER';
      if (text) text.innerHTML = 'NO PUDISTE LLEGAR<br>AL GARITO';
      if (btn) { btn.textContent = 'REINTENTAR'; btn.dataset.next = 'retry'; }
      playGameOver();
    }
    if (overlay) overlay.classList.remove('hidden');
  }

  bindButton('overlay4-btn', () => {
    playClickSound();
    const btn = document.getElementById('overlay4-btn');
    const next = btn ? btn.dataset.next : '';
    if (next === 'next') {
      showScreen('game5');
      startGame5();
      return;
    }
    startGame4();
  });

  // ========================================================================
  // PANTALLA 5 — TOILET SHOOTER (FINAL)
  // ========================================================================
  // Sprites pixel-art para inodoro y arma (no usamos emoji)
  const TOILET_PALETTE = {
    '.': null,
    'k': '#1a1820',
    'K': '#0a0810',
    'g': '#f4f4fc',
    'G': '#c4c4d4',
    'h': '#888896',
    'b': '#5aa0e0',
    'B': '#3a78b8',
    'c': '#aae0ff',
    'C': '#ffffff',
  };

  const TOILET_SPRITE = [
    '........................',
    '........................',
    '........kkkkkkk.........',
    '.......kggggggggk.......',
    '.......kgGGGGGGGk.......',
    '.......kgGGGGGGGk.......',
    '.......kggggggggk.......',
    '.......kkkkkkkkk........',
    '....kkkkkkkkkkkkkkk.....',
    '...kgggggggggggggGGk....',
    '...kgcCcCcCcCcCcCgGk....',
    '...kgbbbbbbbbbbbbgGk....',
    '...kgbBBBBBBBBBBbgGk....',
    '...kgbbBBBBBBBBbbgGk....',
    '...kgbbbbBBBBbbbbgGk....',
    '...kgggggggggggggGGk....',
    '....kkggggggggggkkk.....',
    '.....kkggggggggkkk......',
    '......kkggggggkkk.......',
    '........kkkkkk..........',
    '.........GGGGG..........',
    '.........kkkkk..........',
    '........................',
    '........................',
  ];

  const WEAPON_PALETTE = {
    '.': null,
    'k': '#1a0e10',
    'K': '#0a0508',
    'p': '#fdcfa8',          // skin light
    'P': '#e69e7e',          // skin mid
    'd': '#a65a3a',          // skin shadow
    'D': '#7a3a20',          // skin deep
    'c': '#fff0d8',          // highlight
    'h': '#f0c098',          // hand
    'H': '#a07058',          // hand shadow
  };

  // Anatomía: glans bulboso, corona, shaft con sombras laterales, manos abajo
  // Pivote bottom-center (transform-origin: 50% 100%)
  const WEAPON_SPRITE = [
    '......kkkk......',  // 0  punta
    '.....kPPPPk.....',  // 1
    '....kPcPPcPk....',  // 2  glans (highlights c)
    '...kPccPPccPk...',  // 3
    '...kPPPPPPPPk...',  // 4
    '..kPPPPPPPPPPk..',  // 5  parte ancha del glans
    '..kPPPPPPPPPPk..',  // 6
    '..kPPdPPPPdPPk..',  // 7  sombras laterales del glans
    '...kPPPPPPPPk...',  // 8
    '...kddddddddk...',  // 9  corona (anillo más oscuro)
    '....kPPPPPPk....',  // 10 shaft empieza más estrecho
    '....kPPPPPPk....',  // 11
    '....kPdPPdPk....',  // 12 sombras laterales del shaft
    '....kPdPPdPk....',  // 13
    '....kPdPPdPk....',  // 14
    '....kPdPPdPk....',  // 15
    '....kPPPPPPk....',  // 16
    '...kkkkkkkkkk...',  // 17 borde superior de la mano
    '..khhhhhhhhhhk..',  // 18
    '.khhPPPPPPPPhhk.',  // 19 manos sujetando (PP = shaft entre dedos)
    '.khHPPPPPPPPHhk.',  // 20 nudillos (H)
    '.khhhhhhhhhhhhk.',  // 21
    '..kPPPPPPPPPPk..',  // 22 muñeca
    '...kkkkkkkkkk...',  // 23 base (pivote)
  ];

  const ROUND5_DURATION = 30;       // s
  const WEAPON_LENGTH   = 80;       // px desde pivote hasta punta
  const DROP_SPEED      = 700;      // px/s
  const MAX_AIM_ANGLE   = 50;       // ° (rango [-50, 50] = abanico de 100°)
  const HIT_PER_DROP    = 4;        // % por gota acertada
  const TOILET_HIT_W    = 60;       // px ancho efectivo del bowl

  const state5 = {
    running: false,
    elapsed: 0,
    fillness: 0,
    aimAngle: 0,           // -50 a +50
    aimDir: 0,             // -1, 0, 1 según teclas
    drops: [],
    fireTimer: 0,
    fireInterval: 0.13,    // s entre gotas
    toiletX: 0,
    toiletVx: 80,
    toiletDirTimer: 0,
    rafId: null,
    lastTime: 0,
  };

  function getGame5Area() { return document.getElementById('game5-area'); }
  function getDropsLayer() { return document.getElementById('drops-layer'); }
  function getToilet()     { return document.getElementById('toilet'); }
  function getWeaponPivot(){ return document.getElementById('weapon-pivot'); }
  function getAimLine()    { return document.getElementById('aim-line'); }
  function getWeaponBase() { return document.getElementById('weapon-base'); }

  function setPlayer5Face(charId) {
    const path = FACE_PATH[charId];
    if (!path) return;
    const face = document.getElementById('p5-face');
    if (face) face.src = path;
  }

  function updateAim(dt) {
    const movingLeft  = state.keys.left  || state.touch.left;
    const movingRight = state.keys.right || state.touch.right;
    let dir = 0;
    if (movingLeft) dir -= 1;
    if (movingRight) dir += 1;
    state5.aimAngle += dir * 80 * dt;     // 80 °/s
    state5.aimAngle = Math.max(-MAX_AIM_ANGLE, Math.min(MAX_AIM_ANGLE, state5.aimAngle));

    const pivot = getWeaponPivot();
    if (pivot) pivot.style.transform = `rotate(${state5.aimAngle}deg)`;
    const aim = getAimLine();
    if (aim) aim.style.transform = `translateX(-50%) rotate(${state5.aimAngle}deg)`;
  }

  function spawnDrop() {
    const layer = getDropsLayer();
    const area = getGame5Area();
    const base = getWeaponBase();
    if (!layer || !area || !base) return;

    const baseRect = base.getBoundingClientRect();
    const areaRect = area.getBoundingClientRect();
    const px = baseRect.left - areaRect.left;
    const py = baseRect.top  - areaRect.top;

    const rad = state5.aimAngle * Math.PI / 180;
    const tipX = px + Math.sin(rad) * WEAPON_LENGTH;
    const tipY = py - Math.cos(rad) * WEAPON_LENGTH;

    const el = document.createElement('div');
    el.className = 'drop';
    el.style.transform = `translate(${tipX - 7}px, ${tipY - 9}px)`;
    layer.appendChild(el);

    state5.drops.push({
      el,
      x: tipX - 7,
      y: tipY - 9,
      vx: Math.sin(rad) * DROP_SPEED,
      vy: -Math.cos(rad) * DROP_SPEED,
      dead: false,
    });
  }

  function updateDrops5(dt) {
    const area = getGame5Area();
    const toilet = getToilet();
    if (!area || !toilet) return;
    const aw = area.clientWidth;

    const tRect = toilet.getBoundingClientRect();
    const aRect = area.getBoundingClientRect();
    const toiletCx = tRect.left - aRect.left + tRect.width / 2;
    const toiletCy = tRect.top  - aRect.top  + tRect.height * 0.55; // centro del bowl
    const toiletHalfW = TOILET_HIT_W / 2;
    const hitYBand = 18; // tolerancia vertical

    for (let i = state5.drops.length - 1; i >= 0; i--) {
      const d = state5.drops[i];
      if (d.dead) continue;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.el.style.transform = `translate(${d.x}px, ${d.y}px)`;

      const dropCx = d.x + 7;
      const dropCy = d.y + 9;

      // colisión con el inodoro
      const inX = Math.abs(dropCx - toiletCx) < toiletHalfW;
      const inY = Math.abs(dropCy - toiletCy) < hitYBand;
      if (inX && inY) {
        d.dead = true;
        d.el.classList.add('hit');
        setTimeout(() => d.el.remove(), 300);
        state5.drops.splice(i, 1);
        state5.fillness = Math.min(100, state5.fillness + HIT_PER_DROP);
        updateHUD5();
        beep(880 + Math.random() * 80, 0.04, 'square', 0.06);
        if (state5.fillness >= 100) {
          endGame5(true);
          return;
        }
        continue;
      }

      // fuera de pantalla
      if (d.y < -30 || d.x < -30 || d.x > aw + 30 || d.y > area.clientHeight + 30) {
        d.dead = true;
        d.el.remove();
        state5.drops.splice(i, 1);
      }
    }
  }

  function updateToilet(dt) {
    const toilet = getToilet();
    const area = getGame5Area();
    if (!toilet || !area) return;
    const aw = area.clientWidth;
    const tw = toilet.offsetWidth;

    state5.toiletX += state5.toiletVx * dt;
    if (state5.toiletX < 12) {
      state5.toiletX = 12;
      state5.toiletVx = Math.abs(state5.toiletVx);
    } else if (state5.toiletX > aw - tw - 12) {
      state5.toiletX = aw - tw - 12;
      state5.toiletVx = -Math.abs(state5.toiletVx);
    }
    toilet.style.transform = `translateX(${state5.toiletX}px)`;

    // cambio de dirección/velocidad aleatorio
    state5.toiletDirTimer += dt;
    if (state5.toiletDirTimer > 1.2 + Math.random() * 1.5) {
      state5.toiletDirTimer = 0;
      const speed = 60 + Math.random() * 100;
      state5.toiletVx = (Math.random() < 0.5 ? -1 : 1) * speed;
    }
  }

  function updateHUD5() {
    const fill = document.getElementById('urine-fill');
    const pct  = document.getElementById('urine-pct');
    const time = document.getElementById('time5');
    if (fill) {
      fill.style.width = state5.fillness + '%';
      fill.classList.toggle('full', state5.fillness >= 100);
    }
    if (pct)  pct.textContent  = String(Math.floor(state5.fillness));
    if (time) time.textContent = String(Math.max(0, Math.ceil(ROUND5_DURATION - state5.elapsed)));
  }

  function game5Loop(now) {
    if (!state5.running) return;
    if (!state5.lastTime) state5.lastTime = now;
    const dt = Math.min(0.05, (now - state5.lastTime) / 1000);
    state5.lastTime = now;
    state5.elapsed += dt;

    updateAim(dt);
    updateToilet(dt);
    state5.fireTimer += dt;
    while (state5.fireTimer >= state5.fireInterval) {
      state5.fireTimer -= state5.fireInterval;
      spawnDrop();
    }
    updateDrops5(dt);
    updateHUD5();

    if (state5.elapsed >= ROUND5_DURATION) {
      endGame5(false);
      return;
    }

    state5.rafId = requestAnimationFrame(game5Loop);
  }

  function startGame5() {
    setPlayer5Face(state.selectedCharacter || 'victor');
    // Renderiza sprites canvas (idempotente)
    const toilet = document.getElementById('toilet');
    if (toilet && !toilet.querySelector('canvas')) {
      const c = renderPalette(TOILET_SPRITE, TOILET_PALETTE, 4);
      c.classList.add('toilet-canvas');
      toilet.appendChild(c);
    }
    const pivot = document.getElementById('weapon-pivot');
    if (pivot && !pivot.querySelector('canvas')) {
      const c = renderPalette(WEAPON_SPRITE, WEAPON_PALETTE, 4);
      c.classList.add('weapon-canvas');
      pivot.appendChild(c);
    }
    state5.elapsed = 0;
    state5.fillness = 0;
    state5.aimAngle = 0;
    state5.fireTimer = 0;
    state5.lastTime = 0;
    state5.toiletX = 80;
    state5.toiletVx = (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 80);
    state5.toiletDirTimer = 0;
    state5.drops.forEach(d => d.el.remove());
    state5.drops = [];
    updateHUD5();
    const overlay = document.getElementById('game5-overlay');
    if (overlay) overlay.classList.add('hidden');
    state5.running = true;
    state5.rafId = requestAnimationFrame(game5Loop);
  }

  function endGame5(win) {
    state5.running = false;
    if (state5.rafId) cancelAnimationFrame(state5.rafId);
    state5.drops.forEach(d => d.el.remove());
    state5.drops = [];
    if (win) {
      showScreen('ending-win');
      playStartSound();
      setTimeout(() => beep(1175, 0.2), 600);
      setTimeout(() => beep(1568, 0.4), 900);
    } else {
      showScreen('ending-loss');
      playGameOver();
    }
  }

  bindButton('overlay5-btn', () => {
    playClickSound();
    startGame5();
  });

  // ===== Endings =====
  bindButton('ending-win-btn', () => {
    playClickSound();
    showScreen('welcome');
  });
  bindButton('ending-loss-btn', () => {
    playClickSound();
    showScreen('game5');
    const overlay = document.getElementById('game5-overlay');
    if (overlay) overlay.classList.remove('hidden');
  });

  /** Bind de los touch zones específicos de pantalla 5 */
  function setupGame5Controls() {
    const left = document.getElementById('touch5-left');
    const right = document.getElementById('touch5-right');
    function bindZone(el, side) {
      if (!el) return;
      const start = (e) => { e.preventDefault(); state.touch[side] = true; el.classList.add('active'); };
      const end = (e) => { e.preventDefault(); state.touch[side] = false; el.classList.remove('active'); };
      el.addEventListener('touchstart', start, { passive: false });
      el.addEventListener('touchend', end, { passive: false });
      el.addEventListener('touchcancel', end, { passive: false });
      el.addEventListener('mousedown', start);
      el.addEventListener('mouseup', end);
      el.addEventListener('mouseleave', end);
    }
    bindZone(left, 'left');
    bindZone(right, 'right');
  }

  /** Bind de los touch zones específicos de pantalla 4 */
  function setupGame4Controls() {
    const left = document.getElementById('touch4-left');
    const right = document.getElementById('touch4-right');

    function bindZone(el, side) {
      if (!el) return;
      const start = (e) => { e.preventDefault(); state.touch[side] = true; el.classList.add('active'); };
      const end = (e) => { e.preventDefault(); state.touch[side] = false; el.classList.remove('active'); };
      el.addEventListener('touchstart', start, { passive: false });
      el.addEventListener('touchend', end, { passive: false });
      el.addEventListener('touchcancel', end, { passive: false });
      el.addEventListener('mousedown', start);
      el.addEventListener('mouseup', end);
      el.addEventListener('mouseleave', end);
    }

    bindZone(left, 'left');
    bindZone(right, 'right');
  }

  // ========================================================================
  // ATAJOS DE TESTING (teclas 1..5)
  // ========================================================================
  // 1: bienvenida · 2: instrucciones · 3: selección
  // 4: comida · 5: chupitos · 6: ruleta · 7: runner · 8: WC · 9: ending win
  function setupShortcuts() {
    const map = ['welcome', 'instructions', 'select', 'game', 'game2', 'game3', 'game4', 'game5', 'ending-win'];

    window.addEventListener('keydown', (e) => {
      if (e.key < '1' || e.key > '9') return;
      const idx = parseInt(e.key, 10) - 1;
      const target = map[idx];
      if (!target) return;

      // Personaje por defecto si no se ha elegido
      if (!state.selectedCharacter) state.selectedCharacter = 'victor';

      // Detener loops activos
      state.running = false;
      if (state.rafId) cancelAnimationFrame(state.rafId);
      state2.running = false;
      if (state2.rafId) cancelAnimationFrame(state2.rafId);
      if (typeof state4 !== 'undefined') {
        state4.running = false;
        if (state4.rafId) cancelAnimationFrame(state4.rafId);
      }
      if (typeof state5 !== 'undefined') {
        state5.running = false;
        if (state5.rafId) cancelAnimationFrame(state5.rafId);
      }

      if (target === 'game') {
        showScreen('game');
        setPlayerFace(state.selectedCharacter);
        // limpiar comidas en pantalla
        state.foods.forEach(f => f.el.remove());
        state.foods = [];
        const overlay = getOverlay();
        const title = document.getElementById('overlay-title');
        const text = document.getElementById('overlay-text');
        const btn = document.getElementById('overlay-btn');
        if (title) title.textContent = '¡LISTO ' + (NAMES[state.selectedCharacter] || '') + '!';
        if (text) text.innerHTML = 'JOSE TE LANZARÁ COMIDA<br>PULSA IZQUIERDA O DERECHA<br>O USA LAS FLECHAS';
        if (btn) { btn.textContent = 'EMPEZAR'; btn.dataset.next = ''; }
        if (overlay) overlay.classList.remove('hidden');
      } else if (target === 'game2') {
        showScreen('game2');
        setPlayer2Face(state.selectedCharacter);
        // limpiar monedas en pantalla
        state2.coins.forEach(c => c.el.remove());
        state2.coins = [];
        // re-disponer chupitos (vacíos)
        requestAnimationFrame(() => placeShots());
        const overlay = getOverlay2();
        const title = document.getElementById('overlay2-title');
        const text = document.getElementById('overlay2-text');
        const btn = document.getElementById('overlay2-btn');
        if (title) title.textContent = 'PRUEBA 2';
        if (text) text.innerHTML = 'METE LAS MONEDAS EN<br>8 DE LOS 9 CHUPITOS<br><br>¡EVITA EL MÁS CERCANO!<br><br>1ER TAP: FIJAR POSICIÓN<br>2º TAP: FIJAR FUERZA';
        if (btn) btn.textContent = 'EMPEZAR';
        if (overlay) overlay.classList.remove('hidden');
      } else if (target === 'game3') {
        showScreen('game3');
        state3.running = false;
        state3.spinning = false;
        // construir tapete y rueda al saltar directo a esta pantalla
        requestAnimationFrame(() => { buildBetLayout(); buildWheel(); });
        const overlay = document.getElementById('game3-overlay');
        const title = document.getElementById('overlay3-title');
        const text = document.getElementById('overlay3-text');
        const btn = document.getElementById('overlay3-btn');
        if (title) title.textContent = 'PRUEBA 3 — RULETA';
        if (text) text.innerHTML = 'ELIGE UN NÚMERO DEL TAPETE.<br>LA RULETA GIRARÁ SOLA.<br><br>SI SALE TU NÚMERO,<br>PASAS DE PRUEBA.<br><br>SI SALE EL 0,<br>PIERDES UNA VIDA.';
        if (btn) { btn.textContent = 'EMPEZAR'; btn.dataset.next = ''; }
        if (overlay) overlay.classList.remove('hidden');
      } else if (target === 'game4') {
        showScreen('game4');
        setPlayer4Face(state.selectedCharacter);
        state4.obstacles.forEach(o => o.el.remove());
        state4.obstacles = [];
        const overlay = document.getElementById('game4-overlay');
        const title = document.getElementById('overlay4-title');
        const text = document.getElementById('overlay4-text');
        const btn = document.getElementById('overlay4-btn');
        if (title) title.textContent = 'PRUEBA 4 — RUMBO AL GARITO';
        if (text) text.innerHTML = 'SAL DE CODERE Y LLEGA AL GARITO.<br>ESQUIVA PIEDRAS, CHARCOS, AGUJEROS,<br>GATOS, SEÑALES Y PLANTAS.<br><br>IZQUIERDA / DERECHA O FLECHAS';
        if (btn) { btn.textContent = 'EMPEZAR'; btn.dataset.next = ''; }
        if (overlay) overlay.classList.remove('hidden');
      } else if (target === 'game5') {
        showScreen('game5');
        setPlayer5Face(state.selectedCharacter);
        state5.drops.forEach(d => d.el.remove());
        state5.drops = [];
        const overlay = document.getElementById('game5-overlay');
        const title = document.getElementById('overlay5-title');
        const text = document.getElementById('overlay5-text');
        const btn = document.getElementById('overlay5-btn');
        if (title) title.textContent = 'PRUEBA FINAL';
        if (text) text.innerHTML = 'LLENA EL WC EN<br>30 SEGUNDOS<br><br>IZQUIERDA / DERECHA<br>PARA APUNTAR';
        if (btn) btn.textContent = 'EMPEZAR';
        if (overlay) overlay.classList.remove('hidden');
      } else {
        showScreen(target);
      }

      playClickSound();
    });
  }

  // ========================================================================
  // INIT
  // ========================================================================
  function init() {
    setupControls();
    setupTap();
    setupGame4Controls();
    setupGame5Controls();
    setupShortcuts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
