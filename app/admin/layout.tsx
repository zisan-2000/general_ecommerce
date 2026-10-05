import type { Metadata } from "next";
import type { ReactNode } from "react";
import ClientLayout from "./ClientLayout";
export const metadata: Metadata = { robots: { index: false, follow: false, googleBot: { index: false, follow: false } } };
export default function Layout({ children }: { children: ReactNode }) { return <ClientLayout>{children}</ClientLayout>; }
