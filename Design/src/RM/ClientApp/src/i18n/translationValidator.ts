type TranslationTree = Record<string, unknown>;

export interface TranslationValidationResult {
  isValid: boolean;
  referenceLanguage: string;
  referenceKeyCount: number;
  missingByLanguage: Record<string, string[]>;
  extraByLanguage: Record<string, string[]>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectLeafKeys(node: unknown, prefix = ''): string[] {
  if (!isPlainObject(node)) {
    return prefix ? [prefix] : [];
  }

  const keys: string[] = [];

  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      keys.push(...collectLeafKeys(value, path));
    } else {
      keys.push(path);
    }
  }

  return keys;
}

export function validateTranslationResources(
  resources: Record<string, TranslationTree>,
  referenceLanguage = 'en'
): TranslationValidationResult {
  const reference = resources[referenceLanguage];

  if (!reference) {
    return {
      isValid: false,
      referenceLanguage,
      referenceKeyCount: 0,
      missingByLanguage: Object.fromEntries(Object.keys(resources).map((lang) => [lang, []])),
      extraByLanguage: Object.fromEntries(Object.keys(resources).map((lang) => [lang, []]))
    };
  }

  const referenceKeys = new Set(collectLeafKeys(reference));
  const missingByLanguage: Record<string, string[]> = {};
  const extraByLanguage: Record<string, string[]> = {};

  for (const [language, translations] of Object.entries(resources)) {
    if (language === referenceLanguage) continue;

    const languageKeys = new Set(collectLeafKeys(translations));

    missingByLanguage[language] = Array.from(referenceKeys)
      .filter((key) => !languageKeys.has(key))
      .sort();

    extraByLanguage[language] = Array.from(languageKeys)
      .filter((key) => !referenceKeys.has(key))
      .sort();
  }

  const hasMissing = Object.values(missingByLanguage).some((keys) => keys.length > 0);
  const hasExtra = Object.values(extraByLanguage).some((keys) => keys.length > 0);

  return {
    isValid: !(hasMissing || hasExtra),
    referenceLanguage,
    referenceKeyCount: referenceKeys.size,
    missingByLanguage,
    extraByLanguage
  };
}
