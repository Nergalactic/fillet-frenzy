import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages under /<repo>/.
// Three.js makes one ~500 KB bundle; that's expected, so raise the warning threshold.
export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 700 } });
