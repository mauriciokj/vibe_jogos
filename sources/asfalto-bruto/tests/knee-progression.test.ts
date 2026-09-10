import test from 'node:test';
import assert from 'node:assert/strict';
import { AccountsDB } from '../server/accounts-db';
import { Economy } from '../server/economy';
import { KNEE_PADS } from '../src/game/equipment';
import { buyKneePad, freshSave, normalizeSave } from '../src/game/save';

test('new knee purchases require the previous colour even with enough money; rejection changes nothing',()=>{
  const save=freshSave();save.cash=100000;
  for(let index=0;index<KNEE_PADS.length;index++){
    for(const locked of KNEE_PADS.slice(index+1)){
      const before=structuredClone(save);
      assert.equal(buyKneePad(save,locked.id),false);
      assert.deepEqual(save,before);
    }
    const pad=KNEE_PADS[index],cash=save.cash;
    assert.equal(buyKneePad(save,pad.id),true);
    assert.equal(save.cash,cash-pad.price);
    assert.deepEqual(save.ownedKneePads,KNEE_PADS.slice(0,index+1).map(p=>p.id));
    assert.deepEqual(normalizeSave(JSON.parse(JSON.stringify(save))),save);
  }
  const cash=save.cash;buyKneePad(save,'white');buyKneePad(save,'gold');
  assert.equal(save.cash,cash);assert.equal(save.kneePadId,'gold');
});

test('old beta knee equipment stays owned and can be re-equipped for free without granting earlier tiers',()=>{
  for(const pad of KNEE_PADS){
    const save=normalizeSave({...freshSave(),cash:0,ownedKneePads:[pad.id],kneePadId:pad.id});
    delete save.kneePadId;assert.equal(buyKneePad(save,pad.id),true);
    assert.equal(save.kneePadId,pad.id);assert.equal(save.cash,0);
    assert.deepEqual(save.ownedKneePads,[pad.id]);
  }
});

test('account actions enforce knee progression atomically and replayed purchases are not charged twice',()=>{
  const db=new AccountsDB(':memory:'),account=db.login('knee-progression'),save=freshSave();save.cash=20000;
  db.save(account.id,0,save,'trusted-knee-seed');const economy=new Economy(db);
  const request=(item:string)=>({revision:db.cloud(account.id).revision,request:crypto.randomUUID(),action:{kind:'knee',item}});
  try{
    for(let index=0;index<KNEE_PADS.length;index++){
      for(const locked of KNEE_PADS.slice(index+1)){
        const before=db.cloud(account.id);
        assert.throws(()=>economy.action(account.id,request(locked.id)),/Compre a joelheira/);
        assert.deepEqual(db.cloud(account.id),before);
      }
      const pad=KNEE_PADS[index],cash=db.cloud(account.id).save!.cash,body=request(pad.id);
      economy.action(account.id,body);const after=db.cloud(account.id);
      assert.equal(after.save!.cash,cash-pad.price);assert.equal(after.save!.kneePadId,pad.id);
      economy.action(account.id,body);assert.deepEqual(db.cloud(account.id),after);
    }
  }finally{db.close();}
});
