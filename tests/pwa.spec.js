import { expect, test } from '@playwright/test';

test('manifestとアイコンはGitHub Pagesサブパス相対で取得できる', async ({ request }) => {
  const manifestResponse = await request.get('./manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();

  expect(manifest.start_url).toBe('./');
  expect(manifest.scope).toBe('./');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: '192x192', purpose: 'any' }),
    expect.objectContaining({ sizes: '512x512', purpose: 'any' }),
    expect.objectContaining({ sizes: '512x512', purpose: 'maskable' })
  ]));

  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.ok(), icon.src).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
  }

  const engineResponse = await request.get('./survival-engine.js');
  expect(engineResponse.ok()).toBe(true);
  const workerSource = await (await request.get('./sw.js')).text();
  expect(workerSource).toContain("'./survival-engine.js'");
});

test('初回オンライン起動後、サブパスからオフラインで再起動できる', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const onlinePage = await context.newPage();
  await onlinePage.goto('http://127.0.0.1:4173/tabenai-to-shinu/?debug=1');
  await expect(onlinePage.locator('#sceneTitle')).toHaveText('少し温かいおにぎり');

  const scope = await onlinePage.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.scope;
  });
  expect(scope).toBe('http://127.0.0.1:4173/tabenai-to-shinu/');

  await onlinePage.reload();
  await expect.poll(() => onlinePage.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await onlinePage.close();
  await context.setOffline(true);

  const offlinePage = await context.newPage();
  await offlinePage.goto('http://127.0.0.1:4173/tabenai-to-shinu/?debug=1');
  await expect(offlinePage.locator('#sceneTitle')).toHaveText('少し温かいおにぎり');
  await expect(offlinePage.locator('#choices .choice')).toHaveCount(2);
  await context.close();
});

test('新版検出は自動適用せず、明示更新操作でskipWaitingする', async ({ page, request }) => {
  await page.goto('./');
  await expect(page.locator('#checkUpdateBtn')).toHaveText('更新を確認');
  await expect(page.locator('#applyUpdateBtn')).toHaveText('更新する');

  await expect.poll(() => page.evaluate(() => Boolean(globalThis.__TABENAI_PWA__))).toBe(true);
  const pwa = await page.evaluate(() => ({
    version: globalThis.__TABENAI_PWA__.version,
    scope: globalThis.__TABENAI_PWA__.scope
  }));
  expect(pwa.version).toBe('4.5.0');
  expect(pwa.scope.endsWith('/tabenai-to-shinu/')).toBe(true);

  const workerSource = await (await request.get('./sw.js')).text();
  expect(workerSource).toContain("event.data.type === 'SKIP_WAITING'");
  expect(workerSource).toContain('self.skipWaiting()');
  expect(workerSource).not.toMatch(/addEventListener\('install'[\s\S]{0,260}skipWaiting/);
});
