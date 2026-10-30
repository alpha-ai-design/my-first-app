"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

// Catches a crash in one part of the page so the rest keeps working.
// Shows "Something went wrong. Please refresh." in place of the broken part.
type Props = {
  children: ReactNode;
  name?: string;
  compact?: boolean;
  // When this changes (e.g. the page URL), a failed boundary tries again. Children are NOT remounted,
  // so state above and below (like a started kitchen shift) survives navigation.
  resetKey?: string;
};

export default class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prev: Props) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Error in ${this.props.name ?? "a section"}:`, error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="alert"
        className={`mx-auto flex max-w-xl flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-xl bg-red-50 text-center text-red-800 ring-1 ring-red-200 ${
          this.props.compact ? "m-2 p-2" : "m-4 p-4"
        }`}
      >
        <p className="font-semibold">Something went wrong. Please refresh.</p>
        <button type="button" onClick={() => window.location.reload()} className="min-h-9 rounded-lg bg-red-700 px-4 font-bold text-white">
          Refresh
        </button>
      </div>
    );
  }
}
