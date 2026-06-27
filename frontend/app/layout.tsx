import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Manhwa Reader",
  description: "Baca manhwa dari Shinigami & Ikiru",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen">
        <nav className="sticky top-0 z-50 backdrop-blur border-b border-[var(--border)] bg-[var(--bg)]/80">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
            <Link href="/" className="font-bold text-lg text-[var(--accent)]">Manhwa</Link>
            <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">Home</Link>
            <Link href="/search" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">Search</Link>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
