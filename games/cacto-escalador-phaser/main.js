(() => {
  const WIDTH = 420;
  const HEIGHT = 760;

  class CactoEscaladorPhaserScene extends Phaser.Scene {
    constructor() {
      super('CactoEscaladorPhaserScene');
      this.leftX = WIDTH * 0.2;
      this.rightX = WIDTH * 0.8;
      this.centerX = WIDTH * 0.5;
      this.g = null;
      this.state = null;
      this.audioCtx = null;
      this.masterGain = null;
      this.audioBootstrapped = false;
      this.domAudioUnlockHandler = null;
    }

    create() {
      this.g = this.add.graphics();
      this.setupUi();
      this.setupInput();
      this.setupAudioUnlock();
      this.initState();
      this.renderFrame();

      window.cactoEscaladorPhaserScene = this;
      window.render_game_to_text = () => this.renderGameToText();
      window.advanceTime = (ms) => this.advanceTime(ms);
    }

    setupUi() {
      const fontMain = {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        color: '#eef7ff',
      };

      this.hudHeight = this.add.text(26, 20, '', { ...fontMain, fontSize: '30px', fontStyle: '700' });
      this.hudScore = this.add.text(26, 50, '', { ...fontMain, fontSize: '24px', fontStyle: '700' });
      this.hudSpikes = this.add.text(WIDTH - 152, 20, 'Espinhos', {
        ...fontMain,
        fontSize: '14px',
        fontStyle: '700',
      });
      this.hudBrake = this.add.text(WIDTH - 152, 52, 'Freio', {
        ...fontMain,
        fontSize: '14px',
        fontStyle: '700',
        color: '#d5f8ff',
      });
      this.hudTurbo = this.add.text(WIDTH - 152, 66, 'Turbo', {
        ...fontMain,
        fontSize: '14px',
        fontStyle: '700',
        color: '#ffd7c0',
      });
      this.hudShield = this.add.text(WIDTH - 152, 80, 'Escudo', {
        ...fontMain,
        fontSize: '14px',
        fontStyle: '700',
        color: '#ddccff',
      });

      this.menuTitleA = this.add.text(WIDTH * 0.5, 290, 'CACTO', {
        ...fontMain,
        fontSize: '58px',
        fontStyle: '700',
      }).setOrigin(0.5);
      this.menuTitleB = this.add.text(WIDTH * 0.5, 340, 'ESCALADOR', {
        ...fontMain,
        fontSize: '54px',
        fontStyle: '700',
      }).setOrigin(0.5);
      this.menuLine1 = this.add.text(WIDTH * 0.5, 398, 'Troque lado so encostado na parede', {
        ...fontMain,
        fontSize: '22px',
        fontStyle: '600',
        align: 'center',
      }).setOrigin(0.5).setWordWrapWidth(WIDTH - 32, true);
      this.menuLine2 = this.add.text(WIDTH * 0.5, 430, 'Flor = +score | Gota = freia | Raio = turbo', {
        ...fontMain,
        fontSize: '20px',
        fontStyle: '600',
        align: 'center',
      }).setOrigin(0.5).setWordWrapWidth(WIDTH - 32, true);
      this.menuLine3 = this.add.text(WIDTH * 0.5, 462, 'Cristal = escudo 10s ou 1 impacto', {
        ...fontMain,
        fontSize: '18px',
        fontStyle: '600',
        align: 'center',
      }).setOrigin(0.5).setWordWrapWidth(WIDTH - 32, true);
      this.menuLine4 = this.add.text(WIDTH * 0.5, 494, 'Espaco alterna | Enter inicia | F fullscreen', {
        ...fontMain,
        fontSize: '18px',
        fontStyle: '600',
        align: 'center',
      }).setOrigin(0.5).setWordWrapWidth(WIDTH - 32, true);

      this.gameOverTitle = this.add.text(WIDTH * 0.5, 320, 'ESPINHOS QUEBRADOS', {
        ...fontMain,
        fontSize: '44px',
        fontStyle: '700',
        color: '#fff2ef',
        align: 'center',
      }).setOrigin(0.5).setWordWrapWidth(WIDTH - 36, true);
      this.gameOverHeight = this.add.text(WIDTH * 0.5, 368, '', {
        ...fontMain,
        fontSize: '32px',
        fontStyle: '700',
        color: '#fff2ef',
        align: 'center',
      }).setOrigin(0.5).setWordWrapWidth(WIDTH - 36, true);
      this.gameOverRestart = this.add.text(WIDTH * 0.5, 410, 'Pressione Enter para reiniciar', {
        ...fontMain,
        fontSize: '24px',
        fontStyle: '700',
        color: '#fff2ef',
        align: 'center',
      }).setOrigin(0.5).setWordWrapWidth(WIDTH - 36, true);
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

      const toggleHandler = () => this.toggleSide();
      this.keys.left.on('down', toggleHandler);
      this.keys.right.on('down', toggleHandler);
      this.keys.a.on('down', toggleHandler);
      this.keys.d.on('down', toggleHandler);
      this.keys.space.on('down', toggleHandler);
      this.keys.enter.on('down', () => this.startGame());
      this.keys.f.on('down', () => {
        this.unlockAudio();
        if (this.scale.isFullscreen) {
          this.scale.stopFullscreen();
        } else {
          this.scale.startFullscreen();
        }
      });
    }

    setupAudioUnlock() {
      const unlock = () => this.unlockAudio();
      this.input.keyboard.on('keydown', unlock);
      this.input.on('pointerdown', unlock);
      this.domAudioUnlockHandler = () => this.unlockAudio();
      window.addEventListener('keydown', this.domAudioUnlockHandler, { passive: true });
      window.addEventListener('pointerdown', this.domAudioUnlockHandler, { passive: true });
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.input.keyboard.off('keydown', unlock);
        this.input.off('pointerdown', unlock);
        if (this.domAudioUnlockHandler) {
          window.removeEventListener('keydown', this.domAudioUnlockHandler);
          window.removeEventListener('pointerdown', this.domAudioUnlockHandler);
          this.domAudioUnlockHandler = null;
        }
      });
    }

    unlockAudio() {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        if (!this.audioCtx) this.audioCtx = new AudioContext();
        if (!this.masterGain) {
          this.masterGain = this.audioCtx.createGain();
          this.masterGain.gain.setValueAtTime(0.28, this.audioCtx.currentTime);
          this.masterGain.connect(this.audioCtx.destination);
        }
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
        if (this.audioCtx.state === 'running' && !this.audioBootstrapped) {
          this.audioBootstrapped = true;
          this.playTone(520, 0.05, 'triangle', 0.11, 650);
        }
      } catch (_) {
        // Ignore audio setup failures.
      }
    }

    initState() {
      this.state = {
        mode: 'menu',
        progress: 0,
        score: 0,
        bonusScore: 0,
        speed: 180,
        side: 'left',
        targetSide: 'left',
        targetX: this.leftX,
        slowTimer: 0,
        fastTimer: 0,
        invulnerableTimer: 0,
        rngSeed: 0x1a2b3c4d,
        worldTime: 0,
        nextObstacleHeight: 240,
        nextPickupHeight: 340,
        obstacles: [],
        pickups: [],
        particles: [],
        floatTexts: [],
        glassStripes: Array.from({ length: 9 }, (_, i) => ({ x: 36 + i * 42, drift: (i % 3) - 1 })),
        player: {
          x: this.leftX,
          y: HEIGHT * 0.7,
          vx: 0,
          vy: 0,
          radius: 20,
          isSwitching: false,
          switchSpeed: 820,
          squashX: 1,
          squashY: 1,
          contactSeconds: 0,
          maxContact: 0.5,
          spines: 1,
        },
        contactFlag: false,
      };
    }

    seededRandom() {
      this.state.rngSeed = (1664525 * this.state.rngSeed + 1013904223) >>> 0;
      return this.state.rngSeed / 4294967296;
    }

    pushFloatText(text, x, y, color) {
      const obj = this.add.text(x, y, text, {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '26px',
        fontStyle: '700',
        color,
      }).setOrigin(0.5);
      this.state.floatTexts.push({ ttl: 1.1, obj });
    }

    playTone(freq, duration, type = 'sine', volume = 0.12, slideTo = null) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        if (!this.audioCtx) this.audioCtx = new AudioContext();
        if (!this.masterGain) {
          this.masterGain = this.audioCtx.createGain();
          this.masterGain.gain.setValueAtTime(0.28, this.audioCtx.currentTime);
          this.masterGain.connect(this.audioCtx.destination);
        }
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().then(() => {
            if (this.audioCtx && this.audioCtx.state === 'running') {
              this.playTone(freq, duration, type, volume, slideTo);
            }
          }).catch(() => {});
          return;
        }
        if (this.audioCtx.state !== 'running') return;

        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), now + duration);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.connect(gain);
        gain.connect(this.masterGain || this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + duration + 0.02);
      } catch (_) {
        // Ignore audio failures in headless/locked contexts.
      }
    }

    emitParticles(x, y, count, color, speedMin = 30, speedMax = 110) {
      for (let i = 0; i < count; i += 1) {
        const a = this.seededRandom() * Math.PI * 2;
        const speed = speedMin + this.seededRandom() * (speedMax - speedMin);
        this.state.particles.push({
          x,
          y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - 12,
          ttl: 0.25 + this.seededRandom() * 0.35,
          size: 1.4 + this.seededRandom() * 2.8,
          color,
        });
      }
    }

    resetGame() {
      this.state.mode = 'playing';
      this.state.progress = 0;
      this.state.score = 0;
      this.state.bonusScore = 0;
      this.state.speed = 180;
      this.state.side = 'left';
      this.state.targetSide = 'left';
      this.state.targetX = this.leftX;
      this.state.slowTimer = 0;
      this.state.fastTimer = 0;
      this.state.invulnerableTimer = 0;
      this.state.worldTime = 0;
      this.state.nextObstacleHeight = 240;
      this.state.nextPickupHeight = 340;
      this.state.obstacles = [];
      this.state.pickups = [];
      this.state.particles = [];
      this.state.floatTexts.forEach((entry) => entry.obj.destroy());
      this.state.floatTexts = [];
      this.state.glassStripes = Array.from({ length: 9 }, (_, i) => ({
        x: 36 + i * 42,
        drift: this.seededRandom() * 2 - 1,
      }));

      this.state.player.x = this.leftX;
      this.state.player.y = HEIGHT * 0.7;
      this.state.player.vx = 0;
      this.state.player.vy = 0;
      this.state.player.isSwitching = false;
      this.state.player.squashX = 1;
      this.state.player.squashY = 1;
      this.state.player.contactSeconds = 0;
      this.state.player.spines = 1;
      this.state.contactFlag = false;

      this.ensureObstacles();
      this.ensurePickups();
    }

    getDifficulty() {
      return 1 + this.state.progress / 1800;
    }

    getCurrentClimbSpeed() {
      let current = this.state.speed;
      if (this.state.slowTimer > 0) {
        current = Math.max(130, current - 78);
      }
      if (this.state.fastTimer > 0) {
        current = Math.min(420, current + 72);
      }
      return current;
    }

    randomObstacleType() {
      const roll = this.seededRandom();
      if (roll < 0.55) return 'spike';
      if (roll < 0.82) return 'shard';
      return 'rotor';
    }

    makeObstacle(height) {
      const type = this.randomObstacleType();
      if (type === 'spike') {
        return {
          type,
          side: this.seededRandom() > 0.5 ? 'left' : 'right',
          height,
          size: 36 + this.seededRandom() * 34,
          hitRadius: 44,
          phase: this.seededRandom() * Math.PI * 2,
        };
      }

      if (type === 'shard') {
        return {
          type,
          side: this.seededRandom() > 0.5 ? 'left' : 'right',
          height,
          size: 44 + this.seededRandom() * 30,
          hitRadius: 52,
          phase: this.seededRandom() * Math.PI * 2,
        };
      }

      return {
        type,
        side: this.seededRandom() > 0.5 ? 'left' : 'right',
        height,
        size: 34 + this.seededRandom() * 20,
        hitRadius: 56,
        phase: this.seededRandom() * Math.PI * 2,
      };
    }

    ensureObstacles() {
      const maxHeight = this.state.progress + HEIGHT + 420;
      while (this.state.nextObstacleHeight < maxHeight) {
        this.state.obstacles.push(this.makeObstacle(this.state.nextObstacleHeight));
        const difficulty = this.getDifficulty();
        const gapBase = 124 - Math.min(30, difficulty * 8);
        const gapVar = 154 - Math.min(38, difficulty * 10);
        const gap = Math.max(80, gapBase + this.seededRandom() * gapVar);
        this.state.nextObstacleHeight += gap;

        if (difficulty > 1.9 && this.seededRandom() < 0.2) {
          this.state.obstacles.push(this.makeObstacle(this.state.nextObstacleHeight + 46 + this.seededRandom() * 40));
        }
      }

      const cleanupHeight = this.state.progress - 140;
      this.state.obstacles = this.state.obstacles.filter((obstacle) => obstacle.height > cleanupHeight);
    }

    ensurePickups() {
      const maxHeight = this.state.progress + HEIGHT + 500;
      while (this.state.nextPickupHeight < maxHeight) {
        const laneRoll = this.seededRandom();
        let lane = 'center';
        if (laneRoll < 0.42) lane = 'left';
        else if (laneRoll < 0.84) lane = 'right';

        const pickupRoll = this.seededRandom();
        let pickupType = 'flower';
        if (pickupRoll < 0.44) pickupType = 'flower';
        else if (pickupRoll < 0.72) pickupType = 'dew';
        else if (pickupRoll < 0.9) pickupType = 'boost';
        else pickupType = 'shield';

        this.state.pickups.push({
          type: pickupType,
          lane,
          height: this.state.nextPickupHeight + this.seededRandom() * 70,
          bob: this.seededRandom() * Math.PI * 2,
          collected: false,
        });

        const difficulty = this.getDifficulty();
        const gap = 236 + this.seededRandom() * 220 - Math.min(70, difficulty * 28);
        this.state.nextPickupHeight += Math.max(148, gap);
      }

      const cleanupHeight = this.state.progress - 120;
      this.state.pickups = this.state.pickups.filter((pickup) => pickup.height > cleanupHeight && !pickup.collected);
    }

    pickupX(pickup) {
      const sway = Math.sin(this.state.worldTime * 3 + pickup.bob) * (pickup.lane === 'center' ? 16 : 7);
      if (pickup.lane === 'left') return this.leftX + sway;
      if (pickup.lane === 'right') return this.rightX + sway;
      return this.centerX + sway;
    }

    toggleSide() {
      if (this.state.mode !== 'playing') return;

      const wallX = this.state.side === 'left' ? this.leftX : this.rightX;
      const anchored = Math.abs(this.state.player.x - wallX) <= 6 && !this.state.player.isSwitching;
      if (!anchored) return;

      if (this.state.side === 'left') {
        this.state.targetSide = 'right';
        this.state.targetX = this.rightX;
      } else {
        this.state.targetSide = 'left';
        this.state.targetX = this.leftX;
      }
      this.state.player.isSwitching = true;
      this.state.player.squashX = 1.23;
      this.state.player.squashY = 0.82;
      this.emitParticles(this.state.player.x, this.state.player.y, 8, 0xf4ffe0, 35, 130);
      this.playTone(550, 0.06, 'square', 0.03, 680);
    }

    startGame() {
      if (this.state.mode === 'menu' || this.state.mode === 'gameover') {
        this.resetGame();
      }
    }

    collectPickup(pickup) {
      pickup.collected = true;
      const x = this.pickupX(pickup);
      const y = HEIGHT - (pickup.height - this.state.progress);
      this.state.player.squashX = 1.15;
      this.state.player.squashY = 0.88;

      if (pickup.type === 'flower') {
        this.state.bonusScore += 40;
        this.pushFloatText('+40', x, y, '#ffed79');
        this.emitParticles(x, y, 10, 0xffd65f, 24, 84);
        this.playTone(760, 0.08, 'triangle', 0.035, 980);
        return;
      }

      if (pickup.type === 'dew') {
        this.state.slowTimer = Math.min(6, this.state.slowTimer + 3.2);
        this.state.fastTimer = Math.max(0, this.state.fastTimer - 1);
        this.state.speed = Math.max(140, this.state.speed - 70);
        this.state.player.contactSeconds = Math.max(0, this.state.player.contactSeconds - 0.08);
        this.pushFloatText('SLOW', x, y, '#9fe8ff');
        this.emitParticles(x, y, 10, 0x8ee8ff, 18, 72);
        this.playTone(390, 0.14, 'sine', 0.04, 250);
        return;
      }

      if (pickup.type === 'shield') {
        this.state.invulnerableTimer = 10;
        this.state.player.contactSeconds = Math.max(0, this.state.player.contactSeconds - 0.22);
        this.pushFloatText('SHIELD', x, y, '#ddccff');
        this.emitParticles(x, y, 14, 0xb89dff, 26, 96);
        this.playTone(420, 0.08, 'triangle', 0.045, 700);
        return;
      }

      this.state.fastTimer = Math.min(6, this.state.fastTimer + 2.8);
      this.state.slowTimer = Math.max(0, this.state.slowTimer - 1);
      this.state.speed = Math.min(360, this.state.speed + 34);
      this.pushFloatText('TURBO', x, y, '#ffa25e');
      this.emitParticles(x, y, 12, 0xff9c5d, 30, 100);
      this.playTone(520, 0.11, 'sawtooth', 0.045, 1150);
    }

    updateFloatingTexts(dt) {
      for (const entry of this.state.floatTexts) {
        entry.ttl -= dt;
        entry.obj.y -= 26 * dt;
        entry.obj.setAlpha(Math.max(0, Math.min(1, entry.ttl)));
      }

      const alive = [];
      for (const entry of this.state.floatTexts) {
        if (entry.ttl > 0) {
          alive.push(entry);
        } else {
          entry.obj.destroy();
        }
      }
      this.state.floatTexts = alive;
    }

    updateParticles(dt) {
      const next = [];
      for (const p of this.state.particles) {
        p.ttl -= dt;
        p.vy += 150 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.ttl > 0) next.push(p);
      }
      this.state.particles = next;
    }

    step(dt) {
      this.updateFloatingTexts(dt);
      this.updateParticles(dt);
      this.state.player.squashX += (1 - this.state.player.squashX) * Math.min(1, dt * 9);
      this.state.player.squashY += (1 - this.state.player.squashY) * Math.min(1, dt * 9);

      if (this.state.mode === 'playing') {
        this.state.worldTime += dt;
        const difficulty = this.getDifficulty();
        this.state.speed = Math.min(355, this.state.speed + (2 + difficulty * 1.1) * dt);
        if (this.state.slowTimer > 0) this.state.slowTimer = Math.max(0, this.state.slowTimer - dt);
        if (this.state.fastTimer > 0) this.state.fastTimer = Math.max(0, this.state.fastTimer - dt);
        if (this.state.invulnerableTimer > 0) this.state.invulnerableTimer = Math.max(0, this.state.invulnerableTimer - dt);

        this.state.progress += this.getCurrentClimbSpeed() * dt;
        this.state.score = Math.floor(this.state.progress / 14) + this.state.bonusScore;

        if (this.state.player.isSwitching) {
          const direction = Math.sign(this.state.targetX - this.state.player.x);
          const step = this.state.player.switchSpeed * dt;
          const remaining = Math.abs(this.state.targetX - this.state.player.x);
          if (remaining <= step) {
            this.state.player.x = this.state.targetX;
            this.state.player.vx = 0;
            this.state.player.isSwitching = false;
            this.state.side = this.state.targetSide;
            this.state.player.squashX = 0.84;
            this.state.player.squashY = 1.2;
            this.emitParticles(this.state.player.x, this.state.player.y + 8, 7, 0xd8f5ff, 24, 96);
            this.playTone(680, 0.04, 'square', 0.03, 540);
          } else {
            this.state.player.vx = direction * this.state.player.switchSpeed;
            this.state.player.x += this.state.player.vx * dt;
          }
        } else {
          this.state.player.x = this.state.targetX;
          this.state.player.vx = 0;
        }

        this.ensureObstacles();
        this.ensurePickups();

        const contactSide = this.state.player.isSwitching
          ? (this.state.player.x < WIDTH * 0.5 ? 'left' : 'right')
          : this.state.side;

        let touching = false;
        let touchMultiplier = 1;

        for (const obstacle of this.state.obstacles) {
          const y = HEIGHT - (obstacle.height - this.state.progress);
          if (Math.abs(y - this.state.player.y) > obstacle.hitRadius || obstacle.side !== contactSide) continue;

          let hazardScale = 1;
          if (obstacle.type === 'rotor') {
            hazardScale = 0.7 + Math.abs(Math.sin(this.state.worldTime * 8 + obstacle.phase));
          } else if (obstacle.type === 'shard') {
            hazardScale = 1.2;
          }

          touching = true;
          touchMultiplier = Math.max(touchMultiplier, hazardScale);
        }

        if (touching) {
          if (this.state.invulnerableTimer > 0) {
            this.state.invulnerableTimer = 0;
            this.state.contactFlag = false;
            this.state.player.contactSeconds = Math.max(0, this.state.player.contactSeconds - 0.16);
            this.state.player.squashX = 1.35;
            this.state.player.squashY = 0.72;
            this.emitParticles(this.state.player.x, this.state.player.y, 20, 0xdcc9ff, 40, 170);
            this.playTone(980, 0.09, 'square', 0.05, 460);
            this.cameras.main.flash(80, 210, 180, 255, false);
          } else {
            this.state.player.contactSeconds += dt * touchMultiplier;
            if (!this.state.contactFlag) {
              this.state.contactFlag = true;
              this.emitParticles(this.state.player.x, this.state.player.y, 6, 0xffd3ba, 22, 86);
              this.playTone(200, 0.05, 'square', 0.03, 150);
            }
          }
        } else {
          this.state.player.contactSeconds = Math.max(0, this.state.player.contactSeconds - dt * 0.1);
          this.state.contactFlag = false;
        }

        for (const pickup of this.state.pickups) {
          if (pickup.collected) continue;
          const py = HEIGHT - (pickup.height - this.state.progress);
          if (py < -40 || py > HEIGHT + 40) continue;

          const px = this.pickupX(pickup);
          const rangeX = pickup.lane === 'center' ? 42 : 34;
          if (Math.abs(px - this.state.player.x) <= rangeX && Math.abs(py - this.state.player.y) <= 30) {
            this.collectPickup(pickup);
          }
        }

        if (this.state.player.contactSeconds >= this.state.player.maxContact) {
          this.state.mode = 'falling';
          this.state.player.spines = 0;
          this.state.player.vy = -20;
          this.state.player.squashX = 1.3;
          this.state.player.squashY = 0.72;
          this.emitParticles(this.state.player.x, this.state.player.y, 20, 0xfff2e1, 40, 180);
          this.playTone(180, 0.2, 'sawtooth', 0.055, 70);
          this.cameras.main.shake(130, 0.006);
        }
      } else if (this.state.mode === 'falling') {
        this.state.player.vy += 880 * dt;
        this.state.player.y += this.state.player.vy * dt;
        this.state.player.x += (this.state.targetX - this.state.player.x) * dt * 3;
        if (this.seededRandom() < 0.35) {
          this.emitParticles(this.state.player.x, this.state.player.y, 1, 0xe0ffda, 8, 30);
        }
        if (this.state.player.y - this.state.player.radius > HEIGHT + 30) {
          this.state.mode = 'gameover';
        }
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
      this.g.fillStyle(0xd8eeff, 1);
      this.g.fillRect(0, 0, WIDTH, HEIGHT);

      const driftTime = this.state.worldTime * 24;
      for (const stripe of this.state.glassStripes) {
        const offset = Math.sin(driftTime * 0.02 + stripe.x * 0.07) * 10 + stripe.drift * 10;
        this.g.fillStyle(0xffffff, 0.2);
        this.g.fillRect(stripe.x + offset, 0, 4, HEIGHT);
      }

      this.g.fillStyle(0x7db2d8, 1);
      this.g.fillRect(0, 0, 56, HEIGHT);
      this.g.fillRect(WIDTH - 56, 0, 56, HEIGHT);

      this.g.fillStyle(0xffffff, 0.38);
      this.g.fillRect(10, 0, 6, HEIGHT);
      this.g.fillRect(WIDTH - 16, 0, 6, HEIGHT);
    }

    drawObstacle(obstacle) {
      const y = HEIGHT - (obstacle.height - this.state.progress);
      if (y < -90 || y > HEIGHT + 90) return;

      const isLeft = obstacle.side === 'left';
      const wallX = isLeft ? 56 : WIDTH - 56;

      if (obstacle.type === 'spike') {
        this.g.fillStyle(0x5a7892, 1);
        this.g.beginPath();
        this.g.moveTo(wallX, y);
        this.g.lineTo(isLeft ? wallX + obstacle.size : wallX - obstacle.size, y - 22);
        this.g.lineTo(isLeft ? wallX + obstacle.size * 0.8 : wallX - obstacle.size * 0.8, y + 26);
        this.g.closePath();
        this.g.fillPath();
        return;
      }

      if (obstacle.type === 'shard') {
        const dir = isLeft ? 1 : -1;
        this.g.fillStyle(0x4b6883, 1);
        this.g.beginPath();
        this.g.moveTo(wallX, y);
        this.g.lineTo(wallX + dir * obstacle.size, y - 14);
        this.g.lineTo(wallX + dir * (obstacle.size + 18), y + 8);
        this.g.lineTo(wallX + dir * obstacle.size, y + 32);
        this.g.closePath();
        this.g.fillPath();
        return;
      }

      const pulse = 0.9 + Math.abs(Math.sin(this.state.worldTime * 8 + obstacle.phase)) * 0.45;
      const radius = obstacle.size * pulse;
      const center = isLeft ? wallX + radius * 0.9 : wallX - radius * 0.9;

      this.g.fillStyle(0x35556f, 1);
      this.g.fillCircle(center, y, radius);

      this.g.lineStyle(2, 0xd8edf8, 1);
      for (let i = 0; i < 6; i += 1) {
        const a = this.state.worldTime * 4 + obstacle.phase + (Math.PI * 2 * i) / 6;
        const inner = radius * 0.45;
        const outer = radius * 0.95;
        this.g.beginPath();
        this.g.moveTo(center + Math.cos(a) * inner, y + Math.sin(a) * inner);
        this.g.lineTo(center + Math.cos(a) * outer, y + Math.sin(a) * outer);
        this.g.strokePath();
      }
      this.g.lineStyle();
    }

    drawPickup(pickup) {
      if (pickup.collected) return;
      const y = HEIGHT - (pickup.height - this.state.progress);
      if (y < -50 || y > HEIGHT + 50) return;

      const x = this.pickupX(pickup);
      if (pickup.type === 'flower') {
        this.g.fillStyle(0xffd65f, 1);
        for (let i = 0; i < 6; i += 1) {
          const a = pickup.bob + this.state.worldTime * 1.5 + (Math.PI * 2 * i) / 6;
          this.g.fillCircle(x + Math.cos(a) * 8, y + Math.sin(a) * 8, 5);
        }
        this.g.fillStyle(0xff965a, 1);
        this.g.fillCircle(x, y, 6);
        return;
      }

      if (pickup.type === 'dew') {
        this.g.fillStyle(0x8ee8ff, 1);
        this.g.fillTriangle(x, y - 12, x + 9, y + 6, x - 9, y + 6);
        this.g.fillCircle(x, y + 3, 9);
        this.g.fillStyle(0xffffff, 0.7);
        this.g.fillCircle(x - 2, y - 4, 2.5);
        return;
      }

      if (pickup.type === 'shield') {
        this.g.fillStyle(0xb89dff, 1);
        this.g.fillTriangle(x, y - 12, x + 11, y - 2, x + 6, y + 11);
        this.g.fillTriangle(x, y - 12, x - 11, y - 2, x - 6, y + 11);
        this.g.fillStyle(0xf2e7ff, 0.8);
        this.g.fillCircle(x, y - 1, 3.2);
        return;
      }

      this.g.fillStyle(0xff9b4e, 1);
      this.g.beginPath();
      this.g.moveTo(x - 8, y - 12);
      this.g.lineTo(x + 1, y - 12);
      this.g.lineTo(x - 4, y - 1);
      this.g.lineTo(x + 8, y - 1);
      this.g.lineTo(x - 2, y + 14);
      this.g.lineTo(x + 1, y + 3);
      this.g.lineTo(x - 8, y + 3);
      this.g.closePath();
      this.g.fillPath();
    }

    drawParticles() {
      for (const p of this.state.particles) {
        const alpha = Phaser.Math.Clamp(p.ttl * 2.4, 0, 1);
        this.g.fillStyle(p.color, alpha);
        this.g.fillCircle(p.x, p.y, p.size);
      }
    }

    drawCactus() {
      const x = this.state.player.x;
      const y = this.state.player.y;
      const radius = this.state.player.radius;
      const sx = this.state.player.squashX;
      const sy = this.state.player.squashY;

      this.g.fillStyle(0x2e9a52, 1);
      this.g.fillEllipse(x, y, radius * 2 * sx, radius * 2.4 * sy);

      this.g.fillStyle(0x237d43, 1);
      this.g.fillRect(x - (radius + 8) * sx, y - 14 * sy, 9 * sx, 26 * sy);
      this.g.fillRect(x + (radius - 1) * sx, y - 4 * sy, 9 * sx, 28 * sy);

      if (this.state.player.spines > 0) {
        this.g.lineStyle(2, 0xf4ffe0, 1);
        for (let i = 0; i < 12; i += 1) {
          const angle = (Math.PI * 2 * i) / 12;
          const px = x + Math.cos(angle) * (radius - 2) * sx;
          const py = y + Math.sin(angle) * (radius - 2) * 1.15 * sy;
          const ex = x + Math.cos(angle) * (radius + 7) * sx;
          const ey = y + Math.sin(angle) * (radius + 7) * 1.15 * sy;
          this.g.beginPath();
          this.g.moveTo(px, py);
          this.g.lineTo(ex, ey);
          this.g.strokePath();
        }
        this.g.lineStyle();
      }

      this.g.fillStyle(0x12261a, 1);
      this.g.fillCircle(x - 5 * sx, y - 4 * sy, 3.2);
      this.g.fillCircle(x + 6 * sx, y - 4 * sy, 3.2);
    }

    drawHud() {
      this.g.fillStyle(0x091a2d, 0.72);
      this.g.fillRect(14, 14, WIDTH - 28, 96);

      const safeRatio = Phaser.Math.Clamp(1 - this.state.player.contactSeconds / this.state.player.maxContact, 0, 1);
      this.g.fillStyle(0x28435f, 1);
      this.g.fillRect(WIDTH - 154, 42, 112, 14);
      const r = Math.round(220 - safeRatio * 120);
      const gg = Math.round(120 + safeRatio * 120);
      const spikeColor = Phaser.Display.Color.GetColor(r, gg, 90);
      this.g.fillStyle(spikeColor, 1);
      this.g.fillRect(WIDTH - 154, 42, 112 * safeRatio, 14);

      const slowRatio = Math.min(1, this.state.slowTimer / 3.2);
      this.g.fillStyle(0x294560, 1);
      this.g.fillRect(WIDTH - 154, 70, 112, 8);
      if (slowRatio > 0) {
        this.g.fillStyle(0x7fdfff, 1);
        this.g.fillRect(WIDTH - 154, 70, 112 * slowRatio, 8);
      }

      const fastRatio = Math.min(1, this.state.fastTimer / 2.8);
      this.g.fillStyle(0x5d3d2f, 1);
      this.g.fillRect(WIDTH - 154, 84, 112, 8);
      if (fastRatio > 0) {
        this.g.fillStyle(0xff9c5d, 1);
        this.g.fillRect(WIDTH - 154, 84, 112 * fastRatio, 8);
      }

      const shieldRatio = Math.min(1, this.state.invulnerableTimer / 10);
      this.g.fillStyle(0x433569, 1);
      this.g.fillRect(WIDTH - 154, 98, 112, 8);
      if (shieldRatio > 0) {
        this.g.fillStyle(0xb89dff, 1);
        this.g.fillRect(WIDTH - 154, 98, 112 * shieldRatio, 8);
      }

      this.hudHeight.setText(`Altura: ${Math.floor(this.state.progress)}m`);
      this.hudScore.setText(`Score: ${this.state.score}`);
    }

    drawOverlay() {
      const mode = this.state.mode;

      const menuVisible = mode === 'menu';
      this.menuTitleA.setVisible(menuVisible);
      this.menuTitleB.setVisible(menuVisible);
      this.menuLine1.setVisible(menuVisible);
      this.menuLine2.setVisible(menuVisible);
      this.menuLine3.setVisible(menuVisible);
      this.menuLine4.setVisible(menuVisible);

      const gameoverVisible = mode === 'gameover';
      this.gameOverTitle.setVisible(gameoverVisible);
      this.gameOverHeight.setVisible(gameoverVisible);
      this.gameOverRestart.setVisible(gameoverVisible);
      this.gameOverHeight.setText(`Altura final: ${Math.floor(this.state.progress)}m`);

      if (menuVisible) {
        this.g.fillStyle(0x051220, 0.7);
        this.g.fillRect(0, 0, WIDTH, HEIGHT);
      }

      if (mode === 'falling') {
        this.g.fillStyle(0xb13429, 0.18);
        this.g.fillRect(0, 0, WIDTH, HEIGHT);
      }

      if (gameoverVisible) {
        this.g.fillStyle(0x051220, 0.72);
        this.g.fillRect(0, 0, WIDTH, HEIGHT);
      }

      const hudVisible = mode !== 'menu';
      this.hudHeight.setVisible(hudVisible);
      this.hudScore.setVisible(hudVisible);
      this.hudSpikes.setVisible(hudVisible);
      this.hudBrake.setVisible(hudVisible);
      this.hudTurbo.setVisible(hudVisible);
      this.hudShield.setVisible(hudVisible);
    }

    renderFrame() {
      this.g.clear();
      this.drawBackground();
      for (const obstacle of this.state.obstacles) this.drawObstacle(obstacle);
      for (const pickup of this.state.pickups) this.drawPickup(pickup);
      this.drawParticles();
      this.drawCactus();
      if (this.state.mode !== 'menu') this.drawHud();
      this.drawOverlay();
    }

    renderGameToText() {
      const nearestObstacles = this.state.obstacles
        .map((obstacle) => ({
          type: obstacle.type,
          side: obstacle.side,
          worldHeight: Math.round(obstacle.height),
          screenY: Math.round(HEIGHT - (obstacle.height - this.state.progress)),
        }))
        .filter((obstacle) => obstacle.screenY >= -90 && obstacle.screenY <= HEIGHT + 90)
        .slice(0, 10);

      const visiblePickups = this.state.pickups
        .map((pickup) => ({
          type: pickup.type,
          lane: pickup.lane,
          worldHeight: Math.round(pickup.height),
          screenY: Math.round(HEIGHT - (pickup.height - this.state.progress)),
        }))
        .filter((pickup) => pickup.screenY >= -60 && pickup.screenY <= HEIGHT + 60)
        .slice(0, 8);

      const wallX = this.state.side === 'left' ? this.leftX : this.rightX;
      const canSwitch = Math.abs(this.state.player.x - wallX) <= 6 && !this.state.player.isSwitching;

      return JSON.stringify({
        coordSystem: {
          origin: 'top-left',
          axisX: 'right-positive',
          axisY: 'down-positive',
        },
        mode: this.state.mode,
        player: {
          x: Math.round(this.state.player.x),
          y: Math.round(this.state.player.y),
          vx: Number(this.state.player.vx.toFixed(2)),
          vy: Number(this.state.player.vy.toFixed(2)),
          side: this.state.side,
          targetSide: this.state.targetSide,
          isSwitching: this.state.player.isSwitching,
          canSwitch,
          spinesIntact: this.state.player.spines > 0,
        },
        climb: {
          progressMeters: Math.round(this.state.progress),
          score: this.state.score,
          bonusScore: this.state.bonusScore,
          baseSpeed: Number(this.state.speed.toFixed(2)),
          currentSpeed: Number(this.getCurrentClimbSpeed().toFixed(2)),
          slowTimer: Number(this.state.slowTimer.toFixed(2)),
          fastTimer: Number(this.state.fastTimer.toFixed(2)),
          invulnerableTimer: Number(this.state.invulnerableTimer.toFixed(2)),
          difficulty: Number(this.getDifficulty().toFixed(2)),
        },
        contact: {
          seconds: Number(this.state.player.contactSeconds.toFixed(2)),
          maxSeconds: this.state.player.maxContact,
        },
        effects: {
          particles: this.state.particles.length,
        },
        obstacles: nearestObstacles,
        pickups: visiblePickups,
        controls: ['a', 'd', 'arrowleft', 'arrowright', 'space', 'enter', 'f'],
      });
    }
  }

  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent: 'game-root',
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: '#d8eeff',
    scene: [CactoEscaladorPhaserScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });

  window.cactoEscaladorPhaserGame = game;
})();
