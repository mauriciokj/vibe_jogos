import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { addLeaderboardEntry, normalizePlayerName, parseLeaderboardPayload } from './SnakeLeaderboard.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'data');
const leaderboardFile = path.join(dataDir, 'leaderboard.json');
const port = Number(process.env.PORT || 4173);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

async function readLeaderboard() {
  try {
    const raw = await fs.readFile(leaderboardFile, 'utf8');
    return parseLeaderboardPayload({ entries: JSON.parse(raw) });
  } catch {
    return [];
  }
}

async function writeLeaderboard(entries) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(leaderboardFile, JSON.stringify(entries, null, 2), 'utf8');
}

async function handleApi(req, res) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return true;
  }

  const apiPath = (req.url || '').split('?')[0];
  if (apiPath !== '/api/leaderboard' && apiPath !== '/api/leaderboard/') return false;

  if (req.method === 'GET') {
    const entries = await readLeaderboard();
    sendJson(res, 200, { entries });
    return true;
  }

  if (req.method === 'POST') {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 10_000) {
        sendJson(res, 413, { error: 'Payload too large' });
        return true;
      }
    }

    try {
      const parsed = JSON.parse(body || '{}');
      const name = normalizePlayerName(parsed.name);
      const score = Number(parsed.score) || 0;
      const entries = await readLeaderboard();
      const submittedEntry = { name, score, at: Date.now() };
      const next = addLeaderboardEntry(entries, submittedEntry, 10);
      const position = next.findIndex(
        (entry) => entry.name === submittedEntry.name && entry.score === submittedEntry.score && entry.at === submittedEntry.at,
      );
      await writeLeaderboard(next);
      sendJson(res, 200, { entries: next, position: position >= 0 ? position + 1 : null });
      return true;
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return true;
    }
  }

  sendJson(res, 405, { error: 'Method not allowed' });
  return true;
}

function normalizeStaticPath(urlPath) {
  let pathname = urlPath.split('?')[0];
  if (pathname.startsWith('/snake-classic/')) {
    pathname = pathname.replace('/snake-classic', '');
  }
  if (pathname === '/snake-classic') pathname = '/';
  if (pathname === '/') pathname = '/index.html';
  return pathname;
}

async function handleStatic(req, res) {
  const pathname = normalizeStaticPath(req.url || '/');
  const target = path.join(__dirname, pathname);
  const resolved = path.resolve(target);

  if (!resolved.startsWith(path.resolve(__dirname))) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const stat = await fs.stat(resolved);
    if (stat.isDirectory()) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = await fs.readFile(resolved);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    console.warn('404', req.url);
    sendJson(res, 404, { error: 'Not found' });
  }
}

const server = createServer(async (req, res) => {
  try {
    const handled = await handleApi(req, res);
    if (handled) return;
    await handleStatic(req, res);
  } catch {
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(port, () => {
  console.log(`Snake server running on http://127.0.0.1:${port}`);
});
