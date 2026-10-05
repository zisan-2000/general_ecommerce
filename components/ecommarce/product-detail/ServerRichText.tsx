import { sanitizeStorefrontHtml } from "@/lib/storefront-html";
export default function ServerRichText({ content }: { content: string }) {
  return <div className="product-rich-description mt-4 text-[13px] leading-7 text-muted-foreground sm:text-[14px]" dangerouslySetInnerHTML={{ __html: sanitizeStorefrontHtml(content) }} />;
}
