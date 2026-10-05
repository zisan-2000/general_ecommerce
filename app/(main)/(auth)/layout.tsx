import type { Metadata } from "next";
export const metadata: Metadata = { robots: { index: false, follow: false, googleBot: { index: false, follow: false } } };
// Estiak

import Footer from "@/components/ecommarce/footer";
import Header from "@/components/ecommarce/header";
import React from "react"; // Explicitly import React if needed for older versions

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex-grow flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-card text-card-foreground rounded-xl shadow-2xl border border-border">
          {children}
        </div>
        
      </main>
      
      {/* 5. Footer: Stays at the bottom */}
      <Footer />
      
    </div>
  );
};

export default AuthLayout;
