import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class PlayerCar {
  constructor() {
    this.group = new THREE.Group();
    this.solidParts = [];

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.45, 2.1),
      new THREE.MeshLambertMaterial({ color: 0xd7272a })
    );
    body.position.y = 0.45;
    this.group.add(body);
    this.solidParts.push(body);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.3, 1),
      new THREE.MeshLambertMaterial({ color: 0xf4f4f4 })
    );
    roof.position.set(0, 0.78, -0.1);
    this.group.add(roof);
    this.solidParts.push(roof);

    const wheelGeo = new THREE.BoxGeometry(0.22, 0.22, 0.42);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const wheelPositions = [
      [-0.58, 0.14, 0.7],
      [0.58, 0.14, 0.7],
      [-0.58, 0.14, -0.7],
      [0.58, 0.14, -0.7],
    ];

    wheelPositions.forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(x, y, z);
      this.group.add(wheel);
      this.solidParts.push(wheel);
    });

    const lightGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const frontLightMat = new THREE.MeshBasicMaterial({ color: 0xf5f6ff });
    const rearLightMat = new THREE.MeshBasicMaterial({ color: 0xff3a3a });
    const lightPositions = [
      { x: -0.34, y: 0.36, z: -1.02, mat: frontLightMat },
      { x: 0.34, y: 0.36, z: -1.02, mat: frontLightMat },
      { x: -0.34, y: 0.36, z: 1.02, mat: rearLightMat },
      { x: 0.34, y: 0.36, z: 1.02, mat: rearLightMat },
    ];
    for (const item of lightPositions) {
      const light = new THREE.Mesh(lightGeo, item.mat);
      light.position.set(item.x, item.y, item.z);
      this.group.add(light);
    }

    const leftHeadlight = new THREE.SpotLight(0xc7e3ff, 7.8, 36, Math.PI / 9, 0.28, 0.9);
    leftHeadlight.position.set(-0.34, 0.36, -1.01);
    leftHeadlight.target.position.set(-0.34, -0.2, -11.5);
    leftHeadlight.visible = false;
    this.group.add(leftHeadlight, leftHeadlight.target);

    const rightHeadlight = new THREE.SpotLight(0xc7e3ff, 7.8, 36, Math.PI / 9, 0.28, 0.9);
    rightHeadlight.position.set(0.34, 0.36, -1.01);
    rightHeadlight.target.position.set(0.34, -0.2, -11.5);
    rightHeadlight.visible = false;
    this.group.add(rightHeadlight, rightHeadlight.target);
    this.headlights = [leftHeadlight, rightHeadlight];

    const streakMat = new THREE.MeshBasicMaterial({
      color: 0x74bcff,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const leftStreak = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 9.6), streakMat.clone());
    leftStreak.rotation.x = -Math.PI / 2;
    leftStreak.position.set(-0.34, 0.03, -6.1);
    leftStreak.visible = false;

    const rightStreak = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 9.6), streakMat.clone());
    rightStreak.rotation.x = -Math.PI / 2;
    rightStreak.position.set(0.34, 0.03, -6.1);
    rightStreak.visible = false;
    this.group.add(leftStreak, rightStreak);
    this.headlightStreaks = [leftStreak, rightStreak];

    this.group.position.set(0, 0.05, 0);
    this.halfExtents = new THREE.Vector3(0.62, 0.4, 1.05);
  }

  setNightMode(enabled) {
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

  update(dt, inputAxis, tuning) {
    this.group.position.x += inputAxis * tuning.turnSpeed * tuning.control * dt;
    this.group.position.x = THREE.MathUtils.clamp(
      this.group.position.x,
      -tuning.roadLimit,
      tuning.roadLimit
    );

    const targetRoll = -inputAxis * 0.18 * tuning.control;
    this.group.rotation.z += (targetRoll - this.group.rotation.z) * Math.min(1, dt * 12);
  }
}
