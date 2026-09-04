import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class FallbackBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    fetch('/api/log-client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: error.message, stack: error.stack, componentStack: errorInfo.componentStack })
    });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex flex-col items-center justify-center p-10 h-full w-full bg-slate-50 text-slate-800">
          <h1 className="text-xl font-bold mb-4 text-red-600">Terjadi Kesalahan / Blank</h1>
          <p className="text-xs mb-4 bg-slate-200 p-4 rounded text-red-700 font-mono max-w-full overflow-hidden break-words">
            {this.state.error?.message}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow"
          >
            Coba Lagi (Muat Ulang Komponen)
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
