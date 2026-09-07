import { createServer } from 'node:http';
import { createGameServer } from '../server/service';
import { storeFromEnvironment } from '../server/store';

let server;
try { server = createGameServer(storeFromEnvironment()).server; }
catch {
  server = createServer((_req,res)=> { res.writeHead(503,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:'Multiplayer indisponível: configure o Redis no Vercel. O modo individual continua disponível.'})); });
}
export default server;
