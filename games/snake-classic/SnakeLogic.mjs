export const DIRECTION_VECTORS = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

const OPPOSITES = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
};

function clonePoint(point) {
  return { x: point.x, y: point.y };
}

function sameCell(a, b) {
  return a.x === b.x && a.y === b.y;
}

function outOfBounds(cell, cols, rows) {
  return cell.x < 0 || cell.x >= cols || cell.y < 0 || cell.y >= rows;
}

function buildBlockedSet(points) {
  return new Set(points.map((point) => `${point.x},${point.y}`));
}

export function isOppositeDirection(a, b) {
  return OPPOSITES[a] === b;
}

export function placeFood(cols, rows, snake, rng = Math.random) {
  const blocked = buildBlockedSet(snake);
  const freeCells = [];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (!blocked.has(`${x},${y}`)) {
        freeCells.push({ x, y });
      }
    }
  }

  if (freeCells.length === 0) return null;

  const index = Math.floor(rng() * freeCells.length);
  return freeCells[Math.min(index, freeCells.length - 1)];
}

export function createInitialState({ cols = 20, rows = 20, rng = Math.random } = {}) {
  const centerX = Math.floor(cols / 2);
  const centerY = Math.floor(rows / 2);
  const snake = [
    { x: centerX, y: centerY },
    { x: centerX - 1, y: centerY },
    { x: centerX - 2, y: centerY },
  ];

  return {
    mode: 'ready',
    cols,
    rows,
    snake,
    direction: 'RIGHT',
    nextDirection: 'RIGHT',
    food: placeFood(cols, rows, snake, rng),
    score: 0,
    tick: 0,
  };
}

export function queueDirection(state, direction) {
  if (!DIRECTION_VECTORS[direction]) return state;
  if (isOppositeDirection(state.direction, direction)) return state;

  return {
    ...state,
    nextDirection: direction,
    mode: state.mode === 'ready' ? 'playing' : state.mode,
  };
}

export function stepState(state, rng = Math.random) {
  if (state.mode !== 'playing') return state;

  const velocity = DIRECTION_VECTORS[state.nextDirection];
  const head = state.snake[0];
  const newHead = { x: head.x + velocity.x, y: head.y + velocity.y };

  if (outOfBounds(newHead, state.cols, state.rows)) {
    return {
      ...state,
      mode: 'gameover',
    };
  }

  const ateFood = state.food && sameCell(newHead, state.food);
  const bodyToCheck = ateFood ? state.snake : state.snake.slice(0, -1);

  if (bodyToCheck.some((segment) => sameCell(segment, newHead))) {
    return {
      ...state,
      mode: 'gameover',
    };
  }

  const newSnake = [newHead, ...state.snake.map(clonePoint)];
  if (!ateFood) {
    newSnake.pop();
  }

  const food = ateFood ? placeFood(state.cols, state.rows, newSnake, rng) : clonePoint(state.food);
  const mode = ateFood && !food ? 'won' : 'playing';

  return {
    ...state,
    mode,
    snake: newSnake,
    direction: state.nextDirection,
    nextDirection: state.nextDirection,
    food,
    score: ateFood ? state.score + 1 : state.score,
    tick: state.tick + 1,
  };
}

export function restartState(state, rng = Math.random) {
  return createInitialState({ cols: state.cols, rows: state.rows, rng });
}
