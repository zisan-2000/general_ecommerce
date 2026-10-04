import { z } from "zod";
import { locales } from "@/i18n/config";

export const policyKinds = ["shipping", "returns", "privacy", "faq", "terms", "sitemap"] as const;
export type PolicyKind = (typeof policyKinds)[number];
export const policyLabels: Record<PolicyKind, string> = {
  shipping: "Shipping Policy", returns: "Return Policy", privacy: "Privacy Policy",
  faq: "FAQ", terms: "Terms of Service", sitemap: "Sitemap",
};

// Sitemap entries only accept local storefront paths, never executable or external URLs.
export const policyContentSchema = z.object({
  kind: z.enum(policyKinds),
  locale: z.enum(locales),
  title: z.string().trim().min(1).max(250),
  content: z.string().trim().max(100000),
  category: z.string().trim().max(100).default(""),
  linkUrl: z.string().trim().max(500).nullable().default(null),
  sortOrder: z.number().int().min(0).max(100000).default(0),
  isPublished: z.boolean().default(false),
  effectiveDate: z.iso.date().nullable().default(null),
}).superRefine((value, ctx) => {
  if (value.kind !== "sitemap" && !value.content) {
    ctx.addIssue({ code: "custom", path: ["content"], message: "Content is required" });
  }
  if (value.kind === "sitemap" && (!value.linkUrl || !/^\/ecommerce(?:\/[a-zA-Z0-9/_-]*)?(?:\?[^\s\\#]*)?$/.test(value.linkUrl))) {
    ctx.addIssue({ code: "custom", path: ["linkUrl"], message: "Use a local /ecommerce path" });
  }
});

export type PolicyContentInput = z.infer<typeof policyContentSchema>;
export type PolicyContentRecord = Omit<PolicyContentInput, "effectiveDate"> & {
  id: string; effectiveDate: string | null; createdAt: string; updatedAt: string;
};
