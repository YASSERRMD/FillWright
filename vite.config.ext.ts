import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, renameSync, rmSync } from 'fs';

export default defineConfig({
  base: '',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        content: resolve(__dirname, 'src/content.ts'),
        background: resolve(__dirname, 'src/background.ts'),
        offscreen: resolve(__dirname, 'src/offscreen/offscreen.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].[hash].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    target: 'esnext',
    minify: false,
    sourcemap: false,
  },
  plugins: [
    {
      name: 'copy-extension-files',
      closeBundle() {
        const dist = resolve(__dirname, 'dist');

        // Move popup.html from dist/src/popup/ to dist/
        const srcPopup = resolve(dist, 'src/popup/popup.html');
        const destPopup = resolve(dist, 'popup.html');
        if (existsSync(srcPopup)) {
          renameSync(srcPopup, destPopup);
          let html = readFileSync(destPopup, 'utf-8');
          html = html.replace(/href="(?:\.\.\/\.\.\/)?assets\//g, 'href="assets/');
          html = html.replace(/src="(?:\.\.\/\.\.\/)?popup\.js"/g, 'src="popup.js"');
          html = html.replace(/src="(?:\.\.\/)?icons\//g, 'src="icons/');
          writeFileSync(destPopup, html);
          rmSync(resolve(dist, 'src'), { recursive: true, force: true });
        }

        // Move offscreen.html to dist/
        const srcOffscreenHtml = resolve(__dirname, 'src/offscreen/offscreen.html');
        if (existsSync(srcOffscreenHtml)) {
          const html = readFileSync(srcOffscreenHtml, 'utf-8');
          writeFileSync(resolve(dist, 'offscreen.html'), html);
        }

        // offscreen.js is already at dist/offscreen.js from rollup output

        // Copy manifest.json
        const manifest = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf-8'));
        writeFileSync(resolve(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));

        // Copy icons
        const iconsDir = resolve(dist, 'icons');
        if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true });
        const srcIcons = resolve(__dirname, 'icons');
        if (existsSync(srcIcons)) {
          cpSync(srcIcons, iconsDir, { recursive: true });
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
