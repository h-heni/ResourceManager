import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localesDir = path.resolve(__dirname, '../src/i18n/locales');
const localeFiles = ['en.json', 'fr.json', 'de.json', 'ar.json'];

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectLeafKeys(node, prefix = '') {
  if (!isPlainObject(node)) {
    return prefix ? [prefix] : [];
  }

  const keys = [];

  for (const [key, value] of Object.entries(node)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      keys.push(...collectLeafKeys(value, fullPath));
    } else {
      keys.push(fullPath);
    }
  }

  return keys;
}

const locales = Object.fromEntries(
  localeFiles.map((fileName) => {
    const fullPath = path.join(localesDir, fileName);
    const raw = fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, '');
    const data = JSON.parse(raw);
    return [fileName.replace('.json', ''), data];
  })
);

const referenceLang = 'en';
const referenceKeys = new Set(collectLeafKeys(locales[referenceLang]));

let hasMismatch = false;

for (const [language, payload] of Object.entries(locales)) {
  if (language === referenceLang) continue;

  const localeKeys = new Set(collectLeafKeys(payload));
  const missing = Array.from(referenceKeys).filter((key) => !localeKeys.has(key));
  const extra = Array.from(localeKeys).filter((key) => !referenceKeys.has(key));

  if (missing.length || extra.length) {
    hasMismatch = true;
    console.error(`\n[i18n] Locale ${language} is not aligned with ${referenceLang}.`);
    if (missing.length) {
      console.error(`[i18n] Missing (${missing.length}):`);
      for (const key of missing) console.error(`  - ${key}`);
    }
    if (extra.length) {
      console.error(`[i18n] Extra (${extra.length}):`);
      for (const key of extra) console.error(`  - ${key}`);
    }
  }
}

if (hasMismatch) {
  process.exit(1);
}

console.log('[i18n] All locale files are key-complete and aligned with en.json.');
