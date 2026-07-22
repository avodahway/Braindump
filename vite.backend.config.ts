import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist-server',
    emptyOutDir: true,
    ssr: 'src/server/nodeServerEntry.ts',
    rollupOptions: {
      output: {
        entryFileNames: 'nodeServer.js'
      }
    }
  }
});
