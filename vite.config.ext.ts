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
        offscreen: resolve(__dirname, 'src/offscreen/offscreen.html'),
        content: resolve(__dirname, 'src/content.ts'),
        background: resolve(__dirname, 'src/background.ts'),
        'main-world': resolve(__dirname, 'src/main-world.ts'),
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

        // Move HTML pages from dist/src/** to dist/ and fix asset paths
        const pages = [
          { from: 'src/popup/popup.html', to: 'popup.html', js: 'popup.js' },
          { from: 'src/offscreen/offscreen.html', to: 'offscreen.html', js: 'offscreen.js' },
        ];
        for (const page of pages) {
          const srcHtml = resolve(dist, page.from);
          const destHtml = resolve(dist, page.to);
          if (!existsSync(srcHtml)) continue;
          renameSync(srcHtml, destHtml);
          let html = readFileSync(destHtml, 'utf-8');
          html = html.replace(/href="(?:\.\.\/\.\.\/)?assets\//g, 'href="assets/');
          html = html.replace(/href="(?:\.\.\/\.\.\/)?chunks\//g, 'href="chunks/');
          html = html.replace(new RegExp(`src="(?:\\.\\.\\/\\.\\.\\/)?${page.js}"`, 'g'), `src="${page.js}"`);
          html = html.replace(/src="(?:\.\.\/)?icons\//g, 'src="icons/');
          writeFileSync(destHtml, html);
        }
        rmSync(resolve(dist, 'src'), { recursive: true, force: true });

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
