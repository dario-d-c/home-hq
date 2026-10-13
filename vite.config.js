import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// The wall tablet runs Android WebView 106 — keep JS output within Chromium 106.
// CSS targets chrome61 on purpose: the tablet's WebView rejects 4/8-digit hex colours (#0000,
// #ffffffbf) even though Chrome 106 should support them, and a newer target lets the minifier
// rewrite transparent/rgba() into that form. Verified on-device with CSS.supports().
export default defineConfig({
  build: {
    // Older iPads (iOS 12+) too: es2017 keeps the minifier from emitting ||=, ?. and ?? (a SyntaxError
    // before Safari 14 blanks the whole page).
    target: ['es2017', 'chrome61', 'safari12'],
    cssTarget: ['chrome61', 'safari12'],
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        edit: resolve(import.meta.dirname, 'edit/index.html'),
        sitter: resolve(import.meta.dirname, 'sitter/index.html'),
      },
    },
  },
  server: { host: true, proxy: { '/api': 'http://localhost:8787' } },
});
