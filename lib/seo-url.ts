type SeoEnvironment = {
  NODE_ENV?: string;
  NEXT_PUBLIC_BASE_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  SEO_ALLOW_LOCAL_ORIGIN?: string;
};

export function resolveSeoSiteUrl(env: SeoEnvironment): string {
  const configured = env.NEXT_PUBLIC_BASE_URL?.trim() || env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) {
    if (env.NODE_ENV === "production") throw new Error("Production SEO requires NEXT_PUBLIC_BASE_URL or NEXT_PUBLIC_SITE_URL with a public HTTPS origin.");
    return "http://localhost:3000";
  }
  let url: URL;
  try { url = new URL(configured); } catch {
    throw new Error("Invalid SEO site URL: configure a valid absolute origin.");
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname.replace(/\/+$/, "")) {
    throw new Error("SEO site URL must be an HTTP(S) origin without credentials, path, query or fragment.");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  const nonPublic = host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".test") || host.endsWith(".invalid") || /^169\.254\./.test(host) || host === "::1" || host === "0.0.0.0" || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || !host.includes(".");
  const localOriginAllowed = env.SEO_ALLOW_LOCAL_ORIGIN === "true" &&
    (host === "localhost" || host.endsWith(".localhost") || host === "::1" || /^127\./.test(host));
  if (env.NODE_ENV === "production" && !localOriginAllowed && (url.protocol !== "https:" || nonPublic)) {
    throw new Error("Production SEO site URL must use HTTPS and a public hostname.");
  }
  return url.origin;
}
