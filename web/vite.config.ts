import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      injectRegister: 'auto',
      // architecture.md line 690 + AR-27: SW installs but waits for clean
      // cold-start to activate. No mid-gig activation possible. Belt-and-
      // braces with the §A.2 deploy blackout (Story 1.6).
      workbox: {
        skipWaiting: false,
        clientsClaim: false,
        cacheId: 'gigbuddy',
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,woff2,webmanifest,png,svg,ico}'],
        globIgnores: ['index.html'],
        runtimeCaching: [
          // Order is load-bearing: more-specific NetworkOnly rules first.
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith('/api/v1/auth/'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname === '/api/v1/me',
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname === '/api/v1/health',
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url, request, sameOrigin }) =>
              sameOrigin &&
              request.method === 'GET' &&
              (url.pathname.startsWith('/api/v1/songs') ||
                url.pathname.startsWith('/api/v1/setlists')),
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache-v1' },
          },
          {
            urlPattern: ({ url, request, sameOrigin }) =>
              sameOrigin && request.method !== 'GET' && url.pathname.startsWith('/api/v1/'),
            handler: 'NetworkOnly',
          },
          // Navigations to / and SPA routes — owns /index.html delivery
          // (precache excludes index.html via globIgnores above).
          {
            urlPattern: ({ request, sameOrigin }) => sameOrigin && request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'app-shell-v1' },
          },
        ],
      },
      manifest: {
        name: 'GigBuddy',
        short_name: 'GigBuddy',
        description: 'Setlist and chord chart tool for gigging musicians.',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: '#1a1209',
        background_color: '#1a1209',
        orientation: 'portrait',
        icons: [
          { src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5273,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
