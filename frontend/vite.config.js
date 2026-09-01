import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  server: {
    host: '127.0.0.1',
    port: 5173,

    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
              priority: 30,
            },
            {
              name: 'calendar-vendor',
              test: /node_modules[\\/](react-big-calendar|date-fns)[\\/]/,
              priority: 25,
            },
            {
              name: 'charts-vendor',
              test: /node_modules[\\/](chart\.js|react-chartjs-2)[\\/]/,
              priority: 20,
            },
            {
              name: 'ui-vendor',
              test: /node_modules[\\/](lucide-react|sweetalert2)[\\/]/,
              priority: 15,
            },
            {
              name: 'vendor',
              test: /node_modules/,
              maxSize: 300000,
              priority: 10,
            },
          ],
        },
      },
    },
  },

  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true,
  },
});
