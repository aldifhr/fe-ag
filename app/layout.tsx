import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";
import Nav from "@/components/Nav";
import ThemeProvider from "@/components/ThemeProvider";
import QueryProvider from "@/components/QueryProvider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Manhwa.agg",
  description: "An aggregator for manga/manhwa/manhua from various sources.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-bg text-text">
        <QueryProvider>
          <ThemeProvider>
            <Nav />
            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
              {children}
            </main>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
