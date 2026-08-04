const test = require('node:test');
const assert = require('node:assert/strict');

const leaderboard = require('./leaderboard.js');

function createStore() {
  const values = new Map();
  const options = new Map();
  return {
    values,
    options,
    async get(key) {
      return values.get(key) || [];
    },
    async set(key, value, config) {
      values.set(key, value);
      options.set(key, config);
    },
  };
}

async function request(handler, method, { query = {}, body } = {}) {
  const response = {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(raw) {
      this.payload = raw ? JSON.parse(raw) : null;
    },
  };
  await handler({ method, query, body }, response);
  return response;
}

test('mantém Snake como placar padrão e separa o Rio de Aço', async () => {
  const store = createStore();
  const handler = leaderboard.createHandler(store);

  const snake = await request(handler, 'POST', { body: { name: 'Ana', score: 8 } });
  const river = await request(handler, 'POST', {
    body: {
      game: 'river-raid-3d',
      name: 'Bia<script>',
      score: 4200,
      round: 5,
      bridges: 11,
      evasions: 3,
      distance: 2200,
      version: '1.11.0',
    },
  });

  assert.equal(snake.statusCode, 200);
  assert.equal(river.statusCode, 200);
  assert.equal(river.payload.entries[0].name, 'Biascript');
  assert.equal(river.payload.entries[0].round, 5);
  assert.equal(store.values.get('snake:leaderboard').length, 1);
  assert.equal(store.values.get('river-raid-3d:leaderboard:v1').length, 1);
});

test('ordena pontuações, devolve posição e rejeita campos fora do limite', async () => {
  const store = createStore();
  const handler = leaderboard.createHandler(store);
  await request(handler, 'POST', {
    body: { game: 'river-raid-3d', name: 'A', score: 900, round: 2 },
  });
  const best = await request(handler, 'POST', {
    body: { game: 'river-raid-3d', name: 'B', score: 1200, round: 3 },
  });
  const invalid = await request(handler, 'POST', {
    body: { game: 'river-raid-3d', name: 'X', score: -1, round: 1 },
  });

  assert.equal(best.payload.position, 1);
  assert.deepEqual(best.payload.entries.map((entry) => entry.name), ['B', 'A']);
  assert.equal(invalid.statusCode, 400);
});

test('GET aceita jogo explícito e jogo desconhecido é recusado', async () => {
  const store = createStore();
  const handler = leaderboard.createHandler(store);
  const river = await request(handler, 'GET', { query: { game: 'river-raid-3d' } });
  const unknown = await request(handler, 'GET', { query: { game: 'outro' } });

  assert.equal(river.statusCode, 200);
  assert.equal(river.payload.game, 'river-raid-3d');
  assert.equal(unknown.statusCode, 400);
});

test('ranking diário fica isolado do geral e recebe expiração', async () => {
  const store = createStore();
  const handler = leaderboard.createHandler(store);
  const challenge = '2026-08-04';

  await request(handler, 'POST', {
    body: { game: 'river-raid-3d', name: 'Geral', score: 800, round: 2 },
  });
  const daily = await request(handler, 'POST', {
    body: {
      game: 'river-raid-3d',
      board: 'daily',
      challenge,
      name: 'Diário',
      score: 1200,
      round: 3,
    },
  });
  const dailyGet = await request(handler, 'GET', {
    query: { game: 'river-raid-3d', board: 'daily', challenge },
  });

  assert.equal(daily.statusCode, 200);
  assert.equal(daily.payload.board, 'daily');
  assert.equal(daily.payload.challenge, challenge);
  assert.equal(daily.payload.entries[0].challenge, challenge);
  assert.deepEqual(dailyGet.payload.entries.map((entry) => entry.name), ['Diário']);
  assert.deepEqual(store.values.get('river-raid-3d:leaderboard:v1').map((entry) => entry.name), ['Geral']);
  assert.deepEqual(store.options.get(`river-raid-3d:daily:${challenge}`), {
    ex: leaderboard.testables.DAILY_BOARD_TTL_SECONDS,
  });
});

test('recusa desafio diário sem data válida e não habilita diário no Snake', async () => {
  const store = createStore();
  const handler = leaderboard.createHandler(store);
  const missingDate = await request(handler, 'GET', {
    query: { game: 'river-raid-3d', board: 'daily' },
  });
  const invalidDate = await request(handler, 'GET', {
    query: { game: 'river-raid-3d', board: 'daily', challenge: '2026-02-31' },
  });
  const snakeDaily = await request(handler, 'GET', {
    query: { game: 'snake', board: 'daily', challenge: '2026-08-04' },
  });

  assert.equal(missingDate.statusCode, 400);
  assert.equal(invalidDate.statusCode, 400);
  assert.equal(snakeDaily.statusCode, 400);
});
