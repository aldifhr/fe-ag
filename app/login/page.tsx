"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/reader/auth?action=login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const json = await res.json();
      if (json.success) {
        router.push(redirectTo);
      } else {
        const msg =
          typeof json.error === "string"
            ? json.error
            : json.error?.message || null;
        setError(msg || "Incorrect password");
      }
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-(--color-bg) px-4 overflow-hidden">
      {/* ── Background atmosphere ── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Gradient orbs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-(--color-accent) opacity-[0.05] blur-[140px]" />
        <div className="absolute -top-1/3 -right-1/4 w-[400px] h-[400px] rounded-full bg-(--color-accent) opacity-[0.03] blur-[100px]" />
        <div className="absolute -bottom-1/3 -left-1/4 w-[350px] h-[350px] rounded-full bg-(--color-accent) opacity-[0.025] blur-[80px]" />

        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--color-text) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* ── Login card ── */}
      <div
        className="relative w-full max-w-sm card-entrance"
        role="region"
        aria-label="Login form"
      >
        <div className="bg-(--color-surface) rounded-2xl p-8 shadow-2xl shadow-black/40 border border-(--color-border)">
          {/* Decorative top glow line */}
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-(--color-accent)/40 to-transparent" />

          {/* Icon */}
          <div className="flex flex-col items-center mb-6 pt-2">
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-(--color-accent-dim) to-transparent flex items-center justify-center ring-1 ring-inset ring-(--color-accent)/10 shadow-lg shadow-(--color-accent)/[0.06] mb-4">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                <circle
                  cx="12"
                  cy="17"
                  r="1.25"
                  fill="var(--color-accent)"
                  stroke="none"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-(--color-text) tracking-tight">
              Restricted Access
            </h1>
            <p className="text-sm text-(--color-text-muted) mt-1.5">
              Enter password to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-4">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-(--color-text-secondary) mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                autoFocus
                required
                aria-invalid={!!error}
                aria-describedby={error ? "login-error" : undefined}
                className="w-full px-4 py-2.5 bg-(--color-bg) border border-(--color-border) rounded-lg text-(--color-text) placeholder-(--color-text-muted)/40 transition-all duration-200
                  hover:border-(--color-border-hover)
                  focus:outline-none focus:border-(--color-accent) focus:ring-[3px] focus:ring-(--color-accent-dim) focus:ring-offset-0"
              />
            </div>

            {error && (
              <div
                id="login-error"
                role="alert"
                className="flex items-start gap-2.5 text-sm text-(--color-danger) mb-4 p-3 rounded-lg bg-(--color-danger)/[0.06] border border-(--color-danger)/[0.12]"
              >
                <svg
                  className="w-4 h-4 mt-0.5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="relative w-full py-2.5 bg-(--color-accent) text-white font-medium rounded-lg transition-all duration-200
                hover:bg-(--color-accent-hover) hover:shadow-lg hover:shadow-(--color-accent)/[0.15]
                active:scale-[0.97]
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent) focus-visible:ring-offset-2 focus-visible:ring-offset-(--color-surface)"
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Verifying...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes cardEntrance {
          0% {
            opacity: 0;
            transform: translateY(16px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .card-entrance {
          animation: cardEntrance 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
