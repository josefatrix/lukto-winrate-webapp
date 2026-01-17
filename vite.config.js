import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  
  // Path aliases for cleaner imports
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@utils': resolve(__dirname, './src/utils'),
      '@constants': resolve(__dirname, './src/constants'),
      '@services': resolve(__dirname, './src/services'),
    },
  },
  
  build: {
    target: ['es2015', 'safari11', 'ios11'],
    cssTarget: ['safari11', 'ios11'],
    
    // Code splitting configuration
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'vendor-charts': ['recharts'],
          'vendor-utils': ['canvas-confetti'],
        },
      },
    },
    
    // Increase chunk size warning limit (already optimized)
    chunkSizeWarningLimit: 600,
  },
  
  // Development server configuration
  server: {
    port: 3000,
    open: true,
  },
  
  // Preview server configuration
  preview: {
    port: 4173,
  },
})
