import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  build: {
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/chunk-[name].js',
        assetFileNames: (assetInfo) => assetInfo.name?.endsWith('.css')
          ? 'assets/app.css'
          : 'assets/[name][extname]',
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true,
    restoreMocks: true,
  },
})
