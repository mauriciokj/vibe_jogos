import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { normalizeSave } from '../src/game/save';
import { RANK_RULES, type Account, type CloudSave, type RankedRun } from '../src/account/protocol';
import type { RaceResult, SaveData } from '../src/game/types';
export const token = () => randomBytes(32).toString('base64url');
export const hash = (text: string) => createHash('sha256').update(text).digest('hex');
export class AccountsDB {
  db: DatabaseSync;
  constructor(path: string) {
    if(path !== ':memory:') mkdirSync(dirname(path), {recursive:true, mode:0o700});
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, subject TEXT UNIQUE NOT NULL, nickname TEXT NOT NULL, save TEXT, revision INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, account TEXT NOT NULL, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account);
      CREATE TABLE IF NOT EXISTS receipts(account TEXT NOT NULL, request TEXT NOT NULL, digest TEXT NOT NULL, revision INTEGER NOT NULL, PRIMARY KEY(account,request));
      CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, account TEXT NOT NULL, payload TEXT NOT NULL, created INTEGER NOT NULL, completed INTEGER NOT NULL DEFAULT 0);
      CREATE INDEX IF NOT EXISTS runs_account ON runs(account,created);
      CREATE TABLE IF NOT EXISTS results(race TEXT NOT NULL, account TEXT NOT NULL, mode TEXT NOT NULL, track TEXT NOT NULL, condition TEXT NOT NULL, bike TEXT NOT NULL, time REAL NOT NULL, place INTEGER NOT NULL, points INTEGER NOT NULL, rules INTEGER NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(race,account));
      CREATE INDEX IF NOT EXISTS results_board ON results(rules,mode,track,condition,account,time);`);
  }
  account(id: string): Account | null {
    const row=this.db.prepare('SELECT id,nickname FROM accounts WHERE id=?').get(id);
    return row ? row as unknown as Account : null;
  }
  login(subject: string, now=Date.now()) {
    this.db.prepare('INSERT OR IGNORE INTO accounts(id,subject,nickname,updated) VALUES(?,?,?,?)').run(token(),subject,`Piloto ${randomBytes(3).toString('hex').toUpperCase()}`,now);
    return this.db.prepare('SELECT id,nickname FROM accounts WHERE subject=?').get(subject) as unknown as Account;
  }
  cloud(id: string): CloudSave {
    const r=this.db.prepare('SELECT save,revision,updated FROM accounts WHERE id=?').get(id)!;
    return {save:r.save ? normalizeSave(JSON.parse(r.save as string)) : null, revision:Number(r.revision), updatedAt:Number(r.updated)};
  }
  save(id: string, revision: number, save: SaveData, request: string, now=Date.now()) {
    const serialized=JSON.stringify(normalizeSave(save)), digest=hash(`${revision}:${serialized}`);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const receipt=this.db.prepare('SELECT digest,revision FROM receipts WHERE account=? AND request=?').get(id,request);
      if(receipt) {
        if(receipt.digest!==digest) throw new Error('O identificador deste salvamento já foi usado.');
        this.db.exec('COMMIT'); return {ok:true, revision:Number(receipt.revision), cloud:this.cloud(id)};
      }
      const r=this.db.prepare('UPDATE accounts SET save=?,revision=revision+1,updated=? WHERE id=? AND revision=?').run(serialized,now,id,revision);
      if(!r.changes){this.db.exec('COMMIT');return {ok:false,cloud:this.cloud(id)};}
      this.db.prepare('INSERT INTO receipts VALUES(?,?,?,?)').run(id,request,digest,revision+1);
      // Retain the most recent receipts for each account, including retries after reload.
      this.db.prepare('DELETE FROM receipts WHERE account=? AND revision<?').run(id,revision-128);
      this.db.exec('COMMIT'); return {ok:true,revision:revision+1,cloud:this.cloud(id)};
    } catch(e) {this.db.exec('ROLLBACK');throw e;}
  }
  rename(id:string,name:string) {this.db.prepare('UPDATE accounts SET nickname=? WHERE id=?').run(name,id);}
  session(id: string, now=Date.now()) {
    const value=token(),csrf=token();
    this.db.prepare('DELETE FROM sessions WHERE expires<?').run(now);
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash(value),id,csrf,now+30*86400_000);
    return {value,csrf};
  }
  authenticate(value: string, now=Date.now()) {
    const row=this.db.prepare('SELECT account,csrf FROM sessions WHERE token=? AND expires>?').get(hash(value),now);
    return row ? {account:this.account(String(row.account))!, csrf:String(row.csrf)} : null;
  }
  logout(value: string) { this.db.prepare('DELETE FROM sessions WHERE token=?').run(hash(value)); }
  startRun(id:string,run:RankedRun,now=Date.now()) {
    this.db.prepare('DELETE FROM runs WHERE created<?').run(now-86400_000);
    const last=this.db.prepare('SELECT created FROM runs WHERE account=? ORDER BY created DESC LIMIT 1').get(id);
    if(last && now-Number(last.created)<5000)throw new Error('Aguarde alguns segundos para iniciar outra corrida.');
    this.db.prepare('INSERT INTO runs(id,account,payload,created) VALUES(?,?,?,?)').run(run.id,id,JSON.stringify(run),now);
  }
  run(id:string,account:string) {
    const r=this.db.prepare('SELECT * FROM runs WHERE id=? AND account=?').get(id,account);
    return r ? {run:JSON.parse(String(r.payload)) as RankedRun,created:Number(r.created),completed:!!r.completed} : null;
  }
  result(race:string,account:string,mode:'solo'|'multi',track:string,condition:string,bike:string,result:RaceResult,now=Date.now()) {
    if(result.reason!=='finish')return;
    const points=[25,18,15,12,10,8,6,4][result.place-1] ?? 0;
    this.db.prepare('INSERT OR IGNORE INTO results VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(race,account,mode,track,condition,bike,result.time,result.place,points,RANK_RULES,now);
  }
  ranking(mode:string,track:string,condition:string,order:string,me?:string) {
    const rows=this.db.prepare(`WITH best AS (
      SELECT *,ROW_NUMBER() OVER(PARTITION BY account ORDER BY time,created,race) AS n,
      COUNT(*) OVER(PARTITION BY account) AS races,SUM(points) OVER(PARTITION BY account) AS totalPoints
      FROM results WHERE rules=? AND mode=? AND track=? AND condition=?
    ), ranked AS (SELECT b.*,a.nickname,ROW_NUMBER() OVER(ORDER BY ${order==='points'?'totalPoints DESC,':' '}time,created,account) AS rank FROM best b JOIN accounts a ON a.id=b.account WHERE n=1)
    SELECT rank,nickname,bike AS bikeId,time,place,races,totalPoints AS points,account FROM ranked WHERE rank<=50 OR account=? ORDER BY rank`).all(RANK_RULES,mode,track,condition,me ?? '');
    return rows.map(r=>({rank:Number(r.rank),nickname:String(r.nickname),bikeId:String(r.bikeId),time:Number(r.time),place:Number(r.place),races:Number(r.races),points:Number(r.points),me:r.account===me}));
  }
  close(){this.db.close();}
}
