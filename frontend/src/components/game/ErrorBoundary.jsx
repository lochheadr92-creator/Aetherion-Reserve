import { Component } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Catches render-time exceptions from the game screen so a bad frame or a
// corrupt save shows a recoverable panel instead of a blank white page (H3).
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (typeof console !== 'undefined') console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const message = (error && (error.message || String(error))) || 'Unknown error';
    return (
      <div data-testid="error-boundary" className="fixed inset-0 z-[300] flex items-center justify-center bg-[var(--bg-0)]/95 backdrop-blur-md p-6">
        <div className="max-w-lg w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-2xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-[var(--danger)] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[var(--text-1)]">Something went wrong</h2>
              <p className="mt-1 text-sm text-[var(--text-2)]">
                The facility view hit an unexpected error. Your last archived save is unaffected.
              </p>
              <pre data-testid="error-boundary-message" className="mt-3 max-h-32 overflow-auto rounded border border-[var(--line)] bg-black/30 p-2 text-xs text-[var(--text-2)] whitespace-pre-wrap break-words">
                {message}
              </pre>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button data-testid="error-boundary-retry" variant="outline" onClick={this.reset}>
              <RotateCcw className="h-4 w-4 mr-1.5" /> Try again
            </Button>
            <Button data-testid="error-boundary-home" onClick={() => { this.setState({ error: null }); if (this.props.onHome) this.props.onHome(); }}>
              <Home className="h-4 w-4 mr-1.5" /> Back to menu
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
