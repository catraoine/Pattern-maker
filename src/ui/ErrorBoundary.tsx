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

/**
 * The way out when a reload lands back here: the open designs' saved choices (pattern-maker:skirt, which holds every
 * garment's choices) and moved points go back to the defaults, so a choice the app no longer knows can't stop it
 * opening again. Measurements, people and kept patterns live in pattern-maker:account and stay; so does cm or inches.
 * Code health check, Nov 13: a removed option left in saved work crashed every visit, and Reload alone never fixed it.
 */
function resetDesigns() {
  try {
    const raw = localStorage.getItem('pattern-maker:skirt');
    const unit = raw ? (JSON.parse(raw) as { unit?: unknown }).unit : undefined;
    localStorage.setItem('pattern-maker:skirt', JSON.stringify(unit === undefined ? {} : { unit }));
    localStorage.removeItem('pattern-maker:point-edits');
  } catch {
    // Storage blocked or unreadable: the reload below is all that can be done.
  }
  flushReports();
  window.location.reload();
}

function CrashScreen() {
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
          <p className="small">Still here after a reload? A design choice saved by an older version of the app can stop it opening. Put your designs back to their standard choices: your measurements and the patterns you kept stay as they are.</p>
          <div className="stack">
            <button type="button" className="secondary" onClick={resetDesigns}>
              Reset my designs
            </button>
          </div>
          <p className="muted small">A short error report goes to us so we can fix it. It never includes your measurements, names or photos.</p>
        </section>
      </main>
    </div>
  );
}
