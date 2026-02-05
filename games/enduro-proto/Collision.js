export function checkAABBCollision(posA, extA, posB, extB) {
  return (
    Math.abs(posA.x - posB.x) <= extA.x + extB.x &&
    Math.abs(posA.y - posB.y) <= extA.y + extB.y &&
    Math.abs(posA.z - posB.z) <= extA.z + extB.z
  );
}
