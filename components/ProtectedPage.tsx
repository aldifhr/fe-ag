"use client";

import { useState, useEffect, FormEvent, ReactNode } from "react";

function LoginModal({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        onLogin();
      } else {
        const msg = typeof json.error === "string" ? json.error : json.error?.message || null;
        setError(msg || "Incorrect password");
      }
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm bg-(--color-surface) rounded-2xl p-8 shadow-2xl border border-(--color-border) animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-full bg-(--color-accent)/10 flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-(--color-text)">Restricted Access</h1>
          <p className="text-sm text-(--color-text-muted) mt-1 text-center">
            Enter password to continue
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
            className="w-full py-3 bg-(--color-accent) text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Verifying..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ProtectedPage({ children }: { children: ReactNode }) {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    fetch("/api/reader/auth?action=status")
      .then((r) => r.json())
      .then((body) => {
        setAuthenticated(body?.data?.authenticated === true);
        setAuthChecked(true);
      })
      .catch(() => {
        setAuthenticated(false);
        setAuthChecked(true);
      });
  }, []);

  if (!authChecked) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="skeleton h-8 w-32 rounded" />
      </div>
    );
  }

  if (!authenticated) {
    return <LoginModal onLogin={() => window.location.reload()} />;
  }

  return <>{children}</>;
}
