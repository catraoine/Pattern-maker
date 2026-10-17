import { Component, type ReactNode } from 'react';
import { flushReports, reportCrash } from '../report/report';

interface State {
  failed: boolean;
}

/** Catches a screen that fails to draw, reports it, and offers a reload. Saved work lives in the browser, so it's safe. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    reportCrash(error, 'render');
  }

  render() {
    return this.state.failed ? <CrashScreen /> : this.props.children;
  }
}

export function CrashScreen() {
  return (
    <div className="app">
      <main className="main">
        <section className="card crash" role="alert" aria-labelledby="crashtitle">
          <p className="eyebrow">Maison Tracé</p>
          <h1 id="crashtitle">Something went wrong.</h1>
          <p className="lead">Your work is saved on this device. Reloading the app usually puts things right.</p>
          <div className="stack">
            <button
              type="button"
              className="primary"
              onClick={() => {
                flushReports();
                window.location.reload();
              }}
            >
              Reload
            </button>
          </div>
          <p className="muted small">A short error report goes to us so we can fix it. It never includes your measurements, names or photos.</p>
        </section>
      </main>
    </div>
  );
}
