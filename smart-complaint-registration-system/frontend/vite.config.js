import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During development the React app runs on :5173 and forwards API calls to the
// Express server on :5000, so there are no CORS problems.
export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1200 },
  server: {
    port: 5173,
    host: true, // also reachable from a phone on the same Wi-Fi (use the "Network" URL Vite prints)
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
      '/socket.io': { target: 'http://localhost:5000', ws: true },
    },
  },
});
