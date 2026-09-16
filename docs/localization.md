# Localization

The storefront uses `next-intl`. English and Bengali are enabled for translated
UI copy, while database-managed product, category, banner and site content
remains unchanged.

## Structure

- `i18n/config.ts` defines supported app locales and the fallback locale.
- `i18n/request.ts` supplies the locale and messages for each request.
- `i18n/messages.ts` loads the locale message file.
- `messages/<locale>.json` contains all copy for a locale, grouped by namespace.
- The `storefront-locale` cookie stores the language selected in the header.

Components use a focused namespace, for example:

```tsx
const t = useTranslations("Landing.FlashSale");
return <h2>{t("title")}</h2>;
```

## Adding another language

1. Add its locale code to `locales` in `i18n/config.ts`.
2. Copy `messages/en.json` to `messages/<locale>.json` and translate
   values without changing keys or ICU placeholders.
3. Add a statically analyzable loader for it in `i18n/messages.ts`.
4. Add locale selection (URL prefix, cookie or account setting) at the request
   boundary in `i18n/request.ts`. If URL prefixes are chosen, merge the locale
   handling into the existing root `proxy.ts`; do not create a second proxy.
5. Update document language, canonical URLs, `hreflang`, sitemap entries and
   localized navigation together with the routing rollout.

Keep page/section copy grouped in clear namespaces. Do not move database content
into this file; localize that content at the data-model or CMS layer.
