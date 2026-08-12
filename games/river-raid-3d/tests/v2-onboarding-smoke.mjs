import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4178/games/river-raid-3d/';
const outputRoot = resolve(process.argv[3] || 'output/web-game/river-v2-onboarding');
await mkdir(outputRoot, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});

const readState = async (page) => JSON.parse(await page.evaluate(() => window.render_game_to_text()));
const advance = async (page, ms) => page.evaluate((duration) => window.advanceTime(duration), ms);

async function holdKey(page, key, ms) {
  await page.keyboard.down(key);
  await advance(page, ms);
  await page.keyboard.up(key);
}

async function touchButton(page, selector, pointerId, ms) {
  const button = page.locator(selector);
  await button.dispatchEvent('pointerdown', { pointerId, pointerType: 'touch', isPrimary: true });
  await advance(page, ms);
  await button.dispatchEvent('pointerup', { pointerId, pointerType: 'touch', isPrimary: true });
}

async function openFreshPage(context, suffix = '?locale=pt&tutorial=1') {
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`${baseUrl}${suffix}`, { waitUntil: 'networkidle' });
  return { page, errors };
}

const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const mobileContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  hasTouch: true,
  isMobile: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
});

const report = { desktop: {}, mobile: {} };

try {
  const desktop = await openFreshPage(desktopContext);
  const { page } = desktop;
  await page.screenshot({ path: resolve(outputRoot, 'desktop-menu.png') });
  assert.equal(await page.locator('body').evaluate((body) => body.classList.contains('menu-open')), true);
  assert.equal(await page.locator('#menu-extras').evaluate((details) => details.open), false);
  assert.equal(await page.locator('#hud').evaluate((hud) => getComputedStyle(hud).visibility), 'hidden');
  assert.equal(await page.locator('#leaderboard-panel').isVisible(), false);

  await page.locator('#start-button').click();
  await page.waitForTimeout(480);
  let state = await readState(page);
  assert.equal(state.onboarding.active, true);
  assert.equal(state.onboarding.step, 'move');
  assert.equal(state.mobileControls.visible, false);
  await page.screenshot({ path: resolve(outputRoot, 'desktop-step-1-move.png') });

  await page.evaluate(() => {
    const game = window.__riverRaidGame;
    const river = game.getRiverAtZ(game.player.position.z);
    game.player.position.x = river.center + river.halfWidth + 8;
  });
  await advance(page, 20);
  state = await readState(page);
  assert.equal(state.mode, 'PLAYING');
  assert.equal(state.lives, 3);

  await holdKey(page, 'ArrowLeft', 260);
  state = await readState(page);
  assert.equal(state.onboarding.step, 'speed');
  await page.screenshot({ path: resolve(outputRoot, 'desktop-step-2-speed.png') });

  await holdKey(page, 'ArrowUp', 260);
  state = await readState(page);
  assert.equal(state.onboarding.step, 'shoot');
  assert.ok(state.targetSpeed <= 40);

  await holdKey(page, 'Space', 34);
  state = await readState(page);
  assert.equal(state.onboarding.step, 'fuel');
  assert.equal(await page.locator('#help-chip').isVisible(), false);
  assert.equal(await page.locator('#barrel-roll').isVisible(), false);
  await page.evaluate(() => {
    const game = window.__riverRaidGame;
    const fuel = game.entities.find((entity) => entity.tutorialFuel);
    fuel.group.position.x = game.player.position.x;
    fuel.group.position.z = -82;
  });
  await advance(page, 20);
  await page.screenshot({ path: resolve(outputRoot, 'desktop-step-4-fuel.png') });

  await page.evaluate(() => {
    const game = window.__riverRaidGame;
    const fuel = game.entities.find((entity) => entity.tutorialFuel);
    fuel.group.position.x = game.player.position.x;
    fuel.group.position.z = -55;
  });
  await holdKey(page, 'Space', 700);
  state = await readState(page);
  const protectedFuel = state.visibleEntities.find((entity) => entity.tutorialFuel);
  assert.ok(protectedFuel);
  assert.equal(protectedFuel.health, 1);
  assert.equal(state.score, 0);
  assert.equal(state.onboarding.step, 'fuel');

  await page.evaluate(() => {
    const game = window.__riverRaidGame;
    const fuel = game.entities.find((entity) => entity.tutorialFuel);
    fuel.group.position.x = game.player.position.x;
    fuel.group.position.z = game.player.position.z;
  });
  await advance(page, 20);
  state = await readState(page);
  assert.equal(state.onboarding.step, 'bridge');
  assert.equal(state.visibleEntities.some((entity) => entity.tutorialFuel), false);
  await page.screenshot({ path: resolve(outputRoot, 'desktop-step-5-bridge.png') });

  await page.evaluate(() => {
    const game = window.__riverRaidGame;
    const bridge = game.entities.find((entity) => entity.tutorialBridge);
    bridge.group.position.z = -34;
    bridge.health = 1;
  });
  await holdKey(page, 'Space', 700);
  state = await readState(page);
  assert.equal(state.onboarding.active, false);
  assert.equal(state.onboarding.completed, true);
  assert.equal(state.environment.key, 'sunset');
  assert.equal(await page.locator('#help-chip').isVisible(), true);
  await page.screenshot({ path: resolve(outputRoot, 'desktop-complete.png') });

  const cameraBefore = state.camera;
  await page.keyboard.press('KeyC');
  state = await readState(page);
  assert.notEqual(state.camera, cameraBefore);
  report.desktop = { finalState: state, errors: desktop.errors };
  assert.deepEqual(desktop.errors, []);
  await page.close();

  const persisted = await openFreshPage(desktopContext, '?locale=pt');
  await persisted.page.locator('#start-button').click();
  const persistedState = await readState(persisted.page);
  assert.equal(persistedState.onboarding.active, false);
  assert.equal(persistedState.onboarding.completed, true);
  assert.deepEqual(persisted.errors, []);
  await persisted.page.close();

  const skipped = await openFreshPage(desktopContext);
  await skipped.page.locator('#start-button').click();
  await skipped.page.waitForTimeout(480);
  await skipped.page.locator('#onboarding-skip').click();
  let skippedState = await readState(skipped.page);
  assert.equal(skippedState.onboarding.active, false);
  assert.equal(skippedState.onboarding.completed, true);
  assert.equal(await skipped.page.locator('#onboarding-guide').isVisible(), false);
  assert.equal(await skipped.page.locator('#help-chip').isVisible(), true);
  await skipped.page.evaluate(() => window.__riverRaidGame.gameOver());
  await skipped.page.waitForTimeout(500);
  skippedState = await readState(skipped.page);
  assert.equal(skippedState.mode, 'GAMEOVER');
  assert.equal(await skipped.page.locator('body').evaluate((body) => body.classList.contains('menu-open')), true);
  assert.equal(await skipped.page.locator('#menu-extras').evaluate((details) => details.open), true);
  assert.equal(await skipped.page.locator('#hud').evaluate((hud) => getComputedStyle(hud).visibility), 'hidden');
  assert.deepEqual(skipped.errors, []);
  await skipped.page.close();

  const english = await openFreshPage(desktopContext, '?locale=en&tutorial=1');
  await english.page.locator('#start-button').click();
  await english.page.waitForTimeout(480);
  assert.equal((await english.page.locator('#onboarding-title').textContent()).trim(), 'MOVE THE PLANE');
  assert.equal((await english.page.locator('#onboarding-detail').textContent()).trim(), 'USE ← → OR A D');
  assert.deepEqual(english.errors, []);
  await english.page.close();

  const mobile = await openFreshPage(mobileContext);
  await mobile.page.screenshot({ path: resolve(outputRoot, 'mobile-menu.png') });
  assert.equal(await mobile.page.locator('#hud').evaluate((hud) => getComputedStyle(hud).visibility), 'hidden');
  await mobile.page.locator('#start-button').click();
  await mobile.page.waitForTimeout(480);
  let mobileState = await readState(mobile.page);
  assert.equal(mobileState.onboarding.step, 'move');
  assert.equal(mobileState.mobileControls.visible, true);
  assert.equal(await mobile.page.locator('#touch-camera').isVisible(), false);
  assert.equal(await mobile.page.locator('#touch-barrel-roll').isVisible(), false);
  await mobile.page.screenshot({ path: resolve(outputRoot, 'mobile-step-1-move.png') });

  await touchButton(mobile.page, '#touch-left', 11, 260);
  mobileState = await readState(mobile.page);
  assert.equal(mobileState.onboarding.step, 'speed');
  await touchButton(mobile.page, '#touch-speed-up', 12, 260);
  mobileState = await readState(mobile.page);
  assert.equal(mobileState.onboarding.step, 'shoot');
  await touchButton(mobile.page, '#touch-fire', 13, 40);
  mobileState = await readState(mobile.page);
  assert.equal(mobileState.onboarding.step, 'fuel');
  await mobile.page.screenshot({ path: resolve(outputRoot, 'mobile-step-4-fuel.png') });

  report.mobile = { state: mobileState, errors: mobile.errors };
  assert.deepEqual(mobile.errors, []);
  await mobile.page.close();

  await writeFile(resolve(outputRoot, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    desktop: {
      onboarding: report.desktop.finalState.onboarding,
      camera: report.desktop.finalState.camera,
      errors: report.desktop.errors,
    },
    mobile: {
      onboarding: report.mobile.state.onboarding,
      controls: report.mobile.state.mobileControls,
      errors: report.mobile.errors,
    },
  }, null, 2));
} finally {
  await desktopContext.close();
  await mobileContext.close();
  await browser.close();
}
