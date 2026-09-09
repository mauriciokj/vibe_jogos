const {createServer}=require('node:http');
const path=require('node:path');
const {SqliteStore}=require('./sqlite-store.cjs');
const {createVisitorCounter}=require('./visitors.cjs');
const {createHandler}=require('../../api/leaderboard.js');
function createCatalogServer(filename){
  const store=new SqliteStore(filename),handler=createHandler(store),visitors=createVisitorCounter(store.db);
  let queue=Promise.resolve();
  // Serialize a full read/modify/write operation so concurrent scores are retained.
  const server=createServer((req,res)=>{
    res.setHeader('Cache-Control','no-store');
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({service:'vibe-catalog',storage:'sqlite'}));return;}
    if(/^\/api\/visitors\/?$/.test(url.pathname)){try{visitors(req,res);}catch(error){console.error('Visitor counter failed:',error.message);res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Contador temporariamente indisponível.'}));}return;}
    if(!/^\/api\/leaderboard\/?$/.test(url.pathname)){res.writeHead(404);res.end();return;}
    const length=Number(req.headers['content-length']);
    if(length>10000){res.writeHead(413);res.end();req.resume();return;}
    req.query=Object.fromEntries(url.searchParams);
    queue=queue.then(()=>handler(req,res)).catch(error=>{
      console.error('Leaderboard request failed:',error.message);
      if(!res.headersSent){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Placar temporariamente indisponível.'}));}else res.end();
    });
  });
  server.requestTimeout=10000;server.headersTimeout=10000;server.maxRequestsPerSocket=100;
  const timer=setInterval(()=>store.prune(),3600000);timer.unref();
  return {server,async close(){clearInterval(timer);await new Promise(resolve=>server.close(resolve));await queue;store.close();}};
}
module.exports={createCatalogServer};
if(require.main===module){
  const app=createCatalogServer(process.env.VIBE_DB_PATH||'/var/lib/vibe-jogos/leaderboards.sqlite');
  app.server.listen(Number(process.env.PORT||4320),process.env.HOST||'127.0.0.1',()=>console.log('Vibe Jogos leaderboard listening'));
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>void app.close().then(()=>process.exit(0)));
}
