import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; const external = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
page.on('request', r => { if (/^https?:/.test(r.url()) && !r.url().startsWith('http://127.0.0.1:4317/')) external.push(r.url()); });
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const shot = name => page.screenshot({ path: `output/browser/${name}.png` });
const advance = ms => page.evaluate(ms => window.advanceTime(ms), ms);
try {
  await page.goto('http://127.0.0.1:4317/?test');
  // Isolated fixture to exercise paid features without grinding credits in UI tests.
  await page.evaluate(() => { const save = JSON.parse(window.__game.save()); save.cash = 1000000; save.unlocked = 2; save.races = 1; localStorage.setItem('asfalto-bruto:v1', JSON.stringify(save)); }); await page.reload();
  await page.locator('#garage-btn').focus(); await page.keyboard.press('Enter'); assert.equal((await state()).modal, 'garage-modal');
  await page.click('[data-bike="veneno"]'); let save = await page.evaluate(() => JSON.parse(window.__game.save())); assert.equal(save.bikeId, 'veneno'); assert.equal(save.cash, 15200);
  await page.click('[data-bike="brutal"]'); save = await page.evaluate(() => JSON.parse(window.__game.save())); assert.equal(save.bikeId, 'brutal'); assert.equal(save.cash, 10400);
  for (const key of ['engine', 'armor', 'handling']) { for (let i = 0; i < 3; i++) await page.click(`[data-upgrade="${key}"]`); assert.ok(await page.locator(`[data-upgrade="${key}"]`).isDisabled()); }
  await page.click('[data-bike="veneno"]'); save = await page.evaluate(() => JSON.parse(window.__game.save())); assert.equal(save.bikeId, 'veneno'); assert.equal(save.owned.length, 3); await shot('19-owned-garage');
  await page.click('[data-close="garage-modal"]');
  for (const [track, z] of [['serra', 1900], ['deserto', 2400], ['costa', 1300]]) {
    await page.click(`[data-track="${track}"]`); await page.click('#start-btn');
    await page.evaluate(({ z }) => {
      const s = JSON.parse(window.__game.snapshot()); const p = s.riders[0];
      s.mode = 'racing'; s.time = 42; s.countdown = 0; p.z = z; p.speed = 52;
      s.riders.slice(1).forEach((r, i) => { r.z = z + 8 + 12 * i; r.x = i % 2 ? -2.5 : 4.8; r.speed = 50; });
      s.traffic = [{ id: 'view-car', x: -5.25, z: z + 90, speed: -25, color: '#ed9273', kind: 'car' }, { id: 'view-van', x: 5.25, z: z + 180, speed: 22, color: '#a4bfb5', kind: 'van' }];
      window.__game.restore(JSON.stringify(s));
    }, { z });
    await shot(`20-track-${track}`);
    await page.keyboard.press('Escape'); await page.click('#menu-btn');
  }
  await page.click('#garage-btn'); await page.click('#reset-btn'); await page.click('#confirm-reset');
  save = await page.evaluate(() => JSON.parse(window.__game.save())); assert.equal(save.cash, 650); assert.deepEqual(save.owned, ['ferro']); assert.equal(save.unlocked, 0);
  await page.reload(); assert.equal((await state()).save.cash, 650); assert.equal(await page.locator('.route:disabled').count(), 2);
  // Real animation frames measure the current rendering cadence, independent of simulation stepping.
  const perf = await page.evaluate(async () => {
    const times = []; let before = 0;
    await new Promise(resolve => { function tick(now) { if (before) times.push(now - before); before = now; if (times.length >= 180) resolve(); else requestAnimationFrame(tick); } requestAnimationFrame(tick); });
    times.sort((a, b) => a - b); const mean = times.reduce((a, b) => a + b, 0) / times.length;
    return { width: innerWidth, height: innerHeight, frames: times.length, averageFPS: +(1000 / mean).toFixed(1), p95FrameMs: +times[Math.floor(times.length * .95)].toFixed(1), maxFrameMs: +times.at(-1).toFixed(1) };
  });
  await fs.writeFile('output/browser/performance.json', JSON.stringify(perf, null, 2));
  assert.deepEqual(external, []); assert.deepEqual(errors, []);
  console.log('✓ Keyboard menu navigation, all bike purchases/equip, max upgrades, 3 track visuals, reset and offline assets');
  console.log(JSON.stringify(perf));
} finally { await browser.close(); }
