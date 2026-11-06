import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// The editable HTML lives in web/. The root index.html is a generated,
// self-contained file:// release, so it must not become Vite's input again.
export default defineConfig({
  root: fileURLToPath(new URL('./web', import.meta.url)),
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  // Relative URLs work both at username.github.io and at /repository-name/.
  base: './',
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 800,
    // Fonts are small enough to inline; pictures and OGG stay lazy in dist/.
    assetsInlineLimit: 100000,
    modulePreload: false,
    rollupOptions: { output: { codeSplitting: false } },
  },
});
