import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
const outdir = 'dist/extension';
await mkdir(outdir, { recursive: true });
await Promise.all([
  build({ entryPoints: ['extension/worker.mjs', 'extension/popup.mjs'], bundle: true, format: 'esm', outdir, entryNames: '[name]', target: 'chrome120' }),
  build({ entryPoints: ['extension/content.mjs'], bundle: true, format: 'iife', outdir, entryNames: '[name]', target: 'chrome120' }),
  ...['manifest.json', 'popup.html', 'popup.css'].map(file => copyFile(`extension/${file}`, `${outdir}/${file}`)),
]);
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const manifest = JSON.parse(await readFile(`${outdir}/manifest.json`, 'utf8'));
manifest.version = pkg.version;
await writeFile(`${outdir}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Chrome extension built: ${outdir}`);
