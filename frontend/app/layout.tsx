import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import ThemeProvider from "@/components/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Manhwa Reader",
  description: "Baca manhwa dari Shinigami",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
        <ThemeProvider>
          <Nav />
          <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
