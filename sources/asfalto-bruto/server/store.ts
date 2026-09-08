import Redis from 'ioredis';
import { secret, type Inputs, type Room, type StoredInput } from './room';

export class BusyRoom extends Error {}
export interface RoomStore {
  shared: boolean;
  create(room: Room): Promise<boolean>;
  read(code: string): Promise<Room | null>;
  mutate(code: string, change: (room: Room, inputs: Inputs) => void, retries?: number, localInputs?: Inputs): Promise<Room>;
  input(code: string, key: string, input: StoredInput): Promise<void>;
  close(): Promise<void>;
}
const clone = <T>(value: T): T => structuredClone(value);
export class MemoryStore implements RoomStore {
  shared = false;
  private rooms = new Map<string,Room>();
  private inputs = new Map<string,Inputs>();
  async create(room: Room) { if (this.rooms.has(room.code)) return false; this.rooms.set(room.code,clone(room)); return true; }
  async read(code: string) { return clone(this.rooms.get(code) ?? null); }
  async mutate(code: string, change: (room: Room, inputs: Inputs) => void, _retries?: number, localInputs: Inputs = {}) {
    const old = this.rooms.get(code); if (!old) throw new Error('Sala não encontrada ou encerrada.');
    const all=this.inputs.get(code) ?? {};
    for(const [key,input] of Object.entries(localInputs))if(!all[key] || all[key].seq<input.seq)all[key]=clone(input);
    this.inputs.set(code,all);
    const room = clone(old); change(room,clone(this.inputs.get(code) ?? {})); room.revision++;
    this.rooms.set(code,room); return clone(room);
  }
  async input(code: string, key: string, input: StoredInput) {
    const all = this.inputs.get(code) ?? {}; if (!all[key] || all[key].seq < input.seq) all[key] = clone(input); this.inputs.set(code,all);
  }
  async close() { this.rooms.clear(); this.inputs.clear(); }
  sweep(now: number) { for (const [id,r] of this.rooms) if (now-r.createdAt > 30*60_000) { this.rooms.delete(id); this.inputs.delete(id); } }
}

type RedisCommand = (...args: (string | number)[]) => Promise<unknown>;
const unquote = (s: string | undefined) => (s ?? '').trim().replace(/^['"]|['"]$/g,'');
export class RedisStore implements RoomStore {
  shared = true;
  private command: RedisCommand;
  private redis?: Redis;
  constructor(options: { url?: string; restUrl?: string; token?: string }) {
    if (options.url) {
      this.redis = new Redis(options.url,{ lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 4000, enableOfflineQueue: true });
      this.redis.on('error',()=>{});
      this.command = (...args) => this.redis!.call(args[0] as string,...args.slice(1));
    } else if (options.restUrl && options.token) {
      this.command = async (...args) => {
        const response = await fetch(options.restUrl!,{ method: 'POST', headers: { Authorization: `Bearer ${options.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(4000) });
        if (!response.ok) throw new Error('Não foi possível acessar as salas.');
        const data = await response.json() as { result: unknown; error?: string };
        if (data.error) throw new Error('O armazenamento das salas não respondeu.');
        return data.result;
      };
    } else throw new Error('Configure o Redis do multiplayer no servidor.');
  }
  private key(code: string, field: string) { return `asfalto:online:v3:{${code}}:${field}`; }
  async create(room: Room) { return await this.command('SET',this.key(room.code,'state'),JSON.stringify(room),'NX','EX',1800) === 'OK'; }
  async read(code: string) { const raw = await this.command('GET',this.key(code,'state')); return raw ? JSON.parse(raw as string) as Room : null; }
  async input(code: string, key: string, input: StoredInput) {
    await this.command('EVAL',`local old=redis.call('HGET',KEYS[1],ARGV[1]); if not old or cjson.decode(old).seq<tonumber(ARGV[2]) then redis.call('HSET',KEYS[1],ARGV[1],ARGV[3]); redis.call('EXPIRE',KEYS[1],1800); return 1 end; return 0`,1,this.key(code,'inputs'),key,input.seq,JSON.stringify(input));
  }
  async mutate(code: string, change: (room: Room, inputs: Inputs) => void, retries = 50, localInputs: Inputs = {}): Promise<Room> {
    const lock = this.key(code,'lock'), token = secret();
    let snapshot: [number,string,string[]] | undefined;
    for (let n=0;n<=retries;n++) {
      // One round trip acquires ownership, merges this instance's newest inputs
      // and reads a consistent room/input pair. No preliminary input-write wait.
      const result=await this.command('EVAL',`
        if not redis.call('SET',KEYS[1],ARGV[1],'NX','PX',4000) then return {0} end
        local room=redis.call('GET',KEYS[2])
        if not room then redis.call('DEL',KEYS[1]); return {-1} end
        for key,raw in pairs(cjson.decode(ARGV[2])) do
          local input=cjson.decode(raw)
          local old=redis.call('HGET',KEYS[3],key)
          if not old or cjson.decode(old).seq<input.seq then redis.call('HSET',KEYS[3],key,raw) end
        end
        redis.call('EXPIRE',KEYS[3],1800)
        return {1,room,redis.call('HGETALL',KEYS[3])}
      `,3,lock,this.key(code,'state'),this.key(code,'inputs'),token,JSON.stringify(Object.fromEntries(Object.entries(localInputs).map(([key,input])=>[key,JSON.stringify(input)])))) as [number,string,string[]];
      if(result[0]===-1)throw new Error('Sala não encontrada ou encerrada.');
      if(result[0]===1){snapshot=result;break;}
      if (n<retries) await new Promise(resolve => setTimeout(resolve,20));
    }
    if (!snapshot) throw new BusyRoom('Sala ocupada por um instante. Tente novamente.');
    let committed=false;
    try {
      const room=JSON.parse(snapshot[1]) as Room,entries=snapshot[2],inputs: Inputs = {};
      for (let i=0;i<entries.length;i+=2) inputs[entries[i]] = JSON.parse(entries[i+1]);
      change(room,inputs); room.revision++;
      // Fencing prevents a slow/expired owner from overwriting a newer room.
      const saved = await this.command('EVAL',`if redis.call('GET',KEYS[1])==ARGV[1] then redis.call('SET',KEYS[2],ARGV[2],'EX',1800); redis.call('DEL',KEYS[1]); return 1 end; return 0`,2,lock,this.key(code,'state'),token,JSON.stringify(room));
      if (saved !== 1) throw new BusyRoom('A sala está sincronizando. Tente novamente.');
      committed=true;
      return room;
    } finally {
      if(!committed)await this.command('EVAL',`if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end; return 0`,1,lock,token).catch(()=>{});
    }
  }
  async close() { this.redis?.disconnect(); }
}
export function storeFromEnvironment(): RoomStore {
  const url = unquote(process.env.ASFALTO_REDIS_URL || process.env.REDIS_URL || process.env.KV_URL);
  const restUrl = unquote(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);
  const token = unquote(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN);
  if (url || (restUrl && token)) return new RedisStore({url,restUrl,token});
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') throw new Error('O multiplayer precisa do Redis configurado.');
  return new MemoryStore();
}
