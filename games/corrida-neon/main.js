(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const muteButton = document.getElementById("mute");
  const statusNode = document.getElementById("screen-reader-status");
  const TAU = Math.PI * 2;
  const LANES = [-0.68, 0, 0.68];
  const COLORS = ["#ff2ea6", "#38f8ff", "#ffcf4a", "#8d5cff", "#58ff9d"];

  let width = 1280;
  let height = 720;
  let dpr = 1;
  let lastTime = performance.now();
  let audioContext = null;
  let muted = false;
  let trafficId = 0;
  const keys = Object.create(null);
  const pointer = { active: false, x: 0, y: 0 };

  const state = {
    mode: "menu",
    elapsed: 0,
    distance: 0,
    score: 0,
    best: Number(localStorage.getItem("neon-apex-best") || 0),
    speed: 0,
    cruiseSpeed: 178,
    maxSpeed: 305,
    x: 0,
    steer: 0,
    integrity: 100,
    nitro: 100,
    nitroActive: false,
    nearMisses: 0,
    combo: 1,
    comboTimer: 0,
    difficulty: 1,
    shake: 0,
    flash: 0,
    invulnerable: 0,
    roadPhase: 0,
    traffic: [],
    particles: [],
    spawnTimer: 0,
    message: "",
    messageTimer: 0,
  };

  function resize() {
    width = Math.max(320, window.innerWidth);
    height = Math.max(480, window.innerHeight);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function resetGame() {
    Object.assign(state, {
      mode: "playing", elapsed: 0, distance: 0, score: 0, speed: 90,
      x: 0, steer: 0, integrity: 100, nitro: 100, nitroActive: false,
      nearMisses: 0, combo: 1, comboTimer: 0, difficulty: 1,
      shake: 0, flash: 0, invulnerable: 0, roadPhase: 0,
      traffic: [], particles: [], spawnTimer: 0.45,
      message: "CORRA!", messageTimer: 1.3,
    });
    for (let i = 0; i < 6; i += 1) spawnTraffic(1350 + i * 680);
    statusNode.textContent = "Corrida iniciada";
    beep(190, 0.08, "sawtooth", 0.055);
    beep(380, 0.1, "square", 0.045, 0.09);
  }

  function spawnTraffic(forcedZ) {
    const level = state.difficulty;
    const lane = LANES[Math.floor(Math.random() * LANES.length)];
    const nearSameLane = state.traffic.some((car) => Math.abs(car.lane - lane) < 0.1 && Math.abs(car.z - (forcedZ || 4800)) < 700);
    const car = {
      id: ++trafficId,
      lane: nearSameLane ? lane * -1 : lane,
      x: nearSameLane ? lane * -1 : lane,
      targetLane: nearSameLane ? lane * -1 : lane,
      z: forcedZ || 4400 + Math.random() * 2200,
      speed: 70 + Math.random() * (68 + level * 8),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      type: Math.random() < Math.min(0.2 + level * 0.012, 0.38) ? "truck" : "car",
      driftTimer: 1.2 + Math.random() * 3.4,
      near: false,
      hit: false,
    };
    state.traffic.push(car);
  }

  function roadCurveAt(z) {
    const p = state.roadPhase + z * 0.00052;
    const strength = 0.13 + Math.min(0.2, state.difficulty * 0.012);
    return Math.sin(p) * strength + Math.sin(p * 0.43 + 1.1) * strength * 0.55;
  }

  function horizonY() { return height * (height < 600 ? 0.26 : 0.285); }

  function project(z, roadX = 0) {
    const hz = horizonY();
    const near = height * 0.93;
    const t = Math.max(0, Math.min(1, 1 - z / 6200));
    const eased = Math.pow(t, 2.05);
    const y = hz + (near - hz) * eased;
    const roadHalf = width * (0.035 + eased * 0.54);
    const center = width / 2 + roadCurveAt(z) * width * eased + roadX * roadHalf;
    return { x: center, y, scale: 0.08 + eased * 1.12, roadHalf, eased };
  }

  function pressed(...names) { return names.some((name) => keys[name]); }

  function update(dt) {
    dt = Math.min(dt, 0.05);
    if (state.mode !== "playing") return;

    state.elapsed += dt;
    state.difficulty = Math.min(12, 1 + state.distance / 7.5);
    state.roadPhase += dt * state.speed * 0.00072;
    state.invulnerable = Math.max(0, state.invulnerable - dt);
    state.shake = Math.max(0, state.shake - dt * 22);
    state.flash = Math.max(0, state.flash - dt * 2.8);
    state.messageTimer = Math.max(0, state.messageTimer - dt);
    state.comboTimer = Math.max(0, state.comboTimer - dt);
    if (state.comboTimer === 0) state.combo = 1;

    let steering = 0;
    if (pressed("ArrowLeft", "KeyA")) steering -= 1;
    if (pressed("ArrowRight", "KeyD")) steering += 1;
    if (pointer.active) {
      if (pointer.y > height * 0.56 && pointer.x < width * 0.38) steering -= 1;
      if (pointer.y > height * 0.56 && pointer.x > width * 0.62) steering += 1;
    }

    const nitroPressed = pressed("ShiftLeft", "ShiftRight", "Space") || (pointer.active && pointer.y < height * 0.55);
    state.nitroActive = nitroPressed && state.nitro > 0.4 && state.speed > 115;
    const accelerating = pressed("ArrowUp", "KeyW") || pointer.active;
    const braking = pressed("ArrowDown", "KeyS");
    let targetSpeed = accelerating ? state.cruiseSpeed + Math.min(45, state.difficulty * 3) : 138;
    if (braking) targetSpeed = 72;
    if (state.nitroActive) {
      targetSpeed = state.maxSpeed + Math.min(42, state.difficulty * 2);
      state.nitro = Math.max(0, state.nitro - dt * 26);
      if (Math.random() < dt * 40) exhaustParticle(true);
    } else {
      state.nitro = Math.min(100, state.nitro + dt * 4.4);
      if (Math.random() < dt * 11) exhaustParticle(false);
    }
    const rate = targetSpeed > state.speed ? 48 : 72;
    state.speed += Math.sign(targetSpeed - state.speed) * Math.min(Math.abs(targetSpeed - state.speed), rate * dt);

    state.steer += (steering - state.steer) * Math.min(1, dt * 12);
    state.x += state.steer * dt * (0.72 + state.speed / 410);
    state.x -= roadCurveAt(0) * dt * state.speed * 0.0015;
    if (Math.abs(state.x) > 1.05) {
      state.speed = Math.max(72, state.speed - dt * 115);
      state.x = Math.max(-1.18, Math.min(1.18, state.x));
      if (Math.random() < dt * 22) roadDust();
    }

    const advance = state.speed * dt * 3.45;
    state.distance += state.speed * dt * 0.0061;
    state.score += state.speed * dt * 0.36 * state.combo;

    state.spawnTimer -= dt;
    const maxTraffic = Math.min(15, 6 + Math.floor(state.difficulty * 0.62));
    if (state.spawnTimer <= 0 && state.traffic.length < maxTraffic) {
      spawnTraffic();
      state.spawnTimer = Math.max(0.28, 1.05 - state.difficulty * 0.035) + Math.random() * 0.62;
    }

    for (let i = state.traffic.length - 1; i >= 0; i -= 1) {
      const car = state.traffic[i];
      car.z -= Math.max(45, advance - car.speed * dt * 1.65);
      car.driftTimer -= dt;
      if (car.driftTimer <= 0 && car.z > 1000 && Math.random() < Math.min(0.6, 0.18 + state.difficulty * 0.018)) {
        const laneIndex = LANES.reduce((best, value, idx) => Math.abs(value - car.targetLane) < Math.abs(LANES[best] - car.targetLane) ? idx : best, 0);
        const direction = Math.random() < 0.5 ? -1 : 1;
        car.targetLane = LANES[Math.max(0, Math.min(2, laneIndex + direction))];
        car.driftTimer = 1.6 + Math.random() * 3;
      }
      car.x += (car.targetLane - car.x) * Math.min(1, dt * 0.8);

      if (car.z < 300 && !car.hit && Math.abs(state.x - car.x) < (car.type === "truck" ? 0.38 : 0.31)) {
        collide(car);
      } else if (car.z < 210 && !car.near && !car.hit && Math.abs(state.x - car.x) < 0.58) {
        car.near = true;
        state.nearMisses += 1;
        state.combo = Math.min(5, state.combo + 0.5);
        state.comboTimer = 3.4;
        state.score += 450 * state.combo;
        state.message = "QUASE!  +" + Math.round(450 * state.combo);
        state.messageTimer = 1.1;
        beep(760, 0.08, "sine", 0.035);
      }
      if (car.z < -260) state.traffic.splice(i, 1);
    }

    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.size *= Math.pow(0.26, dt);
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }

  function collide(car) {
    if (state.invulnerable > 0) return;
    car.hit = true;
    state.integrity = Math.max(0, state.integrity - (car.type === "truck" ? 34 : 25));
    state.speed = Math.max(58, state.speed * 0.49);
    state.combo = 1;
    state.comboTimer = 0;
    state.invulnerable = 1.25;
    state.shake = 15;
    state.flash = 1;
    state.message = "IMPACTO";
    state.messageTimer = 0.9;
    burst(project(0, state.x).x, height * 0.77, car.color);
    beep(72, 0.2, "sawtooth", 0.08);
    if (state.integrity <= 0) endGame();
  }

  function endGame() {
    state.mode = "gameover";
    state.nitroActive = false;
    state.best = Math.max(state.best, Math.floor(state.score));
    localStorage.setItem("neon-apex-best", String(state.best));
    statusNode.textContent = `Fim de corrida. Pontuação ${Math.floor(state.score)}.`;
    beep(130, 0.24, "sawtooth", 0.06);
    beep(78, 0.42, "square", 0.04, 0.2);
  }

  function exhaustParticle(boosted) {
    const playerX = project(0, state.x).x;
    state.particles.push({
      x: playerX + (Math.random() - 0.5) * 28,
      y: height * 0.88,
      vx: (Math.random() - 0.5) * 28,
      vy: 75 + Math.random() * 80,
      gravity: -6,
      life: boosted ? 0.48 : 0.26,
      maxLife: boosted ? 0.48 : 0.26,
      size: boosted ? 13 + Math.random() * 10 : 5 + Math.random() * 5,
      color: boosted ? (Math.random() < 0.5 ? "#39f7ff" : "#b43cff") : "#ff4ab9",
      glow: true,
    });
  }

  function roadDust() {
    const playerX = project(0, state.x).x;
    state.particles.push({
      x: playerX,
      y: height * 0.84,
      vx: (Math.random() - 0.5) * 100,
      vy: -30 - Math.random() * 55,
      gravity: 48,
      life: 0.55,
      maxLife: 0.55,
      size: 8 + Math.random() * 12,
      color: "#8b74b8",
      glow: false,
    });
  }

  function burst(x, y, color) {
    for (let i = 0; i < 42; i += 1) {
      const a = Math.random() * TAU;
      const speed = 90 + Math.random() * 380;
      state.particles.push({
        x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        gravity: 220, life: 0.35 + Math.random() * 0.75, maxLife: 1.1,
        size: 2 + Math.random() * 8,
        color: Math.random() < 0.38 ? "#ffffff" : color, glow: true,
      });
    }
  }

  function beep(frequency, duration, type, volume, delay = 0) {
    if (muted) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const start = audioContext.currentTime + delay;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.58), start + duration);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
    } catch (_) { /* Audio is enhancement-only. */ }
  }

  function polygon(points, fill, stroke, lineWidth = 1) {
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }

  function drawBackground() {
    const hz = horizonY();
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#040314");
    sky.addColorStop(0.48, "#100827");
    sky.addColorStop(0.66, "#2b0b48");
    sky.addColorStop(1, "#080713");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(width * 0.5, hz, 0, width * 0.5, hz, width * 0.52);
    glow.addColorStop(0, "rgba(255,32,185,.32)");
    glow.addColorStop(0.25, "rgba(103,37,190,.14)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, hz * 2.3);
    ctx.restore();

    drawMoon(width * 0.77, hz * 0.43, Math.min(width, height) * 0.105);
    drawStars(hz);
    drawCity(hz);
  }

  function drawMoon(x, y, radius) {
    ctx.save();
    ctx.shadowBlur = radius * 0.45;
    ctx.shadowColor = "#ff3ebb";
    const gradient = ctx.createLinearGradient(x, y - radius, x, y + radius);
    gradient.addColorStop(0, "#ff9cde");
    gradient.addColorStop(0.5, "#ee38b3");
    gradient.addColorStop(1, "#7a1a88");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "destination-out";
    for (let i = -3; i <= 3; i += 1) ctx.fillRect(x - radius, y + i * radius * 0.25, radius * 2, radius * 0.055);
    ctx.restore();
  }

  function drawStars(hz) {
    ctx.fillStyle = "rgba(154,239,255,.75)";
    for (let i = 0; i < 54; i += 1) {
      const x = (i * 193.7) % width;
      const y = 13 + ((i * 71.3) % Math.max(30, hz * 0.72));
      const twinkle = 0.5 + Math.sin(state.elapsed * 2 + i) * 0.35;
      ctx.globalAlpha = twinkle;
      ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawCity(hz) {
    const base = hz + height * 0.032;
    ctx.fillStyle = "#070611";
    for (let i = 0; i < 34; i += 1) {
      const bw = 28 + (i * 17) % 55;
      const x = ((i * 89) % (width + 100)) - 50;
      const bh = 25 + (i * 47) % Math.max(45, hz * 0.42);
      ctx.fillRect(x, base - bh, bw, bh);
      ctx.fillStyle = i % 3 === 0 ? "rgba(255,48,180,.45)" : "rgba(55,233,255,.42)";
      for (let wy = base - bh + 9; wy < base - 5; wy += 12) {
        if ((wy + i) % 4) ctx.fillRect(x + 7, wy, 3, 2);
      }
      ctx.fillStyle = "#070611";
    }
    ctx.strokeStyle = "rgba(57,244,255,.42)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, base + 0.5);
    ctx.lineTo(width, base + 0.5);
    ctx.stroke();
  }

  function drawRoad() {
    const segments = 72;
    const farZ = 6200;
    for (let i = segments - 1; i >= 0; i -= 1) {
      const zFar = (i + 1) / segments * farZ;
      const zNear = i / segments * farZ;
      const a = project(zFar);
      const b = project(zNear);
      const stripe = Math.floor((zNear + state.distance * 170) / 220) % 2 === 0;
      const roadColor = stripe ? "#0d1021" : "#101329";
      polygon([
        [a.x - a.roadHalf, a.y], [a.x + a.roadHalf, a.y],
        [b.x + b.roadHalf, b.y], [b.x - b.roadHalf, b.y],
      ], roadColor);

      const shoulderW1 = a.roadHalf * 0.10;
      const shoulderW2 = b.roadHalf * 0.10;
      const edgeColor = stripe ? "#ff2fb0" : "#6a165e";
      polygon([[a.x-a.roadHalf-shoulderW1,a.y],[a.x-a.roadHalf,a.y],[b.x-b.roadHalf,b.y],[b.x-b.roadHalf-shoulderW2,b.y]], edgeColor);
      polygon([[a.x+a.roadHalf,a.y],[a.x+a.roadHalf+shoulderW1,a.y],[b.x+b.roadHalf+shoulderW2,b.y],[b.x+b.roadHalf,b.y]], edgeColor);

      if (stripe) {
        for (const laneMark of [-1 / 3, 1 / 3]) {
          const mw1 = Math.max(0.5, a.roadHalf * 0.012);
          const mw2 = Math.max(0.5, b.roadHalf * 0.012);
          polygon([
            [a.x + a.roadHalf * laneMark - mw1, a.y], [a.x + a.roadHalf * laneMark + mw1, a.y],
            [b.x + b.roadHalf * laneMark + mw2, b.y], [b.x + b.roadHalf * laneMark - mw2, b.y],
          ], "rgba(115,247,255,.72)");
        }
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(255,39,175,.22)";
    ctx.shadowBlur = 16;
    ctx.shadowColor = "#ff27af";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let z = 0; z <= 6200; z += 170) {
        const p = project(z);
        const x = p.x + side * p.roadHalf;
        if (z === 0) ctx.moveTo(x, p.y); else ctx.lineTo(x, p.y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSpeedLines() {
    if (!state.nitroActive) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(97,247,255,.42)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 32; i += 1) {
      const x = (i * 211 + state.elapsed * 1900) % (width + 200) - 100;
      const y = horizonY() + ((i * 83 + state.elapsed * 1200) % (height - horizonY()));
      const dx = (x - width / 2) * 0.12;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx, y + 38 + (i % 4) * 18);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTraffic() {
    const visible = state.traffic.filter((car) => car.z > 0 && car.z < 6200).sort((a, b) => b.z - a.z);
    for (const car of visible) {
      const p = project(car.z, car.x);
      drawCar(p.x, p.y, p.scale * (car.type === "truck" ? 1.12 : 1), car.color, false, car.type, car.hit ? 0.28 : 1);
    }
  }

  function drawCar(x, y, scale, color, player, type = "car", alpha = 1) {
    const w = (player ? 118 : type === "truck" ? 104 : 86) * scale;
    const h = (player ? 118 : type === "truck" ? 116 : 82) * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (player) ctx.rotate(-state.steer * 0.045);

    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = player ? "rgba(48,242,255,.16)" : color + "24";
    ctx.shadowBlur = 24 * scale;
    ctx.shadowColor = player ? "#35efff" : color;
    ctx.beginPath();
    ctx.ellipse(0, 4, w * 0.68, h * 0.25, 0, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 14 * scale;
    ctx.shadowColor = color;

    const body = ctx.createLinearGradient(-w / 2, -h, w / 2, 0);
    body.addColorStop(0, player ? "#dffeff" : color);
    body.addColorStop(0.3, player ? "#31cfe5" : color);
    body.addColorStop(1, player ? "#103456" : "#15152b");
    polygon([
      [-w*.48,0],[-w*.42,-h*.56],[-w*.24,-h*.88],[w*.24,-h*.88],
      [w*.42,-h*.56],[w*.48,0],[w*.31,h*.09],[-w*.31,h*.09],
    ], body, player ? "#7af8ff" : color, Math.max(1, scale * 1.5));

    ctx.shadowBlur = 0;
    polygon([[-w*.25,-h*.8],[-w*.16,-h*.48],[w*.16,-h*.48],[w*.25,-h*.8]], "#080b20", "rgba(162,248,255,.65)", Math.max(.5,scale));
    ctx.fillStyle = "#050610";
    ctx.fillRect(-w * .5, -h * .31, w * .11, h * .34);
    ctx.fillRect(w * .39, -h * .31, w * .11, h * .34);

    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = 14 * scale;
    ctx.shadowColor = player ? "#ff36b6" : "#ff244f";
    ctx.fillStyle = player ? "#ff4ac2" : "#ff3557";
    ctx.fillRect(-w*.34,-h*.12,w*.2,Math.max(2,h*.065));
    ctx.fillRect(w*.14,-h*.12,w*.2,Math.max(2,h*.065));
    if (player && state.nitroActive) {
      ctx.shadowColor = "#4df8ff";
      const flame = ctx.createLinearGradient(0, 0, 0, h * .42);
      flame.addColorStop(0, "#fff"); flame.addColorStop(.28, "#58f8ff"); flame.addColorStop(1, "rgba(135,37,255,0)");
      polygon([[-w*.16,h*.05],[0,h*(.32+Math.random()*.12)],[w*.16,h*.05]], flame);
    }
    ctx.restore();
  }

  function drawPlayer() {
    if (state.mode === "menu") return;
    if (state.invulnerable > 0 && Math.floor(state.invulnerable * 12) % 2 === 0) ctx.globalAlpha = 0.38;
    drawCar(project(0, state.x).x, height * 0.885, Math.max(0.72, Math.min(1.08, width / 1050)), "#3cf6ff", true);
    ctx.globalAlpha = 1;
  }

  function drawParticles() {
    for (const p of state.particles) {
      ctx.save();
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.glow) { ctx.shadowBlur = p.size * 2.4; ctx.shadowColor = p.color; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.7, p.size), 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function cyberPanel(x, y, w, h, color = "#40f4ff") {
    ctx.save();
    ctx.fillStyle = "rgba(4,6,21,.72)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    polygon([[x+8,y],[x+w,y],[x+w,y+h-8],[x+w-8,y+h],[x,y+h],[x,y+8]], ctx.fillStyle, ctx.strokeStyle);
    ctx.restore();
  }

  function drawHud() {
    const compact = width < 650;
    const pad = compact ? 13 : 24;
    const panelW = compact ? 132 : 184;
    const panelH = compact ? 65 : 76;
    cyberPanel(pad, pad, panelW, panelH);
    ctx.fillStyle = "#88faff";
    ctx.font = `700 ${compact ? 9 : 11}px "Segoe UI", sans-serif`;
    ctx.letterSpacing = "0.16em";
    ctx.fillText("VELOCIDADE", pad + 13, pad + 19);
    ctx.fillStyle = "#fff";
    ctx.font = `800 ${compact ? 27 : 34}px "Arial Narrow", sans-serif`;
    ctx.fillText(String(Math.round(state.speed)).padStart(3, "0"), pad + 12, pad + 51);
    ctx.fillStyle = "#ff58c4";
    ctx.font = `700 ${compact ? 8 : 10}px "Segoe UI", sans-serif`;
    ctx.fillText("KM/H", pad + (compact ? 88 : 125), pad + 50);

    const rightW = compact ? 132 : 205;
    cyberPanel(width - pad - rightW, pad, rightW, panelH, "#ff44ba");
    ctx.textAlign = "right";
    ctx.fillStyle = "#ff85d4";
    ctx.font = `700 ${compact ? 9 : 11}px "Segoe UI", sans-serif`;
    ctx.fillText("PONTOS", width - pad - 12, pad + 19);
    ctx.fillStyle = "#fff";
    ctx.font = `800 ${compact ? 23 : 30}px "Arial Narrow", sans-serif`;
    ctx.fillText(Math.floor(state.score).toString().padStart(6, "0"), width - pad - 12, pad + 51);
    ctx.textAlign = "left";

    const barW = compact ? width - 26 : Math.min(360, width * 0.33);
    const barX = compact ? 13 : width / 2 - barW / 2;
    const barY = compact ? 88 : 25;
    drawMeter(barX, barY, barW, 12, state.nitro / 100, "NITRO", "#3cf6ff");
    drawMeter(barX, barY + 29, barW, 8, state.integrity / 100, "INTEGRIDADE", state.integrity < 35 ? "#ff334f" : "#ff46ba");

    if (state.combo > 1) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.shadowBlur = 14;
      ctx.shadowColor = "#ff37b9";
      ctx.font = `900 ${compact ? 16 : 20}px "Arial Narrow", sans-serif`;
      ctx.fillText(`COMBO x${state.combo.toFixed(1)}`, width / 2, barY + 67);
      ctx.shadowBlur = 0;
      ctx.textAlign = "left";
    } else {
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(190,245,255,.72)";
      ctx.font = `700 ${compact ? 8 : 9}px "Segoe UI", sans-serif`;
      ctx.fillText(`SETOR ${String(Math.floor(state.difficulty)).padStart(2, "0")}  •  ${state.distance.toFixed(1)} KM`, width / 2, barY + 66);
      ctx.textAlign = "left";
    }

    if (state.messageTimer > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, state.messageTimer * 2);
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#43f7ff";
      ctx.font = `900 ${compact ? 22 : 29}px "Arial Narrow", sans-serif`;
      ctx.fillText(state.message, width / 2, height * 0.31);
      ctx.restore();
    }

    if (compact && state.mode === "playing") drawTouchHints();
  }

  function drawMeter(x, y, w, h, value, label, color) {
    ctx.fillStyle = "rgba(3,5,17,.74)";
    ctx.fillRect(x, y, w, h);
    const g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, color + "66"); g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.shadowBlur = value > 0.2 ? 12 : 0;
    ctx.shadowColor = color;
    ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * value), h - 4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#dffcff";
    ctx.font = `700 ${width < 650 ? 8 : 9}px "Segoe UI", sans-serif`;
    ctx.fillText(label, x, y - 4);
  }

  function drawTouchHints() {
    const y = height - 47;
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = "#5ff7ff";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(48, y, 28, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(width - 48, y, 28, 0, TAU); ctx.stroke();
    ctx.fillStyle = "#bffcff";
    ctx.font = "700 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("‹", 48, y + 6); ctx.fillText("›", width - 48, y + 6);
    ctx.font = "700 8px sans-serif";
    ctx.fillText("SEGURE NO ALTO: NITRO", width / 2, height - 15);
    ctx.restore();
  }

  function drawMenu() {
    const compact = width < 650;
    ctx.fillStyle = "rgba(3,2,14,.28)";
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = "center";
    ctx.save();
    ctx.shadowBlur = 30;
    ctx.shadowColor = "#ff2eb4";
    ctx.fillStyle = "#ff4abd";
    ctx.font = `900 ${compact ? 18 : 24}px "Segoe UI", sans-serif`;
    ctx.fillText("C O R R I D A   2 0 8 8", width / 2, height * 0.245);
    ctx.shadowColor = "#3cefff";
    ctx.fillStyle = "#efffff";
    ctx.font = `italic 900 ${compact ? 56 : Math.min(106, width * 0.09)}px "Arial Narrow", sans-serif`;
    ctx.fillText("NEON APEX", width / 2, height * 0.39);
    ctx.restore();

    ctx.fillStyle = "#9aeef3";
    ctx.font = `600 ${compact ? 11 : 13}px "Segoe UI", sans-serif`;
    ctx.fillText("ULTRAPASSE. ARRISQUE. SOBREVIVA.", width / 2, height * 0.435);

    const boxW = Math.min(compact ? width - 42 : 470, width - 30);
    const boxH = compact ? 108 : 116;
    const bx = width / 2 - boxW / 2;
    const by = height * 0.51;
    cyberPanel(bx, by, boxW, boxH, "#57f7ff");
    ctx.fillStyle = "#fff";
    ctx.font = `800 ${compact ? 14 : 16}px "Segoe UI", sans-serif`;
    ctx.fillText("ENTER / ESPAÇO / TOQUE PARA CORRER", width / 2, by + 31);
    ctx.fillStyle = "#9ac8d8";
    ctx.font = `600 ${compact ? 9 : 11}px "Segoe UI", sans-serif`;
    ctx.fillText("← → ou A D  •  DIREÇÃO", width / 2, by + 57);
    ctx.fillText("↑ W ACELERA  •  ↓ S FREIA  •  SHIFT NITRO", width / 2, by + 76);
    ctx.fillText("P PAUSA  •  F TELA CHEIA", width / 2, by + 95);

    ctx.fillStyle = "rgba(210,248,255,.64)";
    ctx.font = `600 ${compact ? 9 : 10}px "Segoe UI", sans-serif`;
    ctx.fillText(`RECORDE  ${state.best.toString().padStart(6, "0")}`, width / 2, by + boxH + 28);
    ctx.textAlign = "left";
  }

  function drawOverlay(title, subtitle, action) {
    ctx.fillStyle = "rgba(2,2,13,.66)";
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = "center";
    ctx.shadowBlur = 24;
    ctx.shadowColor = "#ff36b8";
    ctx.fillStyle = "#fff";
    ctx.font = `900 ${width < 650 ? 45 : 72}px "Arial Narrow", sans-serif`;
    ctx.fillText(title, width / 2, height * 0.43);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ff65c8";
    ctx.font = `700 ${width < 650 ? 12 : 15}px "Segoe UI", sans-serif`;
    ctx.fillText(subtitle, width / 2, height * 0.49);
    ctx.fillStyle = "#a9f9ff";
    ctx.font = `700 ${width < 650 ? 11 : 13}px "Segoe UI", sans-serif`;
    ctx.fillText(action, width / 2, height * 0.56);
    ctx.textAlign = "left";
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    if (state.shake > 0) ctx.translate((Math.random() - .5) * state.shake, (Math.random() - .5) * state.shake);
    drawBackground();
    drawRoad();
    drawSpeedLines();
    drawTraffic();
    drawPlayer();
    drawParticles();
    if (state.mode !== "menu") drawHud();
    if (state.mode === "menu") drawMenu();
    if (state.mode === "paused") drawOverlay("PAUSA", "SISTEMA EM ESPERA", "PRESSIONE P PARA CONTINUAR");
    if (state.mode === "gameover") drawOverlay("FIM DE CORRIDA", `PONTOS ${Math.floor(state.score).toString().padStart(6,"0")}  •  RECORDE ${state.best.toString().padStart(6,"0")}`, "ENTER / ESPAÇO / TOQUE PARA REINICIAR");
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255,53,111,${state.flash * .28})`;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
  }

  function togglePause() {
    if (state.mode === "playing") { state.mode = "paused"; statusNode.textContent = "Jogo pausado"; }
    else if (state.mode === "paused") { state.mode = "playing"; statusNode.textContent = "Jogo retomado"; }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) canvas.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  function activate() {
    if (state.mode === "menu" || state.mode === "gameover") resetGame();
  }

  window.addEventListener("keydown", (event) => {
    keys[event.code] = true;
    if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space"].includes(event.code)) event.preventDefault();
    if ((event.code === "Enter" || event.code === "Space") && state.mode !== "playing" && state.mode !== "paused") activate();
    if (event.code === "KeyP" && !event.repeat) togglePause();
    if (event.code === "KeyF" && !event.repeat) toggleFullscreen();
  });
  window.addEventListener("keyup", (event) => { keys[event.code] = false; });
  window.addEventListener("blur", () => { if (state.mode === "playing") togglePause(); });
  window.addEventListener("resize", resize);
  document.addEventListener("fullscreenchange", resize);

  canvas.addEventListener("pointerdown", (event) => {
    pointer.active = true; pointer.x = event.clientX; pointer.y = event.clientY;
    try { canvas.setPointerCapture?.(event.pointerId); } catch (_) { /* Synthetic pointers have no capture target. */ }
    activate();
  });
  canvas.addEventListener("pointermove", (event) => { pointer.x = event.clientX; pointer.y = event.clientY; });
  canvas.addEventListener("pointerup", () => { pointer.active = false; });
  canvas.addEventListener("pointercancel", () => { pointer.active = false; });
  muteButton.addEventListener("click", () => {
    muted = !muted;
    muteButton.textContent = muted ? "SOM: OFF" : "SOM: ON";
  });

  function frame(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  window.advanceTime = (ms) => {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i += 1) update(1 / 60);
    render();
  };

  window.render_game_to_text = () => JSON.stringify({
    coordinateSystem: "road x: -1.18 left to +1.18 right; traffic z decreases toward player, collision below z 300",
    mode: state.mode,
    player: { x: Number(state.x.toFixed(2)), speedKmh: Math.round(state.speed), integrity: Math.round(state.integrity), invulnerableSeconds: Number(state.invulnerable.toFixed(2)) },
    nitro: { amount: Math.round(state.nitro), active: state.nitroActive },
    run: { score: Math.floor(state.score), distanceKm: Number(state.distance.toFixed(2)), difficulty: Number(state.difficulty.toFixed(2)), nearMisses: state.nearMisses, combo: state.combo },
    traffic: state.traffic.filter((car) => car.z > 0 && car.z < 3000).sort((a,b) => a.z-b.z).slice(0,8).map((car) => ({ id: car.id, x: Number(car.x.toFixed(2)), z: Math.round(car.z), type: car.type })),
    controls: "left/right or A/D steer; up/W accelerate; down/S brake; shift/space nitro; P pause; F fullscreen",
  });

  window.__neon_apex_state = state;

  resize();
  render();
  requestAnimationFrame(frame);
}());
