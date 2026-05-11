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
    berenjena: '🍆',
    chile: '🌶️',
    brocoli: '🥦',
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
  // JUEGO: SPAWN, FÍSICA, COLISIÓN
  // ========================================================================
  // Valor según calorías: 1 (poco) a 5 (mucho). Tarta es especial: 10.
  // Verduras (berenjena, chile, brocoli) restan 5: ¡no las cojas!
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
    berenjena: -5,
    chile: -5,
    brocoli: -5,
  };

  // Pesos de aparición (la tarta es rara, las verduras también pero algo más)
  const FOOD_WEIGHTS = {
    gamba: 12, patatas: 12, calamar: 10,
    sangria: 10, cerveza: 10,
    hamburguesa: 10, pizza: 10, pollo: 10,
    chuleton: 8,
    tarta: 3,            // poco frecuente
    berenjena: 5, chile: 5, brocoli: 5,
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

  function isBadFood(type) {
    return (FOOD_VALUES[type] || 0) < 0;
  }

  function pickGoodFoodType() {
    for (let i = 0; i < 20; i++) {
      const t = pickFoodType();
      if (!isBadFood(t)) return t;
    }
    return 'gamba';
  }

  function spawnFoodInstance(type, x, vx) {
    const layer = getFoodLayer();
    const area = getGameArea();
    if (!layer || !area) return;

    const el = document.createElement('div');
    el.className = 'food-item';
    el.appendChild(makeEmojiEl(FOOD_EMOJI[type] || '🍴', 52));

    const w = 64, h = 64;
    const areaRect = area.getBoundingClientRect();
    const y = Math.max(140, areaRect.height * 0.18); // bajo Jose

    el.style.left = '0px';
    el.style.top = '0px';
    el.style.transform = `translate(${x}px, ${y}px)`;

    const baseSpeed = 140 + Math.min(180, state.elapsedMs / 1000 * 6);
    const vy = baseSpeed + Math.random() * 60;

    layer.appendChild(el);
    state.foods.push({ el, x, y, vx, vy, type, w, h, dead: false });
  }

  function spawnFood() {
    const type = pickFoodType();
    const area = getGameArea();
    if (!area) return;
    const areaRect = area.getBoundingClientRect();
    const w = 64;
    const minX = 16;
    const maxX = areaRect.width - w - 16;
    const x = minX + Math.random() * (maxX - minX);
    const vx = (Math.random() - 0.5) * 220;       // -110 a +110 px/s
    spawnFoodInstance(type, x, vx);

    // Si es verdura, viene de cebo una comida buena muy cerca (misma trayectoria)
    if (isBadFood(type)) {
      const goodType = pickGoodFoodType();
      const offset = (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 25);
      const baitX = Math.min(maxX, Math.max(minX, x + offset));
      const baitVx = vx + (Math.random() - 0.5) * 30;
      spawnFoodInstance(goodType, baitX, baitVx);
    }
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
    state.fullness = Math.max(0, Math.min(100, state.fullness + points));
    showFloatingPoints(f.x + f.w / 2, f.y, points, f.type === 'tarta');
    updateHUD();
    triggerEatAnim();
    if (points < 0) {
      playMissSound();
    } else {
      playEatSound();
      if (f.type === 'tarta') {
        // sonido especial para tarta
        setTimeout(() => beep(1568, 0.1, 'square', 0.12), 80);
      }
    }
    if (state.fullness >= 100) endGame(true);
  }

  function showFloatingPoints(x, y, points, special) {
    const layer = getFoodLayer();
    if (!layer) return;
    const el = document.createElement('div');
    const classes = ['floating-points'];
    if (special) classes.push('special');
    if (points < 0) classes.push('negative');
    el.className = classes.join(' ');
    el.textContent = (points >= 0 ? '+' : '') + points;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    layer.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  function missFood(f) {
    f.dead = true;
    f.el.classList.add('missed');
    setTimeout(() => f.el.remove(), 300);
    // verdura esquivada: no penaliza
    if ((FOOD_VALUES[f.type] || 0) < 0) return;
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
    questionTimerId: null,
    questionActive: false,
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
   * Coloca los 9 chupitos en rombo (1-2-3-2-1):
   *         A         ← fila 1
   *       D   B       ← fila 2
   *     G   E   C     ← fila 3 (E = centro)
   *       H   F       ← fila 4
   *         I         ← fila 5: el más cercano al jugador = trampa
   */
  function placeShots() {
    const cluster = getShotsCluster();
    if (!cluster) return;
    cluster.innerHTML = '';
    state2.shots = [];

    const cw = cluster.clientWidth;
    const ch = cluster.clientHeight;
    const SHOT_W = 64;
    const cx = cw / 2;
    const cy = ch / 2;
    // separación entre centros: la mayor posible que mantenga el rombo dentro del cluster
    const sx = Math.floor((cw - SHOT_W) / 4);
    // verticalmente juntamos más los chupitos para que no haya tanto hueco
    const sy = Math.floor(Math.min((ch - SHOT_W) / 4, sx * 0.55));

    const positions = [
      { x: cx,          y: cy - 2 * sy },                       // A — arriba
      { x: cx - sx,     y: cy - sy },                           // D — arriba-izda
      { x: cx + sx,     y: cy - sy },                           // B — arriba-dcha
      { x: cx - 2 * sx, y: cy },                                // G — izda
      { x: cx,          y: cy,          isCenter: true },       // E — centro
      { x: cx + 2 * sx, y: cy },                                // C — dcha
      { x: cx - sx,     y: cy + sy },                           // H — abajo-izda
      { x: cx + sx,     y: cy + sy },                           // F — abajo-dcha
      { x: cx,          y: cy + 2 * sy, isDanger: true },       // I — abajo = trampa
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
        isCenter: !!pos.isCenter,
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
    if (shot.isCenter) {
      // chupito central: bebe todo el grupo → se vacían las monedas
      markShotFilled(shot);
      showToast('OH NO, ¡AL MEDIO BEBEN TODOS!', true);
      playMissSound();
      setTimeout(() => {
        clearAllShots();
        updateHUD2();
        resetToAiming();
      }, 1500);
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

    const filledNonDanger = state2.shots.filter(s => s.filled && !s.danger && !s.isCenter).length;
    if (filledNonDanger >= 7) {
      setTimeout(() => endGame2(true), 600);
      return;
    }
    resetToAiming();
  }

  function clearAllShots() {
    state2.shots.forEach(shot => {
      shot.filled = false;
      shot.el.classList.remove('filled');
      if (shot.coin) {
        shot.coin.remove();
        shot.coin = null;
      }
    });
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
    const filledGood = state2.shots.filter(s => s.filled && !s.danger && !s.isCenter).length;
    const done = getShotsDoneEl(); if (done) done.textContent = String(filledGood);
    const fill = getShotsFillEl();
    if (fill) {
      fill.style.width = ((filledGood / 7) * 100) + '%';
      fill.classList.toggle('full', filledGood >= 7);
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
    if (state2.questionActive) return;
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

    if (!state2.questionActive) {
      updatePlayer2(dt);
      updateForce(dt);
      updateCoins(dt);
    }

    state2.rafId = requestAnimationFrame(game2Loop);
  }

  function clearQuestionTimer() {
    if (state2.questionTimerId) {
      clearTimeout(state2.questionTimerId);
      state2.questionTimerId = null;
    }
  }

  function showQuestion2() {
    if (!state2.running || state2.questionActive) return;
    state2.questionActive = true;
    const q = document.getElementById('game2-question');
    if (q) q.classList.remove('hidden');
    beep(220, 0.2, 'square', 0.15);
  }

  function answerQuestion2(saidYes) {
    if (!state2.questionActive) return;
    const q = document.getElementById('game2-question');
    if (q) q.classList.add('hidden');
    state2.questionActive = false;

    const msg = saidYes
      ? '¡PUES BEBES!'
      : '¡PUES LO HAS\nDICHO AHORA!\n¡BEBES!';
    showToast(msg, true);
    playMissSound();
    state2.lives -= 1;
    updateHUD2();
    if (state2.lives <= 0) {
      setTimeout(() => endGame2(false), 1900);
      return;
    }
    // si justo estaba en medio de algo raro, volvemos a apuntar
    if (state2.phase !== 'flying') {
      resetToAiming();
    }
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

    const q = document.getElementById('game2-question');
    if (q) q.classList.add('hidden');
    state2.questionActive = false;
    clearQuestionTimer();
    state2.questionTimerId = setTimeout(showQuestion2, 30000);

    state2.running = true;
    state2.rafId = requestAnimationFrame(game2Loop);
  }

  function endGame2(win) {
    state2.running = false;
    if (state2.rafId) cancelAnimationFrame(state2.rafId);
    clearQuestionTimer();
    state2.questionActive = false;
    const q = document.getElementById('game2-question');
    if (q) q.classList.add('hidden');
    const overlay = getOverlay2();
    const title = document.getElementById('overlay2-title');
    const text = document.getElementById('overlay2-text');
    const btn = document.getElementById('overlay2-btn');
    if (win) {
      if (title) title.textContent = '¡PRUEBA 2 SUPERADA!';
      if (text) text.innerHTML = `¡BIEN HECHO!<br>HAS EMBORRACHADO A TODOS.<br><br>AHORA AL CODERE<br>A PERDER DINERO.`;
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

  bindButton('q2-yes-btn', () => {
    playClickSound();
    answerQuestion2(true);
  });
  bindButton('q2-no-btn', () => {
    playClickSound();
    answerQuestion2(false);
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
    balance: -5,          // saldo en euros (empieza en -5€, baja 5€ por tirada)
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

  /** Pinta los 37 gajos con conic-gradient y coloca los números en el borde exterior */
  function buildWheel() {
    const wheel = document.getElementById('wheel');
    if (!wheel) return;
    wheel.querySelectorAll('.wheel-num').forEach(n => n.remove());

    const COLOR_MAP = { red: '#c41e3a', black: '#1a1a1a', green: '#128c3a' };
    const stops = WHEEL_ORDER.map((n, i) => {
      const start = i * SLOT_ANGLE;
      const end = (i + 1) * SLOT_ANGLE;
      return `${COLOR_MAP[colorOf(n)]} ${start}deg ${end}deg`;
    });
    // from -SLOT_ANGLE/2 → el gajo 0 queda centrado arriba (12 en punto)
    wheel.style.background =
      `conic-gradient(from ${-SLOT_ANGLE / 2}deg, ${stops.join(', ')})`;

    const radius = 96; // borde exterior del gajo
    WHEEL_ORDER.forEach((n, i) => {
      const angle = i * SLOT_ANGLE;
      const chip = document.createElement('div');
      chip.className = 'wheel-num';
      chip.textContent = String(n);
      // sin el rotate(-angle) final: el número queda orientado radialmente
      chip.style.transform = `rotate(${angle}deg) translateY(-${radius}px)`;
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
    state3.balance -= 5;
    updateHUD3();
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
          else if (num === 8) status.textContent = '¡EL 8 DEL CAPITÁN!';
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
    const b = document.getElementById('balance3');
    if (b) b.textContent = state3.balance + '€';
  }

  function startGame3() {
    buildBetLayout();
    buildWheel();
    state3.running = true;
    state3.spinning = false;
    state3.lives = (typeof state2 !== 'undefined' && state2.lives > 0) ? state2.lives : 3;
    state3.selected = null;
    state3.ballAngle = 0;
    state3.balance = -5;
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
        html = '¡SÍ SEÑOR!<br>EL 8 DEL CAPITÁN<br>DEL ATLÉTICO IBAÑES!';
      } else {
        html = `EL ${state3.selected} ERA TU NÚMERO.<br>SIGUES VIVO`;
      }
      html += `<br><br>¡SOLO HAS PERDIDO ${Math.abs(state3.balance)} EUROS!`;
      html += `<br><br>AHORA AL GARITO<br>A GASTAR LO POCO<br>QUE TE QUEDA`;
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
    joseVisible: false,
    joseFoodTimer: 0,
    joseFoodInterval: 700,  // ms entre comidas que lanza Jose
  };

  const FOOD_TYPES_LIST = Object.keys(FOOD_EMOJI);

  /** Jose lanza una comida desde su posición (derecha) hacia el centro/izquierda */
  function spawnJoseFood() {
    const layer = getObstaclesLayer();
    const area = getGame4Area();
    const jose = document.getElementById('jose-runner');
    if (!layer || !area || !jose) return;

    const w = 52, h = 52;
    const type = FOOD_TYPES_LIST[Math.floor(Math.random() * FOOD_TYPES_LIST.length)];

    const el = document.createElement('div');
    el.className = 'obstacle jose-food';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.appendChild(makeEmojiEl(FOOD_EMOJI[type] || '🍴', 40));

    const aw = area.clientWidth;
    // Spawn cerca de Jose (lado derecho, parte superior)
    const joseRect = jose.getBoundingClientRect();
    const areaRect = area.getBoundingClientRect();
    const startX = joseRect.left - areaRect.left + 10;
    const startY = joseRect.top - areaRect.top + 30;

    // Trayectoria: hacia la izquierda + abajo (con leve aleatoriedad)
    const vx = -180 - Math.random() * 120;
    const vy = state4.speed + 60 + Math.random() * 100;

    el.style.transform = `translate(${startX}px, ${startY}px)`;
    layer.appendChild(el);
    state4.obstacles.push({
      el, x: startX, y: startY, w, h, type: 'jose-food',
      vx, vy, dead: false,
    });
  }

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

    // El gato cruza la calle de un lado a otro mirando hacia donde corre.
    if (type === 'gato') {
      const aw = area.clientWidth;
      const goingRight = Math.random() < 0.5;
      const el = document.createElement('div');
      el.className = 'obstacle obstacle-cat';
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      const emoji = makeEmojiEl(OBSTACLE_EMOJI[type], 44);
      // 🐈 mira a la izquierda por defecto. Si va hacia la derecha, lo espejamos.
      if (goingRight) emoji.style.transform = 'scaleX(-1)';
      el.appendChild(emoji);

      const startX = goingRight ? -w - 8 : aw + 8;
      const startY = 80 + Math.random() * 120;
      const vx = goingRight ? 220 : -220;
      const vy = state4.speed;  // baja con el scroll como el resto del mundo

      el.style.transform = `translate(${startX}px, ${startY}px)`;
      layer.appendChild(el);
      state4.obstacles.push({
        el, x: startX, y: startY, w, h, type,
        vx, vy, dead: false,
      });
      return;
    }

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
    const aw = area.clientWidth;

    const player = getPlayer4();
    const playerRect = player ? player.getBoundingClientRect() : null;
    const areaRect = area.getBoundingClientRect();

    for (let i = state4.obstacles.length - 1; i >= 0; i--) {
      const o = state4.obstacles[i];
      if (o.dead) continue;
      // Velocidad por defecto = velocidad de scroll del mundo
      o.y += (o.vy != null ? o.vy : state4.speed) * dt;
      if (o.vx) o.x += o.vx * dt;
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

      if (o.y > ah + 20 || o.x < -o.w - 50 || o.x > aw + 50) {
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

    // CODERE está anclado abajo y se va deslizando hacia abajo al avanzar
    if (start) {
      const t = Math.min(1, state4.elapsed / 2);
      start.style.transform = `translateY(${t * 140}px)`;
      start.style.opacity = state4.elapsed > 2.5 ? '0' : '1';
    }
    // Fachada del GARITO: aparece desde el top cuando queda <25%
    if (end) {
      const remaining = 100 - progress;
      if (remaining < 25) {
        const t = (25 - remaining) / 25;          // 0 → 1
        end.style.transform = `translateY(${-260 + t * 260}px)`;
        end.style.opacity = '1';
      } else {
        end.style.transform = 'translateY(-260px)';
        end.style.opacity = '0';
      }
    }
  }

  /** Animación final: la puerta se abre y el jugador entra por ella */
  function playEnterDoorAnim() {
    const player = getPlayer4();
    const door = document.getElementById('bar-door');
    const area = getGame4Area();
    if (!player || !door || !area) return Promise.resolve();

    // 1) limpiar obstáculos en pantalla (fade)
    state4.obstacles.forEach(o => {
      o.dead = true;
      o.el.classList.add('fade-out');
      setTimeout(() => o.el.remove(), 450);
    });
    state4.obstacles = [];

    // 2) abrir la puerta
    door.classList.add('opening');

    // 3) tras la apertura, el jugador entra
    return new Promise(res => {
      setTimeout(() => {
        const playerRect = player.getBoundingClientRect();
        const doorRect = door.getBoundingClientRect();
        const dx = (doorRect.left + doorRect.width / 2) - (playerRect.left + playerRect.width / 2);
        const dy = (doorRect.top + doorRect.height * 0.4) - (playerRect.top + playerRect.height * 0.3);
        player.style.transition = 'transform 0.9s ease-in, opacity 0.5s ease-in 0.5s';
        player.style.transform = `translateX(calc(-50% + ${dx}px)) translateY(${dy}px) scale(0.16)`;
        player.style.opacity = '0';
        setTimeout(res, 1000);
      }, 450);
    });
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

    // A 3/4 del trayecto: dejar de spawnear obstáculos normales y aparece Jose lanzando comida
    const progressPct = Math.min(100, state4.elapsed / ROUTE_DURATION * 100);
    const joseActive = progressPct >= 75 && !state4.entering;

    state4.spawnTimer += dt * 1000;
    if (!joseActive && !state4.entering && state4.spawnTimer >= state4.spawnInterval) {
      state4.spawnTimer = 0;
      spawnObstacle();
    }

    // Aparición de Jose y lanzamiento de comida
    const jose = document.getElementById('jose-runner');
    if (joseActive) {
      if (!state4.joseVisible) {
        state4.joseVisible = true;
        if (jose) jose.classList.add('visible');
      }
      state4.joseFoodTimer += dt * 1000;
      if (state4.joseFoodTimer >= state4.joseFoodInterval) {
        state4.joseFoodTimer = 0;
        spawnJoseFood();
        // ligero aleatorio en el intervalo
        state4.joseFoodInterval = 550 + Math.random() * 350;
      }
    }

    updateObstacles4(dt);
    if (!state4.entering) updatePlayer4(dt);
    updateLandmarks4();
    updateHUD4();

    if (state4.elapsed >= ROUTE_DURATION && !state4.entering) {
      state4.entering = true;
      // Detener spawn de obstáculos a partir de ahora
      state4.spawnInterval = 1e9;
      playEnterDoorAnim().then(() => endGame4(true));
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
    state4.entering = false;
    state4.obstacles.forEach(o => o.el.remove());
    state4.obstacles = [];

    // restablecer transform/opacity del jugador (por si quedó animado de la run anterior)
    const player = getPlayer4();
    if (player) {
      player.style.transition = '';
      player.style.transform = 'translateX(-50%)';
      player.style.opacity = '1';
    }
    // restablecer la puerta del bar
    const door = document.getElementById('bar-door');
    if (door) door.classList.remove('opening');
    // restablecer Jose (oculto fuera de pantalla)
    state4.joseVisible = false;
    state4.joseFoodTimer = 0;
    const jose = document.getElementById('jose-runner');
    if (jose) jose.classList.remove('visible');

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
    bladder: 100,          // 100 = vejiga llena, 0 = vaciada (objetivo)
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
        // cada acierto vacía la vejiga
        state5.bladder = Math.max(0, state5.bladder - HIT_PER_DROP);
        updateHUD5();
        beep(880 + Math.random() * 80, 0.04, 'square', 0.06);
        if (state5.bladder <= 0) {
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
    const fill = document.getElementById('bladder-fill');
    const pct  = document.getElementById('bladder-pct');
    const time = document.getElementById('time5');
    if (fill) {
      // El bar siempre ocupa el 100% del track; se "vacía" con scaleX.
      fill.style.transform = 'scaleX(' + (state5.bladder / 100) + ')';
    }
    if (pct)  pct.textContent  = String(Math.ceil(state5.bladder));
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
    state5.bladder = 100;
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
