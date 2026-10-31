import { mkdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
await mkdir('dist/packages', { recursive: true });
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const output = resolve(`dist/packages/salticus-extension-${version}.zip`);
const result = spawnSync('zip', ['-qr', output, '.'], { cwd: 'dist/extension', stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Extension archive: ${output}`);
const source = resolve(`dist/packages/salticus-${version}-source.tar.gz`);
const archive = spawnSync('tar', ['-czf', source, 'README.md', 'LICENSE', 'package.json', 'package-lock.json',
  '.gitignore', 'companion', 'extension', 'scripts', 'shared', 'tests', 'docs', 'salticus.command'], { stdio: 'inherit' });
if (archive.status !== 0) process.exit(archive.status ?? 1);
console.log(`Source archive: ${source}`);
