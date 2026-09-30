import { getTranslations } from "next-intl/server";
import CatalogLink from "./CatalogLink";

export default async function ProductPagination({ page, perPage = 24, total, basePath }: {
  page: number; perPage?: number; total: number; basePath: string;
}) {
  const t = await getTranslations("StorefrontCatalog.page");
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])].filter((value) => value > 0 && value <= totalPages).sort((a, b) => a - b);
  const href = (value: number) => `${basePath}${basePath.includes("?") ? "&" : "?"}page=${value}`;
  return <div className="my-6 space-y-3 text-center">
    <p className="text-sm text-muted-foreground">{t("showingResults", { first: total ? (page - 1) * perPage + 1 : 0, last: Math.min(page * perPage, total), total })}</p>
    {totalPages > 1 ? <nav aria-label={t("pagination.label")} className="flex flex-wrap justify-center gap-2">
      {page > 1 ? <CatalogLink className="rounded-lg border px-3 py-2" href={href(page - 1)}>{t("pagination.previous")}</CatalogLink> : null}
      {pages.map((value) => <CatalogLink key={value} href={href(value)} aria-current={value === page ? "page" : undefined} className={`rounded-lg border px-3 py-2 ${value === page ? "bg-primary text-primary-foreground" : ""}`}>{value}</CatalogLink>)}
      {page < totalPages ? <CatalogLink className="rounded-lg border px-3 py-2" href={href(page + 1)}>{t("pagination.next")}</CatalogLink> : null}
    </nav> : null}
  </div>;
}
