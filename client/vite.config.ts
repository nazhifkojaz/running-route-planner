import { defineConfig } from 'vite';

export default defineConfig({
  base: '/running-route-planner/',
  server: {
    proxy: {
      '/auth': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/me': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/routes': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
