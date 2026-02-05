import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export const PHASES = [
  {
    id: 'DAY',
    sky: 0x6fa4f8,
    clear: 0x6fa4f8,
    fog: null,
    spawnInterval: 1.12,
    aiDrift: 0.08,
    turnControl: 1,
    roadColor: 0x2d2f36,
    shoulderColor: 0x5c4f3f,
    weights: [
      { type: 'blue', weight: 0.42 },
      { type: 'green', weight: 0.35 },
      { type: 'yellow', weight: 0.14 },
      { type: 'white', weight: 0.08 },
      { type: 'black', weight: 0.01 },
    ],
  },
  {
    id: 'NIGHT',
    sky: 0x090d1a,
    clear: 0x090d1a,
    fog: { color: 0x0d1020, near: 38, far: 125 },
    spawnInterval: 0.95,
    aiDrift: 0.12,
    turnControl: 0.95,
    roadColor: 0x1e1f27,
    shoulderColor: 0x2c3038,
    weights: [
      { type: 'blue', weight: 0.26 },
      { type: 'green', weight: 0.33 },
      { type: 'yellow', weight: 0.22 },
      { type: 'white', weight: 0.16 },
      { type: 'black', weight: 0.03 },
    ],
  },
  {
    id: 'FOG',
    sky: 0xa0a6ad,
    clear: 0xa0a6ad,
    fog: { color: 0xb6bcc7, near: 18, far: 80 },
    spawnInterval: 0.82,
    aiDrift: 0.16,
    turnControl: 0.9,
    roadColor: 0x3a3b3f,
    shoulderColor: 0x7b7c7f,
    weights: [
      { type: 'blue', weight: 0.18 },
      { type: 'green', weight: 0.33 },
      { type: 'yellow', weight: 0.27 },
      { type: 'white', weight: 0.18 },
      { type: 'black', weight: 0.04 },
    ],
  },
  {
    id: 'SNOW',
    sky: 0xd8e8ff,
    clear: 0xd8e8ff,
    fog: { color: 0xe8edf7, near: 20, far: 90 },
    spawnInterval: 0.72,
    aiDrift: 0.2,
    turnControl: 0.76,
    roadColor: 0xbec4cd,
    shoulderColor: 0xf3f6fd,
    weights: [
      { type: 'blue', weight: 0.12 },
      { type: 'green', weight: 0.25 },
      { type: 'yellow', weight: 0.3 },
      { type: 'white', weight: 0.27 },
      { type: 'black', weight: 0.06 },
    ],
  },
];

export class PhaseManager {
  constructor() {
    this.day = 1;
    this.phaseIndex = 0;
    this.difficulty = 0;
  }

  get current() {
    return PHASES[this.phaseIndex];
  }

  get carsTarget() {
    return 12 + Math.floor(this.day * 2.4);
  }

  get dayDuration() {
    return Math.max(30, 52 - this.day);
  }

  next() {
    this.day += 1;
    this.difficulty = Math.min(2.5, this.difficulty + 0.12);
    this.phaseIndex = (this.phaseIndex + 1) % PHASES.length;
    return this.current;
  }

  reset() {
    this.day = 1;
    this.phaseIndex = 0;
    this.difficulty = 0;
  }

  applyToScene(scene, renderer, lights, road) {
    const cfg = this.current;

    scene.background = new THREE.Color(cfg.sky);
    renderer.setClearColor(cfg.clear, 1);

    if (cfg.fog) {
      scene.fog = new THREE.Fog(cfg.fog.color, cfg.fog.near, cfg.fog.far);
    } else {
      scene.fog = null;
    }

    lights.ambient.intensity = cfg.id === 'NIGHT' ? 0.28 : 0.55;
    lights.sun.intensity = cfg.id === 'NIGHT' ? 0.38 : 0.95;
    lights.headlight.visible = cfg.id === 'NIGHT';

    road.setPalette(cfg);
  }
}
