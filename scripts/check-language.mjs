import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

// This catches writing systems, not whether Latin-script prose is good English.
const nonLatinLetter = /(?=\p{Letter})(?!\p{Script=Latin})[^]/u;
const decoder = new TextDecoder('utf-8', { fatal: true });
let failures = 0;
function inspect(label, bytes) {
  let text;
  try { text = typeof bytes === 'string' ? bytes : decoder.decode(bytes); } catch { return; }
  const match = nonLatinLetter.exec(text);
  if (!match) return;
  const line = text.slice(0, match.index).split('\n').length;
  console.error(`${label}:${line}: Use English for authored repository content`);
  failures++;
}
function git(args) {
  const result = spawnSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr.toString() || 'Git language audit failed');
  return result.stdout;
}
async function walk(directory = '.') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'dist', 'coverage', '.salticus', '.DS_Store'].includes(entry.name) || entry.name.endsWith('.log')) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

if (process.argv.includes('--history')) {
  const commits = git(['rev-list', '--all']).toString().trim().split('\n').filter(Boolean);
  const blobs = new Set();
  for (const commit of commits) {
    inspect(`commit ${commit}`, git(['show', '-s', '--format=%B', commit]));
    for (const record of git(['ls-tree', '-r', '-z', commit]).toString().split('\0').filter(Boolean)) {
      const [metadata, path] = record.split('\t');
      const [, type, oid] = metadata.split(' ');
      inspect(`${commit} path`, path);
      if (type !== 'blob' || blobs.has(oid)) continue;
      blobs.add(oid);
      inspect(`${commit}:${path}`, git(['cat-file', 'blob', oid]));
    }
  }
  console.log(`Audited ${commits.length} commits and ${blobs.size} unique blobs`);
} else {
  const listing = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  const files = listing.status === 0 ? [...new Set(listing.stdout.toString().split('\0').filter(Boolean))] : await walk();
  for (const path of files) {
    inspect('path', path);
    try { inspect(path, await readFile(path)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
if (failures) process.exit(1);
console.log('Repository language check passed');
