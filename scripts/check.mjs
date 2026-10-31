import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const language = spawnSync(process.execPath, ['scripts/check-language.mjs'], { stdio: 'inherit' });
if (language.status !== 0) process.exit(language.status ?? 1);
for (const dir of ['shared', 'companion', 'extension', 'desktop', 'scripts', 'tests']) {
  for (const file of await readdir(dir)) {
    if (!/\.[mc]js$/.test(file)) continue;
    const result = spawnSync(process.execPath, ['--check', `${dir}/${file}`], { stdio: 'inherit' });
    if (result.status) process.exit(result.status);
  }
}
console.log('JavaScript syntax checks passed');
