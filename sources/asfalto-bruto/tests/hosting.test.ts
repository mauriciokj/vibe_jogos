import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore, RedisStore, storeFromEnvironment } from '../server/store';

test('a standalone production server uses memory only after explicit selection', async()=>{
  const store=storeFromEnvironment({NODE_ENV:'production',ASFALTO_STORE:'memory',REDIS_URL:'redis://unused.invalid'});
  assert.ok(store instanceof MemoryStore);assert.equal(store.shared,false);await store.close();
  assert.throws(()=>storeFromEnvironment({NODE_ENV:'production'}),/Configure o Redis/);
  assert.throws(()=>storeFromEnvironment({ASFALTO_STORE:'typo'}),/memory ou redis/);
  assert.throws(()=>storeFromEnvironment({ASFALTO_STORE:'redis'}),/Configure o Redis/);
});
test('Vercel never silently creates isolated memory rooms',async()=>{
  assert.throws(()=>storeFromEnvironment({VERCEL:'1',ASFALTO_STORE:'memory'}),/único servidor/);
  assert.throws(()=>storeFromEnvironment({VERCEL:'1'}),/Configure o Redis/);
  const store=storeFromEnvironment({VERCEL:'1',REDIS_URL:'redis://127.0.0.1:6398'});
  assert.ok(store instanceof RedisStore);await store.close();
});
