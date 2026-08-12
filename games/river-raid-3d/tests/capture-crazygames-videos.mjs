import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const gameRoot = resolve(decodeURIComponent(new URL('..', import.meta.url).pathname));
const outputRoot = join(gameRoot, 'marketing', 'crazygames');
const recordingRoot = join(outputRoot, 'recordings');
const frameRate = 30;
const frameCount = 360;
const port = 4175;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.css': 'text/css; charset=utf-8',
};

const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname);
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = normalize(join(gameRoot, relativePath));

  if (!filePath.startsWith(gameRoot)) {
    response.writeHead(403).end();
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

function runFfmpeg(args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', rejectRun);
    child.on('close', (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`ffmpeg exited with ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

async function setKey(page, key, pressed) {
  if (pressed) await page.keyboard.down(key);
  else await page.keyboard.up(key);
}

async function recordGameplay({ name, width, height, mobile = false }) {
  const framesDir = join(recordingRoot, `${name}-frames`);
  const destination = join(outputRoot, `${name}-v6.mp4`);
  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    hasTouch: mobile,
    isMobile: mobile,
    userAgent: mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
      : undefined,
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.addInitScript(() => {
    localStorage.setItem('rio-de-aco-simulation-unlocked', '1');
    localStorage.setItem('rio-de-aco-start-round', '5');
  });

  await page.goto(`http://127.0.0.1:${port}/index.html?locale=en`, { waitUntil: 'networkidle' });
  await page.locator('#start-button').click();
  await page.addStyleTag({ content: '* { cursor: none !important; }' });
  await page.evaluate(() => {
    window.__riverRaidGame.crash = () => {};
    window.__riverRaidGame.spawnTank(-50, 'bank');
    window.__riverRaidGame.spawnTank(-66, 'bank');
    window.__riverRaidGame.spawnTank(-82, 'bank');
    window.advanceTime(1000 / 30);
  });

  await setKey(page, 'Space', true);
  await setKey(page, 'ArrowUp', true);

  for (let frame = 0; frame < frameCount; frame += 1) {
    if (frame === 45) await setKey(page, 'ArrowUp', false);
    if (frame === 55) await page.keyboard.press('KeyC');
    if (frame === 85) await page.keyboard.press('KeyQ');
    if (frame === 115) await page.evaluate(() => window.__riverRaidGame.startFighterPursuit());
    if (frame === 135) await page.keyboard.press('KeyC');
    if (frame === 165) await page.keyboard.press('KeyC');
    if (frame === 245) await page.keyboard.press('KeyE');
    if (frame === 300) await page.keyboard.press('KeyC');
    if (frame === 345) await setKey(page, 'Space', false);

    await page.evaluate((currentFrame) => {
      const state = JSON.parse(window.render_game_to_text());
      const nearestShell = state.enemyShells.reduce((nearest, shell) => {
        const distance = Math.hypot(
          shell.x - state.player.x,
          shell.z - state.player.z
        );
        return !nearest || distance < nearest.distance ? { shell, distance } : nearest;
      }, null);
      let evasiveOffset = Math.sin(currentFrame / 18) * 1.25;
      if (nearestShell && nearestShell.distance < 42) {
        const committedX = nearestShell.shell.targetX ?? nearestShell.shell.x;
        evasiveOffset += (state.player.x >= committedX ? 1 : -1) * 3.4;
      }
      if (state.fighterPursuit.active) {
        evasiveOffset += Math.sin(currentFrame / 7) * 2.15;
      }
      window.__riverRaidGame.player.position.x =
        state.player.riverCenter + evasiveOffset;
      window.advanceTime(1000 / 30);
    }, frame);
    await page.screenshot({
      path: join(framesDir, `frame-${String(frame).padStart(4, '0')}.jpg`),
      type: 'jpeg',
      quality: 86,
      animations: 'disabled',
    });
  }

  await setKey(page, 'Space', false);
  await setKey(page, 'ArrowUp', false);
  await setKey(page, 'ArrowLeft', false);
  await setKey(page, 'ArrowRight', false);

  const state = await page.evaluate(() => window.render_game_to_text());
  await context.close();

  if (errors.length) {
    throw new Error(`${name} emitted page errors: ${errors.join(' | ')}`);
  }

  await runFfmpeg([
    '-y',
    '-framerate', String(frameRate),
    '-i', join(framesDir, 'frame-%04d.jpg'),
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-an',
    destination,
  ]);

  return { destination, state };
}

await mkdir(recordingRoot, { recursive: true });
await new Promise((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));

const browser = await chromium.launch({ headless: true });

try {
  const landscape = await recordGameplay({
    name: 'rio-de-aco-3d-preview-landscape',
    width: 1280,
    height: 720,
  });
  const portrait = await recordGameplay({
    name: 'rio-de-aco-3d-preview-portrait',
    width: 800,
    height: 1200,
    mobile: true,
  });
  console.log(JSON.stringify({ landscape, portrait }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
