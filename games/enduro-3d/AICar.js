import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const TYPE_DATA = {
  blue: { color: 0x2f66ff, speedMul: 0.66 },
  green: { color: 0x3fcf65, speedMul: 0.9 },
  yellow: { color: 0xffd84a, speedMul: 1.12 },
  white: { color: 0xf6f7ff, speedMul: 1.3 },
  black: { color: 0x101010, speedMul: 1.7 },
};

export class AICar {
  constructor() {
    this.group = new THREE.Group();
    this.solidParts = [];
    this.nightMode = false;

    this.bodyMat = new THREE.MeshLambertMaterial({ color: 0x2f66ff });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.42, 2), this.bodyMat);
    body.position.y = 0.4;
    this.group.add(body);
    this.solidParts.push(body);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.26, 0.9),
      new THREE.MeshLambertMaterial({ color: 0xe9ecff })
    );
    roof.position.set(0, 0.72, -0.05);
    this.group.add(roof);
    this.solidParts.push(roof);

    const wheelGeo = new THREE.BoxGeometry(0.2, 0.2, 0.36);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x151515 });
    [
      [-0.54, 0.14, 0.65],
      [0.54, 0.14, 0.65],
      [-0.54, 0.14, -0.65],
      [0.54, 0.14, -0.65],
    ].forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(x, y, z);
      this.group.add(wheel);
      this.solidParts.push(wheel);
    });

    const lightGeo = new THREE.SphereGeometry(0.09, 8, 8);
    const frontLightMat = new THREE.MeshBasicMaterial({ color: 0xfbfdff });
    const rearLightMat = new THREE.MeshBasicMaterial({ color: 0xff3d3d });
    const frontLeft = new THREE.Mesh(lightGeo, frontLightMat);
    const frontRight = new THREE.Mesh(lightGeo, frontLightMat);
    const rearLeft = new THREE.Mesh(lightGeo, rearLightMat);
    const rearRight = new THREE.Mesh(lightGeo, rearLightMat);
    frontLeft.position.set(-0.3, 0.34, -0.98);
    frontRight.position.set(0.3, 0.34, -0.98);
    rearLeft.position.set(-0.3, 0.34, 0.98);
    rearRight.position.set(0.3, 0.34, 0.98);
    this.group.add(frontLeft, frontRight, rearLeft, rearRight);

    const leftHeadlight = new THREE.SpotLight(0xc0ddff, 3.2, 18, Math.PI / 9.5, 0.34, 1);
    leftHeadlight.position.set(-0.3, 0.35, -0.96);
    leftHeadlight.target.position.set(-0.3, -0.18, -7.3);
    leftHeadlight.visible = false;
    this.group.add(leftHeadlight, leftHeadlight.target);

    const rightHeadlight = new THREE.SpotLight(0xc0ddff, 3.2, 18, Math.PI / 9.5, 0.34, 1);
    rightHeadlight.position.set(0.3, 0.35, -0.96);
    rightHeadlight.target.position.set(0.3, -0.18, -7.3);
    rightHeadlight.visible = false;
    this.group.add(rightHeadlight, rightHeadlight.target);
    this.headlights = [leftHeadlight, rightHeadlight];

    const streakMat = new THREE.MeshBasicMaterial({
      color: 0x72b8ff,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const leftStreak = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 5.2), streakMat.clone());
    leftStreak.rotation.x = -Math.PI / 2;
    leftStreak.position.set(-0.3, 0.03, -3.7);
    leftStreak.visible = false;

    const rightStreak = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 5.2), streakMat.clone());
    rightStreak.rotation.x = -Math.PI / 2;
    rightStreak.position.set(0.3, 0.03, -3.7);
    rightStreak.visible = false;
    this.group.add(leftStreak, rightStreak);
    this.headlightStreaks = [leftStreak, rightStreak];

    this.active = false;
    this.speedMul = 1;
    this.driftStrength = 0;
    this.baseX = 0;
    this.seed = Math.random() * 10;
    this.halfExtents = new THREE.Vector3(0.57, 0.36, 1);
  }

  spawn({ x, z, type, driftStrength }) {
    this.active = true;
    this.type = type;
    this.baseX = x;
    this.seed = Math.random() * 20;
    this.driftStrength = driftStrength;

    const cfg = TYPE_DATA[type] ?? TYPE_DATA.green;
    this.speedMul = cfg.speedMul;
    this.bodyMat.color.setHex(cfg.color);

    this.group.position.set(x, 0.03, z);
    this.group.rotation.set(0, 0, 0);
    this.group.visible = true;
    this.setNightMode(this.nightMode);
  }

  despawn() {
    this.active = false;
    this.group.visible = false;
  }

  update(dt, worldSpeed, roadLimit, time) {
    if (!this.active) return;

    this.group.position.z += worldSpeed * this.speedMul * dt;

    if (this.driftStrength > 0) {
      const drift = Math.sin(time * 1.5 + this.seed) * this.driftStrength;
      this.group.position.x = THREE.MathUtils.clamp(this.baseX + drift, -roadLimit, roadLimit);
    }

    this.group.rotation.z = THREE.MathUtils.clamp(
      (this.group.position.x - this.baseX) * -0.2,
      -0.15,
      0.15
    );
  }

  setNightMode(enabled) {
    this.nightMode = enabled;
    for (const part of this.solidParts) {
      part.visible = !enabled;
    }
    for (const light of this.headlights) {
      light.visible = enabled;
    }
    for (const streak of this.headlightStreaks) {
      streak.visible = enabled;
    }
  }
}

export function pickAICarType(weights) {
  const roll = Math.random();
  let acc = 0;
  for (const entry of weights) {
    acc += entry.weight;
    if (roll <= acc) return entry.type;
  }
  return weights[weights.length - 1]?.type ?? 'green';
}
