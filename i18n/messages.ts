import type { AppLocale } from "./config";

const messageLoaders = {
  en: () => import("@/messages/en.json").then((module) => module.default),
  bn: () => import("@/messages/bn.json").then((module) => module.default),
} satisfies Record<AppLocale, () => Promise<Record<string, unknown>>>;

export async function loadMessages(locale: AppLocale) {
  return messageLoaders[locale]();
}

export type AppMessages = Awaited<
  ReturnType<(typeof messageLoaders)["en"]>
>;
