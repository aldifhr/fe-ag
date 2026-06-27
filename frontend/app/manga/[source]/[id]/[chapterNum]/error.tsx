"use client";

import Link from "next/link";

export default function ReaderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0f] px-4">
      <div className="w-14 h-14 rounded-full bg-[#14141f] border border-[#27273a] flex items-center justify-center mb-5">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      </div>

      <h1 className="text-lg font-semibold text-[#e4e4e7] mb-1">Terjadi kesalahan</h1>
      <p className="text-sm text-[#71717a] mb-6 text-center max-w-md">
        {error.message || "Gagal memuat chapter. Periksa koneksi dan coba lagi."}
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-[#818cf8] text-white hover:bg-[#6366f1] transition-colors duration-150 cursor-pointer"
        >
          Coba Lagi
        </button>
        <Link
          href="/"
          className="px-4 py-2 text-sm font-medium rounded-lg bg-[#14141f] border border-[#27273a] text-[#a1a1aa] hover:text-[#e4e4e7] hover:border-[#3f3f55] transition-colors duration-150"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
