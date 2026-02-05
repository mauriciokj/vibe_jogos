import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class Road {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.roadHalfWidth = 9;
    this.segmentLength = 12;
    this.segmentCount = 34;

    this.road = new THREE.Mesh(
      new THREE.PlaneGeometry(this.roadHalfWidth * 2, 500),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2f })
    );
    this.road.rotation.x = -Math.PI / 2;
    this.road.position.set(0, 0, -120);
    this.group.add(this.road);

    this.shoulderLeft = this.createShoulder(-this.roadHalfWidth - 1.6);
    this.shoulderRight = this.createShoulder(this.roadHalfWidth + 1.6);
    this.group.add(this.shoulderLeft, this.shoulderRight);

    this.segments = [];
    const segmentGeo = new THREE.PlaneGeometry(0.24, 4);
    const segmentMat = new THREE.MeshBasicMaterial({ color: 0xfff7b3 });

    for (let i = 0; i < this.segmentCount; i += 1) {
      const dash = new THREE.Mesh(segmentGeo, segmentMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.02, i * -this.segmentLength);
      this.group.add(dash);
      this.segments.push(dash);
    }

    this.totalSpan = this.segmentCount * this.segmentLength;
    this.nightMode = false;
    this.baseRoadColor = 0x2a2a2f;
  }

  createShoulder(x) {
    const shoulder = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.08, 500),
      new THREE.MeshLambertMaterial({ color: 0x5a4637 })
    );
    shoulder.position.set(x, -0.03, -120);
    return shoulder;
  }

  update(dt, speed) {
    for (let i = 0; i < this.segments.length; i += 1) {
      const dash = this.segments[i];
      dash.position.z += speed * dt;
      if (dash.position.z > 24) {
        dash.position.z -= this.totalSpan;
      }
    }
  }

  setPalette(cfg) {
    this.baseRoadColor = cfg.roadColor;
    this.road.material.color.setHex(cfg.roadColor);
    this.shoulderLeft.material.color.setHex(cfg.shoulderColor);
    this.shoulderRight.material.color.setHex(cfg.shoulderColor);
    this.setNightMode(this.nightMode);
  }

  setNightMode(enabled) {
    this.nightMode = enabled;
    this.road.visible = true;
    this.road.material.color.setHex(enabled ? 0x0b1528 : this.baseRoadColor);
    this.shoulderLeft.visible = !enabled;
    this.shoulderRight.visible = !enabled;
    for (const dash of this.segments) {
      dash.visible = !enabled;
    }
  }
}
