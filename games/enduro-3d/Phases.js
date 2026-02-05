import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const PHASE_PROFILES = {
  DAY: {
    label: 'DAY',
    sky: 0x6fa4f8,
    clear: 0x6fa4f8,
    fog: null,
    spawnInterval: 0.86,
    aiDrift: 0.1,
    turnControl: 1,
    speedMul: 1,
    roadColor: 0x2d2f36,
    shoulderColor: 0x5c4f3f,
    nightLightsOnly: false,
    weights: [
      { type: 'blue', weight: 0.3 },
      { type: 'green', weight: 0.34 },
      { type: 'yellow', weight: 0.21 },
      { type: 'white', weight: 0.13 },
      { type: 'black', weight: 0.02 },
    ],
  },
  SNOW: {
    label: 'SNOW',
    sky: 0xd8e8ff,
    clear: 0xd8e8ff,
    fog: { color: 0xe8edf7, near: 20, far: 96 },
    spawnInterval: 0.62,
    aiDrift: 0.24,
    turnControl: 0.76,
    speedMul: 0.93,
    roadColor: 0xbec4cd,
    shoulderColor: 0xf3f6fd,
    nightLightsOnly: false,
    weights: [
      { type: 'blue', weight: 0.1 },
      { type: 'green', weight: 0.25 },
      { type: 'yellow', weight: 0.3 },
      { type: 'white', weight: 0.28 },
      { type: 'black', weight: 0.07 },
    ],
  },
  DUSK: {
    label: 'DUSK',
    sky: 0x6b5a7e,
    clear: 0x6b5a7e,
    fog: { color: 0x7c6a82, near: 25, far: 130 },
    spawnInterval: 0.72,
    aiDrift: 0.14,
    turnControl: 0.94,
    speedMul: 1,
    roadColor: 0x2c2b31,
    shoulderColor: 0x5a4f49,
    nightLightsOnly: false,
    weights: [
      { type: 'blue', weight: 0.22 },
      { type: 'green', weight: 0.3 },
      { type: 'yellow', weight: 0.25 },
      { type: 'white', weight: 0.19 },
      { type: 'black', weight: 0.04 },
    ],
  },
  NIGHT: {
    label: 'NIGHT',
    sky: 0x090d1a,
    clear: 0x090d1a,
    fog: { color: 0x0d1020, near: 34, far: 120 },
    spawnInterval: 0.66,
    aiDrift: 0.17,
    turnControl: 0.92,
    speedMul: 1.03,
    roadColor: 0x1e1f27,
    shoulderColor: 0x2c3038,
    nightLightsOnly: true,
    weights: [
      { type: 'blue', weight: 0.18 },
      { type: 'green', weight: 0.29 },
      { type: 'yellow', weight: 0.26 },
      { type: 'white', weight: 0.21 },
      { type: 'black', weight: 0.06 },
    ],
  },
  NIGHT_FOG: {
    label: 'NIGHT FOG',
    sky: 0x070a13,
    clear: 0x070a13,
    fog: { color: 0x141c2e, near: 10, far: 58 },
    spawnInterval: 0.58,
    aiDrift: 0.22,
    turnControl: 0.88,
    speedMul: 0.96,
    roadColor: 0x1a1d26,
    shoulderColor: 0x232936,
    nightLightsOnly: true,
    weights: [
      { type: 'blue', weight: 0.13 },
      { type: 'green', weight: 0.24 },
      { type: 'yellow', weight: 0.28 },
      { type: 'white', weight: 0.26 },
      { type: 'black', weight: 0.09 },
    ],
  },
  PRE_DAWN: {
    label: 'PRE-DAWN',
    sky: 0x26365a,
    clear: 0x26365a,
    fog: { color: 0x2e436b, near: 24, far: 120 },
    spawnInterval: 0.7,
    aiDrift: 0.14,
    turnControl: 0.96,
    speedMul: 1.01,
    roadColor: 0x252830,
    shoulderColor: 0x4b4f58,
    nightLightsOnly: false,
    weights: [
      { type: 'blue', weight: 0.2 },
      { type: 'green', weight: 0.3 },
      { type: 'yellow', weight: 0.24 },
      { type: 'white', weight: 0.2 },
      { type: 'black', weight: 0.06 },
    ],
  },
};

const CYCLE_SEGMENTS = [
  { profile: 'DAY', seconds: 20 },
  { profile: 'SNOW', seconds: 17 },
  { profile: 'DAY', seconds: 17 },
  { profile: 'DUSK', seconds: 13 },
  { profile: 'NIGHT', seconds: 18 },
  { profile: 'NIGHT_FOG', seconds: 18 },
  { profile: 'PRE_DAWN', seconds: 17 },
];

function targetForDay(day) {
  if (day === 1) return 200;
  if (day >= 2 && day <= 5) return 300;
  if (day >= 6 && day <= 8) return 350;
  if (day === 9) return 400;
  if (day >= 10) return 500;
  return 300;
}

export class PhaseManager {
  constructor() {
    this.day = 1;
    this.difficulty = 0;
    this.segmentDurations = [];
    this.segmentIndex = 0;
    this.phaseTimeLeft = 0;
    this.dayTimeLeft = 0;
    this.dayTarget = targetForDay(1);
    this.trafficDensityScalar = 1;
    this.playerSpeedScalar = 1;
    this.startDay(1);
  }

  get currentSegment() {
    return CYCLE_SEGMENTS[this.segmentIndex];
  }

  get current() {
    return PHASE_PROFILES[this.currentSegment.profile];
  }

  get phaseLabel() {
    return this.current.label;
  }

  get carsTarget() {
    return this.dayTarget;
  }

  startDay(dayNumber) {
    this.day = dayNumber;
    this.dayTarget = targetForDay(dayNumber);

    const segmentTimeScale = dayNumber >= 5 ? 0.9 : 1;
    this.segmentDurations = CYCLE_SEGMENTS.map((item) => item.seconds * segmentTimeScale);

    this.segmentIndex = 0;
    this.phaseTimeLeft = this.segmentDurations[0];
    this.dayTimeLeft = this.segmentDurations.reduce((sum, value) => sum + value, 0);

    this.difficulty = Math.min(2.8, (dayNumber - 1) * 0.1);

    this.trafficDensityScalar = 1;
    if (dayNumber >= 3) this.trafficDensityScalar += 0.18;
    if (dayNumber >= 7) this.trafficDensityScalar += 0.18;

    this.playerSpeedScalar = dayNumber >= 8 ? 1.1 : 1;
  }

  update(dt) {
    const result = { phaseChanged: false, dayWrapped: false };

    this.dayTimeLeft = Math.max(0, this.dayTimeLeft - dt);
    this.phaseTimeLeft -= dt;

    while (this.phaseTimeLeft <= 0) {
      const carry = -this.phaseTimeLeft;
      this.segmentIndex += 1;

      if (this.segmentIndex >= CYCLE_SEGMENTS.length) {
        result.dayWrapped = true;
        this.segmentIndex = CYCLE_SEGMENTS.length - 1;
        this.phaseTimeLeft = 0;
        return result;
      }

      result.phaseChanged = true;
      this.phaseTimeLeft = this.segmentDurations[this.segmentIndex] - carry;
    }

    return result;
  }

  applyToScene(scene, renderer, lights, road) {
    const cfg = this.current;
    const isNight = cfg.nightLightsOnly;

    scene.background = new THREE.Color(cfg.sky);
    renderer.setClearColor(cfg.clear, 1);

    if (cfg.fog) {
      scene.fog = new THREE.Fog(cfg.fog.color, cfg.fog.near, cfg.fog.far);
    } else {
      scene.fog = null;
    }

    lights.ambient.intensity = isNight ? 0.03 : cfg.label === 'DUSK' ? 0.34 : 0.56;
    lights.sun.intensity = isNight ? 0.04 : cfg.label === 'DUSK' ? 0.45 : 0.95;

    road.setPalette(cfg);
    road.setNightMode(isNight);
  }
}
