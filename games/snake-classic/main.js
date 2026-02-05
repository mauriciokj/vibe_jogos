import { SnakeGame } from './SnakeGame.mjs';

const app = document.getElementById('app');
const game = new SnakeGame(app);
game.start();
