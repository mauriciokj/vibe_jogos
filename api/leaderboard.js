const { kv } = require('@vercel/kv');

const KEY = 'snake:leaderboard';
const MAX_ENTRIES = 10;

function normalizeName(raw) {
  const cleaned = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Jogador';
  return cleaned.slice(0, 12);
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.at - b.at;
  });
}

async function readEntries() {
  const stored = await kv.get(KEY);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((entry) => entry && typeof entry.name === 'string' && Number.isFinite(Number(entry.score)))
    .map((entry) => ({
      name: normalizeName(entry.name),
      score: Number(entry.score),
      at: Number(entry.at) || Date.now(),
    }));
}

async function writeEntries(entries) {
  await kv.set(KEY, entries);
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(payload));
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 10_000) break;
  }
  if (!body) return {};
  return JSON.parse(body);
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.method === 'GET') {
    try {
      const entries = sortEntries(await readEntries()).slice(0, MAX_ENTRIES);
      sendJson(res, 200, { entries });
    } catch (error) {
      sendJson(res, 500, { error: 'KV error' });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const name = normalizeName(body.name);
      const score = Number(body.score) || 0;
      const submittedEntry = { name, score, at: Date.now() };

      const entries = await readEntries();
      const next = sortEntries([...entries, submittedEntry]).slice(0, MAX_ENTRIES);
      await writeEntries(next);

      const position = next.findIndex(
        (entry) => entry.name === submittedEntry.name && entry.score === submittedEntry.score && entry.at === submittedEntry.at,
      );
      sendJson(res, 200, { entries: next, position: position >= 0 ? position + 1 : null });
    } catch (error) {
      sendJson(res, 400, { error: 'Invalid payload' });
    }
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
};
