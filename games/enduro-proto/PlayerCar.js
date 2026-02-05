import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class PlayerCar {
  constructor() {
    this.group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.45, 2.1),
      new THREE.MeshLambertMaterial({ color: 0xd7272a })
    );
    body.position.y = 0.45;
    this.group.add(body);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.3, 1),
      new THREE.MeshLambertMaterial({ color: 0xf4f4f4 })
    );
    roof.position.set(0, 0.78, -0.1);
    this.group.add(roof);

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
    });

    this.group.position.set(0, 0.05, 0);
    this.halfExtents = new THREE.Vector3(0.62, 0.4, 1.05);
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
