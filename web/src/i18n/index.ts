import en from './en';
import es from './es';

export const languages = {
  en: 'English',
  es: 'Español',
};

export const defaultLang = 'en';

export type Lang = keyof typeof languages;

const translations = { en, es } as const;

export function getLangFromUrl(url: URL): Lang {
  const [, lang] = url.pathname.split('/');
  if (lang in languages) return lang as Lang;
  return defaultLang;
}

export function useTranslations(lang: Lang) {
  return translations[lang];
}

export function getLocalizedPath(path: string, lang: Lang): string {
  // Remove leading slash for consistency
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // For default language, don't add prefix
  if (lang === defaultLang) {
    return `/${cleanPath}`;
  }
  
  // For other languages, add prefix
  return `/${lang}/${cleanPath}`;
}

export function getAlternateUrls(currentPath: string, currentLang: Lang): { lang: Lang; url: string }[] {
  // Remove the language prefix from the current path
  let basePath = currentPath;
  
  for (const lang of Object.keys(languages) as Lang[]) {
    if (currentPath.startsWith(`/${lang}/`)) {
      basePath = currentPath.slice(lang.length + 1);
      break;
    } else if (currentPath === `/${lang}`) {
      basePath = '/';
      break;
    }
  }
  
  // Generate URLs for all languages
  return (Object.keys(languages) as Lang[]).map((lang) => ({
    lang,
    url: getLocalizedPath(basePath, lang),
  }));
}
