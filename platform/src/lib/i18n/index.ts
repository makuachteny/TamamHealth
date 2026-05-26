/**
 * Lightweight i18n system for TamamHealth EMR.
 *
 * Design decisions (per pan-African research):
 *   - No heavy deps (next-i18next adds 40KB+). This is <2KB.
 *   - Translations are plain JSON objects loaded lazily per locale.
 *   - Supports RTL (Arabic, Amharic, Juba Arabic) via dir attribute on <html>.
 *   - Medical terms live in a separate namespace so clinicians can validate them.
 *
 * Locale tiers:
 *   - Tier 1 (pan-African): en, fr, ar, sw
 *   - Tier 2 (East Africa): am (Amharic), ha (Hausa), so (Somali), pt (Portuguese)
 *   - Tier 3 (South Sudan): apd (Juba Arabic), din (Dinka), nus (Nuer)
 */

export type Locale = 'en' | 'fr' | 'ar' | 'sw' | 'am' | 'ha' | 'so' | 'pt' | 'apd' | 'din' | 'nus';

export interface LocaleConfig {
  code: Locale;
  name: string;
  nativeName: string;
  dir: 'ltr' | 'rtl';
  region?: string;
}

export const SUPPORTED_LOCALES: LocaleConfig[] = [
  // Pan-African
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr', region: 'West & Central Africa' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl', region: 'North & East Africa' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', dir: 'ltr', region: 'East Africa' },
  // East African national languages
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ', dir: 'ltr', region: 'Ethiopia' },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa', dir: 'ltr', region: 'Nigeria & West Africa' },
  { code: 'so', name: 'Somali', nativeName: 'Soomaali', dir: 'ltr', region: 'Somalia & Horn of Africa' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', dir: 'ltr', region: 'Mozambique & Angola' },
  // South Sudan
  { code: 'apd', name: 'Juba Arabic', nativeName: 'عربي جوبا', dir: 'rtl', region: 'South Sudan' },
  { code: 'din', name: 'Dinka', nativeName: 'Thuɔŋjäŋ', dir: 'ltr', region: 'South Sudan' },
  { code: 'nus', name: 'Nuer', nativeName: 'Thok Naath', dir: 'ltr', region: 'South Sudan' },
];

export const DEFAULT_LOCALE: Locale = 'en';

// Flat key-value translations. Nested keys use dot notation: "nav.dashboard"
export type TranslationMap = Record<string, string>;

/**
 * Load translations for a locale. Returns English as fallback for missing keys.
 */
export async function loadTranslations(locale: Locale): Promise<TranslationMap> {
  const base = (await import('./locales/en')).default;
  if (locale === 'en') return base;

  try {
    const mod = await import(`./locales/${locale}`);
    // Merge: locale-specific overrides on top of English fallback
    return { ...base, ...mod.default };
  } catch {
    console.warn(`[i18n] Locale "${locale}" not found, falling back to English`);
    return base;
  }
}

/**
 * Simple interpolation: replaces {{key}} placeholders in a translated string.
 *   t('greeting', { name: 'Deng' }) => "Hello, Deng"
 */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? `{{${key}}}`));
}
