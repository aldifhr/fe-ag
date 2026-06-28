"use client";

import React from "react";
import ErrorIcon from "./ErrorIcon";

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
          <span style={{ color: "var(--color-text-muted)" }}><ErrorIcon size={16} /></span>
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
