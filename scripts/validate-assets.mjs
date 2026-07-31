import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'assets', 'manifest.json');
const assetsRoot = resolve(root, 'assets');

const ASSET_TYPES = ['background', 'character', 'art', 'effect', 'bgm', 'se'];
const ASSIGNMENT_GROUPS = ['screens', 'scenes', 'survival', 'categories', 'endings'];
const ROOT_FIELDS = ['schemaVersion', 'manifestVersion', 'budgets', 'assets', 'assignments', 'hooks', 'actions'];
const BUDGET_FIELDS = ['precacheBytes', 'presentationPrecacheBytes', 'lazyBytes'];
const REFERENCE_FIELDS = new Map([
  ['backgroundKey', 'background'],
  ['characterKey', 'character'],
  ['artKey', 'art'],
  ['moodKey', 'effect'],
  ['bgmKey', 'bgm'],
  ['seKey', 'se']
]);
const PRESENTATION_TYPES = new Set(['background', 'character', 'art', 'effect']);
const ASSET_FIELDS = {
  background: new Set(['src', 'mime', 'cache', 'alt', 'licenseId']),
  character: new Set(['src', 'mime', 'cache', 'fallback', 'alt', 'licenseId']),
  art: new Set(['src', 'mime', 'cache', 'alt', 'licenseId']),
  effect: new Set(['src', 'mime', 'cache', 'className', 'alt', 'licenseId']),
  bgm: new Set(['src', 'mime', 'cache', 'loop', 'label', 'licenseId']),
  se: new Set(['src', 'mime', 'cache', 'synth', 'label', 'licenseId'])
};
const MIME_BY_EXTENSION = new Map([
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.mp3', 'audio/mpeg'],
  ['.ogg', 'audio/ogg'],
  ['.wav', 'audio/wav'],
  ['.m4a', 'audio/mp4'],
  ['.aac', 'audio/aac']
]);
const ID_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/;
const LICENSE_PATTERN = /^[a-z0-9][a-z0-9.-]*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const SOURCE_PATTERN = /^\.\/assets\/[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const CORE_SHELL_FILES = [
  'index.html',
  'survival-engine.js',
  'presentation-engine.js',
  'manifest.webmanifest',
  'icons/favicon-32.png',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'assets/manifest.json'
];
const EXPECTED_SVG_DIMENSIONS = {
  background: [1600, 900],
  art: [800, 800]
};

const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
const toPosix = value => value.split(sep).join('/');

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function validateSvg(path, type, entryPath, fail) {
  const source = await readFile(path, 'utf8');
  const svgTag = source.match(/<svg\b([^>]*)>/i);
  if (!svgTag) {
    fail(`${entryPath}.src is not a recognizable SVG document.`);
    return;
  }

  const attribute = name => {
    const match = svgTag[1].match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
    return match ? match[1].trim() : null;
  };
  const width = Number(attribute('width'));
  const height = Number(attribute('height'));
  const viewBox = String(attribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    fail(`${entryPath}.src must declare positive numeric SVG width and height.`);
  }
  if (viewBox.length !== 4 || viewBox.some(value => !Number.isFinite(value))
    || viewBox[0] !== 0 || viewBox[1] !== 0 || viewBox[2] !== width || viewBox[3] !== height) {
    fail(`${entryPath}.src viewBox must be "0 0 width height" and match its dimensions.`);
  }
  const expected = EXPECTED_SVG_DIMENSIONS[type];
  if (expected && (width !== expected[0] || height !== expected[1])) {
    fail(`${entryPath}.src must be ${expected[0]}x${expected[1]}; received ${width}x${height}.`);
  }

  for (const tag of ['title', 'desc']) {
    const match = source.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    const text = match && match[1].replace(/<[^>]+>/g, '').trim();
    if (!text || !/[\u3040-\u30ff\u3400-\u9fff]/u.test(text)) {
      fail(`${entryPath}.src must contain a non-empty Japanese <${tag}>.`);
    }
  }

  if (/<(?:script|foreignObject|image|audio|video|font|font-face)\b/i.test(source)
    || /@(?:import|font-face)\b/i.test(source)
    || /\son[a-z]+\s*=/i.test(source)) {
    fail(`${entryPath}.src must not contain scripts, embedded fonts, active content, or external resource elements.`);
  }
  for (const match of source.matchAll(/(?:href|xlink:href|src)\s*=\s*["']([^"']+)["']/gi)) {
    if (!match[1].trim().startsWith('#')) {
      fail(`${entryPath}.src contains a non-local resource reference: ${match[1]}`);
    }
  }
  for (const match of source.matchAll(/url\(\s*([^)]+?)\s*\)/gi)) {
    const value = match[1].trim().replace(/^(["'])(.*)\1$/, '$2').trim();
    if (!value.startsWith('#')) fail(`${entryPath}.src contains an external CSS resource: ${value}`);
  }
}

async function main() {
  const errors = [];
  const warnings = [];
  const fail = message => errors.push(message);

  let manifest;
  let packageJson;
  let licenseIds = new Set();
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    const report = {
      ok: false,
      manifest: 'assets/manifest.json',
      errors: [`Unable to parse assets/manifest.json: ${error.message}`],
      warnings,
      counts: {},
      usageBytes: {},
      budgetsBytes: {},
      remainingBytes: {}
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.stderr.write(`${report.errors[0]}\n`);
    process.exitCode = 1;
    return;
  }

  try {
    packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  } catch (error) {
    fail(`Unable to parse package.json: ${error.message}`);
    packageJson = {};
  }
  try {
    const licenseLedger = await readFile(resolve(root, 'ASSET_LICENSES.md'), 'utf8');
    const licenseSection = licenseLedger.match(/^## License IDs\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/m);
    licenseIds = new Set(
      [...String(licenseSection && licenseSection[1] || '').matchAll(/^\|\s*`([^`]+)`\s*\|/gm)]
        .map(match => match[1])
    );
    if (!licenseIds.size) fail('ASSET_LICENSES.md does not define any license IDs.');
  } catch (error) {
    fail(`Unable to read ASSET_LICENSES.md: ${error.message}`);
  }

  if (!isObject(manifest)) {
    fail('Manifest root must be an object.');
    manifest = {};
  }

  for (const key of Object.keys(manifest)) {
    if (!ROOT_FIELDS.includes(key)) fail(`Unknown manifest field: ${key}`);
  }
  for (const key of ROOT_FIELDS) {
    if (!Object.hasOwn(manifest, key)) fail(`Missing manifest field: ${key}`);
  }

  if (manifest.schemaVersion !== 1) {
    fail(`schemaVersion must be 1; received ${JSON.stringify(manifest.schemaVersion)}.`);
  }
  if (typeof manifest.manifestVersion !== 'string' || !VERSION_PATTERN.test(manifest.manifestVersion)) {
    fail(`manifestVersion must be a semantic version; received ${JSON.stringify(manifest.manifestVersion)}.`);
  } else if (typeof packageJson.version === 'string') {
    const manifestRelease = manifest.manifestVersion.split(/[+-]/, 1)[0];
    if (manifestRelease !== packageJson.version) {
      fail(`manifestVersion release ${manifestRelease} does not match package version ${packageJson.version}.`);
    }
  }

  const budgets = isObject(manifest.budgets) ? manifest.budgets : {};
  if (!isObject(manifest.budgets)) fail('budgets must be an object.');
  for (const key of Object.keys(budgets)) {
    if (!BUDGET_FIELDS.includes(key)) fail(`Unknown budget field: budgets.${key}`);
  }
  for (const key of BUDGET_FIELDS) {
    if (!Number.isSafeInteger(budgets[key]) || budgets[key] < 0) {
      fail(`budgets.${key} must be a non-negative safe integer.`);
    }
  }

  const assets = isObject(manifest.assets) ? manifest.assets : {};
  if (!isObject(manifest.assets)) fail('assets must be an object.');
  for (const type of Object.keys(assets)) {
    if (!ASSET_TYPES.includes(type)) fail(`Unknown asset type: assets.${type}`);
  }

  const knownByType = new Map(ASSET_TYPES.map(type => [type, new Set()]));
  const typeById = new Map();
  const assetRows = [];
  const sourceRows = new Map();

  for (const type of ASSET_TYPES) {
    const group = assets[type];
    if (!isObject(group)) {
      fail(`assets.${type} must be an object.`);
      continue;
    }

    for (const [id, entry] of Object.entries(group)) {
      const entryPath = `assets.${type}.${id}`;
      knownByType.get(type).add(id);
      if (!ID_PATTERN.test(id) || !id.includes('.')) {
        fail(`${entryPath}: ID must be lowercase and namespaced.`);
      }
      if (typeById.has(id)) {
        fail(`${entryPath}: duplicate ID already declared as ${typeById.get(id)}.`);
      } else {
        typeById.set(id, type);
      }
      if (!isObject(entry)) {
        fail(`${entryPath} must be an object.`);
        assetRows.push({ id, type, src: null, cache: null, bytes: 0 });
        continue;
      }

      for (const key of Object.keys(entry)) {
        if (!ASSET_FIELDS[type].has(key)) fail(`${entryPath}: unknown field ${key}.`);
      }
      if (typeof entry.licenseId !== 'string' || !LICENSE_PATTERN.test(entry.licenseId)) {
        fail(`${entryPath}.licenseId must be a non-empty lowercase license identifier.`);
      } else if (!licenseIds.has(entry.licenseId)) {
        fail(`${entryPath}.licenseId is not registered in ASSET_LICENSES.md: ${entry.licenseId}`);
      }
      if (Object.hasOwn(entry, 'cache') && !['precache', 'lazy'].includes(entry.cache)) {
        fail(`${entryPath}.cache must be "precache" or "lazy".`);
      }

      const row = { id, type, src: null, cache: entry.cache || null, bytes: 0 };
      assetRows.push(row);
      const hasSource = typeof entry.src === 'string' && entry.src.length > 0;
      const sourceIsAbsent = entry.src === null || !Object.hasOwn(entry, 'src');
      if (!hasSource && !sourceIsAbsent) {
        fail(`${entryPath}.src must be a relative string or null.`);
        continue;
      }

      if (!hasSource) {
        const isSlot = (type === 'character' && typeof entry.fallback === 'string' && entry.fallback.length > 0)
          || (type === 'bgm' && entry.src === null)
          || (type === 'se' && isObject(entry.synth));
        const isEffect = type === 'effect' && typeof entry.className === 'string' && entry.className.length > 0;
        if (!isSlot && !isEffect) fail(`${entryPath} must define src, a supported slot, or an effect.`);
        if (Object.hasOwn(entry, 'mime')) fail(`${entryPath}.mime is only valid when src is present.`);
        continue;
      }

      row.src = entry.src;
      if (!['precache', 'lazy'].includes(entry.cache)) {
        fail(`${entryPath}: sourced assets must declare cache as "precache" or "lazy".`);
      }
      if (!SOURCE_PATTERN.test(entry.src)
        || entry.src.includes('..')
        || entry.src.includes('//')
        || entry.src.includes('\\')
        || entry.src.includes('?')
        || entry.src.includes('#')) {
        fail(`${entryPath}.src must be a clean relative ./assets/ path.`);
        continue;
      }

      const candidate = resolve(root, entry.src.slice(2).split('/').join(sep));
      const withinAssets = relative(assetsRoot, candidate);
      if (!withinAssets || withinAssets.startsWith(`..${sep}`) || withinAssets === '..') {
        fail(`${entryPath}.src resolves outside assets/.`);
        continue;
      }

      const extension = extname(candidate).toLowerCase();
      const expectedMime = MIME_BY_EXTENSION.get(extension);
      if (!expectedMime) {
        fail(`${entryPath}.src has unsupported extension ${extension || '(none)'}.`);
      } else if (entry.mime !== expectedMime) {
        fail(`${entryPath}.mime must be ${expectedMime} for ${extension}; received ${JSON.stringify(entry.mime)}.`);
      }

      try {
        const details = await stat(candidate);
        if (!details.isFile()) {
          fail(`${entryPath}.src does not point to a regular file: ${entry.src}`);
        } else {
          row.bytes = details.size;
          if (details.size === 0) fail(`${entryPath}.src is empty: ${entry.src}`);
          if (extension === '.svg') await validateSvg(candidate, type, entryPath, fail);
        }
      } catch (error) {
        fail(`${entryPath}.src does not exist: ${entry.src} (${error.code || error.message})`);
      }

      const previous = sourceRows.get(entry.src);
      if (previous) {
        if (previous.mime !== entry.mime || previous.cache !== entry.cache) {
          fail(`${entryPath}.src reuses ${entry.src} with conflicting MIME or cache policy.`);
        }
        previous.ids.push(id);
        previous.types.add(type);
        previous.bytes = Math.max(previous.bytes, row.bytes);
      } else {
        sourceRows.set(entry.src, {
          src: entry.src,
          mime: entry.mime,
          cache: entry.cache,
          bytes: row.bytes,
          ids: [id],
          types: new Set([type])
        });
      }
    }
  }

  try {
    const declaredSources = new Set(['./assets/manifest.json', ...sourceRows.keys()]);
    for (const path of await listFiles(assetsRoot)) {
      const source = `./assets/${toPosix(relative(assetsRoot, path))}`;
      if (!declaredSources.has(source)) fail(`Orphan delivery file is not declared in the manifest: ${source}`);
    }
  } catch (error) {
    fail(`Unable to enumerate assets/: ${error.message}`);
  }

  const referenced = new Set();
  const validateReference = (field, value, path) => {
    const expectedType = REFERENCE_FIELDS.get(field);
    if (!expectedType) {
      fail(`${path}: unknown reference field ${field}.`);
      return;
    }
    if (typeof value !== 'string') {
      fail(`${path} must be a string asset ID.`);
      return;
    }
    if (!knownByType.get(expectedType).has(value)) {
      const actualType = typeById.get(value);
      fail(actualType
        ? `${path} references ${value} as ${expectedType}, but it is declared as ${actualType}.`
        : `${path} references unknown ${expectedType} asset ${value}.`);
      return;
    }
    referenced.add(value);
  };

  const walkReferenceTree = (value, path) => {
    if (!isObject(value)) {
      fail(`${path} must be an object.`);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (isObject(child)) walkReferenceTree(child, childPath);
      else if (REFERENCE_FIELDS.has(key)) validateReference(key, child, childPath);
      else fail(`${childPath}: unknown assignment or hook field.`);
    }
  };

  const assignments = isObject(manifest.assignments) ? manifest.assignments : {};
  if (!isObject(manifest.assignments)) fail('assignments must be an object.');
  for (const key of Object.keys(assignments)) {
    if (!ASSIGNMENT_GROUPS.includes(key)) fail(`Unknown assignment group: assignments.${key}`);
  }
  for (const key of ASSIGNMENT_GROUPS) {
    if (!isObject(assignments[key])) fail(`assignments.${key} must be an object.`);
    else walkReferenceTree(assignments[key], `assignments.${key}`);
  }

  const hooks = isObject(manifest.hooks) ? manifest.hooks : {};
  if (!isObject(manifest.hooks)) fail('hooks must be an object.');
  for (const [name, hook] of Object.entries(hooks)) walkReferenceTree(hook, `hooks.${name}`);

  const actions = isObject(manifest.actions) ? manifest.actions : {};
  if (!isObject(manifest.actions)) fail('actions must be an object.');
  for (const [name, id] of Object.entries(actions)) validateReference('seKey', id, `actions.${name}`);

  for (const { id, type } of assetRows) {
    if (!referenced.has(id)) fail(`Unused asset ${id} (${type}) is not referenced by assignments, hooks, or actions.`);
  }

  const uniqueSources = [...sourceRows.values()];
  let coreShellBytes = 0;
  for (const path of CORE_SHELL_FILES) {
    try {
      const details = await stat(resolve(root, path));
      if (!details.isFile()) fail(`Application-shell path is not a regular file: ${path}`);
      else coreShellBytes += details.size;
    } catch (error) {
      fail(`Application-shell file does not exist: ${path} (${error.code || error.message})`);
    }
  }
  const presentationPrecacheBytes = uniqueSources
    .filter(item => item.cache === 'precache' && [...item.types].some(type => PRESENTATION_TYPES.has(type)))
    .reduce((sum, item) => sum + item.bytes, 0);
  const assetPrecacheBytes = uniqueSources
    .filter(item => item.cache === 'precache')
    .reduce((sum, item) => sum + item.bytes, 0);
  const assetBytes = uniqueSources.reduce((sum, item) => sum + item.bytes, 0);
  const usageBytes = {
    totalBytes: coreShellBytes + assetBytes,
    coreShellBytes,
    assetBytes,
    precacheBytes: coreShellBytes + assetPrecacheBytes,
    presentationPrecacheBytes,
    lazyBytes: uniqueSources.filter(item => item.cache === 'lazy').reduce((sum, item) => sum + item.bytes, 0)
  };
  for (const key of BUDGET_FIELDS) {
    if (Number.isSafeInteger(budgets[key]) && usageBytes[key] > budgets[key]) {
      fail(`${key} budget exceeded: ${usageBytes[key]} > ${budgets[key]} bytes.`);
    }
  }

  const byType = Object.fromEntries(ASSET_TYPES.map(type => {
    const rows = assetRows.filter(item => item.type === type);
    return [type, {
      assets: rows.length,
      sourcedAssets: rows.filter(item => item.src).length,
      bytes: rows.reduce((sum, item) => sum + item.bytes, 0)
    }];
  }));
  const budgetsBytes = Object.fromEntries(BUDGET_FIELDS.map(key => [key,
    Number.isSafeInteger(budgets[key]) ? budgets[key] : null
  ]));
  const remainingBytes = Object.fromEntries(BUDGET_FIELDS.map(key => [key,
    Number.isSafeInteger(budgets[key]) ? budgets[key] - usageBytes[key] : null
  ]));

  const report = {
    ok: errors.length === 0,
    manifest: 'assets/manifest.json',
    schemaVersion: manifest.schemaVersion ?? null,
    manifestVersion: manifest.manifestVersion ?? null,
    packageVersion: packageJson.version ?? null,
    counts: {
      assets: assetRows.length,
      referencedAssets: referenced.size,
      sourceFiles: uniqueSources.length,
      coreShellFiles: CORE_SHELL_FILES.length,
      precacheFiles: uniqueSources.filter(item => item.cache === 'precache').length,
      lazyFiles: uniqueSources.filter(item => item.cache === 'lazy').length,
      slotOrEffectAssets: assetRows.filter(item => !item.src).length
    },
    byType,
    usageBytes,
    budgetsBytes,
    remainingBytes,
    errors,
    warnings
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (errors.length) {
    process.stderr.write(`${errors.map(error => `Asset validation error: ${error}`).join('\n')}\n`);
    process.exitCode = 1;
  }
}

await main();
