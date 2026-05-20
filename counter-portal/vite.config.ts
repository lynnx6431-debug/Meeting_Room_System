import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174, // distinct from guest-kiosk (5173)
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // E4-07: Socket.IO handshake + transport. ws:true upgrades the proxy
      // to WebSocket so EventSource/polling-to-ws transitions both work.
      '/socket.io': {
        target: 'ws://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
