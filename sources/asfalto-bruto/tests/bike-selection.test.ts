import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountsDB} from '../server/accounts-db';
import {Economy} from '../server/economy';
import {BIKES} from '../src/game/bikes';
import {buyBike,freshSave,soloBikeStatus} from '../src/game/save';
import {newChampionship} from '../src/game/championship';

test('solo start keeps every owned model above zero; a broken purchase changes no balance, selection or stock',()=>{
  for(const bike of BIKES)for(const integrity of [0,.5,19,20,100]){
    const db=new AccountsDB(':memory:'),a=db.login('selection'),save=freshSave();save.cash=1000000;buyBike(save,bike.id);save.cash=15;save.condition[bike.id]=integrity;save.nitro={[bike.id]:2};
    db.save(a.id,0,save,'selection-fixture');const economy=new Economy(db),before=db.cloud(a.id);
    try{
      const start=()=>economy.start(a.id,{trackId:'costa',condition:'day',revision:before.revision});
      if(integrity===0&&bike.id!=='ferro'){
        assert.equal(soloBikeStatus(save).blocked,true);assert.throws(start,/moto equipada está em 0%/);
        assert.deepEqual(db.cloud(a.id),before);assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM economy_runs').get()!.n,0);
      }else{
        const run=start();assert.equal(run.initial!.riders[0].bikeId,bike.id);assert.equal(db.cloud(a.id).save!.bikeId,bike.id);
        assert.equal(run.initial!.riders[0].integrity,bike.id==='ferro'&&integrity<20?55:integrity);assert.equal(db.cloud(a.id).save!.cash,15);
      }
    }finally{db.close();}
  }
});

test('starter assistance in a free race does not repair the championship bike or permit a broken championship start',()=>{
  const db=new AccountsDB(':memory:'),a=db.login('champ'),save=freshSave();save.condition.ferro=0;save.championship=newChampionship(1);db.save(a.id,0,save,'champ-selection-fixture');
  const economy=new Economy(db),before=db.cloud(a.id);
  try{assert.throws(()=>economy.start(a.id,{trackId:'costa',condition:'day',championship:true,revision:before.revision}),/zerada/);assert.deepEqual(db.cloud(a.id),before);}finally{db.close();}
});
