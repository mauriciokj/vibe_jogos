import { createInitialState, queueDirection, restartState, stepState } from './SnakeLogic.mjs';
import { SnakeAudio } from './SnakeAudio.mjs';
import {
  addLeaderboardEntry,
  fetchLeaderboard,
  loadLeaderboard,
  saveLeaderboard,
  submitLeaderboardScore,
} from './SnakeLeaderboard.mjs';

const KEY_TO_DIRECTION = {
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  w: 'UP',
  W: 'UP',
  s: 'DOWN',
  S: 'DOWN',
  a: 'LEFT',
  A: 'LEFT',
  d: 'RIGHT',
  D: 'RIGHT',
};

const LEADERBOARD_STORAGE_KEY = 'snake-classic-leaderboard';
const LEADERBOARD_API_URL = '/api/leaderboard';

export class SnakeGame {
  constructor(mountEl, options = {}) {
    this.mountEl = mountEl;
    this.tickMs = options.tickMs ?? 120;
    this.cellSize = options.cellSize ?? 22;
    this.state = createInitialState(options);
    this.accumulatorMs = 0;
    this.lastFrameTime = 0;
    this.rafId = null;
    this.isScorePending = false;
    this.hasSavedCurrentScore = false;
    this.leaderboard = this.loadLeaderboardEntries();
    this.leaderboardSource = 'local';
    this.isSavingScore = false;
    this.audio = new SnakeAudio();
    this.podiumMessageTimeout = null;

    this.buildUI();
    this.bindEvents();
    this.render();
    this.hydrateGlobalLeaderboard();

    window.render_game_to_text = () => this.renderGameToText();
    window.advanceTime = (ms) => this.advanceTime(ms);
  }

  loadLeaderboardEntries() {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    return loadLeaderboard(window.localStorage, LEADERBOARD_STORAGE_KEY);
  }

  persistLeaderboardEntries() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    saveLeaderboard(window.localStorage, LEADERBOARD_STORAGE_KEY, this.leaderboard);
  }

  async hydrateGlobalLeaderboard() {
    try {
      const entries = await fetchLeaderboard(LEADERBOARD_API_URL);
      this.leaderboard = entries;
      this.leaderboardSource = 'global';
      this.persistLeaderboardEntries();
      this.render();
    } catch {
      this.leaderboardSource = 'local';
      this.render();
    }
  }

  buildUI() {
    this.mountEl.innerHTML = '';

    this.root = document.createElement('main');
    this.root.className = 'snake-root';

    this.scoreEl = document.createElement('div');
    this.scoreEl.className = 'snake-score';

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'snake-status';

    const hud = document.createElement('div');
    hud.className = 'snake-hud';
    hud.append(this.scoreEl, this.statusEl);

    this.canvasWrap = document.createElement('section');
    this.canvasWrap.className = 'snake-canvas-wrap';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'snake-canvas';
    this.canvas.width = this.state.cols * this.cellSize;
    this.canvas.height = this.state.rows * this.cellSize;
    this.ctx = this.canvas.getContext('2d');

    this.podiumMessageEl = document.createElement('div');
    this.podiumMessageEl.className = 'podium-message hidden';

    this.scoreForm = document.createElement('form');
    this.scoreForm.className = 'score-form hidden';
    this.scoreForm.innerHTML = `
      <label for="player-name">Novo recorde? Salve seu nome</label>
      <div class="score-form-row">
        <input id="player-name" name="playerName" maxlength="12" placeholder="Seu nome" autocomplete="nickname" required />
        <button type="submit">Salvar</button>
      </div>
    `;
    this.playerNameInput = this.scoreForm.querySelector('#player-name');

    this.canvasWrap.append(this.canvas, this.podiumMessageEl, this.scoreForm);

    this.controls = document.createElement('div');
    this.controls.className = 'touch-controls';
    this.controls.innerHTML = `
      <button type="button" data-dir="UP">UP</button>
      <div class="touch-controls-mid">
        <button type="button" data-dir="LEFT">LEFT</button>
        <button type="button" data-action="pause">PAUSE</button>
        <button type="button" data-dir="RIGHT">RIGHT</button>
      </div>
      <button type="button" data-dir="DOWN">DOWN</button>
      <button type="button" data-action="restart">RESTART</button>
    `;

    this.leaderboardPanel = document.createElement('section');
    this.leaderboardPanel.className = 'leaderboard';
    this.leaderboardPanel.innerHTML = '<h2>Placar</h2>';
    this.leaderboardMeta = document.createElement('small');
    this.leaderboardMeta.className = 'leaderboard-meta';
    this.leaderboardList = document.createElement('ol');
    this.leaderboardPanel.append(this.leaderboardMeta, this.leaderboardList);

    this.root.append(hud, this.canvasWrap, this.controls, this.leaderboardPanel);
    this.mountEl.appendChild(this.root);
  }

  bindEvents() {
    window.addEventListener('keydown', (event) => {
      if (this.isTypingTarget(event.target)) return;

      this.audio.unlock();

      if (event.key in KEY_TO_DIRECTION) {
        this.onDirection(KEY_TO_DIRECTION[event.key]);
        return;
      }

      if (event.code === 'Space') {
        this.togglePause();
        return;
      }

      if (event.key === 'r' || event.key === 'R' || event.code === 'Enter') {
        this.restart();
      }
    });

    this.controls.addEventListener('click', (event) => {
      this.audio.unlock();
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;

      const direction = target.getAttribute('data-dir');
      const action = target.getAttribute('data-action');

      if (direction) {
        this.onDirection(direction);
        return;
      }

      if (action === 'pause') {
        this.togglePause();
      } else if (action === 'restart') {
        this.restart();
      }
    });

    this.scoreForm.addEventListener('submit', (event) => {
      event.preventDefault();
      this.saveCurrentScore();
    });
  }

  isTypingTarget(target) {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  onDirection(direction) {
    if (this.state.mode === 'gameover' || this.state.mode === 'won') return;
    if (this.state.mode === 'paused') {
      this.state = { ...this.state, mode: 'playing' };
    }

    this.state = queueDirection(this.state, direction);
    this.render();
  }

  togglePause() {
    if (this.state.mode === 'playing') {
      this.state = { ...this.state, mode: 'paused' };
    } else if (this.state.mode === 'paused' || this.state.mode === 'ready') {
      this.state = { ...this.state, mode: 'playing' };
    }

    this.render();
  }

  restart() {
    this.state = restartState(this.state);
    this.accumulatorMs = 0;
    this.isScorePending = false;
    this.hasSavedCurrentScore = false;
    this.isSavingScore = false;
    this.hidePodiumMessage();
    this.hideScoreForm();
    this.render();
  }

  onGameOver() {
    if (this.hasSavedCurrentScore) return;

    this.isScorePending = this.state.score > 0;
    const projectedPosition = this.getProjectedPosition(this.state.score);
    this.maybeShowPodiumMessage(projectedPosition);
    if (this.isScorePending) {
      this.showScoreForm();
    }
  }

  showScoreForm() {
    this.scoreForm.classList.remove('hidden');
    this.playerNameInput.value = '';
    this.playerNameInput.focus();
  }

  hideScoreForm() {
    this.scoreForm.classList.add('hidden');
  }

  async saveCurrentScore() {
    if (!this.isScorePending || this.hasSavedCurrentScore || this.isSavingScore) return;

    this.isSavingScore = true;
    this.playerNameInput.disabled = true;
    const saveButton = this.scoreForm.querySelector('button[type="submit"]');
    if (saveButton) saveButton.disabled = true;

    const name = this.playerNameInput.value;
    try {
      const remoteResult = await submitLeaderboardScore(LEADERBOARD_API_URL, {
        name,
        score: this.state.score,
      });
      this.leaderboard = remoteResult.entries;
      this.leaderboardSource = 'global';
      this.persistLeaderboardEntries();
    } catch {
      const localEntry = {
        name,
        score: this.state.score,
        at: Date.now(),
      };
      this.leaderboard = addLeaderboardEntry(this.leaderboard, localEntry);
      this.leaderboardSource = 'local';
      this.persistLeaderboardEntries();
    }

    this.hasSavedCurrentScore = true;
    this.isScorePending = false;
    this.isSavingScore = false;
    this.playerNameInput.disabled = false;
    if (saveButton) saveButton.disabled = false;
    this.hideScoreForm();
    this.render();
  }

  getProjectedPosition(score) {
    const sorted = [...this.leaderboard].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.at - b.at;
    });

    const peopleAhead = sorted.filter((entry) => entry.score >= score).length;
    return peopleAhead + 1;
  }

  maybeShowPodiumMessage(position) {
    if (!position || position > 3) return;
    this.showPodiumMessage(`Voce entrou para o podium: ${position}o lugar!`);
  }

  showPodiumMessage(message) {
    if (this.podiumMessageTimeout) {
      clearTimeout(this.podiumMessageTimeout);
      this.podiumMessageTimeout = null;
    }

    this.podiumMessageEl.textContent = message;
    this.podiumMessageEl.classList.remove('hidden');
    this.podiumMessageTimeout = setTimeout(() => this.hidePodiumMessage(), 2800);
  }

  hidePodiumMessage() {
    if (this.podiumMessageTimeout) {
      clearTimeout(this.podiumMessageTimeout);
      this.podiumMessageTimeout = null;
    }
    this.podiumMessageEl.classList.add('hidden');
  }

  updateStep() {
    const previousMode = this.state.mode;
    const previousScore = this.state.score;
    this.state = stepState(this.state);

    if (this.state.score > previousScore) {
      this.audio.playEat();
    }

    if (previousMode !== 'gameover' && this.state.mode === 'gameover') {
      this.audio.playDeath();
      this.onGameOver();
    }
  }

  advanceTime(ms) {
    const ticks = Math.max(1, Math.floor(ms / this.tickMs));
    for (let i = 0; i < ticks; i += 1) {
      this.updateStep();
    }
    this.render();
  }

  frame = (timeMs) => {
    if (!this.lastFrameTime) this.lastFrameTime = timeMs;
    const delta = timeMs - this.lastFrameTime;
    this.lastFrameTime = timeMs;

    this.accumulatorMs += delta;
    while (this.accumulatorMs >= this.tickMs) {
      this.updateStep();
      this.accumulatorMs -= this.tickMs;
    }

    this.render();
    this.rafId = requestAnimationFrame(this.frame);
  };

  drawGrid() {
    this.ctx.fillStyle = '#050910';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    this.ctx.lineWidth = 1;

    for (let x = 0; x <= this.state.cols; x += 1) {
      const px = x * this.cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(px, 0);
      this.ctx.lineTo(px, this.canvas.height);
      this.ctx.stroke();
    }

    for (let y = 0; y <= this.state.rows; y += 1) {
      const py = y * this.cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(0, py);
      this.ctx.lineTo(this.canvas.width, py);
      this.ctx.stroke();
    }
  }

  drawSnake() {
    this.state.snake.forEach((segment, index) => {
      this.ctx.fillStyle = index === 0 ? '#ffd94a' : '#7ed957';
      this.ctx.fillRect(segment.x * this.cellSize + 2, segment.y * this.cellSize + 2, this.cellSize - 4, this.cellSize - 4);
    });
  }

  drawFood() {
    if (!this.state.food) return;

    const { x, y } = this.state.food;
    this.ctx.fillStyle = '#ff6f5e';
    this.ctx.fillRect(x * this.cellSize + 4, y * this.cellSize + 4, this.cellSize - 8, this.cellSize - 8);
  }

  renderLeaderboard() {
    this.leaderboardList.innerHTML = '';
    this.leaderboardMeta.textContent = this.leaderboardSource === 'global' ? 'Fonte: global' : 'Fonte: local (offline)';

    if (this.leaderboard.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.textContent = 'Sem recordes ainda';
      this.leaderboardList.appendChild(emptyItem);
      return;
    }

    this.leaderboard.forEach((entry, index) => {
      const item = document.createElement('li');
      const medals = ['🥇', '🥈', '🥉'];
      const prefix = medals[index] ?? `${index + 1}.`;
      item.textContent = `${prefix} ${entry.name} - ${entry.score}`;
      this.leaderboardList.appendChild(item);
    });
  }

  getStatusText() {
    if (this.state.mode === 'ready') return 'Use arrows or WASD to start';
    if (this.state.mode === 'paused') return 'Paused (Space to resume)';
    if (this.state.mode === 'gameover' && this.isScorePending) return 'Game over (salve seu nome no placar)';
    if (this.state.mode === 'gameover') return 'Game over (R or Enter to restart)';
    if (this.state.mode === 'won') return 'You win! (R or Enter to restart)';
    return 'Space: pause';
  }

  render() {
    this.drawGrid();
    this.drawFood();
    this.drawSnake();
    this.scoreEl.textContent = `Score: ${this.state.score}`;
    this.statusEl.textContent = this.getStatusText();
    this.renderLeaderboard();
  }

  renderGameToText() {
    return JSON.stringify({
      mode: this.state.mode,
      coordinateSystem: 'origin at top-left, x grows right, y grows down',
      grid: { cols: this.state.cols, rows: this.state.rows },
      direction: this.state.direction,
      nextDirection: this.state.nextDirection,
      score: this.state.score,
      snakeLength: this.state.snake.length,
      snakeHead: this.state.snake[0],
      food: this.state.food,
      tick: this.state.tick,
      scorePending: this.isScorePending,
      leaderboardSource: this.leaderboardSource,
      leaderboardTop5: this.leaderboard.slice(0, 5),
    });
  }

  start() {
    this.rafId = requestAnimationFrame(this.frame);
  }
}
