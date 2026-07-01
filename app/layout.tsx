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
  description: "Dashboard for monitoring manhwa from discord",
  manifest: "/manifest.json",
  other: {
    "theme-color": "#0a0a0f",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
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
          <script
            dangerouslySetInnerHTML={{
              __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}`,
            }}
          />
      </body>
    </html>
  );
}
