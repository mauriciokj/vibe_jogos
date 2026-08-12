import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const outputDir = process.argv[3] || 'output/web-game/river-raid-crazygames-sdk';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.addInitScript(() => {
  const calls = [];
  let settingsListener = null;
  window.__crazyGamesTest = {
    calls,
    updateSettings(settings) {
      window.CrazyGames.SDK.game.settings = settings;
      settingsListener?.(settings);
    },
  };
  window.CrazyGames = {
    SDK: {
      environment: 'local',
      async init() {
        calls.push('init');
      },
      game: {
        settings: { muteAudio: true, disableChat: false },
        loadingStart() {
          calls.push('loadingStart');
        },
        loadingStop() {
          calls.push('loadingStop');
        },
        gameplayStart() {
          calls.push('gameplayStart');
        },
        gameplayStop() {
          calls.push('gameplayStop');
        },
        addSettingsChangeListener(listener) {
          settingsListener = listener;
          calls.push('settingsListener');
        },
        setGameContext(context) {
          calls.push(`context:${context.mode}:${context.round}`);
        },
        clearGameContext() {
          calls.push('context:clear');
        },
      },
    },
  };
});

const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('pageerror', (error) => errors.push(error.message));

await page.goto(`${baseUrl}?platform=crazygames`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__riverRaidGame && window.render_game_to_text);

let state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
assert.equal(state.version, '1.20.1');
assert.equal(state.platform.id, 'crazygames');
assert.equal(state.platform.locale, 'en');
assert.equal(state.platform.externalFullscreen, true);
assert.equal(state.audio.externalMuted, true);

await page.locator('#start-button').click();
await page.waitForTimeout(120);
await page.keyboard.press('KeyP');
await page.waitForTimeout(40);
await page.keyboard.press('KeyP');
await page.waitForTimeout(40);
await page.keyboard.press('KeyF');
await page.evaluate(() => window.__crazyGamesTest.updateSettings({ muteAudio: false }));
await page.waitForTimeout(40);

state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
const calls = await page.evaluate(() => window.__crazyGamesTest.calls.slice());
assert.equal(state.mode, 'PLAYING');
assert.equal(state.audio.externalMuted, false);
assert.equal(await page.evaluate(() => Boolean(document.fullscreenElement)), false);
assert.deepEqual(calls.slice(0, 4), ['init', 'loadingStart', 'settingsListener', 'loadingStop']);
assert.ok(calls.includes('gameplayStart'));
assert.ok(calls.includes('gameplayStop'));
assert.ok(calls.includes('context:classic:1'));
assert.deepEqual(errors, []);

await fs.mkdir(outputDir, { recursive: true });
await page.screenshot({ path: `${outputDir}/crazygames-basic-launch.png` });
await fs.writeFile(
  `${outputDir}/crazygames-sdk-state.json`,
  JSON.stringify({ state, calls, errors }, null, 2)
);

await browser.close();
console.log(JSON.stringify({ ok: true, calls, platform: state.platform, audio: state.audio }));
