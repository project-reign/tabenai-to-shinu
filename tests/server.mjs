import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mountPath = '/tabenai-to-shinu/';
const port = Number(process.env.PORT || 4173);
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8'
};

function localPath(urlPath) {
  let pathname = decodeURIComponent(urlPath.split('?')[0]);
  if (pathname.startsWith(mountPath)) pathname = pathname.slice(mountPath.length);
  else pathname = pathname.replace(/^\/+/, '');
  if (!pathname || pathname.endsWith('/')) pathname += 'index.html';
  const candidate = resolve(root, pathname);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return null;
  return candidate;
}

const server = createServer(async (request, response) => {
  const path = localPath(request.url || '/');
  if (!path) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const fileStat = await stat(path);
    const filePath = fileStat.isDirectory() ? resolve(path, 'index.html') : path;
    const body = await readFile(filePath);
    const headers = {
      'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': filePath.endsWith('sw.js') ? 'no-cache' : 'no-store'
    };
    if (filePath.endsWith('sw.js')) headers['Service-Worker-Allowed'] = mountPath;
    response.writeHead(200, headers).end(body);
  } catch (_) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Test server: http://127.0.0.1:${port}${mountPath}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
