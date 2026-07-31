import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const path of ['index.html', 'manifest.webmanifest', 'sw.js']) {
  await cp(resolve(root, path), resolve(dist, path));
}
await cp(resolve(root, 'icons'), resolve(dist, 'icons'), { recursive: true });
await writeFile(resolve(dist, '.nojekyll'), '');

process.stdout.write(`Built static site in ${dist}\n`);
