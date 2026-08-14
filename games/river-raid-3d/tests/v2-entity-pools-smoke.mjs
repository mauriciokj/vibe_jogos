import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4178/games/river-raid-3d/';
const outputDir = process.argv[3] || 'output/web-game/river-v2-entity-pools';
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
  localStorage.setItem('rio-de-aco-first-flight-complete', '1');
  localStorage.setItem('rio-de-aco-graphics-quality', 'high');
});
await page.goto(`${baseUrl}?locale=pt&pool-test=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => Boolean(window.__riverRaidGame));
await page.click('#start-button');
await page.waitForTimeout(350);

const report = await page.evaluate(() => {
  const game = window.__riverRaidGame;
  const snapshotStats = () => JSON.parse(JSON.stringify(game.entityPoolStats));
  const createWave = () => {
    const startedAt = performance.now();
    const entities = [];
    for (let index = 0; index < 6; index += 1) {
      entities.push(game.createShip(-6 + index * 2, -50 - index * 14));
      entities.push(game.createHelicopter(6 - index * 2, -58 - index * 14));
      entities.push(game.createFuel((index % 3) * 3 - 3, -66 - index * 14));
    }
    return { entities, durationMs: performance.now() - startedAt };
  };
  const releaseWave = (wave) => {
    for (const entity of wave.entities) game.releaseEntity(entity);
  };
  const idsByType = (wave) => Object.fromEntries(
    ['navio', 'helicóptero', 'fuel'].map((type) => [
      type,
      wave.entities
        .filter((entity) => entity.type === type)
        .map((entity) => entity.group.uuid)
        .sort(),
    ])
  );

  game.clearEntities();
  const before = snapshotStats();
  const first = createWave();
  const firstIds = idsByType(first);
  const afterFirst = snapshotStats();
  releaseWave(first);
  const availableAfterRelease = Object.fromEntries(
    Object.entries(game.entityPools).map(([type, pool]) => [type, pool.length])
  );

  const second = createWave();
  const secondIds = idsByType(second);
  const afterSecond = snapshotStats();
  const sameGroups = Object.fromEntries(
    Object.keys(firstIds).map((type) => [
      type,
      JSON.stringify(firstIds[type]) === JSON.stringify(secondIds[type]),
    ])
  );
  releaseWave(second);

  const visible = [
    game.createShip(-5, -34),
    game.createHelicopter(5, -52),
    game.createFuel(0, -70),
  ];
  game.entities.push(...visible);
  game.render();

  return {
    before,
    afterFirst,
    afterSecond,
    availableAfterRelease,
    sameGroups,
    firstWaveMs: Number(first.durationMs.toFixed(3)),
    reusedWaveMs: Number(second.durationMs.toFixed(3)),
    finalPools: Object.fromEntries(
      Object.entries(game.entityPools).map(([type, pool]) => [type, pool.length])
    ),
  };
});

await page.waitForTimeout(250);
const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
await page.screenshot({ path: path.join(outputDir, 'pooled-entities.png') });
await browser.close();

const result = { report, state, errors };
fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

if (errors.length) process.exitCode = 1;
if (!Object.values(report.sameGroups).every(Boolean)) {
  console.error('A segunda onda não reutilizou os mesmos grupos 3D.');
  process.exitCode = 1;
}
for (const type of ['navio', 'helicóptero', 'fuel']) {
  if (report.afterSecond.created[type] !== report.afterFirst.created[type]) {
    console.error(`${type} criou grupos extras na segunda onda.`);
    process.exitCode = 1;
  }
}
