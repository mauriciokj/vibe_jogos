import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { AccountsDB } from '../server/accounts-db';
import { AccountService } from '../server/accounts';
import { createGameServer } from '../server/service';
import { MemoryStore } from '../server/store';
import { freshSave } from '../src/game/save';
import { createRace, stepRace } from '../src/game/simulation';
import { safeDrivingCommand } from './driving';
import { googleVerifier } from '../server/google';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { makeMember, makeRoom, lobbyClock, joinRoom, viewRoom } from '../server/room';
import { RANK_RULES } from '../src/account/protocol';

test('Google verification rejects wrong audience, nonce, issuer, expiry and unsigned credentials',async()=>{
  const {publicKey,privateKey}=await generateKeyPair('RS256'),jwk=await exportJWK(publicKey);jwk.kid='test';
  const verify=googleVerifier('test-client',createLocalJWKSet({keys:[jwk]}));
  const sign=(aud='test-client',nonce='nonce',iss='https://accounts.google.com',exp:number|string='5m')=>new SignJWT({nonce}).setProtectedHeader({alg:'RS256',kid:'test'}).setSubject('subject-one').setAudience(aud).setIssuer(iss).setIssuedAt().setExpirationTime(exp).sign(privateKey);
  assert.equal(await verify(await sign(),'nonce'),'subject-one');
  for(const credential of [await sign('wrong'),await sign('test-client','wrong'),await sign('test-client','nonce','https://evil.example'),await sign('test-client','nonce',undefined,1),'eyJhbGciOiJub25lIn0.e30.'])await assert.rejects(verify(credential,'nonce'));
});
test('Cloud save CAS and retry receipts preserve purchased gear through restart without doubling money',()=>{
  const dir=mkdtempSync(tmpdir()+'/asfalto-account-');let db=new AccountsDB(dir+'/accounts.sqlite');
  try{
    const a=db.login('one'),b=db.login('two'),save=freshSave();save.cash=15000;save.ownedKneePads=['gold'];save.kneePadId='gold';
    assert.equal(db.save(a.id,0,save,'request-first-0001').ok,true);
    save.cash-=10000;assert.equal(db.save(a.id,1,save,'request-second-002').ok,true);
    const stale=freshSave();stale.cash=999;
    assert.equal(db.save(a.id,1,stale,'request-third-003').ok,false);
    const retry=db.save(a.id,1,save,'request-second-002');assert.equal(retry.revision,2);assert.equal(db.cloud(a.id).save!.cash,5000);
    assert.throws(()=>db.save(a.id,1,stale,'request-second-002'));
    assert.equal(db.cloud(b.id).save,null);
    db.close();db=new AccountsDB(dir+'/accounts.sqlite');assert.equal(db.cloud(a.id).save!.kneePadId,'gold');assert.equal(db.cloud(a.id).revision,2);
    assert.equal(db.db.prepare('PRAGMA integrity_check').get()!.integrity_check,'ok');
  }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
test('Authenticated API: nonce, CSRF, import, conflicts, verified solo replay and durable separate rankings',async()=>{
  let now=Date.now();const db=new AccountsDB(':memory:'),store=new MemoryStore();
  const origin='https://game.example';
  const accounts=new AccountService({db,clientId:'test-client',origins:[origin],now:()=>now,verify:async(credential,nonce)=>{if(credential!==`test:${nonce}`)throw new Error();return 'subject';}});
  const app=createGameServer(store,{accounts,origins:[origin]});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const url=`http://127.0.0.1:${(app.server.address() as {port:number}).port}/api/asfalto/account`;
  let cookie='',csrf='';
  async function call(path:string,body?:unknown,headers:Record<string,string>={}){
    const res=await fetch(url+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-Asfalto-CSRF':csrf,...headers},body:body===undefined?undefined:JSON.stringify(body)});
    return {res,body:await res.json()};
  }
  try{
    const challenge=await call('/session');cookie=challenge.res.headers.get('set-cookie')!.split(';')[0];csrf=challenge.body.csrf;
    assert.match(challenge.res.headers.get('set-cookie')!,/HttpOnly; SameSite=Lax.*Secure/);
    const refocused=await call('/session');
    assert.equal(refocused.body.nonce,challenge.body.nonce,'returning from Google must preserve the pending nonce');
    assert.equal(refocused.body.csrf,csrf);
    assert.equal(refocused.res.headers.get('set-cookie'),null);
    assert.equal((await call('/login',{credential:`test:${challenge.body.nonce}`},{Origin:'https://evil.example'})).res.status,403);
    assert.equal((await call('/login',{credential:`test:${challenge.body.nonce}`},{'X-Asfalto-CSRF':'wrong'})).res.status,403);
    const login=await call('/login',{credential:`test:${challenge.body.nonce}`});assert.equal(login.res.status,200);
    const oldCookie=cookie,oldCsrf=csrf;cookie=login.res.headers.get('set-cookie')!.split(';')[0];csrf=login.body.csrf;
    assert.equal((await call('/login',{credential:`test:${challenge.body.nonce}`},{Cookie:oldCookie,'X-Asfalto-CSRF':oldCsrf})).res.status,403);
    const id=login.body.account.id,save=freshSave();save.ownedKneePads=['gold'];save.kneePadId='gold';
    const saved=await call('/save',{revision:0,request:'initial-import-0001',save});assert.equal(saved.res.status,200);
    assert.equal((await call('/save',{revision:0,request:'stale-save-0000002',save})).res.status,409);
    assert.equal((await call('/save',{revision:1,request:'forged-account-03',account:'other',save})).res.status,200);
    assert.equal(db.cloud(id).revision,2);
    const started=await call('/start',{trackId:'costa',condition:'day',revision:2});assert.equal(started.res.status,200);
    const run=started.body,race=createRace(run.trackId,run.save,run.seed,run.condition),segments=[];
    while(race.mode!=='finished' && race.tick<72000){const command=safeDrivingCommand(race);segments.push({count:1,command});stepRace(race,{player:command});}
    assert.equal(race.result?.reason,'finish');
    assert.equal((await call('/finish',{id:run.id,segments})).res.status,400,'cannot finish faster than wall time');
    now+=race.tick/60*1000+2000;
    let pulses=0;const heartbeat=setInterval(()=>pulses++,5);
    const finish=await call('/finish',{id:run.id,segments});clearInterval(heartbeat);
    assert.equal(finish.res.status,200,JSON.stringify(finish.body));assert.ok(pulses>10,'replay yields to the realtime loop');
    assert.equal((await call('/finish',{id:run.id,segments})).res.status,200,'idempotent');
    const board=await call('/ranking?mode=solo&track=costa&condition=day');assert.equal(board.body.entries.length,1);assert.equal(board.body.entries[0].races,1);assert.ok(board.body.entries[0].me);
    assert.equal(board.body.entries[0].time,race.result!.time);assert.equal((await call('/ranking?mode=multi&track=costa&condition=day')).body.entries.length,0);
    assert.equal((await call('/ranking?mode=solo&track=costa&condition=rain')).body.entries.length,0);
    assert.ok(!JSON.stringify(board.body).includes(id));assert.ok(!JSON.stringify(board.body).includes('subject'));
    assert.equal((await call('/logout',{})).res.status,200);assert.equal((await call('/session')).body.account,null);
  }finally{await app.close();db.close();}
});
test('Multiplayer ranking binds private member account, never leaks identity, deduplicates finished results',()=>{
  const db=new AccountsDB(':memory:'),service=new AccountService({db,clientId:'',origins:[]});
  try{
    const account=db.login('pilot'),member=makeMember('Pilot',0);member.accountId=account.id;
    const room=makeRoom('ABCDEF','costa',member,0,false,'night');
    const duplicate=makeMember('Copy',0);duplicate.accountId=account.id;assert.throws(()=>joinRoom(room,duplicate,0));
    joinRoom(room,makeMember('Guest',0),0);room.members.forEach(m=>m.ready=true);lobbyClock(room,0);lobbyClock(room,5001);
    room.race!.multiplayer!.results[member.id]={reason:'finish',time:200,place:1,reward:0,hits:3,falls:0};
    service.recordRoom(room);service.recordRoom(room);
    const result=db.ranking('multi','costa','night','points',account.id);assert.equal(result.length,1);assert.equal(result[0].races,1);assert.equal(result[0].points,25);
    assert.ok(!JSON.stringify(viewRoom(room,6000)).includes(account.id));assert.equal(RANK_RULES,2);
  }finally{db.close();}
});
