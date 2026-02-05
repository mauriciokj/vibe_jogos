import test from 'node:test';
import assert from 'node:assert/strict';

import { addLeaderboardEntry, loadLeaderboard, normalizePlayerName, parseLeaderboardPayload } from '../SnakeLeaderboard.mjs';

test('normaliza nome vazio para Jogador e limita tamanho', () => {
  assert.equal(normalizePlayerName('   '), 'Jogador');
  assert.equal(normalizePlayerName('Nome bem grande demais'), 'Nome bem gra');
});

test('ordena placar por score desc e mantém os melhores', () => {
  const entries = [
    { name: 'Ana', score: 4, at: 2 },
    { name: 'Bia', score: 8, at: 3 },
  ];

  const next = addLeaderboardEntry(entries, { name: 'Cau', score: 6, at: 1 }, 2);

  assert.deepEqual(next, [
    { name: 'Bia', score: 8, at: 3 },
    { name: 'Cau', score: 6, at: 1 },
  ]);
});

test('carrega placar válido e ignora json inválido', () => {
  const storage = {
    value: '[{"name":"Ana","score":10,"at":1}]',
    getItem() {
      return this.value;
    },
    setItem() {},
  };

  assert.deepEqual(loadLeaderboard(storage, 'key'), [{ name: 'Ana', score: 10, at: 1 }]);

  storage.value = '{invalid';
  assert.deepEqual(loadLeaderboard(storage, 'key'), []);
});

test('parseia payload da API com entradas válidas', () => {
  const payload = {
    entries: [
      { name: ' Ana  ', score: '12', at: 50 },
      { name: 'ok', score: 0, at: 10 },
      { name: 33, score: 10 },
    ],
  };

  assert.deepEqual(parseLeaderboardPayload(payload), [
    { name: 'Ana', score: 12, at: 50 },
    { name: 'ok', score: 0, at: 10 },
  ]);
});
