import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: `npm run dev` (port 5173) proxies API calls to the zero-dep server on 3210.
// Prod: `npm run build` -> dist/ is served directly by app/server.js.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3210',
      '/resumes': 'http://localhost:3210',
    },
  },
});
