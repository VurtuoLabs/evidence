import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary. A render error in one feature must not blank the
 * whole console silently - it surfaces a legible fallback with a reload path.
 * Data-fetch errors are handled per-query by the feature `QueryBoundary`; this
 * catches the unexpected.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("Evidence console crashed:", error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
          <div className="font-display text-2xl font-semibold">The console hit an unexpected error</div>
          <p className="max-w-md text-sm text-muted-foreground">{this.state.error.message}</p>
          <Button
            variant="brand"
            onClick={() => {
              this.reset();
              window.location.reload();
            }}
          >
            Reload the console
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
