import type { AppLocale } from "@/i18n/config";
import enMessages from "@/messages/en.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: AppLocale;
    Messages: typeof enMessages;
  }
}
