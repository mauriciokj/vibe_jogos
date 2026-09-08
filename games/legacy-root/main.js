import { Game } from '/games/enduro-proto/Game.js';

const app = document.getElementById('app');
const game = new Game(app);
game.start();
