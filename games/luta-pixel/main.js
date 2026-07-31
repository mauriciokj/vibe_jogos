(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const touchControls = document.querySelector("#touch-controls");
  ctx.imageSmoothingEnabled = false;

  const W = 960;
  const H = 540;
  const FLOOR = 442;
  const GRAVITY = 1850;
  const keys = new Set();
  const pressed = new Set();

  const roster = [
    { name: "KAEL", title: "PUNHO RUBRO", color: "#ff3b4f", accent: "#ffcf48", speed: 238, power: 1.00, defense: 1.00, cell: [0, 0], special: "ONDA CARMESIM" },
    { name: "NYX", title: "LÂMINA VIOLETA", color: "#a65cff", accent: "#2ee9ff", speed: 270, power: .90, defense: .91, cell: [1, 0], special: "CORTE FANTASMA" },
    { name: "BRUTUS", title: "TITÃ DE AÇO", color: "#ff8b22", accent: "#ffe15b", speed: 188, power: 1.25, defense: 1.18, cell: [0, 1], special: "MARTELO SÍSMICO" },
    { name: "YARA", title: "GINGA SOLAR", color: "#19d6b4", accent: "#ffe15b", speed: 255, power: .95, defense: .96, cell: [1, 1], special: "MEIA-LUA SOLAR" },
  ];

  const state = {
    mode: "title",
    selected: 0,
    playerWins: 0,
    cpuWins: 0,
    round: 1,
    timer: 60,
    countdown: 0,
    banner: "",
    bannerTime: 0,
    shake: 0,
    flash: 0,
    particles: [],
    projectiles: [],
    player: null,
    cpu: null,
    cpuChoice: 1,
    lastTime: performance.now(),
    demoTime: 0,
  };

  const atlas = new Image();
  atlas.src = "assets/fighters.png";

  let audio = null;
  function initAudio() {
    if (audio) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) audio = new AudioCtx();
  }

  function tone(freq, duration, type = "square", volume = .035, slide = 0) {
    initAudio();
    if (!audio) return;
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  function makeFighter(character, x, isCPU) {
    return {
      character,
      isCPU,
      x,
      y: FLOOR,
      vx: 0,
      vy: 0,
      health: 100,
      meter: 0,
      facing: isCPU ? -1 : 1,
      grounded: true,
      blocking: false,
      action: "idle",
      actionTime: 0,
      attackId: 0,
      attackHit: false,
      hurtTime: 0,
      invuln: 0,
      aiThink: 0,
      aiMove: 0,
      aiBlock: 0,
      combo: 0,
      comboTime: 0,
    };
  }

  function beginMatch() {
    state.playerWins = 0;
    state.cpuWins = 0;
    state.round = 1;
    state.cpuChoice = (state.selected + 1 + Math.floor(Math.random() * 3)) % 4;
    beginRound();
  }

  function beginRound() {
    state.player = makeFighter(roster[state.selected], 245, false);
    state.cpu = makeFighter(roster[state.cpuChoice], 715, true);
    state.timer = 60;
    state.countdown = 2.8;
    state.banner = `ROUND ${state.round}`;
    state.bannerTime = 2.8;
    state.mode = "countdown";
    state.projectiles.length = 0;
    state.particles.length = 0;
    touchControls.classList.add("show");
    tone(180, .12, "square", .04);
  }

  function finishRound(winner) {
    if (state.mode !== "fight") return;
    state.mode = "roundOver";
    state.countdown = 2.8;
    if (winner === "player") state.playerWins++;
    if (winner === "cpu") state.cpuWins++;
    state.banner = winner === "draw" ? "EMPATE" : winner === "player" ? "VOCÊ VENCEU" : "CPU VENCEU";
    state.bannerTime = 2.8;
    tone(winner === "player" ? 440 : 110, .5, "sawtooth", .05, winner === "player" ? 440 : -50);
  }

  function advanceRoundFlow(dt) {
    state.countdown -= dt;
    if (state.mode === "countdown" && state.countdown <= 0) {
      state.mode = "fight";
      state.banner = "LUTE!";
      state.bannerTime = .8;
      tone(420, .18, "square", .055, 350);
    } else if (state.mode === "roundOver" && state.countdown <= 0) {
      if (state.playerWins >= 2 || state.cpuWins >= 2) {
        state.mode = "matchOver";
        state.banner = state.playerWins >= 2 ? "CAMPEÃO!" : "DERROTA";
        state.bannerTime = 999;
        touchControls.classList.remove("show");
      } else {
        state.round++;
        beginRound();
      }
    }
  }

  const attackData = {
    light: { duration: .28, activeStart: .08, activeEnd: .17, range: 72, damage: 7, stun: .2, push: 120, meter: 9 },
    heavy: { duration: .48, activeStart: .16, activeEnd: .30, range: 92, damage: 12, stun: .34, push: 220, meter: 14 },
    special: { duration: .66, activeStart: .22, activeEnd: .33, range: 68, damage: 17, stun: .44, push: 270, meter: 0 },
  };

  function startAttack(f, kind) {
    if (state.mode !== "fight" || f.hurtTime > 0 || f.actionTime > 0 || f.blocking) return false;
    if (kind === "special" && f.meter < 50) return false;
    f.action = kind;
    f.actionTime = attackData[kind].duration;
    f.attackId++;
    f.attackHit = false;
    if (kind === "special") {
      f.meter -= 50;
      tone(110, .34, "sawtooth", .035, 520);
    } else {
      tone(kind === "light" ? 190 : 120, .08, "square", .025, kind === "light" ? 70 : -30);
    }
    return true;
  }

  function spawnHit(x, y, color, blocked = false) {
    const count = blocked ? 7 : 14;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = (blocked ? 60 : 110) + Math.random() * 180;
      state.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: .18 + Math.random() * .2, max: .38, color, size: 2 + Math.random() * 6 });
    }
    state.shake = blocked ? 3 : 7;
    state.flash = blocked ? .02 : .06;
  }

  function takeHit(target, attacker, data, projectile = false) {
    if (target.invuln > 0) return;
    const incomingSide = Math.sign(attacker.x - target.x);
    const guarding = target.blocking && target.grounded && target.facing === incomingSide;
    const raw = data.damage * attacker.character.power / target.character.defense;
    const damage = Math.max(1, Math.round(raw * (guarding ? .22 : 1)));
    target.health = Math.max(0, target.health - damage);
    target.meter = Math.min(100, target.meter + (guarding ? 5 : 11));
    attacker.meter = Math.min(100, attacker.meter + (data.meter || 0));
    target.combo = 0;
    if (guarding) {
      attacker.combo = 0;
    } else {
      attacker.combo = attacker.comboTime > 0 ? attacker.combo + 1 : 1;
      attacker.comboTime = .75;
    }
    if (!guarding) {
      target.hurtTime = data.stun;
      target.actionTime = 0;
      target.action = "hurt";
      target.vx = attacker.facing * data.push;
      if (data.damage >= 16) {
        target.vy = -170;
        target.grounded = false;
      }
    } else {
      target.vx = attacker.facing * data.push * .3;
    }
    spawnHit((target.x + attacker.x) / 2, target.y - 108, guarding ? "#85f5ff" : attacker.character.accent, guarding);
    tone(guarding ? 320 : 70, guarding ? .06 : .12, guarding ? "triangle" : "square", .045, guarding ? 180 : -20);
    if (projectile) attacker.attackHit = true;
  }

  function updateAttack(f, enemy, dt) {
    if (f.actionTime <= 0) return;
    const data = attackData[f.action];
    if (!data) return;
    const elapsed = data.duration - f.actionTime;
    if (f.action === "special" && elapsed >= data.activeStart && !f.attackHit) {
      f.attackHit = true;
      state.projectiles.push({
        owner: f,
        x: f.x + f.facing * 64,
        y: f.y - 92,
        vx: f.facing * (f.character === roster[2] ? 350 : 470),
        life: 1.45,
        color: f.character.color,
        accent: f.character.accent,
        size: f.character === roster[2] ? 24 : 18,
      });
    }
    if (f.action !== "special" && !f.attackHit && elapsed >= data.activeStart && elapsed <= data.activeEnd) {
      const dx = enemy.x - f.x;
      if (Math.sign(dx) === f.facing && Math.abs(dx) <= data.range + 34 && Math.abs(enemy.y - f.y) < 115) {
        f.attackHit = true;
        takeHit(enemy, f, data);
      }
    }
    f.actionTime = Math.max(0, f.actionTime - dt);
    if (f.actionTime === 0 && f.hurtTime <= 0) f.action = "idle";
  }

  function updateProjectiles(dt) {
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i];
      p.x += p.vx * dt;
      p.life -= dt;
      const target = p.owner === state.player ? state.cpu : state.player;
      if (Math.abs(target.x - p.x) < 42 && Math.abs((target.y - 95) - p.y) < 72) {
        takeHit(target, p.owner, attackData.special, true);
        state.projectiles.splice(i, 1);
      } else if (p.life <= 0 || p.x < -50 || p.x > W + 50) {
        state.projectiles.splice(i, 1);
      }
    }
  }

  function playerInput(f) {
    if (f.hurtTime > 0) return;
    f.blocking = (keys.has("s") || keys.has("arrowdown")) && f.grounded && f.actionTime <= 0;
    if (!f.blocking && f.actionTime <= 0) {
      let move = 0;
      if (keys.has("a") || keys.has("arrowleft")) move--;
      if (keys.has("d") || keys.has("arrowright")) move++;
      f.vx = move * f.character.speed;
      if ((pressed.has("w") || pressed.has("arrowup")) && f.grounded) {
        f.vy = -650;
        f.grounded = false;
        tone(150, .08, "square", .02, 80);
      }
      if (pressed.has("j") || pressed.has("b")) startAttack(f, "light");
      if (pressed.has("k")) startAttack(f, "heavy");
      if (pressed.has("l")) startAttack(f, "special");
    } else if (f.blocking) {
      f.vx *= .5;
    }
  }

  function cpuInput(f, enemy, dt) {
    if (f.hurtTime > 0) return;
    f.aiThink -= dt;
    f.aiBlock = Math.max(0, f.aiBlock - dt);
    const dist = Math.abs(enemy.x - f.x);
    if (f.aiThink <= 0) {
      f.aiThink = .18 + Math.random() * .22;
      f.aiMove = dist > 98 ? Math.sign(enemy.x - f.x) : dist < 66 ? -Math.sign(enemy.x - f.x) : 0;
      if (enemy.actionTime > .08 && dist < 120 && Math.random() < .40) f.aiBlock = .28 + Math.random() * .25;
      if (dist < 118 && f.actionTime <= 0 && f.aiBlock <= 0 && Math.random() < .70) {
        const r = Math.random();
        if (f.meter >= 50 && r < .23) startAttack(f, "special");
        else startAttack(f, r < .68 ? "light" : "heavy");
      } else if (dist < 230 && f.meter >= 50 && Math.random() < .13) {
        startAttack(f, "special");
      } else if (dist > 180 && f.grounded && Math.random() < .035) {
        f.vy = -630;
        f.grounded = false;
      }
    }
    f.blocking = f.aiBlock > 0 && f.grounded && f.actionTime <= 0;
    if (!f.blocking && f.actionTime <= 0) f.vx = f.aiMove * f.character.speed * .82;
  }

  function updateFighter(f, enemy, dt) {
    f.facing = enemy.x >= f.x ? 1 : -1;
    f.hurtTime = Math.max(0, f.hurtTime - dt);
    f.invuln = Math.max(0, f.invuln - dt);
    f.comboTime = Math.max(0, f.comboTime - dt);
    if (f.comboTime === 0) f.combo = 0;
    if (!f.grounded) f.vy += GRAVITY * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.vx *= Math.pow(f.grounded ? .0007 : .09, dt);
    if (f.y >= FLOOR) {
      if (!f.grounded && f.vy > 250) tone(70, .07, "square", .015);
      f.y = FLOOR;
      f.vy = 0;
      f.grounded = true;
    }
    f.x = Math.max(70, Math.min(W - 70, f.x));
    updateAttack(f, enemy, dt);
  }

  function separateFighters() {
    const a = state.player;
    const b = state.cpu;
    const min = 74;
    const dx = b.x - a.x;
    if (Math.abs(dx) < min && Math.abs(a.y - b.y) < 110) {
      const push = (min - Math.abs(dx)) / 2;
      const sign = dx >= 0 ? 1 : -1;
      a.x -= push * sign;
      b.x += push * sign;
    }
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }

  function update(dt) {
    dt = Math.min(.034, dt);
    state.demoTime += dt;
    state.bannerTime = Math.max(0, state.bannerTime - dt);
    state.shake = Math.max(0, state.shake - 30 * dt);
    state.flash = Math.max(0, state.flash - dt);

    if (state.mode === "title") {
      if (pressed.has("enter") || pressed.has(" ")) {
        state.mode = "select";
        tone(220, .12, "square", .04, 220);
      }
    } else if (state.mode === "select") {
      if (pressed.has("a") || pressed.has("arrowleft")) state.selected = (state.selected + 3) % 4;
      if (pressed.has("d") || pressed.has("arrowright")) state.selected = (state.selected + 1) % 4;
      if (pressed.has("w") || pressed.has("arrowup")) state.selected = (state.selected + 2) % 4;
      if (pressed.has("s") || pressed.has("arrowdown")) state.selected = (state.selected + 2) % 4;
      if (pressed.has("enter") || pressed.has(" ") || pressed.has("j")) beginMatch();
    } else if (["countdown", "roundOver"].includes(state.mode)) {
      advanceRoundFlow(dt);
    } else if (state.mode === "fight") {
      state.timer = Math.max(0, state.timer - dt);
      playerInput(state.player);
      cpuInput(state.cpu, state.player, dt);
      updateFighter(state.player, state.cpu, dt);
      updateFighter(state.cpu, state.player, dt);
      separateFighters();
      updateProjectiles(dt);
      if (state.player.health <= 0 || state.cpu.health <= 0 || state.timer <= 0) {
        const winner = state.player.health === state.cpu.health ? "draw" : state.player.health > state.cpu.health ? "player" : "cpu";
        finishRound(winner);
      }
    } else if (state.mode === "matchOver") {
      if (pressed.has("enter") || pressed.has(" ") || pressed.has("j")) {
        state.mode = "select";
        touchControls.classList.remove("show");
      }
    }
    updateParticles(dt);
    pressed.clear();
  }

  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function text(str, x, y, size, color = "#fff", align = "center", font = "'Press Start 2P'") {
    ctx.save();
    ctx.font = `${size}px ${font}, monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#080212";
    ctx.fillText(str, x + 3, y + 3);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  function drawArena() {
    const grad = ctx.createLinearGradient(0, 0, 0, FLOOR);
    grad.addColorStop(0, "#10052c");
    grad.addColorStop(.55, "#291158");
    grad.addColorStop(1, "#ff396d");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    rect(0, 74, W, 4, "#25134b");
    ctx.fillStyle = "#f5539c";
    ctx.beginPath();
    ctx.arc(760, 150, 72, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffbc56";
    for (let y = 102; y < 200; y += 11) ctx.fillRect(690, y, 140, 4);

    const buildings = [0, 115, 205, 342, 462, 585, 690, 815, 900];
    buildings.forEach((x, i) => {
      const bw = 70 + (i % 3) * 22;
      const bh = 100 + (i % 4) * 35;
      rect(x, FLOOR - bh - 55, bw, bh + 55, i % 2 ? "#13092d" : "#1c0c3c");
      for (let wy = FLOOR - bh - 40; wy < FLOOR - 38; wy += 22) {
        for (let wx = x + 10; wx < x + bw - 8; wx += 18) rect(wx, wy, 6, 8, (wx + wy) % 3 ? "#20e3ff" : "#ffce43");
      }
    });
    text("ARENA", 480, 196, 28, "#ff3b84", "center", "'Black Ops One'");
    text("ZERO", 480, 227, 28, "#25e8ff", "center", "'Black Ops One'");

    ctx.strokeStyle = "#a93eab";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const x = i * 80;
      ctx.moveTo(480, FLOOR);
      ctx.lineTo(x, H);
    }
    for (let y = FLOOR; y <= H; y += 18) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    rect(0, FLOOR, W, 6, "#ffcf48");
  }

  function drawSprite(f, scale = 1) {
    const char = f.character;
    const [cx, cy] = char.cell;
    const cell = 627;
    const attack = f.actionTime > 0 && attackData[f.action] ? f.action : null;
    const elapsed = attack ? attackData[attack].duration - f.actionTime : 0;
    const active = attack && elapsed > attackData[attack].activeStart;
    const lunge = active ? (attack === "light" ? 12 : attack === "heavy" ? 22 : 8) : 0;
    const bob = f.grounded && f.action === "idle" ? Math.sin(state.demoTime * 5 + (f.isCPU ? 2 : 0)) * 2 : 0;
    const squash = f.blocking ? .92 : f.hurtTime > 0 ? .88 : 1;
    const dw = 252 * scale;
    const dh = 252 * scale * squash;
    ctx.save();
    ctx.translate(Math.round(f.x + f.facing * lunge), Math.round(f.y + bob));
    if (f.facing < 0) ctx.scale(-1, 1);
    if (f.hurtTime > 0 && Math.floor(f.hurtTime * 30) % 2 === 0) ctx.globalAlpha = .48;
    if (f.blocking) {
      ctx.fillStyle = `${char.accent}33`;
      ctx.strokeStyle = char.accent;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(24, -112, 68, -1.3, 1.3);
      ctx.fill();
      ctx.stroke();
    }
    ctx.drawImage(atlas, cx * cell, cy * cell, cell, cell, -dw / 2, -dh, dw, dh);
    ctx.restore();
  }

  function drawProjectiles() {
    state.projectiles.forEach((p) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(state.demoTime * 8 * Math.sign(p.vx));
      ctx.fillStyle = `${p.color}55`;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-p.size, 0); ctx.lineTo(p.size, 0);
      ctx.moveTo(0, -p.size); ctx.lineTo(0, p.size);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawParticles() {
    state.particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      rect(p.x, p.y, p.size, p.size, p.color);
    });
    ctx.globalAlpha = 1;
  }

  function drawBar(x, y, w, value, color, flip = false) {
    rect(x - 4, y - 4, w + 8, 24, "#080212");
    rect(x, y, w, 16, "#3e274a");
    const amount = w * Math.max(0, value) / 100;
    rect(flip ? x + w - amount : x, y, amount, 16, color);
    rect(x, y, w, 4, "rgba(255,255,255,.28)");
  }

  function drawHud() {
    const p = state.player;
    const c = state.cpu;
    text(p.character.name, 48, 30, 13, p.character.color, "left");
    text(c.character.name, 912, 30, 13, c.character.color, "right");
    drawBar(48, 48, 352, p.health, p.health < 25 ? "#ff304f" : p.character.color);
    drawBar(560, 48, 352, c.health, c.health < 25 ? "#ff304f" : c.character.color, true);
    rect(48, 71, 180, 8, "#2a193c");
    rect(48, 71, 180 * p.meter / 100, 8, p.character.accent);
    rect(732, 71, 180, 8, "#2a193c");
    rect(912 - 180 * c.meter / 100, 71, 180 * c.meter / 100, 8, c.character.accent);
    text(String(Math.ceil(state.timer)).padStart(2, "0"), 480, 48, 28, "#fff4d2");
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = i < state.playerWins ? p.character.accent : "#39264a";
      ctx.beginPath(); ctx.arc(48 + i * 20, 91, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = i < state.cpuWins ? c.character.accent : "#39264a";
      ctx.beginPath(); ctx.arc(912 - i * 20, 91, 6, 0, Math.PI * 2); ctx.fill();
    }
    if (p.combo >= 2 && p.comboTime > 0) text(`${p.combo} HITS`, 90, 142, 18, p.character.accent, "left", "'Black Ops One'");
    if (p.meter >= 50) text("ESPECIAL!", 48, 91, 8, p.character.accent, "left");
  }

  function drawTitle() {
    drawArena();
    const fauxLeft = makeFighter(roster[0], 230, false);
    const fauxRight = makeFighter(roster[1], 730, true);
    fauxLeft.facing = 1; fauxRight.facing = -1;
    drawSprite(fauxLeft, 1.2);
    drawSprite(fauxRight, 1.2);
    rect(0, 0, W, H, "rgba(8,2,18,.38)");
    text("LUTA", 480, 176, 98, "#fff4d2", "center", "'Black Ops One'");
    text("DUELO NEON", 480, 244, 22, "#20e3ff");
    rect(328, 294, 304, 48, "#080212");
    rect(334, 300, 292, 36, Math.sin(state.demoTime * 5) > 0 ? "#ff2975" : "#6e164e");
    text("ENTER PARA JOGAR", 480, 319, 12, "#fff4d2");
    text("4 LUTADORES • MELHOR DE 3", 480, 378, 10, "#ffcf48");
    text("A/D MOVER  W PULAR  S DEFENDER", 480, 416, 8, "#cdb9df");
    text("J LEVE  K PESADO  L ESPECIAL", 480, 439, 8, "#cdb9df");
  }

  function drawSelect() {
    ctx.fillStyle = "#100520";
    ctx.fillRect(0, 0, W, H);
    text("ESCOLHA SEU LUTADOR", 480, 48, 28, "#fff4d2", "center", "'Black Ops One'");
    text("A/D OU SETAS • ENTER CONFIRMA", 480, 78, 8, "#9e86b8");
    roster.forEach((char, i) => {
      const x = 54 + i * 226;
      const y = 112;
      const selected = i === state.selected;
      rect(x - 6, y - 6, 194, 298, selected ? char.accent : "#2b1742");
      rect(x, y, 182, 286, selected ? "#291052" : "#180b2c");
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, 182, 205);
      ctx.clip();
      const fake = makeFighter(char, x + 91, false);
      fake.y = y + 214;
      fake.facing = i % 2 === 0 ? 1 : -1;
      drawSprite(fake, .86);
      ctx.restore();
      text(char.name, x + 91, y + 229, 16, char.color);
      text(char.title, x + 91, y + 255, 7, char.accent);
      const stats = `VEL ${Math.round(char.speed / 30)}  FOR ${Math.round(char.power * 8)}`;
      text(stats, x + 91, y + 276, 6, "#cdb9df");
      if (selected) text("▼", x + 91, y - 22 + Math.sin(state.demoTime * 7) * 4, 16, char.accent);
    });
    text(`ESPECIAL: ${roster[state.selected].special}`, 480, 454, 11, roster[state.selected].accent);
    text("PRESSIONE ENTER", 480, 495, 10, "#fff4d2");
  }

  function drawFight() {
    drawArena();
    drawProjectiles();
    const fighters = [state.player, state.cpu].sort((a, b) => a.y - b.y);
    fighters.forEach((f) => drawSprite(f));
    drawParticles();
    drawHud();
    if (state.bannerTime > 0) {
      const main = state.banner;
      const wide = main.length > 8;
      rect(0, 218, W, 84, "rgba(8,2,18,.75)");
      text(main, 480, 260, wide ? 42 : 58, main === "LUTE!" ? "#ffcf48" : "#fff4d2", "center", "'Black Ops One'");
    }
  }

  function drawMatchOver() {
    drawFight();
    rect(0, 0, W, H, "rgba(8,2,18,.74)");
    const won = state.playerWins >= 2;
    text(won ? "CAMPEÃO!" : "DERROTA", 480, 184, 70, won ? "#ffcf48" : "#ff3b6b", "center", "'Black Ops One'");
    text(`${state.playerWins}  —  ${state.cpuWins}`, 480, 258, 28, "#fff4d2");
    text(won ? `${state.player.character.name} DOMINA A ARENA` : "A ARENA COBRA SEU PREÇO", 480, 307, 11, won ? state.player.character.accent : "#cdb9df");
    rect(340, 356, 280, 46, "#ff2975");
    text("ENTER: NOVA LUTA", 480, 380, 10, "#fff4d2");
  }

  function render() {
    ctx.save();
    const sx = state.shake ? (Math.random() - .5) * state.shake : 0;
    const sy = state.shake ? (Math.random() - .5) * state.shake : 0;
    ctx.translate(Math.round(sx), Math.round(sy));
    if (state.mode === "title") drawTitle();
    else if (state.mode === "select") drawSelect();
    else if (state.mode === "matchOver") drawMatchOver();
    else drawFight();
    ctx.restore();
    if (state.flash > 0) rect(0, 0, W, H, `rgba(255,255,255,${state.flash * 5})`);
  }

  function gameLoop(now) {
    const dt = (now - state.lastTime) / 1000;
    state.lastTime = now;
    update(dt);
    render();
    requestAnimationFrame(gameLoop);
  }

  function canvasPoint(event) {
    const r = canvas.getBoundingClientRect();
    return { x: (event.clientX - r.left) * W / r.width, y: (event.clientY - r.top) * H / r.height };
  }

  canvas.addEventListener("pointerdown", (event) => {
    initAudio();
    const p = canvasPoint(event);
    if (state.mode === "title") {
      pressed.add("enter");
    } else if (state.mode === "select") {
      if (p.y > 100 && p.y < 420) {
        const choice = Math.max(0, Math.min(3, Math.floor((p.x - 42) / 226)));
        if (choice === state.selected) beginMatch();
        else { state.selected = choice; tone(260, .06, "square", .025); }
      } else if (p.y > 440) beginMatch();
    } else if (state.mode === "matchOver") {
      pressed.add("enter");
    }
  });

  function normalizeKey(key) { return key.toLowerCase(); }
  window.addEventListener("keydown", (event) => {
    const key = normalizeKey(event.key);
    if (["a", "b", "d", "w", "s", "j", "k", "l", "enter", " ", "arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) event.preventDefault();
    initAudio();
    if (!keys.has(key)) pressed.add(key);
    keys.add(key);
    if (key === "f") {
      if (!document.fullscreenElement) canvas.parentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    }
  });
  window.addEventListener("keyup", (event) => keys.delete(normalizeKey(event.key)));
  window.addEventListener("blur", () => { keys.clear(); pressed.clear(); });

  document.querySelectorAll("[data-key]").forEach((button) => {
    const key = button.dataset.key;
    const down = (event) => {
      event.preventDefault(); initAudio();
      if (!keys.has(key)) pressed.add(key);
      keys.add(key); button.classList.add("active");
    };
    const up = (event) => {
      event.preventDefault(); keys.delete(key); button.classList.remove("active");
    };
    button.addEventListener("pointerdown", down);
    button.addEventListener("pointerup", up);
    button.addEventListener("pointercancel", up);
    button.addEventListener("pointerleave", up);
  });

  window.render_game_to_text = () => JSON.stringify({
    coordinateSystem: "origin top-left; x increases right; y increases down; arena floor y=442",
    mode: state.mode,
    selectedFighter: roster[state.selected].name,
    availableFighters: roster.map((c, i) => ({ index: i, name: c.name, special: c.special })),
    round: state.round,
    timer: Number(state.timer.toFixed(1)),
    score: { playerRounds: state.playerWins, cpuRounds: state.cpuWins, firstTo: 2 },
    player: state.player ? {
      name: state.player.character.name, x: Math.round(state.player.x), y: Math.round(state.player.y),
      vx: Math.round(state.player.vx), vy: Math.round(state.player.vy), health: state.player.health,
      meter: Math.round(state.player.meter), action: state.player.blocking ? "block" : state.player.action,
      grounded: state.player.grounded, facing: state.player.facing,
    } : null,
    cpu: state.cpu ? {
      name: state.cpu.character.name, x: Math.round(state.cpu.x), y: Math.round(state.cpu.y),
      health: state.cpu.health, meter: Math.round(state.cpu.meter), action: state.cpu.blocking ? "block" : state.cpu.action,
      grounded: state.cpu.grounded, facing: state.cpu.facing,
    } : null,
    projectiles: state.projectiles.map((p) => ({ owner: p.owner.isCPU ? "cpu" : "player", x: Math.round(p.x), y: Math.round(p.y) })),
    controls: state.mode === "fight" ? { move: "A/D", jump: "W", block: "S", light: "J", heavy: "K", special: "L (costs 50 meter)" } : { select: "A/D/arrows", confirm: "Enter/Space/J" },
  });

  window.advanceTime = (ms) => {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i++) update(1 / 60);
    render();
  };

  atlas.addEventListener("load", render);
  requestAnimationFrame(gameLoop);
})();
