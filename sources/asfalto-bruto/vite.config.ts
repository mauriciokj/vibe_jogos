import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  server: { proxy: { '/api/asfalto': {target:process.env.ASFALTO_SERVER_URL || 'http://127.0.0.1:4318',ws:true} } },
});
