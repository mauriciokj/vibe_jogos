const test=require('node:test');const assert=require('node:assert/strict');
const {mkdtemp,rm}=require('node:fs/promises');const {tmpdir}=require('node:os');const {join}=require('node:path');const {once}=require('node:events');
const {createCatalogServer}=require('./catalog-server.cjs');const {SqliteStore}=require('./sqlite-store.cjs');
async function start(file){const app=createCatalogServer(file);app.server.listen(0,'127.0.0.1');await once(app.server,'listening');return {app,url:`http://127.0.0.1:${app.server.address().port}`};}
test('local rankings retain concurrent submissions, daily separation and survive a process restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'vibe-sqlite-'));let current;
 try{
  current=await start(join(dir,'rankings.sqlite'));
  const responses=await Promise.all(Array.from({length:10},(_,i)=>fetch(`${current.url}/api/leaderboard`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:`Piloto ${i}`,score:i+1})})));
  assert.ok(responses.every(r=>r.status===200));const first=await(await fetch(`${current.url}/api/leaderboard`)).json();assert.equal(first.entries.length,10);assert.deepEqual(first.entries.map(e=>e.score),[10,9,8,7,6,5,4,3,2,1]);
  const daily=await fetch(`${current.url}/api/leaderboard`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({game:'river-raid-3d',board:'daily',challenge:'2026-09-08',name:'Dia',score:45})});assert.equal(daily.status,200);
  await current.app.close();current=await start(join(dir,'rankings.sqlite'));
  const restored=await(await fetch(`${current.url}/api/leaderboard?game=snake`)).json();assert.deepEqual(restored.entries,first.entries);
  assert.equal((await(await fetch(`${current.url}/api/leaderboard?game=river-raid-3d&board=daily&challenge=2026-09-08`)).json()).entries.length,1);
  assert.equal((await(await fetch(`${current.url}/api/leaderboard?game=river-raid-3d`)).json()).entries.length,0);
  assert.equal((await fetch(`${current.url}/api/leaderboard?game=invalid`)).status,400);
  assert.equal((await fetch(`${current.url}/api/unknown`)).status,404);
  assert.equal((await fetch(`${current.url}/api/leaderboard`,{method:'POST',body:'x'.repeat(10001)})).status,413);
  assert.equal((await(await fetch(`${current.url}/health`)).json()).storage,'sqlite');
 }finally{if(current)await current.app.close();await rm(dir,{recursive:true,force:true});}
});
test('expired daily boards are absent and are pruned from SQLite',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'vibe-ttl-')),s=new SqliteStore(join(dir,'db.sqlite'));
 try{await s.set('expired',[{score:1}],{ex:-1});await s.set('global',[{score:2}]);assert.equal(await s.get('expired'),null);s.prune();assert.equal(s.db.prepare('SELECT COUNT(*) AS count FROM boards').get().count,1);assert.deepEqual(await s.get('global'),[{score:2}]);}finally{s.close();await rm(dir,{recursive:true,force:true});}
});
