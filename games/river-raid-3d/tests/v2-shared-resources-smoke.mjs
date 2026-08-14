import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4178/games/river-raid-3d/';
const outputDir = process.argv[3] || 'output/web-game/river-v2-shared-resources';
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('pageerror', (error) => errors.push(`page: ${String(error)}`));

await page.addInitScript(() => {
  localStorage.setItem('rio-de-aco-onboarding-completed', '1');
  localStorage.setItem('rio-de-aco-graphics-quality', 'high');
});
await page.goto(`${baseUrl}?locale=pt&resource-test=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => Boolean(window.__riverRaidGame));
await page.waitForTimeout(500);

const report = await page.evaluate(async () => {
  const game = window.__riverRaidGame;
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const snapshot = () => ({
    geometries: game.renderer.info.memory.geometries,
    textures: game.renderer.info.memory.textures,
    programs: game.renderer.info.programs?.length || 0,
    labelMaterials: game.labelMaterialCache.size,
    searchlightGeometries: game.searchlightGeometryCache.size,
  });
  const createBatch = () => {
    const entities = [];
    for (let index = 0; index < 6; index += 1) {
      const z = -45 - index * 18;
      entities.push(game.createShip(-4 + index, z));
      entities.push(game.createHelicopter(4 - index, z - 6));
      entities.push(game.createFuel((index % 3) - 1, z - 12));
    }
    entities.push(game.createBridge(-170));
    entities.push(game.createBridge(-215));
    return entities;
  };
  const removeBatch = (entities) => {
    for (const entity of entities) game.removeObject3D(entity.group);
  };

  game.clearEntities();
  game.render();
  await nextFrame();
  const baseline = snapshot();

  const firstBatch = createBatch();
  game.render();
  await nextFrame();
  const first = snapshot();
  removeBatch(firstBatch);
  game.render();
  await nextFrame();

  const secondBatch = createBatch();
  game.render();
  await nextFrame();
  const second = snapshot();
  removeBatch(secondBatch);
  game.render();

  return {
    baseline,
    first,
    second,
    firstGeometryDelta: first.geometries - baseline.geometries,
    secondGeometryDelta: second.geometries - first.geometries,
    secondTextureDelta: second.textures - first.textures,
  };
});

await page.screenshot({
  path: path.join(outputDir, 'shared-resources-final.png'),
  fullPage: false,
});
await browser.close();

const result = { report, errors };
fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

if (errors.length) process.exitCode = 1;
if (report.firstGeometryDelta > 1) {
  console.error(`Recursos comuns criaram ${report.firstGeometryDelta} geometrias extras.`);
  process.exitCode = 1;
}
if (report.secondGeometryDelta !== 0 || report.secondTextureDelta !== 0) {
  console.error('A segunda onda recriou geometrias ou texturas já aquecidas.');
  process.exitCode = 1;
}
