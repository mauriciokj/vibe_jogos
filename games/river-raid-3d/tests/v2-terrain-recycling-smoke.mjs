import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4178/games/river-raid-3d/';
const outputDir = process.argv[3] || 'output/web-game/river-v2-terrain-recycling';
const expectPooling = process.argv[4] !== 'baseline';
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
await page.goto(`${baseUrl}?locale=pt&terrain-test=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => Boolean(window.__riverRaidGame));
await page.click('#start-button');
await page.waitForTimeout(350);

const report = await page.evaluate(() => {
  const game = window.__riverRaidGame;
  const percentile = (values, fraction) => {
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] || 0;
  };
  const profileBiome = (biome, startIndex) => {
    const biomeCycles = { valley: 0, desert: 2, jungle: 3 };
    game.environmentCyclesCompleted = biomeCycles[biome];
    game.currentBiomeKey = biome;
    game.terrainRefreshQueue.length = 0;
    const segment = game.terrain[0];
    game.rebuildTerrainSegment(segment, startIndex);
    const firstIds = new Set(segment.decorations.children.map((child) => child.uuid));
    game.rebuildTerrainSegment(segment, startIndex + 1);
    const secondIds = new Set(segment.decorations.children.map((child) => child.uuid));
    const reusedTopLevelObjects = [...secondIds].filter((id) => firstIds.has(id)).length;
    const timings = [];
    for (let round = 0; round < 40; round += 1) {
      for (let index = 0; index < game.terrain.length; index += 1) {
        const startedAt = performance.now();
        game.rebuildTerrainSegment(game.terrain[index], startIndex + round * game.terrain.length + index);
        timings.push(performance.now() - startedAt);
      }
    }
    return {
      rebuilds: timings.length,
      p50Ms: Number(percentile(timings, 0.5).toFixed(3)),
      p95Ms: Number(percentile(timings, 0.95).toFixed(3)),
      maxMs: Number(Math.max(...timings).toFixed(3)),
      totalMs: Number(timings.reduce((sum, value) => sum + value, 0).toFixed(3)),
      firstDecorationCount: firstIds.size,
      secondDecorationCount: secondIds.size,
      reusedTopLevelObjects,
    };
  };

  game.clearEntities();
  const before = {
    geometries: game.renderer.info.memory.geometries,
    textures: game.renderer.info.memory.textures,
  };
  const biomes = {
    valley: profileBiome('valley', 1000),
    desert: profileBiome('desert', 2000),
    jungle: profileBiome('jungle', 3000),
  };
  game.environmentCyclesCompleted = 0;
  game.currentBiomeKey = 'valley';
  game.resetTerrainRun();
  game.render();
  const after = {
    geometries: game.renderer.info.memory.geometries,
    textures: game.renderer.info.memory.textures,
  };
  return { before, after, biomes };
});

for (const biome of ['valley', 'desert', 'jungle']) {
  await page.evaluate((nextBiome) => {
    const game = window.__riverRaidGame;
    game.environmentCyclesCompleted = { valley: 0, desert: 2, jungle: 3 }[nextBiome];
    game.currentBiomeKey = nextBiome;
    game.setEnvironmentPhase(0, true);
    game.resetTerrainRun();
    game.render();
  }, biome);
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(outputDir, `terrain-${biome}.png`) });
}
await page.evaluate(() => {
  const game = window.__riverRaidGame;
  game.environmentCyclesCompleted = 0;
  game.currentBiomeKey = 'valley';
  game.setEnvironmentPhase(0, true);
  game.resetTerrainRun();
  game.render();
});
await page.waitForTimeout(120);
const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
await page.screenshot({ path: path.join(outputDir, 'terrain-after-recycling.png') });
await browser.close();

const result = { report, state, errors };
fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
if (
  report.after.geometries !== report.before.geometries ||
  report.after.textures !== report.before.textures
) {
  console.error('A reciclagem do terreno aumentou geometrias ou texturas do renderizador.');
  process.exitCode = 1;
}
for (const [biome, profile] of Object.entries(report.biomes)) {
  if (expectPooling && profile.reusedTopLevelObjects <= 0) {
    console.error(`${biome} não reutilizou objetos visuais entre segmentos.`);
    process.exitCode = 1;
  }
}
