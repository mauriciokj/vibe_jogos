function unquoteEnv(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

process.env.KV_REST_API_URL = unquoteEnv(process.env.KV_REST_API_URL || '');
process.env.KV_REST_API_TOKEN = unquoteEnv(process.env.KV_REST_API_TOKEN || '');
process.env.KV_REST_API_READ_ONLY_TOKEN = unquoteEnv(process.env.KV_REST_API_READ_ONLY_TOKEN || '');

const { randomUUID } = require('node:crypto');

const DEFAULT_GAME = 'snake';
const GAME_CONFIGS = Object.freeze({
  snake: Object.freeze({ key: 'snake:leaderboard', maxEntries: 10, metadata: false }),
  'river-raid-3d': Object.freeze({ key: 'river-raid-3d:leaderboard:v1', maxEntries: 20, metadata: true }),
});
const DAILY_BOARD_TTL_SECONDS = 60 * 60 * 24 * 45;

function normalizeGame(raw) {
  const game = String(raw || DEFAULT_GAME).trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(GAME_CONFIGS, game) ? game : null;
}

function normalizeBoard(raw, game) {
  const board = String(raw || 'global').trim().toLowerCase();
  if (board === 'global') return board;
  if (board === 'daily' && game === 'river-raid-3d') return board;
  return null;
}

function normalizeChallenge(raw) {
  const challenge = String(raw || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(challenge)) return null;
  const [year, month, day] = challenge.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) return null;
  return challenge;
}

function resolveBoardConfig(baseConfig, board, challenge) {
  if (board !== 'daily') return baseConfig;
  return {
    ...baseConfig,
    key: `river-raid-3d:daily:${challenge}`,
    ttlSeconds: DAILY_BOARD_TTL_SECONDS,
    challenge,
  };
}

function normalizeName(raw) {
  const cleaned = String(raw ?? '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N} ._-]/gu, '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!cleaned) return 'Jogador';
  return cleaned.slice(0, 14);
}

function normalizeInteger(raw, minimum, maximum, field) {
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${field} inválido`);
  const integer = Math.floor(value);
  if (integer < minimum || integer > maximum) throw new Error(`${field} fora do limite`);
  return integer;
}

function normalizeEntry(raw, config, { submitted = false } = {}) {
  if (!raw || typeof raw !== 'object') throw new Error('entrada inválida');
  const entry = {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 64) : randomUUID(),
    name: normalizeName(raw.name),
    score: normalizeInteger(raw.score, 0, 999_999_999, 'score'),
    at: submitted ? Date.now() : normalizeInteger(raw.at || Date.now(), 1, 9_999_999_999_999, 'data'),
  };

  if (config.metadata) {
    entry.round = normalizeInteger(raw.round ?? 1, 1, 999, 'rodada');
    entry.bridges = normalizeInteger(raw.bridges ?? 0, 0, 99_999, 'pontes');
    entry.evasions = normalizeInteger(raw.evasions ?? 0, 0, 99_999, 'evasões');
    entry.distance = normalizeInteger(raw.distance ?? 0, 0, 999_999_999, 'distância');
    entry.version = String(raw.version || '').trim().slice(0, 16);
    if (config.challenge) entry.challenge = config.challenge;
  }

  return entry;
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if ((b.round || 0) !== (a.round || 0)) return (b.round || 0) - (a.round || 0);
    if ((b.distance || 0) !== (a.distance || 0)) return (b.distance || 0) - (a.distance || 0);
    return a.at - b.at;
  });
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(payload));
}

function getKvConfigStatus() {
  return {
    hasUrl: Boolean(process.env.KV_REST_API_URL),
    hasToken: Boolean(process.env.KV_REST_API_TOKEN),
    hasReadOnlyToken: Boolean(process.env.KV_REST_API_READ_ONLY_TOKEN),
  };
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 10_000) throw new Error('payload muito grande');
  }
  if (!body) return {};
  return JSON.parse(body);
}

function createHandler(store = kv) {
  async function readEntries(config) {
    const stored = await store.get(config.key);
    if (!Array.isArray(stored)) return [];
    const entries = [];
    for (const raw of stored) {
      try {
        entries.push(normalizeEntry(raw, config));
      } catch {
        // Entradas antigas ou corrompidas não devem derrubar o placar inteiro.
      }
    }
    return entries;
  }

  return async (req, res) => {
    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {});
      return;
    }

    const body = req.method === 'POST' ? await parseBody(req).catch((error) => ({ __error: error })) : null;
    if (body?.__error) {
      sendJson(res, 400, { error: body.__error.message || 'Payload inválido' });
      return;
    }
    const game = normalizeGame(req.query?.game || body?.game);
    if (!game) {
      sendJson(res, 400, { error: 'Jogo não suportado' });
      return;
    }
    const board = normalizeBoard(req.query?.board || body?.board, game);
    if (!board) {
      sendJson(res, 400, { error: 'Ranking não suportado' });
      return;
    }
    const challenge = board === 'daily'
      ? normalizeChallenge(req.query?.challenge || body?.challenge)
      : null;
    if (board === 'daily' && !challenge) {
      sendJson(res, 400, { error: 'Data do desafio inválida' });
      return;
    }
    const config = resolveBoardConfig(GAME_CONFIGS[game], board, challenge);

    if (req.method === 'GET') {
      try {
        const entries = sortEntries(await readEntries(config)).slice(0, config.maxEntries);
        sendJson(res, 200, { game, board, challenge, entries });
      } catch (error) {
        sendJson(res, 500, {
          error: 'KV error',
          details: error && error.message ? error.message : 'unknown',
          env: getKvConfigStatus(),
        });
      }
      return;
    }

    if (req.method === 'POST') {
      try {
        const submittedEntry = normalizeEntry(body, config, { submitted: true });
        const entries = await readEntries(config);
        const next = sortEntries([...entries, submittedEntry]).slice(0, config.maxEntries);
        if (config.ttlSeconds) {
          await store.set(config.key, next, { ex: config.ttlSeconds });
        } else {
          await store.set(config.key, next);
        }
        const position = next.findIndex((entry) => entry.id === submittedEntry.id);
        sendJson(res, 200, {
          game,
          board,
          challenge,
          entries: next,
          position: position >= 0 ? position + 1 : null,
        });
      } catch (error) {
        sendJson(res, 400, {
          error: 'Invalid payload or KV error',
          details: error && error.message ? error.message : 'unknown',
          env: getKvConfigStatus(),
        });
      }
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
  };
}

let defaultHandler = null;
const handler = async (req, res) => {
  if (!defaultHandler) {
    const { kv } = require('@vercel/kv');
    defaultHandler = createHandler(kv);
  }
  return defaultHandler(req, res);
};
handler.createHandler = createHandler;
handler.testables = {
  DAILY_BOARD_TTL_SECONDS,
  GAME_CONFIGS,
  normalizeBoard,
  normalizeChallenge,
  normalizeEntry,
  normalizeGame,
  normalizeName,
  resolveBoardConfig,
  sortEntries,
};

module.exports = handler;
