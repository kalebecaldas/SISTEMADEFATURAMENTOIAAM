import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas pesadas em chunks próprios: elas quase nunca mudam, então
        // o cache do navegador sobrevive a cada deploy do app.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          pdf: ['jspdf', 'jspdf-autotable'],
          planilha: ['xlsx'],
          motion: ['framer-motion'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
})
