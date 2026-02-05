import { AICar, pickAICarType } from './AICar.js';

export class Spawner {
  constructor(scene, poolSize = 36) {
    this.pool = [];
    this.active = [];
    this.spawnTimer = 0;

    for (let i = 0; i < poolSize; i += 1) {
      const car = new AICar();
      car.group.visible = false;
      scene.add(car.group);
      this.pool.push(car);
    }
  }

  setNightMode(enabled) {
    for (const car of this.pool) {
      car.setNightMode(enabled);
    }
  }

  reset() {
    this.spawnTimer = 0;
    this.active.forEach((car) => car.despawn());
    this.active.length = 0;
  }

  update(dt, cfg, difficulty, roadHalfWidth, speedFactor = 1) {
    this.spawnTimer -= dt;

    const interval = Math.max(0.17, (cfg.spawnInterval * (1 - difficulty * 0.14)) / Math.max(0.7, speedFactor));
    while (this.spawnTimer <= 0) {
      this.spawnOne(cfg, difficulty, roadHalfWidth);
      this.spawnTimer += interval;
    }
  }

  spawnOne(cfg, difficulty, roadHalfWidth) {
    const car = this.pool.find((item) => !item.active);
    if (!car) return;

    const laneWidth = roadHalfWidth * (0.8 - difficulty * 0.06);
    const x = (Math.random() * 2 - 1) * laneWidth;
    const z = -130 - Math.random() * 130;
    const type = pickAICarType(cfg.weights);
    const driftStrength = cfg.aiDrift + difficulty * 0.08;

    car.spawn({ x, z, type, driftStrength });
    this.active.push(car);
  }

  forEachActive(callback) {
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const car = this.active[i];
      if (!car.active) {
        this.active.splice(i, 1);
        continue;
      }
      callback(car, i);
    }
  }

  despawnAt(index) {
    const car = this.active[index];
    if (!car) return;
    car.despawn();
    this.active.splice(index, 1);
  }
}
