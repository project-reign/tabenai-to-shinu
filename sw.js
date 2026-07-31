'use strict';

const APP_VERSION = '4.6.0';
const CACHE_PREFIX = 'tabenai-to-shinu-';
const CORE_CACHE_NAME = `${CACHE_PREFIX}core-${APP_VERSION}`;
const PRESENTATION_CACHE_NAME = `${CACHE_PREFIX}presentation-${APP_VERSION}`;
const ACTIVE_CACHE_NAMES = new Set([CORE_CACHE_NAME, PRESENTATION_CACHE_NAME]);
const SCOPE_URL = new URL('./', self.registration.scope);
const OFFLINE_DOCUMENT = new URL('./index.html', SCOPE_URL).href;
const ASSET_ROOT_URL = new URL('./assets/', SCOPE_URL).href;
const ASSET_MANIFEST_URL = new URL('./assets/manifest.json', SCOPE_URL).href;
const CORE_URLS = [
  './',
  './index.html',
  './survival-engine.js',
  './presentation-engine.js',
  './manifest.webmanifest',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
].map(path => new URL(path, SCOPE_URL).href);
const CORE_URL_SET = new Set([...CORE_URLS, ASSET_MANIFEST_URL]);

function collectPrecacheUrls(manifest) {
  const urls = new Set();
  const assets = manifest && typeof manifest.assets === 'object' ? manifest.assets : {};
  for (const group of Object.values(assets)) {
    if (!group || typeof group !== 'object') continue;
    for (const entry of Object.values(group)) {
      if (!entry || entry.cache !== 'precache' || typeof entry.src !== 'string') continue;
      const url = new URL(entry.src, SCOPE_URL);
      if (url.origin === SCOPE_URL.origin && url.href.startsWith(ASSET_ROOT_URL)) {
        urls.add(url.href);
      }
    }
  }
  return [...urls];
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const manifestResponse = await fetch(ASSET_MANIFEST_URL, { cache: 'no-store' });
    if (!manifestResponse.ok) throw new Error(`Asset manifest request failed: ${manifestResponse.status}`);
    const manifest = await manifestResponse.clone().json();
    const precacheUrls = collectPrecacheUrls(manifest);
    const [coreCache, presentationCache] = await Promise.all([
      caches.open(CORE_CACHE_NAME),
      caches.open(PRESENTATION_CACHE_NAME)
    ]);
    await Promise.all([
      coreCache.addAll(CORE_URLS),
      coreCache.put(ASSET_MANIFEST_URL, manifestResponse),
      precacheUrls.length ? presentationCache.addAll(precacheUrls) : Promise.resolve()
    ]);
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter(name => name.startsWith(CACHE_PREFIX) && !ACTIVE_CACHE_NAMES.has(name))
        .map(name => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== SCOPE_URL.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CORE_CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(OFFLINE_DOCUMENT, response.clone());
        return response;
      } catch (_) {
        return (await cache.match(OFFLINE_DOCUMENT))
          || (await cache.match(new URL('./', SCOPE_URL).href))
          || Response.error();
      }
    })());
    return;
  }

  if (!requestUrl.href.startsWith(SCOPE_URL.href)) return;
  event.respondWith((async () => {
    const isManifest = requestUrl.href === ASSET_MANIFEST_URL;
    const isPresentationAsset = !isManifest && requestUrl.href.startsWith(ASSET_ROOT_URL);
    const primaryCacheName = isPresentationAsset ? PRESENTATION_CACHE_NAME : CORE_CACHE_NAME;
    const secondaryCacheName = isPresentationAsset ? CORE_CACHE_NAME : PRESENTATION_CACHE_NAME;
    const [primaryCache, secondaryCache] = await Promise.all([
      caches.open(primaryCacheName),
      caches.open(secondaryCacheName)
    ]);
    const cached = (await primaryCache.match(request))
      || (await secondaryCache.match(request));
    if (cached) return cached;
    const response = await fetch(request);
    if (response.status === 200 && (isPresentationAsset || CORE_URL_SET.has(requestUrl.href))) {
      await primaryCache.put(request, response.clone());
    }
    return response;
  })());
});
