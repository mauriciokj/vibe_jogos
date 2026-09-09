const test=require('node:test');const assert=require('node:assert/strict');
const {mkdtemp,rm}=require('node:fs/promises');const {tmpdir}=require('node:os');const {join}=require('node:path');const {once}=require('node:events');
const {createCatalogServer}=require('./catalog-server.cjs');
async function start(file){const app=createCatalogServer(file);app.server.listen(0,'127.0.0.1');await once(app.server,'listening');return {app,url:`http://127.0.0.1:${app.server.address().port}/api/visitors`};}
test('visitor count deduplicates signed cookies, survives restart and shares both domains',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'vibe-visitors-'));let current;
  try{
    current=await start(join(dir,'db.sqlite'));
    const read=async()=> (await fetch(current.url)).json();
    const post=(cookie,host='asfaltobruto.flowofdevelopment.com')=>fetch(current.url,{method:'POST',headers:{'X-Game-Visit':'1','X-Forwarded-Host':host,'X-Forwarded-Proto':'https',Origin:`https://${host}`,...(cookie?{Cookie:cookie}:{})}});
    const initial=await read();assert.equal(initial.visitors,0);assert.equal(initial.metric,'unique-browsers');
    const first=await post();assert.equal((await first.json()).visitors,1);const setCookie=first.headers.get('set-cookie'),cookie=setCookie.split(';')[0];
    for(const value of ['HttpOnly','Secure','SameSite=Lax','Domain=flowofdevelopment.com'])assert.ok(setCookie.includes(value));
    const repeated=await Promise.all(Array.from({length:10},()=>post(cookie)));for(const response of repeated)assert.equal((await response.json()).visitors,1);
    assert.equal((await(await post(cookie,'flowofdevelopment.com')).json()).visitors,1);
    assert.equal((await(await post()).json()).visitors,2);
    await current.app.close();current=await start(join(dir,'db.sqlite'));
    assert.equal((await(await post(cookie)).json()).visitors,2);assert.equal((await read()).since,initial.since);
    assert.equal((await fetch(current.url,{method:'POST'})).status,403);
    assert.equal((await fetch(current.url,{method:'POST',headers:{'X-Game-Visit':'1',Origin:'https://outside.example'}})).status,403);
    assert.equal((await fetch(current.url+'?game=unknown')).status,400);assert.equal((await fetch(current.url,{method:'DELETE'})).status,405);
    assert.equal((await read()).visitors,2);
    const tampered=cookie.slice(0,-1)+(cookie.endsWith('0')?'1':'0');const invalid=await post(tampered);assert.notEqual(invalid.headers.get('set-cookie').split(';')[0],tampered);assert.equal((await invalid.json()).visitors,3);
  }finally{if(current)await current.app.close();await rm(dir,{recursive:true,force:true});}
});
test('new-visitor rate limit does not block an already counted browser or read-only totals',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'vibe-visitor-limit-'));let current;
  try{current=await start(join(dir,'db.sqlite'));let cookie;
    for(let i=0;i<30;i++){const r=await fetch(current.url,{method:'POST',headers:{'X-Game-Visit':'1'}});assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];}
    assert.equal((await fetch(current.url,{method:'POST',headers:{'X-Game-Visit':'1'}})).status,429);
    assert.equal((await(await fetch(current.url,{method:'POST',headers:{'X-Game-Visit':'1',Cookie:cookie}})).json()).visitors,30);
    assert.equal((await(await fetch(current.url)).json()).visitors,30);
  }finally{if(current)await current.app.close();await rm(dir,{recursive:true,force:true});}
});
