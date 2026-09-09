const {randomBytes,createHmac,createHash,timingSafeEqual}=require('node:crypto');
const {isIP}=require('node:net');
const COOKIE='vibe_visitor';
const GAME='asfalto-bruto';
function createVisitorCounter(db,{now=Date.now}={}){
  db.exec(`CREATE TABLE IF NOT EXISTS visitor_meta (key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS game_visitors (game TEXT NOT NULL,visitor TEXT NOT NULL,first_seen INTEGER NOT NULL,PRIMARY KEY(game,visitor));`);
  db.prepare('INSERT OR IGNORE INTO visitor_meta VALUES (?,?)').run('secret',randomBytes(32).toString('hex'));
  db.prepare('INSERT OR IGNORE INTO visitor_meta VALUES (?,?)').run('since',String(now()));
  const secret=db.prepare('SELECT value FROM visitor_meta WHERE key=?').get('secret').value;
  const since=new Date(Number(db.prepare('SELECT value FROM visitor_meta WHERE key=?').get('since').value)).toISOString();
  const insert=db.prepare('INSERT OR IGNORE INTO game_visitors VALUES (?,?,?)');
  const count=db.prepare('SELECT COUNT(*) AS total FROM game_visitors WHERE game=?');
  const exists=db.prepare('SELECT 1 FROM game_visitors WHERE game=? AND visitor=?');
  const limits=new Map();
  const sign=id=>createHmac('sha256',secret).update(id).digest('hex');
  const valid=value=>typeof value==='string'&&/^[a-f0-9]{32}\.[a-f0-9]{64}$/.test(value)&&timingSafeEqual(Buffer.from(value.slice(33)),Buffer.from(sign(value.slice(0,32))));
  function handler(req,res){
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
    const url=new URL(req.url,'http://localhost');
    if((url.searchParams.get('game')||GAME)!==GAME)return send(400,{error:'Jogo inválido.'});
    if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return send(405,{error:'Método inválido.'});}
    if(req.method==='POST'){
      const remote=req.socket.remoteAddress;
      const proxy=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote);
      const host=proxy&&req.headers['x-forwarded-host']||req.headers.host||'';
      const secure=req.socket.encrypted||proxy&&req.headers['x-forwarded-proto']==='https';
      const origin=`${secure?'https':'http'}://${host}`;
      if(req.headers['x-game-visit']!=='1'||req.headers['sec-fetch-site']==='cross-site'||req.headers.origin&&req.headers.origin!==origin)return send(403,{error:'Origem inválida.'});
      req.resume();
      const cookies=String(req.headers.cookie||'').split(';').map(s=>s.trim());
      let token=cookies.find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
      if(!valid(token)){const id=randomBytes(16).toString('hex');token=id+'.'+sign(id);}
      const visitor=createHash('sha256').update(token).digest('hex');
      if(!exists.get(GAME,visitor)){
        const forwarded=req.headers['x-real-ip'];
        const ip=proxy&&typeof forwarded==='string'&&isIP(forwarded)?forwarded:remote;
        const at=now();for(const [key,limit] of limits)if(at-limit.at>=60000)limits.delete(key);
        const limit=limits.get(ip)||{at,count:0};limits.set(ip,limit);
        if(++limit.count>30){res.setHeader('Retry-After','60');return send(429,{error:'Tente novamente em um minuto.'});}
        // A primary key makes duplicate visits atomic, including simultaneous tabs.
        insert.run(GAME,visitor,at);
      }
      const hostname=new URL(origin).hostname;
      const domain=hostname==='flowofdevelopment.com'||hostname.endsWith('.flowofdevelopment.com')?'; Domain=flowofdevelopment.com':'';
      res.setHeader('Set-Cookie',`${COOKIE}=${token}; Path=/; Max-Age=34560000; HttpOnly; SameSite=Lax${secure?'; Secure':''}${domain}`);
    }
    send(200,{game:GAME,visitors:count.get(GAME).total,since,metric:'unique-browsers'});
  }
  return handler;
}
module.exports={createVisitorCounter};
