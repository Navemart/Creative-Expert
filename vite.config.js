import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config. The dev server proxies /api/* to the Express server
// so the frontend can call fetch('/api/clients') without worrying about CORS.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const serverPort = env.PORT || '3001';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
