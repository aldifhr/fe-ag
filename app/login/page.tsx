"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/");
      } else {
        setError("Password salah");
      }
    } catch {
      setError("Gagal terhubung ke server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-(--color-bg) px-4">
      <div className="w-full max-w-sm bg-(--color-surface) rounded-2xl p-8 shadow-xl border border-(--color-border)">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-full bg-(--color-accent)/10 flex items-center justify-center mb-4">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-(--color-text)">Akses Terbatas</h1>
          <p className="text-sm text-(--color-text-muted) mt-1">
            Masukkan password untuk melanjutkan
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            placeholder="Password"
            autoFocus
            required
            className="w-full px-4 py-3 bg-(--color-bg) border border-(--color-border) rounded-lg text-(--color-text) placeholder-(--color-text-muted) focus:outline-none focus:border-(--color-accent) transition-colors mb-3"
          />

          {error && <p className="text-sm text-(--color-danger) mb-3">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-(--color-accent) text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Memeriksa..." : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}
