import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: process.env.PORT,
    allowedHosts: [
      '0071328835d1.ngrok-free.app',
      '4149daca23eb.ngrok-free.app'

    ]
  },
  plugins: [react()],
  optimizeDeps: {
    exclude: [
      "react-force-graph-vr",
      "react-force-graph-ar",
      "aframe"
    ]
  },
  build: {
    rollupOptions: {
      external: ["react-force-graph-vr", "react-force-graph-ar", "aframe"]
    }
  }
});


