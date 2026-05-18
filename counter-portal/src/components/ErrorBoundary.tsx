import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Counter portal render failure:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-background px-8 text-center text-foreground">
          <div className="max-w-lg space-y-3">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="text-foreground-muted">
              Please reload the counter portal. If it persists, contact your administrator.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
