"use client";

import React from "react";
import ErrorIcon from "@/components/ErrorIcon";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class PageErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[PageErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 bg-(--color-bg) text-(--color-text)">
          <div className="w-14 h-14 rounded-full bg-(--color-surface) border border-(--color-border) flex items-center justify-center">
            <ErrorIcon size={28} />
          </div>
          <h1 className="text-lg font-semibold">Terjadi kesalahan</h1>
          <p className="text-sm text-(--color-text-muted) text-center max-w-md">
            {this.state.error?.message || "Terjadi kesalahan yang tidak terduga."}
          </p>
          <button
            onClick={this.handleReset}
            className="px-5 py-2 text-[13px] font-medium rounded-lg bg-(--color-accent) text-white hover:opacity-90 transition-opacity"
          >
            Coba Lagi
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
