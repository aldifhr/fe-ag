"use client";

import ErrorIcon from "@/components/ErrorIcon";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="bg-(--color-bg) text-(--color-text)">
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
          <div className="w-14 h-14 rounded-full bg-(--color-surface) border border-(--color-border) flex items-center justify-center">
            <ErrorIcon size={28} />
          </div>
          <h1 className="text-lg font-semibold">Terjadi Kesalahan</h1>
          <p className="text-sm text-(--color-text-muted) text-center max-w-md">
            {error.message || "Terjadi kesalahan yang tidak terduga."}
          </p>
          <button
            onClick={() => reset()}
            className="px-5 py-2 text-[13px] font-medium rounded-lg bg-(--color-accent) text-white hover:opacity-90 transition-opacity"
          >
            Coba Lagi
          </button>
        </div>
      </body>
    </html>
  );
}
