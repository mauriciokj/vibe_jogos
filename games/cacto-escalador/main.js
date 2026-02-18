(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const leftX = canvas.width * 0.2;
  const rightX = canvas.width * 0.8;
  const centerX = canvas.width * 0.5;

  const state = {
    mode: 'menu',
    progress: 0,
    score: 0,
    bonusScore: 0,
    speed: 180,
    side: 'left',
    targetSide: 'left',
    targetX: leftX,
    slowTimer: 0,
    fastTimer: 0,
    rngSeed: 0x1a2b3c4d,
    worldTime: 0,
    nextObstacleHeight: 240,
    nextPickupHeight: 340,
    obstacles: [],
    pickups: [],
    floatTexts: [],
    glassStripes: Array.from({ length: 9 }, (_, i) => ({ x: 36 + i * 42, drift: (i % 3) - 1 })),
    player: {
      x: leftX,
      y: canvas.height * 0.7,
      vx: 0,
      vy: 0,
      radius: 20,
      isSwitching: false,
      switchSpeed: 820,
      contactSeconds: 0,
      maxContact: 0.5,
      spines: 1,
    },
  };

  function seededRandom() {
    state.rngSeed = (1664525 * state.rngSeed + 1013904223) >>> 0;
    return state.rngSeed / 4294967296;
  }

  function pushFloatText(text, x, y, color) {
    state.floatTexts.push({ text, x, y, color, ttl: 1.1 });
  }

  function resetGame() {
    state.mode = 'playing';
    state.progress = 0;
    state.score = 0;
    state.bonusScore = 0;
    state.speed = 180;
    state.side = 'left';
    state.targetSide = 'left';
    state.targetX = leftX;
    state.slowTimer = 0;
    state.fastTimer = 0;
    state.worldTime = 0;
    state.nextObstacleHeight = 240;
    state.nextPickupHeight = 340;
    state.obstacles = [];
    state.pickups = [];
    state.floatTexts = [];
    state.glassStripes = Array.from({ length: 9 }, (_, i) => ({
      x: 36 + i * 42,
      drift: seededRandom() * 2 - 1,
    }));
    state.player.x = leftX;
    state.player.y = canvas.height * 0.7;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.isSwitching = false;
    state.player.contactSeconds = 0;
    state.player.spines = 1;
    ensureObstacles();
    ensurePickups();
  }

  function getDifficulty() {
    return 1 + state.progress / 1800;
  }

  function getCurrentClimbSpeed() {
    let current = state.speed;
    if (state.slowTimer > 0) {
      current = Math.max(130, current - 78);
    }
    if (state.fastTimer > 0) {
      current = Math.min(420, current + 72);
    }
    return current;
  }

  function randomObstacleType() {
    const roll = seededRandom();
    if (roll < 0.55) {
      return 'spike';
    }
    if (roll < 0.82) {
      return 'shard';
    }
    return 'rotor';
  }

  function makeObstacle(height) {
    const type = randomObstacleType();
    if (type === 'spike') {
      return {
        type,
        side: seededRandom() > 0.5 ? 'left' : 'right',
        height,
        size: 36 + seededRandom() * 34,
        hitRadius: 44,
        phase: seededRandom() * Math.PI * 2,
      };
    }

    if (type === 'shard') {
      return {
        type,
        side: seededRandom() > 0.5 ? 'left' : 'right',
        height,
        size: 44 + seededRandom() * 30,
        hitRadius: 52,
        phase: seededRandom() * Math.PI * 2,
      };
    }

    return {
      type,
      side: seededRandom() > 0.5 ? 'left' : 'right',
      height,
      size: 34 + seededRandom() * 20,
      hitRadius: 56,
      phase: seededRandom() * Math.PI * 2,
    };
  }

  function ensureObstacles() {
    const maxHeight = state.progress + canvas.height + 420;
    while (state.nextObstacleHeight < maxHeight) {
      state.obstacles.push(makeObstacle(state.nextObstacleHeight));
      const difficulty = getDifficulty();
      const gapBase = 124 - Math.min(30, difficulty * 8);
      const gapVar = 154 - Math.min(38, difficulty * 10);
      const gap = Math.max(80, gapBase + seededRandom() * gapVar);
      state.nextObstacleHeight += gap;

      if (difficulty > 1.9 && seededRandom() < 0.2) {
        state.obstacles.push(makeObstacle(state.nextObstacleHeight + 46 + seededRandom() * 40));
      }
    }

    const cleanupHeight = state.progress - 140;
    state.obstacles = state.obstacles.filter((obstacle) => obstacle.height > cleanupHeight);
  }

  function ensurePickups() {
    const maxHeight = state.progress + canvas.height + 500;
    while (state.nextPickupHeight < maxHeight) {
      const laneRoll = seededRandom();
      let lane = 'center';
      if (laneRoll < 0.42) {
        lane = 'left';
      } else if (laneRoll < 0.84) {
        lane = 'right';
      }

      const pickupRoll = seededRandom();
      let pickupType = 'flower';
      if (pickupRoll < 0.5) {
        pickupType = 'flower';
      } else if (pickupRoll < 0.8) {
        pickupType = 'dew';
      } else {
        pickupType = 'boost';
      }

      state.pickups.push({
        type: pickupType,
        lane,
        height: state.nextPickupHeight + seededRandom() * 70,
        radius: 14,
        bob: seededRandom() * Math.PI * 2,
        collected: false,
      });

      const difficulty = getDifficulty();
      const gap = 236 + seededRandom() * 220 - Math.min(70, difficulty * 28);
      state.nextPickupHeight += Math.max(148, gap);
    }

    const cleanupHeight = state.progress - 120;
    state.pickups = state.pickups.filter((pickup) => pickup.height > cleanupHeight && !pickup.collected);
  }

  function pickupX(pickup) {
    const sway = Math.sin(state.worldTime * 3 + pickup.bob) * (pickup.lane === 'center' ? 16 : 7);
    if (pickup.lane === 'left') {
      return leftX + sway;
    }
    if (pickup.lane === 'right') {
      return rightX + sway;
    }
    return centerX + sway;
  }

  function toggleSide() {
    if (state.mode !== 'playing') {
      return;
    }

    const wallX = state.side === 'left' ? leftX : rightX;
    const anchored = Math.abs(state.player.x - wallX) <= 6 && !state.player.isSwitching;
    if (!anchored) {
      return;
    }

    if (state.side === 'left') {
      state.targetSide = 'right';
      state.targetX = rightX;
    } else {
      state.targetSide = 'left';
      state.targetX = leftX;
    }
    state.player.isSwitching = true;
  }

  function startGame() {
    if (state.mode === 'menu' || state.mode === 'gameover') {
      resetGame();
    }
  }

  function updateFloatingTexts(dt) {
    for (const entry of state.floatTexts) {
      entry.ttl -= dt;
      entry.y -= 26 * dt;
    }
    state.floatTexts = state.floatTexts.filter((entry) => entry.ttl > 0);
  }

  function collectPickup(pickup) {
    pickup.collected = true;
    const x = pickupX(pickup);
    const y = canvas.height - (pickup.height - state.progress);

    if (pickup.type === 'flower') {
      state.bonusScore += 40;
      pushFloatText('+40', x, y, { r: 255, g: 237, b: 121 });
      return;
    }

    if (pickup.type === 'dew') {
      state.slowTimer = Math.min(6, state.slowTimer + 3.2);
      state.fastTimer = Math.max(0, state.fastTimer - 1);
      state.speed = Math.max(140, state.speed - 70);
      state.player.contactSeconds = Math.max(0, state.player.contactSeconds - 0.08);
      pushFloatText('SLOW', x, y, { r: 159, g: 232, b: 255 });
      return;
    }

    state.fastTimer = Math.min(6, state.fastTimer + 2.8);
    state.slowTimer = Math.max(0, state.slowTimer - 1);
    state.speed = Math.min(360, state.speed + 34);
    pushFloatText('TURBO', x, y, { r: 255, g: 162, b: 94 });
  }

  function update(dt) {
    updateFloatingTexts(dt);

    if (state.mode === 'playing') {
      state.worldTime += dt;
      const difficulty = getDifficulty();
      state.speed = Math.min(355, state.speed + (2 + difficulty * 1.1) * dt);
      if (state.slowTimer > 0) {
        state.slowTimer = Math.max(0, state.slowTimer - dt);
      }
      if (state.fastTimer > 0) {
        state.fastTimer = Math.max(0, state.fastTimer - dt);
      }
      state.progress += getCurrentClimbSpeed() * dt;
      state.score = Math.floor(state.progress / 14) + state.bonusScore;

      if (state.player.isSwitching) {
        const direction = Math.sign(state.targetX - state.player.x);
        const step = state.player.switchSpeed * dt;
        const remaining = Math.abs(state.targetX - state.player.x);
        if (remaining <= step) {
          state.player.x = state.targetX;
          state.player.vx = 0;
          state.player.isSwitching = false;
          state.side = state.targetSide;
        } else {
          state.player.vx = direction * state.player.switchSpeed;
          state.player.x += state.player.vx * dt;
        }
      } else {
        state.player.x = state.targetX;
        state.player.vx = 0;
      }

      ensureObstacles();
      ensurePickups();

      const contactSide = state.player.isSwitching
        ? (state.player.x < canvas.width * 0.5 ? 'left' : 'right')
        : state.side;

      let touching = false;
      let touchMultiplier = 1;
      for (const obstacle of state.obstacles) {
        const y = canvas.height - (obstacle.height - state.progress);
        if (Math.abs(y - state.player.y) > obstacle.hitRadius || obstacle.side !== contactSide) {
          continue;
        }

        let hazardScale = 1;
        if (obstacle.type === 'rotor') {
          const pulse = 0.7 + Math.abs(Math.sin(state.worldTime * 8 + obstacle.phase));
          hazardScale = pulse;
        } else if (obstacle.type === 'shard') {
          hazardScale = 1.2;
        }

        touching = true;
        touchMultiplier = Math.max(touchMultiplier, hazardScale);
      }

      if (touching) {
        state.player.contactSeconds += dt * touchMultiplier;
      } else {
        state.player.contactSeconds = Math.max(0, state.player.contactSeconds - dt * 0.1);
      }

      for (const pickup of state.pickups) {
        if (pickup.collected) {
          continue;
        }
        const py = canvas.height - (pickup.height - state.progress);
        if (py < -40 || py > canvas.height + 40) {
          continue;
        }

        const px = pickupX(pickup);
        const rangeX = pickup.lane === 'center' ? 42 : 34;
        if (Math.abs(px - state.player.x) <= rangeX && Math.abs(py - state.player.y) <= 30) {
          collectPickup(pickup);
        }
      }

      if (state.player.contactSeconds >= state.player.maxContact) {
        state.mode = 'falling';
        state.player.spines = 0;
        state.player.vy = -20;
      }
    } else if (state.mode === 'falling') {
      state.player.vy += 880 * dt;
      state.player.y += state.player.vy * dt;
      state.player.x += (state.targetX - state.player.x) * dt * 3;
      if (state.player.y - state.player.radius > canvas.height + 30) {
        state.mode = 'gameover';
      }
    }
  }

  function drawGlassShaft() {
    ctx.fillStyle = '#d8eeff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const driftTime = state.worldTime * 24;
    for (const stripe of state.glassStripes) {
      const offset = Math.sin(driftTime * 0.02 + stripe.x * 0.07) * 10 + stripe.drift * 10;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(stripe.x + offset, 0, 4, canvas.height);
    }

    const wallWidth = 56;
    ctx.fillStyle = '#7db2d8';
    ctx.fillRect(0, 0, wallWidth, canvas.height);
    ctx.fillRect(canvas.width - wallWidth, 0, wallWidth, canvas.height);

    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.fillRect(10, 0, 6, canvas.height);
    ctx.fillRect(canvas.width - 16, 0, 6, canvas.height);
  }

  function drawObstacle(obstacle) {
    const y = canvas.height - (obstacle.height - state.progress);
    if (y < -90 || y > canvas.height + 90) {
      return;
    }

    const isLeft = obstacle.side === 'left';
    const wallX = isLeft ? 56 : canvas.width - 56;

    if (obstacle.type === 'spike') {
      ctx.fillStyle = '#5a7892';
      ctx.beginPath();
      ctx.moveTo(wallX, y);
      ctx.lineTo(isLeft ? wallX + obstacle.size : wallX - obstacle.size, y - 22);
      ctx.lineTo(isLeft ? wallX + obstacle.size * 0.8 : wallX - obstacle.size * 0.8, y + 26);
      ctx.closePath();
      ctx.fill();
      return;
    }

    if (obstacle.type === 'shard') {
      ctx.fillStyle = '#4b6883';
      const dir = isLeft ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(wallX, y);
      ctx.lineTo(wallX + dir * obstacle.size, y - 14);
      ctx.lineTo(wallX + dir * (obstacle.size + 18), y + 8);
      ctx.lineTo(wallX + dir * obstacle.size, y + 32);
      ctx.closePath();
      ctx.fill();
      return;
    }

    const pulse = 0.9 + Math.abs(Math.sin(state.worldTime * 8 + obstacle.phase)) * 0.45;
    const radius = obstacle.size * pulse;
    const centerXWall = isLeft ? wallX + radius * 0.9 : wallX - radius * 0.9;
    ctx.fillStyle = '#35556f';
    ctx.beginPath();
    ctx.arc(centerXWall, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#d8edf8';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      const a = state.worldTime * 4 + obstacle.phase + (Math.PI * 2 * i) / 6;
      const inner = radius * 0.45;
      const outer = radius * 0.95;
      ctx.beginPath();
      ctx.moveTo(centerXWall + Math.cos(a) * inner, y + Math.sin(a) * inner);
      ctx.lineTo(centerXWall + Math.cos(a) * outer, y + Math.sin(a) * outer);
      ctx.stroke();
    }
  }

  function drawPickup(pickup) {
    if (pickup.collected) {
      return;
    }
    const y = canvas.height - (pickup.height - state.progress);
    if (y < -50 || y > canvas.height + 50) {
      return;
    }

    const x = pickupX(pickup);
    if (pickup.type === 'flower') {
      ctx.fillStyle = '#ffd65f';
      for (let i = 0; i < 6; i += 1) {
        const a = pickup.bob + state.worldTime * 1.5 + (Math.PI * 2 * i) / 6;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * 8, y + Math.sin(a) * 8, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ff965a';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (pickup.type === 'dew') {
      ctx.fillStyle = '#8ee8ff';
      ctx.beginPath();
      ctx.moveTo(x, y - 12);
      ctx.bezierCurveTo(x + 10, y - 2, x + 8, y + 12, x, y + 14);
      ctx.bezierCurveTo(x - 8, y + 12, x - 10, y - 2, x, y - 12);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(x - 2, y - 4, 2.5, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    ctx.fillStyle = '#ff9b4e';
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 12);
    ctx.lineTo(x + 1, y - 12);
    ctx.lineTo(x - 4, y - 1);
    ctx.lineTo(x + 8, y - 1);
    ctx.lineTo(x - 2, y + 14);
    ctx.lineTo(x + 1, y + 3);
    ctx.lineTo(x - 8, y + 3);
    ctx.closePath();
    ctx.fill();
  }

  function drawFloatingTexts() {
    ctx.textAlign = 'center';
    ctx.font = '700 18px Trebuchet MS, sans-serif';
    for (const entry of state.floatTexts) {
      const alpha = Math.max(0, Math.min(1, entry.ttl));
      ctx.fillStyle = `rgba(${entry.color.r}, ${entry.color.g}, ${entry.color.b}, ${alpha})`;
      ctx.fillText(entry.text, entry.x, entry.y);
    }
    ctx.textAlign = 'start';
  }

  function drawCactus() {
    const { x, y, radius, spines } = state.player;
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = '#2e9a52';
    ctx.beginPath();
    ctx.ellipse(0, 0, radius, radius * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#237d43';
    ctx.fillRect(-radius - 8, -14, 9, 26);
    ctx.fillRect(radius - 1, -4, 9, 28);

    if (spines > 0) {
      ctx.strokeStyle = '#f4ffe0';
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i += 1) {
        const angle = (Math.PI * 2 * i) / 12;
        const sx = Math.cos(angle) * (radius - 2);
        const sy = Math.sin(angle) * (radius - 2) * 1.15;
        const ex = Math.cos(angle) * (radius + 7);
        const ey = Math.sin(angle) * (radius + 7) * 1.15;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
    }

    ctx.fillStyle = '#12261a';
    ctx.beginPath();
    ctx.arc(-5, -4, 3.5, 0, Math.PI * 2);
    ctx.arc(6, -4, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawHud() {
    const safeRatio = 1 - state.player.contactSeconds / state.player.maxContact;
    const safe = Math.max(0, Math.min(1, safeRatio));

    ctx.fillStyle = 'rgba(9, 26, 45, 0.72)';
    ctx.fillRect(14, 14, canvas.width - 28, 84);

    ctx.fillStyle = '#eef7ff';
    ctx.font = '600 22px Trebuchet MS, sans-serif';
    ctx.fillText(`Altura: ${Math.floor(state.progress)}m`, 26, 45);
    ctx.font = '600 17px Trebuchet MS, sans-serif';
    ctx.fillText(`Score: ${state.score}`, 26, 69);

    ctx.fillStyle = '#28435f';
    ctx.fillRect(canvas.width - 154, 42, 112, 14);
    ctx.fillStyle = `rgb(${Math.round(220 - safe * 120)}, ${Math.round(120 + safe * 120)}, 90)`;
    ctx.fillRect(canvas.width - 154, 42, 112 * safe, 14);

    ctx.fillStyle = '#eff7ff';
    ctx.font = '600 12px Trebuchet MS, sans-serif';
    ctx.fillText('Espinhos', canvas.width - 152, 36);

    ctx.fillStyle = '#294560';
    ctx.fillRect(canvas.width - 154, 70, 112, 8);
    const slowRatio = Math.min(1, state.slowTimer / 3.2);
    if (slowRatio > 0) {
      ctx.fillStyle = '#7fdfff';
      ctx.fillRect(canvas.width - 154, 70, 112 * slowRatio, 8);
    }
    ctx.fillStyle = '#d5f8ff';
    ctx.fillText('Freio', canvas.width - 152, 67);

    ctx.fillStyle = '#5d3d2f';
    ctx.fillRect(canvas.width - 154, 84, 112, 8);
    const fastRatio = Math.min(1, state.fastTimer / 2.8);
    if (fastRatio > 0) {
      ctx.fillStyle = '#ff9c5d';
      ctx.fillRect(canvas.width - 154, 84, 112 * fastRatio, 8);
    }
    ctx.fillStyle = '#ffd7c0';
    ctx.fillText('Turbo', canvas.width - 152, 81);
  }

  function drawOverlay() {
    if (state.mode === 'menu') {
      ctx.fillStyle = 'rgba(5, 18, 32, 0.7)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#eff9ff';
      ctx.font = '700 44px Trebuchet MS, sans-serif';
      ctx.fillText('CACTO', 100, 290);
      ctx.fillText('ESCALADOR', 74, 338);
      ctx.font = '600 20px Trebuchet MS, sans-serif';
      ctx.fillText('Troque lado so encostado na parede', 42, 405);
      ctx.fillText('Flor = +score | Gota = freia | Raio = turbo', 24, 435);
      ctx.fillText('Espaco alterna | Enter inicia', 84, 465);
    }

    if (state.mode === 'falling') {
      ctx.fillStyle = 'rgba(177, 52, 41, 0.18)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (state.mode === 'gameover') {
      ctx.fillStyle = 'rgba(5, 18, 32, 0.72)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff2ef';
      ctx.font = '700 42px Trebuchet MS, sans-serif';
      ctx.fillText('ESPINHOS QUEBRADOS', 24, 320);
      ctx.font = '600 26px Trebuchet MS, sans-serif';
      ctx.fillText(`Altura final: ${Math.floor(state.progress)}m`, 102, 366);
      ctx.fillText('Pressione Enter para reiniciar', 78, 410);
    }
  }

  function render() {
    drawGlassShaft();
    for (const obstacle of state.obstacles) {
      drawObstacle(obstacle);
    }
    for (const pickup of state.pickups) {
      drawPickup(pickup);
    }
    drawCactus();
    drawFloatingTexts();
    if (state.mode !== 'menu') {
      drawHud();
    }
    drawOverlay();
  }

  function renderGameToText() {
    const nearestObstacles = state.obstacles
      .map((obstacle) => ({
        type: obstacle.type,
        side: obstacle.side,
        worldHeight: Math.round(obstacle.height),
        screenY: Math.round(canvas.height - (obstacle.height - state.progress)),
      }))
      .filter((obstacle) => obstacle.screenY >= -90 && obstacle.screenY <= canvas.height + 90)
      .slice(0, 10);

    const visiblePickups = state.pickups
      .map((pickup) => ({
        type: pickup.type,
        lane: pickup.lane,
        worldHeight: Math.round(pickup.height),
        screenY: Math.round(canvas.height - (pickup.height - state.progress)),
      }))
      .filter((pickup) => pickup.screenY >= -60 && pickup.screenY <= canvas.height + 60)
      .slice(0, 8);

    const wallX = state.side === 'left' ? leftX : rightX;
    const canSwitch = Math.abs(state.player.x - wallX) <= 6 && !state.player.isSwitching;

    return JSON.stringify({
      coordSystem: {
        origin: 'top-left',
        axisX: 'right-positive',
        axisY: 'down-positive',
      },
      mode: state.mode,
      player: {
        x: Math.round(state.player.x),
        y: Math.round(state.player.y),
        vx: Number(state.player.vx.toFixed(2)),
        vy: Number(state.player.vy.toFixed(2)),
        side: state.side,
        targetSide: state.targetSide,
        isSwitching: state.player.isSwitching,
        canSwitch,
        spinesIntact: state.player.spines > 0,
      },
      climb: {
        progressMeters: Math.round(state.progress),
        score: state.score,
        bonusScore: state.bonusScore,
        baseSpeed: Number(state.speed.toFixed(2)),
        currentSpeed: Number(getCurrentClimbSpeed().toFixed(2)),
        slowTimer: Number(state.slowTimer.toFixed(2)),
        fastTimer: Number(state.fastTimer.toFixed(2)),
        difficulty: Number(getDifficulty().toFixed(2)),
      },
      contact: {
        seconds: Number(state.player.contactSeconds.toFixed(2)),
        maxSeconds: state.player.maxContact,
      },
      obstacles: nearestObstacles,
      pickups: visiblePickups,
      controls: ['a', 'd', 'arrowleft', 'arrowright', 'space', 'enter', 'f'],
    });
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = (ms) => {
    const stepMs = 1000 / 60;
    const steps = Math.max(1, Math.round(ms / stepMs));
    const dt = stepMs / 1000;
    for (let i = 0; i < steps; i += 1) {
      update(dt);
    }
    render();
  };

  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();

    if (key === 'enter') {
      startGame();
      return;
    }

    if (key === 'f') {
      if (!document.fullscreenElement) {
        canvas.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
      return;
    }

    if (key === 'a' || key === 'arrowleft' || key === 'd' || key === 'arrowright' || key === ' ') {
      toggleSide();
    }
  });

  let previous = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - previous) / 1000);
    previous = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  render();
  requestAnimationFrame(loop);
})();
