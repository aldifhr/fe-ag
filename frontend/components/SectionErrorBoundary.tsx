"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export default class SectionErrorBoundary extends React.Component<
  Props,
  State
> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-(--color-surface) border border-(--color-border)">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-text-muted)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
          <p className="text-[13px] text-(--color-text-muted) flex-1">
            Gagal memuat section ini.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-3 py-1 text-[12px] font-medium rounded bg-(--color-accent) text-white hover:opacity-90 transition-opacity"
          >
            Coba lagi
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
