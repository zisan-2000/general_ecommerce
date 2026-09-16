import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import {
  defaultLocale,
  isAppLocale,
  localeCookieName,
} from "./config";
import { loadMessages } from "./messages";

export default getRequestConfig(async () => {
  const requestedLocale = (await cookies()).get(localeCookieName)?.value;
  const locale =
    requestedLocale && isAppLocale(requestedLocale)
      ? requestedLocale
      : defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
