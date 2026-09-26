import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { Suspense } from "react";
import Header from "@/components/Header";
import "./globals.css";

const plex = IBM_Plex_Sans({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: { default: "CloudPulse", template: "%s · CloudPulse" },
  description: "Cloud cost root-cause intelligence",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plex.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <Suspense fallback={<div className="h-14 border-b border-line bg-surface" />}>
          <Header />
        </Suspense>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
