import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { PlayerCar } from './PlayerCar.js';
import { Road } from './Road.js';
import { Spawner } from './Spawner.js';
import { checkAABBCollision } from './Collision.js';
import { PhaseManager } from './Phases.js';
import { HUD } from './HUD.js';
import { AudioEngine } from './Audio.js';

const CONFIG = {
  cameraFov: 62,
  minWorldSpeed: 42,
  maxWorldSpeed: 88,
  accelRate: 0.95,
  brakeRate: 1.55,
  coastingDecay: 0.22,
  defaultThrottle: 0.64,
  turnSpeed: 11,
  stunSeconds: 1,
  stunSpeedFactor: 0.35,
  crashTimePenalty: 2.4,
  edgePenaltySeconds: 0.45,
  edgeSpeedFactor: 0.68,
  overtakeZ: 12,
};

const GAME_VERSION = 'v0.7.6';

export class Game {
  constructor(mountEl) {
    this.mountEl = mountEl;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.mountEl.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CONFIG.cameraFov, window.innerWidth / window.innerHeight, 0.1, 650);

    this.lights = this.createLights();

    this.road = new Road(this.scene);
    this.player = new PlayerCar();
    this.player.group.position.z = 3;
    this.scene.add(this.player.group);

    this.spawner = new Spawner(this.scene);
    this.phases = new PhaseManager();
    this.hud = new HUD();
    this.audio = new AudioEngine();

    this.state = 'START';
    this.elapsed = 0;

    this.stunTimer = 0;
    this.edgePenaltyTimer = 0;
    this.failCooldown = 0;

    this.input = { left: false, right: false, up: false, down: false };
    this.speedNorm = CONFIG.defaultThrottle;

    this.carsTarget = this.phases.carsTarget;
    this.carsOvertaken = 0;
    this.dayCompletedEarly = false;

    this.clock = new THREE.Clock();

    this.bindEvents();
    this.applyPhaseVisuals();

    this.hud.showStart(() => {
      this.audio.ensureContext();
      this.state = 'PLAYING';
    });
    this.hud.setVersion(GAME_VERSION);

    this.updateHUD();
    this.updateCamera();

    window.render_game_to_text = () => this.renderGameToText();
    window.advanceTime = (ms) => this.advanceTime(ms);
  }

  createLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(16, 22, 12);

    this.scene.add(ambient, sun);
    return { ambient, sun };
  }

  bindEvents() {
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyP') {
        this.togglePause();
        return;
      }

      if (event.code === 'ArrowLeft' || event.code === 'KeyA') this.input.left = true;
      if (event.code === 'ArrowRight' || event.code === 'KeyD') this.input.right = true;
      if (event.code === 'ArrowUp' || event.code === 'KeyW') this.input.up = true;
      if (event.code === 'ArrowDown' || event.code === 'KeyS') this.input.down = true;

      if (this.state === 'FAILED' && this.failCooldown <= 0 && (event.code === 'KeyR' || event.code === 'Enter')) {
        this.restart();
      }
    });

    window.addEventListener('keyup', (event) => {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') this.input.left = false;
      if (event.code === 'ArrowRight' || event.code === 'KeyD') this.input.right = false;
      if (event.code === 'ArrowUp' || event.code === 'KeyW') this.input.up = false;
      if (event.code === 'ArrowDown' || event.code === 'KeyS') this.input.down = false;
    });
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  restart() {
    this.phases.startDay(1);
    this.state = 'PLAYING';
    this.spawner.reset();
    this.player.group.position.x = 0;
    this.player.group.position.z = 3;
    this.player.group.rotation.set(0, 0, 0);

    this.speedNorm = CONFIG.defaultThrottle;
    this.input.left = false;
    this.input.right = false;
    this.input.up = false;
    this.input.down = false;

    this.stunTimer = 0;
    this.edgePenaltyTimer = 0;
    this.failCooldown = 0;

    this.carsTarget = this.phases.carsTarget;
    this.carsOvertaken = 0;
    this.dayCompletedEarly = false;

    this.hud.hideMessage();
    this.applyPhaseVisuals();
    this.updateHUD();
  }

  applyPhaseVisuals() {
    this.phases.applyToScene(this.scene, this.renderer, this.lights, this.road);
    const isNight = this.phases.current.nightLightsOnly;
    this.player.setNightMode(isNight);
    this.spawner.setNightMode(isNight);
  }

  getCarsLeft() {
    return Math.max(0, this.carsTarget - this.carsOvertaken);
  }

  getCarsLabel() {
    if (!this.dayCompletedEarly) {
      return `CARS LEFT: ${this.getCarsLeft()}`;
    }

    const flags = 3 + ((this.phases.day - 1) % 4);
    const symbol = Math.floor(this.elapsed * 4) % 2 === 0 ? '*' : '+';
    return `FLAGS: ${symbol.repeat(flags)}`;
  }

  updateHUD() {
    this.hud.setStatus({
      carsLabel: this.getCarsLabel(),
      phase: this.phases.phaseLabel,
      day: this.phases.day,
      speedKmh: this.getSpeedKmh(this.getWorldSpeed()),
      dayTimeLeft: this.phases.dayTimeLeft,
    });
  }

  getInputAxis() {
    return (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
  }

  updateSpeedNorm(dt) {
    if (this.input.up) this.speedNorm += CONFIG.accelRate * dt;
    if (this.input.down) this.speedNorm -= CONFIG.brakeRate * dt;
    if (!this.input.up && !this.input.down) this.speedNorm -= CONFIG.coastingDecay * dt;
    this.speedNorm = THREE.MathUtils.clamp(this.speedNorm, 0.2, 1);
  }

  getWorldSpeed() {
    const profile = this.phases.current;
    const targetSpeed = THREE.MathUtils.lerp(CONFIG.minWorldSpeed, CONFIG.maxWorldSpeed, this.speedNorm);
    const speedPenalty =
      (this.stunTimer > 0 ? CONFIG.stunSpeedFactor : 1) * (this.edgePenaltyTimer > 0 ? CONFIG.edgeSpeedFactor : 1);
    return targetSpeed * this.phases.playerSpeedScalar * profile.speedMul * (1 + this.phases.difficulty * 0.12) * speedPenalty;
  }

  getSpeedKmh(worldSpeed) {
    return worldSpeed * 2.8;
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this.input.left = false;
      this.input.right = false;
      this.input.up = false;
      this.input.down = false;
      this.hud.message('PAUSED', 0);
      return;
    }

    if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.hud.hideMessage();
    }
  }

  startNextDay() {
    const nextDay = this.phases.day + 1;
    this.phases.startDay(nextDay);

    this.carsTarget = this.phases.carsTarget;
    this.carsOvertaken = 0;
    this.dayCompletedEarly = false;

    this.stunTimer = 0;
    this.edgePenaltyTimer = 0;
    this.speedNorm = Math.min(0.76, CONFIG.defaultThrottle + (this.phases.day - 1) * 0.01);

    this.spawner.reset();
    this.applyPhaseVisuals();
    this.hud.message(`DAY ${this.phases.day}`, 900);
  }

  update(dt) {
    this.elapsed += dt;

    if (this.state === 'START') {
      this.road.update(dt, CONFIG.minWorldSpeed * 0.55);
      this.player.group.position.x = Math.sin(this.elapsed * 0.5) * 0.4;
      this.updateCamera();
      this.audio.setMotor(0.2);
      return;
    }

    if (this.state === 'FAILED') {
      this.failCooldown = Math.max(0, this.failCooldown - dt);
      this.audio.setMotor(0.08);
      return;
    }

    if (this.state === 'PAUSED') {
      this.audio.setMotor(0.05);
      return;
    }

    this.stunTimer = Math.max(0, this.stunTimer - dt);
    this.edgePenaltyTimer = Math.max(0, this.edgePenaltyTimer - dt);
    this.updateSpeedNorm(dt);

    const phaseTick = this.phases.update(dt);
    if (phaseTick.phaseChanged) {
      this.applyPhaseVisuals();
    }

    if (phaseTick.dayWrapped) {
      if (!this.dayCompletedEarly) {
        this.state = 'FAILED';
        this.failCooldown = 0.3;
        this.hud.flash(170);
        this.hud.message('DAY FAILED - PRESS R OR ENTER', 0);
        this.updateHUD();
        return;
      }

      this.startNextDay();
    }

    const phaseCfg = this.phases.current;

    const axis = this.getInputAxis();
    const controlFactor = this.stunTimer > 0 ? 0.15 : this.edgePenaltyTimer > 0 ? 0.45 : phaseCfg.turnControl;

    this.player.update(dt, axis, {
      turnSpeed: CONFIG.turnSpeed,
      control: controlFactor,
      roadLimit: this.road.roadHalfWidth - 0.8,
    });

    if (Math.abs(this.player.group.position.x) > this.road.roadHalfWidth - 1.8) {
      this.edgePenaltyTimer = CONFIG.edgePenaltySeconds;
    }

    const worldSpeed = this.getWorldSpeed();
    const spawnSpeedFactor = THREE.MathUtils.lerp(0.85, 1.45, this.speedNorm) * this.phases.trafficDensityScalar;
    this.spawner.update(
      dt,
      phaseCfg,
      this.phases.difficulty + (this.phases.trafficDensityScalar - 1) * 0.9,
      this.road.roadHalfWidth - 1.2,
      spawnSpeedFactor
    );
    this.road.update(dt, worldSpeed);

    this.spawner.forEachActive((car, index) => {
      car.update(dt, worldSpeed, this.road.roadHalfWidth - 0.9, this.elapsed);

      if (car.group.position.z > this.player.group.position.z + CONFIG.overtakeZ) {
        this.spawner.despawnAt(index);
        if (!this.dayCompletedEarly) {
          this.carsOvertaken += 1;
          this.audio.beep();
          this.hud.overtakePulse();

          if (this.carsOvertaken >= this.carsTarget) {
            this.dayCompletedEarly = true;
            this.hud.message('GOAL CLEARED', 1100);
          }
        }
        this.updateHUD();
        return;
      }

      if (
        this.stunTimer <= 0 &&
        checkAABBCollision(this.player.group.position, this.player.halfExtents, car.group.position, car.halfExtents)
      ) {
        this.stunTimer = CONFIG.stunSeconds;
        this.audio.crash();
        this.hud.flash(140);
        this.player.group.position.x -= Math.sign(car.group.position.x - this.player.group.position.x) * 0.7;
        this.updateHUD();
      }
    });

    this.audio.setMotor(0.25 + this.speedNorm * 0.7 + Math.abs(axis) * 0.08);
    this.updateHUD();
    this.updateCamera();
  }

  updateCamera() {
    const p = this.player.group.position;
    this.camera.position.lerp(new THREE.Vector3(p.x * 0.25, 5.5, 12.5), 0.14);
    this.camera.lookAt(p.x * 0.1, 1.2, -34);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  frame = () => {
    const dt = Math.min(0.033, this.clock.getDelta());
    this.update(dt);
    this.render();
    requestAnimationFrame(this.frame);
  };

  start() {
    this.clock.start();
    this.frame();
  }

  advanceTime(ms) {
    const step = 1 / 60;
    const frames = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < frames; i += 1) {
      this.update(step);
    }
    this.render();
  }

  renderGameToText() {
    const payload = {
      mode: this.state,
      coordinateSystem: 'x: left(-) to right(+), z: forward is negative, cars approach toward positive z',
      phase: this.phases.phaseLabel,
      day: this.phases.day,
      targetCars: this.carsTarget,
      overtakenCars: this.carsOvertaken,
      carsLeft: this.getCarsLeft(),
      completedEarly: this.dayCompletedEarly,
      phaseTimeLeft: Number(this.phases.phaseTimeLeft.toFixed(2)),
      dayTimeLeft: Number(this.phases.dayTimeLeft.toFixed(2)),
      trafficDensityScalar: Number(this.phases.trafficDensityScalar.toFixed(2)),
      playerSpeedScalar: Number(this.phases.playerSpeedScalar.toFixed(2)),
      player: {
        x: Number(this.player.group.position.x.toFixed(2)),
        z: Number(this.player.group.position.z.toFixed(2)),
        stun: Number(this.stunTimer.toFixed(2)),
        edgePenalty: Number(this.edgePenaltyTimer.toFixed(2)),
        speedNorm: Number(this.speedNorm.toFixed(2)),
        speedKmh: Math.round(this.getSpeedKmh(this.getWorldSpeed())),
      },
      aiCars: this.spawner.active.slice(0, 10).map((car) => ({
        type: car.type,
        x: Number(car.group.position.x.toFixed(2)),
        z: Number(car.group.position.z.toFixed(2)),
      })),
    };

    return JSON.stringify(payload);
  }
}
