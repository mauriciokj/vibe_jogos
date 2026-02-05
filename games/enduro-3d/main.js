import { Game } from './Game.js';

const app = document.getElementById('app');
const game = new Game(app);
window.__game_instance = game;
game.start();
