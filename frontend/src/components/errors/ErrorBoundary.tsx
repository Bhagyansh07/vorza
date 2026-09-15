import { Component, type ErrorInfo, type ReactNode } from 'react';

import { ErrorState } from '@/components/errors/ErrorState';

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Generic render error boundary — shows branded fallback instead of a blank
 * screen when a subtree throws.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, info.componentStack);
  }

  private reset = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto w-full max-w-lg px-4 py-16">
          <ErrorState
            title="Something went wrong"
            error={this.state.error}
            onRetry={this.reset}
          />
        </div>
      );
    }
    return this.props.children;
  }
}