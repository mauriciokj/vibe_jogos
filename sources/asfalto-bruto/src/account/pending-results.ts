import type { ReplaySegment } from './protocol';
export interface PendingResult { id:string; account:string; segments:ReplaySegment[]; created:number; cursor?:number; finish?:boolean; abandon?:boolean; }
let connection:Promise<IDBDatabase>|undefined;
function database(){return connection ??=new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open('asfalto-ranking',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('pending',{keyPath:'id'});
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>{connection=undefined;reject(request.error);};
});}
export async function pendingResults(account:string):Promise<PendingResult[]>{
  const db=await database();return new Promise((resolve,reject)=>{const request=db.transaction('pending').objectStore('pending').getAll();request.onsuccess=()=>resolve(request.result.filter(r=>r.account===account).sort((a,b)=>a.created-b.created));request.onerror=()=>reject(request.error);});
}
export async function queueResult(result:PendingResult){
  const db=await database();
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('pending','readwrite');tx.objectStore('pending').put(result);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
  const all=await pendingResults(result.account);for(const old of all.slice(0,-3))await removeResult(old.id);
}
export async function removeResult(id:string){const db=await database();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('pending','readwrite');tx.objectStore('pending').delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
