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
  worldSpeed: 52,
  turnSpeed: 11,
  stunSeconds: 1,
  stunSpeedFactor: 0.35,
  crashTimePenalty: 1.4,
  edgePenaltySeconds: 0.45,
  edgeSpeedFactor: 0.75,
  phasePauseSeconds: 1.6,
  overtakeZ: 12,
  daySpeedStep: 0.75,
};

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
    this.player.group.add(this.lights.headlight);
    this.player.group.add(this.lights.headlight.target);

    this.spawner = new Spawner(this.scene);
    this.phases = new PhaseManager();
    this.hud = new HUD();
    this.audio = new AudioEngine();

    this.state = 'START';
    this.phaseTransition = 0;
    this.dayTimer = this.phases.dayDuration;
    this.carsLeft = this.phases.carsTarget;
    this.elapsed = 0;

    this.stunTimer = 0;
    this.edgePenaltyTimer = 0;
    this.failCooldown = 0;

    this.input = { left: false, right: false };
    this.clock = new THREE.Clock();

    this.bindEvents();
    this.resetDay();

    this.hud.showStart(() => {
      this.audio.ensureContext();
      this.state = 'PLAYING';
    });

    this.updateHUD();
    this.updateCamera();

    window.render_game_to_text = () => this.renderGameToText();
    window.advanceTime = (ms) => this.advanceTime(ms);
  }

  createLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(16, 22, 12);

    const headlight = new THREE.SpotLight(0xe5f1ff, 0.85, 24, Math.PI / 5, 0.35, 1.3);
    headlight.position.set(0, 2.6, 4.2);
    headlight.target.position.set(0, 0, -8);
    headlight.visible = false;

    this.scene.add(ambient, sun);
    return { ambient, sun, headlight };
  }

  bindEvents() {
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('keydown', (event) => {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') this.input.left = true;
      if (event.code === 'ArrowRight' || event.code === 'KeyD') this.input.right = true;

      if (this.state === 'FAILED' && this.failCooldown <= 0 && (event.code === 'KeyR' || event.code === 'Enter')) {
        this.restart();
      }
    });

    window.addEventListener('keyup', (event) => {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') this.input.left = false;
      if (event.code === 'ArrowRight' || event.code === 'KeyD') this.input.right = false;
    });
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  restart() {
    this.phases.reset();
    this.state = 'PLAYING';
    this.spawner.reset();
    this.player.group.position.x = 0;
    this.player.group.position.z = 3;
    this.player.group.rotation.set(0, 0, 0);
    this.hud.hideMessage();
    this.resetDay();
  }

  resetDay() {
    this.phaseTransition = 0;
    this.dayTimer = this.phases.dayDuration;
    this.carsLeft = this.phases.carsTarget;
    this.stunTimer = 0;
    this.edgePenaltyTimer = 0;
    this.failCooldown = 0;

    this.phases.applyToScene(this.scene, this.renderer, this.lights, this.road);
    this.spawner.reset();
    this.updateHUD();
  }

  updateHUD() {
    this.hud.setStatus({
      carsLeft: this.carsLeft,
      phase: this.phases.current.id,
      day: this.phases.day,
    });
  }

  getInputAxis() {
    return (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
  }

  update(dt) {
    this.elapsed += dt;

    if (this.state === 'START') {
      this.road.update(dt, CONFIG.worldSpeed * 0.4);
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

    if (this.state === 'PHASE_TRANSITION') {
      this.phaseTransition -= dt;
      this.audio.setMotor(0.2);
      if (this.phaseTransition <= 0) {
        this.phases.next();
        this.resetDay();
        this.state = 'PLAYING';
      }
      return;
    }

    this.dayTimer -= dt;
    if (this.dayTimer <= 0 && this.carsLeft > 0) {
      this.state = 'FAILED';
      this.failCooldown = 0.3;
      this.hud.flash(170);
      this.hud.message('DAY FAILED - PRESS R OR ENTER', 0);
      return;
    }

    const phaseCfg = this.phases.current;
    this.spawner.update(dt, phaseCfg, this.phases.difficulty, this.road.roadHalfWidth - 1.2);

    this.stunTimer = Math.max(0, this.stunTimer - dt);
    this.edgePenaltyTimer = Math.max(0, this.edgePenaltyTimer - dt);

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

    const baseSpeed =
      (CONFIG.worldSpeed + (this.phases.day - 1) * CONFIG.daySpeedStep) * (1 + this.phases.difficulty * 0.2);
    const speedPenalty =
      (this.stunTimer > 0 ? CONFIG.stunSpeedFactor : 1) * (this.edgePenaltyTimer > 0 ? CONFIG.edgeSpeedFactor : 1);
    const worldSpeed = baseSpeed * speedPenalty;
    this.road.update(dt, worldSpeed);

    this.spawner.forEachActive((car, index) => {
      car.update(dt, worldSpeed, this.road.roadHalfWidth - 0.9, this.elapsed);

      if (car.group.position.z > this.player.group.position.z + CONFIG.overtakeZ) {
        this.spawner.despawnAt(index);
        this.carsLeft -= 1;
        this.audio.beep();
        this.hud.overtakePulse();
        this.updateHUD();
        return;
      }

      if (
        this.stunTimer <= 0 &&
        checkAABBCollision(this.player.group.position, this.player.halfExtents, car.group.position, car.halfExtents)
      ) {
        this.stunTimer = CONFIG.stunSeconds;
        this.dayTimer = Math.max(0, this.dayTimer - CONFIG.crashTimePenalty);
        this.audio.crash();
        this.hud.flash(140);
        this.player.group.position.x -= Math.sign(car.group.position.x - this.player.group.position.x) * 0.7;
        this.updateHUD();
      }
    });

    if (this.carsLeft <= 0) {
      this.state = 'PHASE_TRANSITION';
      this.phaseTransition = CONFIG.phasePauseSeconds;
      this.hud.message(`${phaseCfg.id} COMPLETED`, 1200);
    }

    this.audio.setMotor(0.4 + Math.abs(axis) * 0.2 + this.phases.difficulty * 0.08);
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
      phase: this.phases.current.id,
      day: this.phases.day,
      carsLeft: this.carsLeft,
      dayTimeLeft: Number(this.dayTimer.toFixed(2)),
      player: {
        x: Number(this.player.group.position.x.toFixed(2)),
        z: Number(this.player.group.position.z.toFixed(2)),
        stun: Number(this.stunTimer.toFixed(2)),
        edgePenalty: Number(this.edgePenaltyTimer.toFixed(2)),
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
