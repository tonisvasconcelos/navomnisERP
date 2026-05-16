import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AppErrorBoundary', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorFallbackView
          message={this.state.error.message}
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}

function ErrorFallbackView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 dark:bg-slate-950"
      role="alert"
    >
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Algo correu mal</h1>
      <p className="max-w-md text-center text-sm text-slate-600 dark:text-slate-400">{message}</p>
      <button
        type="button"
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        onClick={onRetry}
      >
        Tentar novamente
      </button>
    </div>
  );
}
