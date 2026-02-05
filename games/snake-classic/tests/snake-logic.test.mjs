import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState, placeFood, queueDirection, stepState } from '../SnakeLogic.mjs';

test('moves one cell per tick in active direction', () => {
  let state = createInitialState({ cols: 12, rows: 12, rng: () => 0 });
  state = queueDirection(state, 'RIGHT');
  state = stepState(state, () => 0);

  assert.equal(state.snake[0].x, 7);
  assert.equal(state.snake[0].y, 6);
  assert.equal(state.mode, 'playing');
});

test('ignores opposite direction while moving', () => {
  let state = createInitialState({ cols: 12, rows: 12, rng: () => 0 });
  state = queueDirection(state, 'RIGHT');
  state = stepState(state, () => 0);
  state = queueDirection(state, 'LEFT');

  assert.equal(state.nextDirection, 'RIGHT');
});

test('eating food grows snake and increments score', () => {
  let state = createInitialState({ cols: 12, rows: 12, rng: () => 0 });
  state = {
    ...state,
    mode: 'playing',
    food: { x: state.snake[0].x + 1, y: state.snake[0].y },
  };

  const beforeLength = state.snake.length;
  state = stepState(state, () => 0);

  assert.equal(state.score, 1);
  assert.equal(state.snake.length, beforeLength + 1);
  assert.ok(state.food);
  assert.notDeepEqual(state.food, state.snake[0]);
});

test('collision with wall ends game', () => {
  let state = createInitialState({ cols: 4, rows: 4, rng: () => 0 });
  state = {
    ...state,
    mode: 'playing',
    snake: [{ x: 3, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 1 }],
    direction: 'RIGHT',
    nextDirection: 'RIGHT',
  };

  state = stepState(state, () => 0);
  assert.equal(state.mode, 'gameover');
});

test('collision with self ends game', () => {
  let state = createInitialState({ cols: 8, rows: 8, rng: () => 0 });
  state = {
    ...state,
    mode: 'playing',
    snake: [
      { x: 3, y: 3 },
      { x: 3, y: 4 },
      { x: 2, y: 4 },
      { x: 2, y: 3 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ],
    direction: 'UP',
    nextDirection: 'LEFT',
  };

  state = stepState(state, () => 0);
  assert.equal(state.mode, 'gameover');
});

test('food placement never picks occupied cell', () => {
  const snake = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ];

  const food = placeFood(4, 1, snake, () => 0.99);
  assert.deepEqual(food, { x: 3, y: 0 });
});
