import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4178/games/river-raid-3d/?locale=pt';
const outputRoot = resolve(process.argv[3] || 'output/web-game/river-v2-audit');
const durationSeconds = 180;
const captureSeconds = new Set([0, 30, 90, 180]);

const percentile = (values, amount) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * amount))] || 0;
};

async function runScenario(browser, scenario) {
  const outputDir = resolve(outputRoot, scenario.name);
  await mkdir(outputDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: scenario.width, height: scenario.height },
    deviceScaleFactor: 1,
    hasTouch: scenario.mobile,
    isMobile: scenario.mobile,
    userAgent: scenario.mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
      : undefined,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.screenshot({ path: resolve(outputDir, '00-menu.png') });

  const menuSnapshot = await page.evaluate(() => {
    const visibleText = [...document.querySelectorAll('button, [role="button"], #start-screen *')]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      })
      .map((element) => element.textContent?.trim())
      .filter(Boolean);
    return {
      visibleTextCount: visibleText.length,
      visibleText: [...new Set(visibleText)].slice(0, 40),
    };
  });

  await page.locator('#start-button').click();
  await page.evaluate(() => {
    const game = window.__riverRaidGame;
    window.__v2AuditCrashes = [];
    game.crash = (reason) => {
      const lastCrash = window.__v2AuditCrashes.at(-1);
      if (!lastCrash || lastCrash.reason !== reason || game.distance - lastCrash.distance > 20) {
        window.__v2AuditCrashes.push({
          reason,
          distance: Number(game.distance.toFixed(1)),
          speed: Number(game.getSpeed().toFixed(1)),
        });
      }
      if (reason === 'SEM COMBUSTÍVEL') game.fuel = 100;
      const river = game.getRiverAtZ(game.player.position.z);
      const escapeDirection = game.player.position.x >= river.center ? -1 : 1;
      game.player.position.x = river.center + escapeDirection * Math.max(2, river.halfWidth * 0.55);
      for (const entity of game.entities) {
        if (Math.abs(entity.group.position.z - game.player.position.z) < 8) {
          entity.group.position.z = 28;
        }
      }
    };
  });

  const samples = [];
  const milestones = {};
  await page.screenshot({ path: resolve(outputDir, '01-flight-000s.png') });
  milestones[0] = JSON.parse(await page.evaluate(() => window.render_game_to_text()));

  await page.keyboard.down('Space');
  for (let second = 1; second <= durationSeconds; second += 1) {
    if (second === 15) await page.keyboard.down('ArrowUp');
    if (second === 20) await page.keyboard.up('ArrowUp');
    if (second === 45) await page.keyboard.down('ArrowDown');
    if (second === 48) await page.keyboard.up('ArrowDown');

    const elapsed = await page.evaluate((currentSecond) => {
      const game = window.__riverRaidGame;
      const river = game.getRiverAtZ(game.player.position.z);
      const center = river.center;
      const safeHalfWidth = river.halfWidth - 2.3;
      const inputWave = Math.sin(currentSecond / 4.8) * Math.min(3.4, safeHalfWidth * 0.28);
      game.player.position.x = center + inputWave;
      const started = performance.now();
      window.advanceTime(1000);
      return performance.now() - started;
    }, second);
    samples.push(elapsed);

    if (captureSeconds.has(second)) {
      const label = String(Math.round(second)).padStart(3, '0');
      await page.screenshot({ path: resolve(outputDir, `flight-${label}s.png`) });
      milestones[Math.round(second)] = JSON.parse(
        await page.evaluate(() => window.render_game_to_text())
      );
    }
  }
  await page.keyboard.up('Space');
  await page.keyboard.up('ArrowUp').catch(() => {});
  await page.keyboard.up('ArrowDown').catch(() => {});

  const crashes = await page.evaluate(() => window.__v2AuditCrashes);
  const report = {
    scenario,
    menu: menuSnapshot,
    simulatedSeconds: durationSeconds,
    performanceMs: {
      sample: 'tempo para atualizar 1 segundo simulado e renderizar 1 quadro',
      average: Number((samples.reduce((sum, value) => sum + value, 0) / samples.length).toFixed(3)),
      p95: Number(percentile(samples, 0.95).toFixed(3)),
      p99: Number(percentile(samples, 0.99).toFixed(3)),
      maximum: Number(Math.max(...samples).toFixed(3)),
      above20ms: samples.filter((value) => value > 20).length,
      above50ms: samples.filter((value) => value > 50).length,
    },
    crashes,
    milestones,
    errors,
  };
  await writeFile(resolve(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  await context.close();
  return report;
}

await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});

try {
  const desktop = await runScenario(browser, {
    name: 'desktop-1280x720',
    width: 1280,
    height: 720,
    mobile: false,
  });
  const mobile = await runScenario(browser, {
    name: 'mobile-390x844',
    width: 390,
    height: 844,
    mobile: true,
  });
  console.log(JSON.stringify({ desktop, mobile }, null, 2));
} finally {
  await browser.close();
}
