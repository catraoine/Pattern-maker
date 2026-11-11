import { TESTER_REPORT_URL } from '../testerReport';

/** For a fit tester: the one place their report goes, with the pattern code they'll need (tester journey, Nov 11). */
export function TesterReport({ lead = 'Fit tester?' }: { lead?: string }) {
  return (
    <div className="stack tester-report">
      <p className="small">
        {lead} Your report goes on the tester form. Have the pattern code from your PDF cover ready.
      </p>
      <a className="link" href={TESTER_REPORT_URL} target="_blank" rel="noopener noreferrer">
        Open the tester form ›
      </a>
    </div>
  );
}
