import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';

const root = process.cwd();
const mountPath = '/tabenai-to-shinu/';
const manifestPath = `${mountPath}assets/manifest.json`;
const failedAssetPath = `${mountPath}assets/cards/rice-ball.svg`;
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

let server;
let appUrl;
let failureMode = 'healthy';
let failureHits = { manifest: 0, asset: 0 };

function diskPath(requestUrl) {
  let pathname = decodeURIComponent(new URL(requestUrl || '/', 'http://127.0.0.1').pathname);
  if (!pathname.startsWith(mountPath)) return null;
  pathname = pathname.slice(mountPath.length);
  if (!pathname || pathname.endsWith('/')) pathname += 'index.html';
  const candidate = resolve(root, pathname);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return null;
  return candidate;
}

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
    if (failureMode === 'manifest-503' && pathname === manifestPath) {
      failureHits.manifest += 1;
      response.writeHead(503, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      }).end('{"error":"temporarily unavailable"}');
      return;
    }
    if (failureMode === 'asset-404' && pathname === failedAssetPath) {
      failureHits.asset += 1;
      response.writeHead(404, {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-store'
      }).end('');
      return;
    }

    const path = diskPath(request.url);
    if (!path) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    try {
      const details = await stat(path);
      const filePath = details.isDirectory() ? resolve(path, 'index.html') : path;
      const body = await readFile(filePath);
      const headers = {
        'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
        'Cache-Control': filePath.endsWith('sw.js') ? 'no-cache' : 'no-store'
      };
      if (filePath.endsWith('sw.js')) headers['Service-Worker-Allowed'] = mountPath;
      response.writeHead(200, headers).end(body);
    } catch (_) {
      response.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
      }).end('Not found');
    }
  });

  await new Promise((resolveListen, rejectListen) => {
    const onError = error => rejectListen(error);
    server.once('error', onError);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', onError);
      const address = server.address();
      appUrl = `http://127.0.0.1:${address.port}${mountPath}`;
      resolveListen();
    });
  });
});

test.afterAll(async () => {
  if (!server) return;
  await new Promise(resolveClose => server.close(resolveClose));
});

async function activateFirstWorker(page) {
  await page.evaluate(async () => {
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Service Worker did not activate after core precache')), 12_000);
    });
    await Promise.race([navigator.serviceWorker.ready, timeout]);
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__));
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

async function expectOfflineCore(context, expectedManifestStatus) {
  await context.setOffline(true);
  const page = await context.newPage();
  await page.goto(`${appUrl}?debug=1`);
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__));
  await expect.poll(() => page.evaluate(async () => {
    const engine = globalThis.__TABENAI_PRESENTATION__;
    if (!engine) return null;
    await engine.ready;
    return engine.snapshot().manifestStatus;
  })).toBe(expectedManifestStatus);
  await expect(page.locator('#sceneTitle')).not.toBeEmpty();
  await expect(page.locator('#sceneText')).not.toBeEmpty();
  await expect(page.locator('#sceneIcon')).toBeVisible();
  await expect(page.locator('#sceneIcon')).not.toBeEmpty();
  await expect(page.locator('#choices .choice')).toHaveCount(2);
  await expect(page.locator('#choiceA')).toBeVisible();
  await expect(page.locator('#choiceB')).toBeVisible();
  return page;
}

test('初回installでasset manifestが503でもcore shellがactivateしoffline再起動できる', async ({ browser }) => {
  failureMode = 'manifest-503';
  failureHits = { manifest: 0, asset: 0 };
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  await page.goto(`${appUrl}?debug=1`);
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__));
  await activateFirstWorker(page);

  expect(failureHits.manifest).toBeGreaterThan(0);
  const cacheState = await page.evaluate(async () => {
    const names = await caches.keys();
    const coreName = names.find(name => name === 'tabenai-to-shinu-core-4.8.0');
    const indexUrl = new URL('./index.html', location.href).href;
    const manifestUrl = new URL('./assets/manifest.json', location.href).href;
    return {
      names,
      coreHasIndex: coreName ? Boolean(await (await caches.open(coreName)).match(indexUrl)) : false,
      manifestCached: Boolean(await caches.match(manifestUrl))
    };
  });
  expect(cacheState.names).toContain('tabenai-to-shinu-core-4.8.0');
  expect(cacheState.coreHasIndex).toBe(true);
  expect(cacheState.manifestCached).toBe(false);

  await page.close();
  const offlinePage = await expectOfflineCore(context, 'fallback');
  await offlinePage.close();
  await context.close();
});

test('presentation precacheのSVG 1枚が404でもcoreをactivateし404を保存しない', async ({ browser }) => {
  failureMode = 'asset-404';
  failureHits = { manifest: 0, asset: 0 };
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  await page.goto(`${appUrl}?debug=1`);
  await page.waitForFunction(() => Boolean(globalThis.__TABENAI_DEBUG__));
  await activateFirstWorker(page);

  expect(failureHits.asset).toBeGreaterThan(0);
  const cacheState = await page.evaluate(async () => {
    const failedUrl = new URL('./assets/cards/rice-ball.svg', location.href).href;
    const healthyUrl = new URL('./assets/backgrounds/forest-day.svg', location.href).href;
    return {
      names: await caches.keys(),
      failedCached: Boolean(await caches.match(failedUrl)),
      healthyCached: Boolean(await caches.match(healthyUrl))
    };
  });
  expect(cacheState.names).toContain('tabenai-to-shinu-core-4.8.0');
  expect(cacheState.names).toContain('tabenai-to-shinu-presentation-4.8.0');
  expect(cacheState.failedCached).toBe(false);
  expect(cacheState.healthyCached).toBe(true);

  await page.close();
  const offlinePage = await expectOfflineCore(context, 'ready');
  expect(await offlinePage.evaluate(async () => {
    const failedUrl = new URL('./assets/cards/rice-ball.svg', location.href).href;
    return Boolean(await caches.match(failedUrl));
  })).toBe(false);
  await offlinePage.close();
  await context.close();
});
