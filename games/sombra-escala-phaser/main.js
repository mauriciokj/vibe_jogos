(() => {
  const WIDTH = 420;
  const HEIGHT = 760;

  const GROUND_Y = HEIGHT - 84;
  const PLAYER_RADIUS = 12;
  const PLAYER_MOVE_SPEED = 180;
  const PLAYER_JUMP_SPEED = 430;
  const GRAVITY = 980;
  const EXPOSE_LIMIT = 0.5;

  class SombraEscalaScene extends Phaser.Scene {
    constructor() {
      super('SombraEscalaScene');
      this.g = null;
      this.keys = null;
      this.ui = {};
      this.state = null;
    }

    create() {
      this.g = this.add.graphics();
      this.setupInput();
      this.setupUi();
      this.resetToMenu();

      window.sombraEscalaScene = this;
      window.render_game_to_text = () => this.renderGameToText();
      window.advanceTime = (ms) => this.advanceTime(ms);
    }

    setupInput() {
      this.keys = this.input.keyboard.addKeys({
        left: Phaser.Input.Keyboard.KeyCodes.LEFT,
        right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        a: Phaser.Input.Keyboard.KeyCodes.A,
        d: Phaser.Input.Keyboard.KeyCodes.D,
        space: Phaser.Input.Keyboard.KeyCodes.SPACE,
        enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
        f: Phaser.Input.Keyboard.KeyCodes.F,
      });

      this.keys.enter.on('down', () => {
        if (this.state.mode === 'menu' || this.state.mode === 'gameover') {
          this.startRun();
        }
      });

      this.keys.space.on('down', () => {
        if (this.state.mode !== 'playing') return;
        if (this.state.player.onShadow) {
          this.state.player.vy = -PLAYER_JUMP_SPEED;
          this.state.player.onShadow = false;
        }
      });

      this.keys.f.on('down', () => {
        if (this.scale.isFullscreen) {
          this.scale.stopFullscreen();
        } else {
          this.scale.startFullscreen();
        }
      });
    }

    setupUi() {
      const font = {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        color: '#121212',
      };

      this.ui.hudAlt = this.add.text(14, 12, '', { ...font, fontSize: '26px', fontStyle: '700' });
      this.ui.hudScore = this.add.text(14, 40, '', { ...font, fontSize: '21px', fontStyle: '700' });
      this.ui.hudExposure = this.add.text(WIDTH - 192, 16, '', { ...font, fontSize: '18px', fontStyle: '700' });
      this.ui.hudFloor = this.add.text(WIDTH - 192, 42, '', { ...font, fontSize: '18px', fontStyle: '700' });

      this.ui.menuTitle = this.add.text(WIDTH * 0.5, 218, 'SOMBRA ESCALA', {
        ...font,
        fontSize: '42px',
        fontStyle: '700',
      }).setOrigin(0.5);

      this.ui.menuDesc = this.add.text(WIDTH * 0.5, 302,
        'Voce so existe no preto.\nFora da sombra: exposicao letal em 0.5s.', {
          ...font,
          fontSize: '17px',
          fontStyle: '700',
          align: 'center',
          lineSpacing: 6,
        }).setOrigin(0.5);

      this.ui.menuLoop = this.add.text(WIDTH * 0.5, 382,
        'Espere sombra -> pule no escuro -> suba ->\nsalte para a proxima antes da atual sumir.', {
          ...font,
          fontSize: '16px',
          fontStyle: '700',
          align: 'center',
          lineSpacing: 5,
        }).setOrigin(0.5);

      this.ui.menuControls = this.add.text(WIDTH * 0.5, 460,
        'A/D ou Setas: mover | Espaco: pular\nEnter: iniciar | F: tela cheia', {
          ...font,
          fontSize: '16px',
          fontStyle: '700',
          align: 'center',
          lineSpacing: 5,
        }).setOrigin(0.5);

      this.ui.overTitle = this.add.text(WIDTH * 0.5, 300, '', {
        ...font,
        fontSize: '48px',
        fontStyle: '700',
      }).setOrigin(0.5);

      this.ui.overInfo = this.add.text(WIDTH * 0.5, 372, '', {
        ...font,
        fontSize: '28px',
        fontStyle: '700',
        align: 'center',
      }).setOrigin(0.5);

      this.ui.overRestart = this.add.text(WIDTH * 0.5, 440, 'Enter para reiniciar', {
        ...font,
        fontSize: '24px',
        fontStyle: '700',
      }).setOrigin(0.5);
    }

    resetToMenu() {
      this.state = {
        mode: 'menu',
        loseReason: '',
        time: 0,
        cameraY: 0,
        altitude: 0,
        bestAltitude: 0,
        score: 0,
        scoreFloat: 0,
        multiplier: 1,
        multiplierTimer: 0,
        exposure: 0,
        crushTimer: 0,
        floorTarget: 500,
        unlockedTypes: ['beam'],
        rngSeed: 0x91ae34bc,
        player: {
          x: WIDTH * 0.5,
          y: GROUND_Y - PLAYER_RADIUS,
          vx: 0,
          vy: 0,
          onShadow: true,
          shadowId: null,
        },
        shadows: [],
        sparks: [],
        nextShadowY: GROUND_Y - 80,
        nextSparkY: GROUND_Y - 150,
      };

      this.seedStartPlatforms();
      this.renderFrame();
    }

    startRun() {
      this.state.mode = 'playing';
      this.state.loseReason = '';
      this.state.time = 0;
      this.state.cameraY = 0;
      this.state.altitude = 0;
      this.state.score = 0;
      this.state.scoreFloat = 0;
      this.state.multiplier = 1;
      this.state.multiplierTimer = 0;
      this.state.exposure = 0;
      this.state.crushTimer = 0;
      this.state.floorTarget = 500;
      this.state.unlockedTypes = ['beam'];

      this.state.player.x = WIDTH * 0.5;
      this.state.player.y = GROUND_Y - PLAYER_RADIUS;
      this.state.player.vx = 0;
      this.state.player.vy = 0;
      this.state.player.onShadow = true;
      this.state.player.shadowId = null;

      this.state.shadows = [];
      this.state.sparks = [];
      this.state.nextShadowY = GROUND_Y - 80;
      this.state.nextSparkY = GROUND_Y - 150;

      this.seedStartPlatforms();
      this.ensureWorld();
    }

    seededRandom() {
      this.state.rngSeed = (1664525 * this.state.rngSeed + 1013904223) >>> 0;
      return this.state.rngSeed / 4294967296;
    }

    seedStartPlatforms() {
      this.state.shadows.push({
        id: 'start',
        type: 'beam',
        y: GROUND_Y,
        baseX: WIDTH * 0.5,
        width: 220,
        thickness: 14,
        ampX: 0,
        speedX: 0,
        phase: 0,
      });

      const tutorialOffsets = [0, 44, -36, 56, -48, 64];
      let tutorialY = GROUND_Y - 58;
      for (let i = 0; i < tutorialOffsets.length; i += 1) {
        this.state.shadows.push({
          id: `tutorial-${i}`,
          type: 'beam',
          y: tutorialY,
          baseX: Phaser.Math.Clamp(WIDTH * 0.5 + tutorialOffsets[i], 82, WIDTH - 82),
          width: 122 - i * 4,
          thickness: 12,
          ampX: 6 + i * 2,
          speedX: 0.8 + i * 0.1,
          phase: i * 0.4,
        });
        tutorialY -= 60;
      }
      this.state.nextShadowY = tutorialY;

      for (let i = 0; i < 10; i += 1) {
        this.addShadow();
      }
    }

    chooseType() {
      const altitude = this.state.altitude;
      if (altitude >= 350 && !this.state.unlockedTypes.includes('gear')) {
        this.state.unlockedTypes.push('gear');
      }
      if (altitude >= 180 && !this.state.unlockedTypes.includes('pendulum')) {
        this.state.unlockedTypes.push('pendulum');
      }

      const types = this.state.unlockedTypes;
      return types[Math.floor(this.seededRandom() * types.length)];
    }

    addShadow() {
      const y = this.state.nextShadowY - (58 + this.seededRandom() * 28);
      this.state.nextShadowY = y;

      const type = this.chooseType();
      let width = 92 + this.seededRandom() * 74;
      let ampX = 24 + this.seededRandom() * 54;
      let speedX = 0.9 + this.seededRandom() * 1.6;
      if (type === 'gear') {
        width *= 0.85;
        ampX *= 1.15;
        speedX *= 1.2;
      } else if (type === 'pendulum') {
        width *= 0.95;
        ampX *= 1.35;
        speedX *= 0.7;
      }

      const margin = 70;
      const baseX = margin + this.seededRandom() * (WIDTH - margin * 2);

      this.state.shadows.push({
        id: `s${Math.floor(this.state.time * 1000)}-${Math.floor(this.seededRandom() * 100000)}`,
        type,
        y,
        baseX,
        width,
        thickness: 12,
        ampX,
        speedX,
        phase: this.seededRandom() * Math.PI * 2,
      });

      if (this.seededRandom() < 0.45) {
        this.addSpark(y - (26 + this.seededRandom() * 22));
      }
    }

    addSpark(y) {
      this.state.sparks.push({
        y,
        baseX: 64 + this.seededRandom() * (WIDTH - 128),
        ampX: 16 + this.seededRandom() * 36,
        speedX: 1.2 + this.seededRandom() * 2,
        phase: this.seededRandom() * Math.PI * 2,
        collected: false,
      });
    }

    shadowX(shadow) {
      if (shadow.ampX === 0 || shadow.speedX === 0) return shadow.baseX;
      if (shadow.type === 'pendulum') {
        const pend = Math.sin(this.state.time * shadow.speedX + shadow.phase);
        return shadow.baseX + pend * shadow.ampX;
      }
      const wave = Math.sin(this.state.time * shadow.speedX + shadow.phase);
      return shadow.baseX + wave * shadow.ampX;
    }

    sparkX(spark) {
      return spark.baseX + Math.sin(this.state.time * spark.speedX + spark.phase) * spark.ampX;
    }

    ensureWorld() {
      const upperLimit = this.state.cameraY - 540;
      while (this.state.nextShadowY > upperLimit) {
        this.addShadow();
      }

      const lowerLimit = this.state.cameraY + HEIGHT + 180;
      this.state.shadows = this.state.shadows.filter((shadow) => shadow.y < lowerLimit);
      this.state.sparks = this.state.sparks.filter((spark) => !spark.collected && spark.y < lowerLimit);
    }

    updatePlayer(dt) {
      const left = this.keys.left.isDown || this.keys.a.isDown;
      const right = this.keys.right.isDown || this.keys.d.isDown;
      const moveDir = (right ? 1 : 0) - (left ? 1 : 0);

      this.state.player.vx = moveDir * PLAYER_MOVE_SPEED;

      let carriedDx = 0;
      if (this.state.player.onShadow && this.state.player.shadowId) {
        const currentShadow = this.state.shadows.find((s) => s.id === this.state.player.shadowId);
        if (currentShadow) {
          const prevX = this.shadowXAtTime(currentShadow, this.state.time - dt);
          const nowX = this.shadowX(currentShadow);
          carriedDx = nowX - prevX;
        }
      }

      const prevY = this.state.player.y;
      this.state.player.vy += GRAVITY * dt;
      this.state.player.y += this.state.player.vy * dt;
      this.state.player.x += this.state.player.vx * dt + carriedDx;
      this.state.player.x = Phaser.Math.Clamp(this.state.player.x, PLAYER_RADIUS, WIDTH - PLAYER_RADIUS);

      this.state.player.onShadow = false;
      this.state.player.shadowId = null;

      for (const shadow of this.state.shadows) {
        const sx = this.shadowX(shadow);
        const top = shadow.y - shadow.thickness * 0.5;
        const leftEdge = sx - shadow.width * 0.5;
        const rightEdge = sx + shadow.width * 0.5;

        const insideX = this.state.player.x + PLAYER_RADIUS > leftEdge && this.state.player.x - PLAYER_RADIUS < rightEdge;
        const wasAbove = prevY + PLAYER_RADIUS <= top + 3;
        const nowBelow = this.state.player.y + PLAYER_RADIUS >= top;

        if (this.state.player.vy >= 0 && insideX && wasAbove && nowBelow) {
          this.state.player.y = top - PLAYER_RADIUS;
          this.state.player.vy = 0;
          this.state.player.onShadow = true;
          this.state.player.shadowId = shadow.id;
          break;
        }
      }
    }

    shadowXAtTime(shadow, t) {
      if (shadow.ampX === 0 || shadow.speedX === 0) return shadow.baseX;
      const angle = t * shadow.speedX + shadow.phase;
      return shadow.baseX + Math.sin(angle) * shadow.ampX;
    }

    updateSparks() {
      for (const spark of this.state.sparks) {
        if (spark.collected) continue;
        const sx = this.sparkX(spark);
        const sy = spark.y;
        const dx = this.state.player.x - sx;
        const dy = this.state.player.y - sy;
        if (dx * dx + dy * dy <= 19 * 19) {
          spark.collected = true;
          this.state.multiplier = Math.min(4, this.state.multiplier + 0.5);
          this.state.multiplierTimer = 7;
          this.state.scoreFloat += 35;
        }
      }
    }

    updateFailure(dt) {
      const inDarkness = this.state.player.onShadow || this.isPlayerInDarkness();
      if (inDarkness) {
        this.state.exposure = Math.max(0, this.state.exposure - dt * 2.2);
      } else {
        this.state.exposure += dt;
      }

      if (this.state.exposure >= EXPOSE_LIMIT) {
        this.lose('EXPOSICAO');
        return;
      }

      if (this.state.player.y - this.state.cameraY > HEIGHT + 120) {
        this.lose('QUEDA');
        return;
      }

      // esmagamento: duas sombras quase no mesmo Y com sobreposicao horizontal sob o jogador.
      let crushed = false;
      for (let i = 0; i < this.state.shadows.length && !crushed; i += 1) {
        const a = this.state.shadows[i];
        for (let j = i + 1; j < this.state.shadows.length; j += 1) {
          const b = this.state.shadows[j];
          const ay = a.y;
          const by = b.y;
          if (Math.abs(ay - by) > 18) continue;
          const ax = this.shadowX(a);
          const bx = this.shadowX(b);
          const aLeft = ax - a.width * 0.5;
          const aRight = ax + a.width * 0.5;
          const bLeft = bx - b.width * 0.5;
          const bRight = bx + b.width * 0.5;
          const overlapLeft = Math.max(aLeft, bLeft);
          const overlapRight = Math.min(aRight, bRight);
          if (overlapRight <= overlapLeft) continue;

          const playerNearY = Math.abs(this.state.player.y - ay) < 20;
          const playerInX = this.state.player.x > overlapLeft && this.state.player.x < overlapRight;
          if (playerNearY && playerInX) {
            crushed = true;
            break;
          }
        }
      }

      if (crushed) {
        this.state.crushTimer += dt;
      } else {
        this.state.crushTimer = Math.max(0, this.state.crushTimer - dt * 2);
      }

      if (this.state.crushTimer > 0.18) {
        this.lose('ESMAGAMENTO');
      }
    }

    isPlayerInDarkness() {
      for (const shadow of this.state.shadows) {
        const sx = this.shadowX(shadow);
        const halfW = shadow.width * 0.5;
        const halfT = shadow.thickness * 0.5;
        const insideX = Math.abs(this.state.player.x - sx) <= halfW;
        const insideY = Math.abs(this.state.player.y - shadow.y) <= halfT + 18;
        if (insideX && insideY) return true;
      }
      return false;
    }

    lose(reason) {
      this.state.mode = 'gameover';
      this.state.loseReason = reason;
    }

    updateProgress(dt) {
      const runAltitude = Math.max(0, Math.round((GROUND_Y - PLAYER_RADIUS) - this.state.player.y));
      if (runAltitude > this.state.altitude) {
        const climbed = runAltitude - this.state.altitude;
        this.state.altitude = runAltitude;
        this.state.scoreFloat += climbed * this.state.multiplier;
      }

      if (this.state.multiplierTimer > 0) {
        this.state.multiplierTimer = Math.max(0, this.state.multiplierTimer - dt);
      } else {
        this.state.multiplier = Math.max(1, this.state.multiplier - dt * 0.16);
      }

      this.state.score = Math.floor(this.state.scoreFloat);
      this.state.bestAltitude = Math.max(this.state.bestAltitude, this.state.altitude);

      while (this.state.altitude >= this.state.floorTarget) {
        this.state.floorTarget += 500;
      }
    }

    updateCamera() {
      const desired = this.state.player.y - HEIGHT * 0.64;
      this.state.cameraY = Math.min(this.state.cameraY, desired);
    }

    updateRun(dt) {
      this.state.time += dt;
      this.updatePlayer(dt);
      this.updateSparks();
      this.updateProgress(dt);
      this.updateCamera();
      this.ensureWorld();
      this.updateFailure(dt);
    }

    step(dt) {
      if (this.state.mode === 'playing') {
        this.updateRun(dt);
      }
      this.renderFrame();
    }

    update(_time, delta) {
      const dt = Math.min(0.033, delta / 1000);
      this.step(dt);
    }

    advanceTime(ms) {
      const stepMs = 1000 / 60;
      const steps = Math.max(1, Math.round(ms / stepMs));
      for (let i = 0; i < steps; i += 1) {
        this.step(stepMs / 1000);
      }
    }

    drawBackground() {
      this.g.fillStyle(0xf4f4f4, 1);
      this.g.fillRect(0, 0, WIDTH, HEIGHT);

      for (let i = 0; i < 12; i += 1) {
        const y = (i * 72 - (this.state.cameraY * 0.3) % 72) % HEIGHT;
        this.g.fillStyle(0xdddddd, 1);
        this.g.fillRect(0, y, WIDTH, 1);
      }

      this.g.fillStyle(0xf0e7c7, 1);
      this.g.fillCircle(48, 54, 28);
      this.g.fillStyle(0xe2d7af, 1);
      this.g.fillCircle(48, 54, 12);
    }

    drawCastersAndShadows() {
      for (const shadow of this.state.shadows) {
        const sx = this.shadowX(shadow);
        const sy = shadow.y - this.state.cameraY;
        if (sy < -100 || sy > HEIGHT + 100) continue;

        const casterY = sy - 122;
        if (shadow.type === 'beam') {
          this.g.fillStyle(0x4a4a4a, 1);
          this.g.fillRect(sx - 30, casterY - 8, 60, 16);
        } else if (shadow.type === 'pendulum') {
          this.g.lineStyle(3, 0x4a4a4a, 1);
          this.g.beginPath();
          this.g.moveTo(sx, casterY - 34);
          this.g.lineTo(sx, casterY + 14);
          this.g.strokePath();
          this.g.lineStyle();
          this.g.fillStyle(0x4a4a4a, 1);
          this.g.fillCircle(sx, casterY + 22, 14);
        } else {
          this.g.fillStyle(0x4a4a4a, 1);
          this.g.fillCircle(sx, casterY + 4, 17);
          this.g.lineStyle(2, 0xf4f4f4, 1);
          for (let i = 0; i < 8; i += 1) {
            const a = this.state.time * 4 + (Math.PI * 2 * i) / 8;
            this.g.beginPath();
            this.g.moveTo(sx + Math.cos(a) * 6, casterY + 4 + Math.sin(a) * 6);
            this.g.lineTo(sx + Math.cos(a) * 16, casterY + 4 + Math.sin(a) * 16);
            this.g.strokePath();
          }
          this.g.lineStyle();
        }

        this.g.fillStyle(0x050505, 1);
        this.g.fillRoundedRect(
          sx - shadow.width * 0.5,
          sy - shadow.thickness * 0.5,
          shadow.width,
          shadow.thickness,
          4,
        );
      }
    }

    drawSparks() {
      for (const spark of this.state.sparks) {
        if (spark.collected) continue;
        const x = this.sparkX(spark);
        const y = spark.y - this.state.cameraY;
        if (y < -40 || y > HEIGHT + 40) continue;

        this.g.fillStyle(0x111111, 1);
        this.g.fillCircle(x, y, 6);
        this.g.lineStyle(2, 0x111111, 1);
        this.g.beginPath();
        this.g.moveTo(x - 11, y);
        this.g.lineTo(x + 11, y);
        this.g.strokePath();
        this.g.beginPath();
        this.g.moveTo(x, y - 11);
        this.g.lineTo(x, y + 11);
        this.g.strokePath();
        this.g.lineStyle();
      }
    }

    drawPlayer() {
      const x = this.state.player.x;
      const y = this.state.player.y - this.state.cameraY;

      this.g.fillStyle(0x000000, 1);
      this.g.fillCircle(x, y, PLAYER_RADIUS);
      this.g.fillStyle(0xffffff, 0.5);
      this.g.fillCircle(x - 3, y - 4, 2.3);
    }

    drawHud() {
      this.g.fillStyle(0xffffff, 0.86);
      this.g.fillRect(8, 8, WIDTH - 16, 68);

      const exposureRatio = Phaser.Math.Clamp(this.state.exposure / EXPOSE_LIMIT, 0, 1);
      this.g.fillStyle(0x888888, 1);
      this.g.fillRect(WIDTH - 186, 58, 164, 9);
      this.g.fillStyle(0x111111, 1);
      this.g.fillRect(WIDTH - 186, 58, 164 * exposureRatio, 9);

      const multText = this.state.multiplier.toFixed(1);
      this.ui.hudAlt.setText(`Altura: ${this.state.altitude}m  x${multText}`);
      this.ui.hudScore.setText(`Score: ${this.state.score}`);
      this.ui.hudExposure.setText(`Exposicao: ${this.state.exposure.toFixed(2)}s`);
      this.ui.hudFloor.setText(`Andar alvo: ${this.state.floorTarget}m`);
    }

    drawMenuOverlay() {
      this.g.fillStyle(0xffffff, 0.84);
      this.g.fillRoundedRect(24, 164, WIDTH - 48, 348, 22);
      this.g.lineStyle(2, 0x111111, 0.25);
      this.g.strokeRoundedRect(24, 164, WIDTH - 48, 348, 22);
      this.g.lineStyle();
    }

    drawGameOverOverlay() {
      this.g.fillStyle(0xffffff, 0.88);
      this.g.fillRect(0, 0, WIDTH, HEIGHT);
      this.g.fillStyle(0x111111, 1);
      this.g.fillRoundedRect(28, 220, WIDTH - 56, 290, 18);
      this.g.fillStyle(0xf4f4f4, 1);
      this.g.fillRoundedRect(32, 224, WIDTH - 64, 282, 16);
    }

    renderFrame() {
      this.g.clear();
      this.drawBackground();
      this.drawCastersAndShadows();
      this.drawSparks();
      this.drawPlayer();

      const showHud = this.state.mode !== 'menu';
      this.ui.hudAlt.setVisible(showHud);
      this.ui.hudScore.setVisible(showHud);
      this.ui.hudExposure.setVisible(showHud);
      this.ui.hudFloor.setVisible(showHud);

      if (showHud) this.drawHud();

      const menuVisible = this.state.mode === 'menu';
      this.ui.menuTitle.setVisible(menuVisible);
      this.ui.menuDesc.setVisible(menuVisible);
      this.ui.menuLoop.setVisible(menuVisible);
      this.ui.menuControls.setVisible(menuVisible);
      if (menuVisible) {
        this.drawMenuOverlay();
      }

      const overVisible = this.state.mode === 'gameover';
      this.ui.overTitle.setVisible(overVisible);
      this.ui.overInfo.setVisible(overVisible);
      this.ui.overRestart.setVisible(overVisible);
      if (overVisible) {
        this.drawGameOverOverlay();
        this.ui.overTitle.setText(this.state.loseReason);
        this.ui.overInfo.setText(`Altura: ${this.state.altitude}m\nScore: ${this.state.score}`);
      }
    }

    renderGameToText() {
      const visibleShadows = this.state.shadows
        .map((shadow) => ({
          type: shadow.type,
          x: Math.round(this.shadowX(shadow)),
          y: Math.round(shadow.y - this.state.cameraY),
          width: Math.round(shadow.width),
          thickness: Math.round(shadow.thickness),
        }))
        .filter((s) => s.y >= -120 && s.y <= HEIGHT + 120)
        .slice(0, 14);

      const visibleSparks = this.state.sparks
        .filter((spark) => !spark.collected)
        .map((spark) => ({
          x: Math.round(this.sparkX(spark)),
          y: Math.round(spark.y - this.state.cameraY),
        }))
        .filter((s) => s.y >= -50 && s.y <= HEIGHT + 50)
        .slice(0, 10);

      return JSON.stringify({
        coordSystem: {
          origin: 'top-left',
          axisX: 'right-positive',
          axisY: 'down-positive',
        },
        mode: this.state.mode,
        loseReason: this.state.loseReason,
        player: {
          x: Math.round(this.state.player.x),
          y: Math.round(this.state.player.y - this.state.cameraY),
          vx: Number(this.state.player.vx.toFixed(2)),
          vy: Number(this.state.player.vy.toFixed(2)),
          onShadow: this.state.player.onShadow,
        },
        run: {
          altitude: this.state.altitude,
          bestAltitude: this.state.bestAltitude,
          score: this.state.score,
          multiplier: Number(this.state.multiplier.toFixed(2)),
          exposure: Number(this.state.exposure.toFixed(2)),
          floorTarget: this.state.floorTarget,
          unlockedTypes: this.state.unlockedTypes,
          cameraY: Math.round(this.state.cameraY),
        },
        shadows: visibleShadows,
        sparks: visibleSparks,
        controls: ['arrowleft', 'arrowright', 'a', 'd', 'space', 'enter', 'f'],
      });
    }
  }

  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent: 'game-root',
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: '#f4f4f4',
    scene: [SombraEscalaScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });

  window.sombraEscalaGame = game;
})();
