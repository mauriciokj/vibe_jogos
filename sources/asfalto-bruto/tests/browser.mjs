import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.env.GAME_URL || 'http://127.0.0.1:4317';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
await fs.mkdir('output/browser', { recursive: true });
const state = async () => JSON.parse(await page.evaluate(() => window.render_game_to_text()));
const shot = name => page.screenshot({ path: `output/browser/${name}.png` });
const advance = ms => page.evaluate(ms => window.advanceTime(ms), ms);
async function press(code, ms) { await page.keyboard.down(code); await advance(ms); await page.keyboard.up(code); }
async function patchState(fn) { const s = JSON.parse(await page.evaluate(() => window.__game.snapshot())); fn(s); await page.evaluate(s => window.__game.restore(JSON.stringify(s)), s); return s; }
async function check(name, fn) { await fn(); console.log(`✓ ${name}`); }
try {
  await page.goto(`${base}/?test`); await page.evaluate(() => document.fonts.ready); await shot('01-menu');
  await check('menu, disabled tracks, tutorial, countdown and keyboard acceleration', async () => {
    assert.equal(await page.title(), 'Asfalto Bruto — Corrida sem regras'); assert.equal(await page.locator('.route:disabled').count(), 2);
    await page.click('#start-btn'); assert.equal((await state()).modal, 'help-modal'); await shot('02-controls');
    await page.click('#help-go'); assert.equal((await state()).mode, 'countdown'); await shot('03-countdown');
    await press('ArrowUp', 9500); assert.equal((await state()).mode, 'racing'); assert.ok((await state()).player.speed > 35); await shot('04-driving');
  });
  await check('WASD/arrows, brake and pause freeze/resume/restart', async () => {
    const x = (await state()).player.x; await page.keyboard.down('w'); await press('ArrowLeft', 220); assert.ok((await state()).player.x < x - .5);
    await press('d', 200); const speed = (await state()).player.speed; await page.keyboard.up('w'); await press('s', 500); assert.ok((await state()).player.speed < speed - 9);
    await page.keyboard.press('Escape'); assert.equal((await state()).paused, true); const pausedTime = (await state()).time; await advance(2500); assert.equal((await state()).time, pausedTime); await shot('05-pause');
    await page.click('#resume-btn'); assert.equal((await state()).paused, false); await page.keyboard.press('Escape'); await page.click('#restart-btn'); assert.equal((await state()).mode, 'countdown'); assert.equal((await state()).player.z, 0);
  });
  await check('punch, stolen weapon, kick displacement, weapon damage and visual attack frames', async () => {
    await patchState(s => { s.mode = 'racing'; s.countdown = 0; s.traffic = []; s.obstacles = []; s.riders = s.riders.slice(0, 2); const [p, rival] = s.riders; Object.assign(p, { z: 300, x: 1, speed: 0, weapon: false, cooldown: 0 }); Object.assign(rival, { z: 300, x: 2.8, speed: 0, weapon: true, targetX: 2.8, decisionAt: 999, cooldown: 100, profile: 'careful' }); });
    await press('j', 200); assert.ok((await state()).player.weapon); assert.equal((await state()).player.hits, 1); assert.ok(!(await state()).riders[0].weapon); await shot('06-punch-and-steal');
    await patchState(s => { const [p, rival] = s.riders; p.attack = null; p.cooldown = 0; rival.x = p.x + 1.7; rival.z = p.z; rival.speed = 0; rival.targetX = rival.x; });
    const oldX = (await state()).riders[0].x; await press('k', 320); assert.ok((await state()).riders[0].x > oldX + .6); await shot('07-kick');
    await patchState(s => { const [p, rival] = s.riders; p.attack = null; p.cooldown = 0; rival.x = p.x + 2.4; rival.z = p.z; rival.speed = 0; rival.targetX = rival.x; });
    const health = (await state()).riders[0].health; await press('l', 260); assert.ok((await state()).riders[0].health < health - 20); await shot('08-weapon');
  });
  await check('traffic crash, visual fall and recovery', async () => {
    await patchState(s => { const p = s.riders[0]; Object.assign(p, { z: 600, x: -3.8, speed: 54, attack: null, immune: 0, integrity: 100 }); s.traffic = [{ id: 'qa-car', x: -3.8, z: 604, speed: -20, kind: 'car', color: '#ddd' }]; s.riders = [p]; });
    await advance(100); assert.ok((await state()).player.crash > 0); await shot('09-crash'); await press('w', 3400); assert.equal((await state()).player.crash, 0); assert.ok((await state()).player.speed > 12); await shot('10-recovery');
  });
  await check('police pursuit, capture and replay after defeat', async () => {
    await patchState(s => { const p = s.riders[0]; Object.assign(p, { z: 1700, x: 1, speed: 0, immune: 0, crash: 0 }); s.traffic = []; s.heat = 70; s.time = 40; });
    await advance(50); assert.ok((await state()).police); await patchState(s => { const p = s.riders[0], cop = s.riders.find(r => r.id === 'police'); Object.assign(cop, { x: 2.8, z: p.z + 2, speed: 0, cooldown: 99, crash: 0 }); s.capture = 2.95; });
    await advance(100); assert.equal((await state()).result.reason, 'caught'); await shot('11-caught'); await page.click('#again-btn'); assert.equal((await state()).mode, 'countdown');
  });
  await check('fall next to police immediately loses, explains arrest and cannot recover', async () => {
    await patchState(s => {
      s.mode = 'racing'; s.countdown = 0; s.time = 30; s.capture = 0; s.policeActive = true; s.obstacles = [];
      s.riders = s.riders.slice(0,2); const [p,cop] = s.riders;
      Object.assign(p,{x:1.7,z:1800,speed:64,health:100,integrity:100,immune:0,crash:0});
      Object.assign(cop,{id:'police',name:'POLÍCIA',profile:'police',x:-1.7,z:1775,speed:0,cooldown:100});
      s.traffic = [{id:'arrest-traffic',x:1.7,z:1803,speed:-20,kind:'car',color:'#b6c8bb'}];
    });
    await advance(1000/60); const caught = await state();
    assert.equal(caught.result?.reason,'caught'); assert.equal(caught.result?.arrestCause,'fall'); assert.ok(caught.player.crash>0);
    assert.ok(await page.locator('.result-sub').innerText().then(t=>t.includes('Você caiu perto da polícia')));
    assert.equal(await page.locator('#crash').isVisible(),false); await shot('11b-fall-arrest');
    const cash=caught.save.cash; await advance(4000); assert.equal((await state()).save.cash,cash); assert.equal((await state()).mode,'finished');
    await page.click('#again-btn'); assert.equal((await state()).player.crash,0); assert.equal((await state()).mode,'countdown');
  });
  await check('complete race in browser, without invulnerability or position skips', async () => {
    await page.evaluate(() => window.__game.start());
    const summary = await page.evaluate(async () => {
      const {safeDrivingCommand} = await import('/tests/driving.ts');
      let frames = 0;
      while (JSON.parse(window.render_game_to_text()).mode !== 'finished' && frames < 60 * 300) {
        const s = JSON.parse(window.__game.snapshot());
        window.__game.command(safeDrivingCommand(s), 6); frames += 6;
      }
      return JSON.parse(window.render_game_to_text());
    });
    assert.equal(summary.result?.reason, 'finish', JSON.stringify(summary)); assert.ok(summary.result.time > 130);
    await shot('12-full-race-result'); await fs.writeFile('output/browser/full-race.json', JSON.stringify(summary, null, 2)); console.log(`  Full race: ${summary.result.time.toFixed(1)}s, position ${summary.result.place}, ${summary.result.falls} falls, ${summary.result.hits} hits`);
  });
  await check('top-five unlocks route, rewards paid once and progress persists', async () => {
    await page.click('#again-btn'); await patchState(s => { s.mode = 'racing'; s.countdown = 0; s.time = 166; s.traffic = []; s.obstacles = []; s.riders.forEach((r, i) => { r.z = 8399 - i * 20; r.x = i % 2 ? -3.8 : 1.2; r.speed = 50; }); });
    const cash = (await state()).save.cash; await advance(50); assert.equal((await state()).result.place, 1); const rewarded = (await state()).save.cash; assert.ok(rewarded > cash);
    await advance(5000); assert.equal((await state()).save.cash, rewarded); assert.equal((await state()).save.unlocked, 1); await shot('13-victory');
    await page.click('#result-menu-btn'); assert.equal(await page.locator('.route:disabled').count(), 1); await page.reload(); assert.equal((await state()).save.cash, rewarded); assert.equal((await state()).save.unlocked, 1);
  });
  await check('garage repairs, upgrades, reset cancellation and second track', async () => {
    await page.click('#garage-btn'); await shot('14-garage'); const engine = page.locator('[data-upgrade="engine"]'); assert.equal(await engine.isDisabled(), false); await engine.click();
    let saved = JSON.parse(await page.evaluate(() => window.__game.save())); assert.equal(saved.upgrades.ferro.engine, 1);
    if (!await page.locator('#repair-btn').isDisabled()) await page.click('#repair-btn'); saved = JSON.parse(await page.evaluate(() => window.__game.save())); assert.equal(saved.condition.ferro, 100);
    await page.click('#reset-btn'); await page.click('[data-close="reset-modal"]'); assert.equal((await state()).modal, 'garage-modal');
    await page.click('[data-close="garage-modal"]'); await page.click('[data-track="serra"]'); await page.click('#start-btn'); assert.equal((await state()).track, 'serra'); await advance(3600); await shot('15-mountain'); await page.keyboard.press('Escape'); await page.click('#menu-btn');
  });
  await check('mute, fullscreen and reload persistence', async () => {
    const before = JSON.parse(await page.evaluate(() => window.__game.save())).muted; await page.keyboard.press('m'); const muted = JSON.parse(await page.evaluate(() => window.__game.save())).muted; assert.equal(muted, !before);
    await page.reload(); assert.equal(JSON.parse(await page.evaluate(() => window.__game.save())).muted, muted);
    await page.keyboard.press('f'); await page.waitForTimeout(100); assert.ok(await page.evaluate(() => !!document.fullscreenElement)); await page.keyboard.press('f'); await page.waitForTimeout(100); assert.ok(await page.evaluate(() => !document.fullscreenElement));
  });
  await check('mobile menu, dialogs and touch acceleration', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => window.dispatchEvent(new Event('resize'))); await shot('16-mobile-menu');
    assert.ok(await page.locator('#start-btn').isVisible()); await page.click('#garage-btn'); await shot('17-mobile-garage'); await page.click('[data-close="garage-modal"]');
    await page.click('#start-btn'); await advance(3700); const button = page.locator('[data-touch="KeyW"]');
    const box = await button.boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await advance(3500); await page.mouse.up();
    assert.ok((await state()).player.speed > 20); await shot('18-mobile-driving');
  });
  assert.deepEqual(errors, [], 'Browser errors'); await fs.writeFile('output/browser/errors.json', JSON.stringify(errors)); console.log('All browser checks passed; no console or runtime errors.');
} finally { await browser.close(); }
