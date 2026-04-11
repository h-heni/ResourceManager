import { useEffect, useState } from 'react';
import api from '../services/api';
import { DEFAULT_CURRENCY } from '../lib/currencyUtils';

interface CompanySettings {
    currency: string;
    currencySymbol: string;
}

const defaults: CompanySettings = { currency: DEFAULT_CURRENCY, currencySymbol: DEFAULT_CURRENCY };

// Module-level cache so every component shares the same value
// without needing a React Context provider.
let cached: CompanySettings | null = null;
let fetchPromise: Promise<CompanySettings> | null = null;

async function loadSettings(): Promise<CompanySettings> {
    if (cached) return cached;
    if (fetchPromise) return fetchPromise;

    fetchPromise = api
        .get('/Settings')
        .then((res) => {
            const d = res.data;
            cached = {
                currency: d.currency || defaults.currency,
                currencySymbol: d.currencySymbol || defaults.currencySymbol,
            };
            return cached;
        })
        .catch(() => {
            cached = defaults;
            return defaults;
        })
        .finally(() => {
            fetchPromise = null;
        });

    return fetchPromise;
}

/**
 * Returns the company currency settings.
 * First render may return the default ("TND") until the API responds.
 *
 * Usage:
 *   const { currency, currencySymbol } = useSettings();
 */
export function useSettings(): CompanySettings {
    const [settings, setSettings] = useState<CompanySettings>(cached ?? defaults);

    useEffect(() => {
        let cancelled = false;
        loadSettings().then((s) => {
            if (!cancelled) setSettings(s);
        });
        return () => { cancelled = true; };
    }, []);

    return settings;
}

/**
 * Invalidate the module-level cache (call after user updates settings).
 */
export function invalidateSettingsCache(): void {
    cached = null;
    sessionStorage.removeItem('company_branding');
}

/**
 * Seed the cache from external data (e.g. branding response) to avoid a separate /Settings call.
 */
export function seedSettingsCache(currency: string, currencySymbol: string): void {
    if (cached) return; // Don't overwrite if already loaded from /Settings
    cached = { currency: currency || defaults.currency, currencySymbol: currencySymbol || defaults.currencySymbol };
}
