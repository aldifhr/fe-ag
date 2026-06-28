"use client";

import { useState } from "react";
import Link from "next/link";
import { checkConnection } from "@/lib/connection";
import ErrorIcon from "./ErrorIcon";

function classifyError(message: string): "network" | "timeout" | "server" {
  const m = message.toLowerCase();
  if (m.includes("timeout") || m.includes("abort")) return "timeout";
  if (
    m.includes("network") ||
    m.includes("fetch") ||
    m.includes("econnrefused") ||
    m.includes("failed to fetch")
  )
    return "network";
  if (m.includes("500") || m.includes("server")) return "server";
  return "server";
}

const ERROR_MESSAGES = {
  network:
    "Tidak dapat terhubung ke server. Pastikan backend berjalan di localhost:3000",
  timeout: "Permintaan timeout. Server mungkin sedang lambat",
  server: "Server sedang mengalami masalah",
};

export default function ErrorView({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [connStatus, setConnStatus] = useState<{
    backend: boolean;
    shinigami: boolean;
  } | null>(null);
  const [checking, setChecking] = useState(false);

  const type = classifyError(error.message || "");
  const message = error.message || "";

  async function testConnection() {
    setChecking(true);
    const result = await checkConnection();
    setConnStatus(result);
    setChecking(false);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-(--color-bg) px-4">
      <div className="w-14 h-14 rounded-full bg-(--color-surface) border border-(--color-border) flex items-center justify-center mb-5" style={{ color: "var(--color-accent)" }}>
        <ErrorIcon size={24} />
      </div>

      <h1 className="text-lg font-semibold text-(--color-text) mb-1">
        Terjadi kesalahan
      </h1>
      <p className="text-sm text-(--color-text-secondary) mb-2 text-center max-w-md">
        {ERROR_MESSAGES[type]}
      </p>
      {message && (
        <p className="text-[11px] text-(--color-text-muted) mb-6 text-center max-w-md break-all">
          {message}
        </p>
      )}

      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={reset}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-(--color-accent) text-white hover:bg-(--color-accent-hover) transition-colors duration-150 cursor-pointer"
        >
          Coba Lagi
        </button>
        <button
          onClick={testConnection}
          disabled={checking}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-(--color-surface) border border-(--color-border) text-(--color-text-secondary) hover:text-(--color-text) hover:border-(--color-border-hover) transition-colors duration-150 cursor-pointer disabled:opacity-50"
        >
          {checking ? "Menguji..." : "Test koneksi"}
        </button>
      </div>

      {connStatus && (
        <div className="w-full max-w-sm rounded-lg bg-(--color-surface) border border-(--color-border) p-4 text-center">
          <p className="text-[12px] text-(--color-text-secondary) mb-3 font-medium uppercase tracking-wider">
            Status Koneksi
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-(--color-text-secondary)">Backend</span>
              <span
                className={
                  connStatus.backend ? "text-emerald-400" : "text-red-400"
                }
              >
                {connStatus.backend ? "Terhubung" : "Tidak terhubung"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-(--color-text-secondary)">Shinigami</span>
              <span
                className={
                  connStatus.shinigami ? "text-emerald-400" : "text-red-400"
                }
              >
                {connStatus.shinigami ? "Online" : "Offline"}
              </span>
            </div>
          </div>
          {!connStatus.backend && (
            <p className="text-[11px] text-red-400/70 mt-3">
              Pastikan backend berjalan: npm run dev
            </p>
          )}
          {connStatus.backend && !connStatus.shinigami && (
            <p className="text-[11px] text-yellow-400/70 mt-3">
              Shinigami sedang tidak tersedia
            </p>
          )}
        </div>
      )}

      <Link
        href="/"
        className="text-[12px] text-(--color-text-secondary) mt-6 hover:text-(--color-text-muted) underline underline-offset-2 decoration-(--color-border) hover:decoration-(--color-text-muted) transition-colors duration-150"
      >
        Kembali ke Beranda
      </Link>
    </div>
  );
}
