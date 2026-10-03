import { defineConfig } from 'vite';

export default defineConfig({
  // relative paths, so the build works both at a domain root and under /<repo>/ on GitHub Pages
  base: './',
  server: { host: '127.0.0.1', port: 5173, open: false },
});
