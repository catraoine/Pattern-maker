import { IN_TESTING, TESTING_TOOLS, type TestingTool } from '../launch';

/** The quiet "In testing" chip beside a tool that is usable but frozen until the fit gate (docs/SHIP-LIST.md). Every
 *  tag names its tool in the registry (launch.ts), so none can be forgotten; the chip's tooltip says what takes it off. */
export function TestingTag({ tool }: { tool: TestingTool }) {
  return (
    <span className="testing-tag chip" title={`Comes off when ${TESTING_TOOLS[tool].proof}.`}>
      {IN_TESTING}
    </span>
  );
}
