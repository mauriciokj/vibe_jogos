const test = require('node:test');
const assert = require('node:assert/strict');

const leaderboard = require('./leaderboard.js');

function createStore() {
  const values = new Map();
  return {
    values,
    async get(key) {
      return values.get(key) || [];
    },
    async set(key, value) {
      values.set(key, value);
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
