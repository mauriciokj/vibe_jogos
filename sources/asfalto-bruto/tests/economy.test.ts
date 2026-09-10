import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { AccountsDB } from '../server/accounts-db';
import { Economy } from '../server/economy';
import { freshSave } from '../src/game/save';
import { BIKES } from '../src/game/content';
import { NITRO_PRICE } from '../src/game/equipment';
import { stepRace,snapshot } from '../src/game/simulation';
import { EMPTY_COMMAND } from '../src/game/types';
import { safeDrivingCommand } from './driving';
import { makeMember,makeRoom } from '../server/room';

function fixture(cash=650){
  const db=new AccountsDB(':memory:'),a=db.login('economy-test'),save=freshSave();save.cash=cash;
  db.save(a.id,0,save,'trusted-fixture-0001');let now=Date.now();const economy=new Economy(db,()=>now);
  const action=(kind:string,item?:string,request=crypto.randomUUID(),revision=db.cloud(a.id).revision)=>economy.action(a.id,{request,revision,action:{kind,item}});
  const start=(championship=false)=>economy.start(a.id,{trackId:'costa',condition:'day',championship,revision:db.cloud(a.id).revision});
  return {db,a,economy,action,start,advance:(ms:number)=>{now+=ms;}};
}
test('migration takes a single beta baseline without changing existing balances or equipment',()=>{
  const dir=mkdtempSync(tmpdir()+'/beta-ledger-'),path=dir+'/accounts.sqlite';
  const old=new DatabaseSync(path),save=freshSave();save.cash=17170;save.ownedKneePads=['gold'];save.kneePadId='gold';
  old.exec('CREATE TABLE accounts(id TEXT PRIMARY KEY,subject TEXT UNIQUE NOT NULL,nickname TEXT NOT NULL,save TEXT,revision INTEGER NOT NULL DEFAULT 0,updated INTEGER NOT NULL)');
  old.prepare('INSERT INTO accounts VALUES(?,?,?,?,?,?)').run('trusted','old-google','Piloto',JSON.stringify(save),537,42);old.close();
  let db=new AccountsDB(path);
  try{
    assert.equal(db.cloud('trusted').save!.cash,17170);assert.equal(db.cloud('trusted').save!.kneePadId,'gold');assert.equal(db.cloud('trusted').revision,537);
    const initial=db.db.prepare('SELECT * FROM beta_baseline').get();
    new Economy(db).initialize('trusted');assert.equal(db.cloud('trusted').revision,537);
    db.close();db=new AccountsDB(path);assert.deepEqual(db.db.prepare('SELECT * FROM beta_baseline').get(),initial);
  }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
test('shop computes prices, checks ownership/capacity and serializes duplicate/stale purchase requests',()=>{
  const f=fixture(150000);try{
    const bike=BIKES.filter(b=>b.price>0).sort((a,b)=>a.price-b.price)[0],revision=f.db.cloud(f.a.id).revision,request=crypto.randomUUID();
    f.action('bike',bike.id,request,revision);const after=f.db.cloud(f.a.id);
    assert.equal(after.save!.cash,150000-bike.price);assert.equal(after.save!.bikeId,bike.id);
    f.action('bike',bike.id,request,revision);assert.deepEqual(f.db.cloud(f.a.id),after);
    assert.throws(()=>f.action('nitro',undefined,request,revision));
    assert.throws(()=>f.action('upgrade','engine',crypto.randomUUID(),revision));
    assert.throws(()=>f.action('upgrade','__proto__'));assert.throws(()=>f.action('cash','99999999'));
    f.action('nitro');assert.equal(f.db.cloud(f.a.id).save!.cash,after.save!.cash-NITRO_PRICE);
    for(let i=1;i<bike.nitroCapacity;i++)f.action('nitro');assert.throws(()=>f.action('nitro'));
    const poor=fixture();try{assert.throws(()=>poor.action('bike',bike.id));assert.equal(poor.db.cloud(poor.a.id).save!.cash,650);}finally{poor.db.close();}
  }finally{f.db.close();}
});
test('verified checkpoints fix the race state, resume on another device and cannot be replayed twice',async()=>{
  const f=fixture(10000);try{
    f.action('nitro');const before=f.db.cloud(f.a.id).save!.cash,run=f.start(),race=structuredClone(run.initial!),segments=[];
    assert.equal(f.db.cloud(f.a.id).save!.nitro!.ferro,0,'reserved before the race');
    assert.throws(()=>f.action('repair'));
    for(let i=0;i<600;i++){const command={...EMPTY_COMMAND,throttle:1,...(i===250?{action:'nitro' as const}:{})};stepRace(race,{player:command});segments.push({count:1,command});}
    f.advance(11000);
    const response=await f.economy.advance(f.a.id,{id:run.id,cursor:0,segments,state:{...race,cash:1e8}});
    assert.equal(response.cursor,600);
    const resumed=f.start();assert.equal(snapshot(resumed.initial!),snapshot(race));assert.equal(resumed.id,run.id);
    const duplicate=await f.economy.advance(f.a.id,{id:run.id,cursor:0,segments});assert.equal(duplicate.ok,false);assert.equal(duplicate.cursor,600);
    assert.equal(duplicate.resync,false);
    const extended=await f.economy.advance(f.a.id,{id:run.id,cursor:0,segments:[...segments,{count:10,command:{...EMPTY_COMMAND,throttle:1}}]});assert.equal(extended.resync,false,'lost acknowledgement accepts the already committed prefix');
    const forged=structuredClone(segments);forged[0].command.steer=1;
    const fork=await f.economy.advance(f.a.id,{id:run.id,cursor:0,segments:forged});assert.equal(fork.resync,true,'a different device cannot replace committed commands');assert.equal(snapshot(f.start().initial!),snapshot(race));
    const finish=await f.economy.advance(f.a.id,{id:run.id,cursor:600,segments:[],abandon:true},true);
    assert.equal(finish.completed,true);assert.equal(f.db.cloud(f.a.id).save!.cash,before,'abandonment cannot farm workshop assistance');
    assert.equal(f.db.cloud(f.a.id).save!.nitro!.ferro,0,'consumed nitro does not return');
    const stored=f.db.cloud(f.a.id);await f.economy.advance(f.a.id,{id:run.id,cursor:0,segments,abandon:true},true);assert.deepEqual(f.db.cloud(f.a.id),stored);
  }finally{f.db.close();}
});
test('championship advances from verified races, rejects fabricated finishes and awards exactly once',async()=>{
  const f=fixture(10000);try{
    const run=f.start(true),race=structuredClone(run.initial!),segments=[];
    await assert.rejects(f.economy.advance(f.a.id,{id:run.id,cursor:0,segments:[],result:{reason:'finish',reward:1e8}},true));
    while(race.mode!=='finished'&&segments.length<72000){const command=safeDrivingCommand(race);stepRace(race,{player:command});segments.push({count:1,command});}
    f.advance(segments.length/60*1000+2000);
    const result=await f.economy.advance(f.a.id,{id:run.id,cursor:0,segments},true);
    assert.equal(result.ok,true);const saved=f.db.cloud(f.a.id).save!;
    assert.equal(saved.championship!.heats.length,1);assert.equal(saved.championship!.status,'standings');assert.equal(saved.races,1);assert.equal(saved.cash,10000+race.result!.reward);
    await f.economy.advance(f.a.id,{id:run.id,cursor:0,segments},true);assert.equal(f.db.cloud(f.a.id).save!.races,1);
    const next=f.start(true);assert.equal(next.condition,'sunset');assert.equal(next.initial!.riders[0].integrity,race.riders[0].integrity);
    assert.throws(()=>f.action('champRestart'));
  }finally{f.db.close();}
});
test('multiplayer ignores forged loadouts, reserves stock once and refunds only verified unused stock',()=>{
  const f=fixture(10000);try{
    f.action('nitro');f.action('nitro');
    const member=makeMember('Me',Date.now(),'brutal',{weaponId:'chain',kneePadId:'gold',nitro:5});
    f.economy.equipMember(f.a.id,member);assert.equal(member.bikeId,'ferro');assert.equal(member.weaponId,undefined);assert.equal(member.kneePadId,undefined);assert.equal(member.nitro,2);
    assert.throws(()=>f.economy.equipMember(f.a.id,makeMember('Clone',Date.now())));assert.throws(()=>f.start());
    f.economy.releaseMember(member,1);assert.equal(f.db.cloud(f.a.id).save!.nitro!.ferro,1);
    f.economy.releaseMember(member,0);assert.equal(f.db.cloud(f.a.id).save!.nitro!.ferro,1);
    const guest=makeMember('Guest',Date.now(),'brutal',{nitro:5,kneePadId:'gold'});f.economy.equipMember(undefined,guest);assert.equal(guest.bikeId,'ferro');assert.equal(guest.nitro,0);assert.equal(guest.kneePadId,undefined);
    const next=makeMember('Me',Date.now());f.economy.equipMember(f.a.id,next);f.economy.recoverMemoryRooms();assert.equal(f.db.cloud(f.a.id).save!.nitro!.ferro,1);f.economy.recoverMemoryRooms();assert.equal(f.db.cloud(f.a.id).save!.nitro!.ferro,1);
  }finally{f.db.close();}
});
