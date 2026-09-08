const {DatabaseSync}=require('node:sqlite');
const {mkdirSync}=require('node:fs');
const path=require('node:path');
class SqliteStore {
  constructor(filename){
    mkdirSync(path.dirname(filename),{recursive:true});
    this.db=new DatabaseSync(filename);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS boards (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER);');
    this.select=this.db.prepare('SELECT value FROM boards WHERE key=? AND (expires_at IS NULL OR expires_at>?)');
    this.upsert=this.db.prepare('INSERT INTO boards(key,value,expires_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, expires_at=excluded.expires_at');
  }
  async get(key){const row=this.select.get(key,Date.now());return row?JSON.parse(row.value):null;}
  async set(key,value,options){this.upsert.run(key,JSON.stringify(value),options?.ex?Date.now()+options.ex*1000:null);}
  prune(){this.db.prepare('DELETE FROM boards WHERE expires_at IS NOT NULL AND expires_at<=?').run(Date.now());}
  close(){this.db.close();}
}
module.exports={SqliteStore};
