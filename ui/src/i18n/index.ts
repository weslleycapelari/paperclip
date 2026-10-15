import i18n, { type InitOptions, type TOptions } from "i18next";
import { initReactI18next, useTranslation as useReactI18nextTranslation } from "react-i18next";

import { DEFAULT_LOCALE, i18nextResources, supportedLocales } from "./locales";

function getInitialLocale(): string {
  if (typeof window !== "undefined" && window.localStorage) {
    const saved = window.localStorage.getItem("paperclip_locale");
    if (saved && supportedLocales.includes(saved)) {
      return saved;
    }
    if (typeof process !== "undefined" && (process.env?.VITEST || process.env?.NODE_ENV === "test")) {
      return "en";
    }
    if (supportedLocales.includes("pt-BR")) {
      return "pt-BR";
    }
  }
  return DEFAULT_LOCALE;
}

const initialLocale = getInitialLocale();

const i18nextOptions: InitOptions = {
  resources: i18nextResources,
  lng: initialLocale,
  fallbackLng: "en",
  supportedLngs: supportedLocales,
  defaultNS: "translation",
  interpolation: { escapeValue: false },
  returnObjects: false,
  initAsync: false,
};

void i18n.use(initReactI18next).init(i18nextOptions).catch((error: unknown) => {
  console.error("Failed to initialize i18next", error);
});

export function changeLocale(locale: string) {
  if (supportedLocales.includes(locale)) {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("paperclip_locale", locale);
    }
    return i18n.changeLanguage(locale);
  }
}

export function t(key: string, options: TOptions = {}) {
  return i18n.t(key, options);
}

export const useTranslation = useReactI18nextTranslation;
export { i18n };
