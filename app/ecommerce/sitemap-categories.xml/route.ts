import { NextResponse } from "next/server";
import sitemap from "@/app/sitemap";
const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
export async function GET() {
  const entries = (await sitemap()).filter((entry) => new URL(entry.url).searchParams.has("category"));
  const urls = entries.map((entry) => `<url><loc>${escapeXml(entry.url)}</loc></url>`).join("");
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, { headers: { "Content-Type": "application/xml" } });
}
