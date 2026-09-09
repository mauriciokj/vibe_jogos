import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  server: { proxy: { '/api/visitors': {target:process.env.VIBE_CATALOG_URL || 'http://127.0.0.1:4320'}, '/api/asfalto': {target:process.env.ASFALTO_SERVER_URL || 'http://127.0.0.1:4318',ws:true} } },
});
