import { createGameServer } from './service';
import { storeFromEnvironment } from './store';
const port = Number(process.env.PORT || 4318);
const origins = (process.env.ASFALTO_ORIGINS || 'http://127.0.0.1:4317,http://localhost:4317').split(',');
const game = createGameServer(storeFromEnvironment(),{origins});
game.server.listen(port,process.env.HOST || '127.0.0.1',()=>console.log(`Multiplayer: http://127.0.0.1:${port}`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>void game.close().then(()=>process.exit(0)));
