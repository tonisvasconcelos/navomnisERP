import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Navomnis ERP',
        short_name: 'Navomnis',
        description: 'ERP enterprise multi-tenant',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        lang: 'pt-BR',
        display: 'standalone',
        start_url: '/',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2,jpg,jpeg,webp}'],
        globIgnores: ['**/login/**'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_API ?? 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }
          if (id.includes('@tanstack')) {
            return 'tanstack';
          }
          if (id.includes('react-router')) {
            return 'router';
          }
          if (id.includes('framer-motion')) {
            return 'motion';
          }
          if (id.includes('i18next') || id.includes('react-i18next')) {
            return 'i18n';
          }
          if (id.includes('@sentry')) {
            return 'sentry';
          }
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }
          return 'vendor';
        },
      },
    },
  },
});
