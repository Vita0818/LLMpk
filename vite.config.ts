import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // GitHub Actions publishes this repository at /LLMpk/. Local development
  // keeps the root path used by the existing localhost workflow.
  base: process.env.GITHUB_ACTIONS === 'true' ? '/LLMpk/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/openrouter': {
        target: 'https://openrouter.ai/api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openrouter/, ''),
      },
    },
  },
});
