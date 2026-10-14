import type { MeasurementId } from '../measurements';

// Where the tape goes on a neutral dress form, in the figure's 200 x 420 coordinate space.
const ROUND: Partial<Record<MeasurementId, number>> = { waist: 150, full_hip: 208 };
const VERTICAL: Partial<Record<MeasurementId, [number, number]>> = {
  waist_to_hip: [150, 208],
  waist_to_knee: [150, 330],
  waist_to_floor: [150, 404],
};

// Places to tap, each with a marker and a label: the waist and hip bands, the side from waist to hip,
// and the knee and floor lines.
const SPOTS: { id: MeasurementId; at: [number, number]; label: string; hit: [number, number, number, number] }[] = [
  { id: 'waist', at: [100, 150], label: 'WAIST', hit: [30, 138, 140, 24] },
  { id: 'full_hip', at: [100, 208], label: 'HIP', hit: [30, 194, 140, 30] },
  { id: 'waist_to_hip', at: [176, 179], label: 'DEPTH', hit: [158, 140, 42, 78] },
  { id: 'waist_to_knee', at: [150, 330], label: 'KNEE', hit: [0, 312, 200, 36] },
  { id: 'waist_to_floor', at: [150, 404], label: 'FLOOR', hit: [0, 386, 200, 34] },
];

const NAMES: Record<MeasurementId, string> = {
  waist: 'waist',
  full_hip: 'full hip',
  waist_to_hip: 'waist to hip',
  waist_to_knee: 'waist to knee',
  waist_to_floor: 'waist to floor',
};

/** The dress form, with the tape where the chosen measurement goes. With `onPick`, each body part
 * can be tapped to show how to measure it. */
export function TapeFigure({ field, onPick }: { field: MeasurementId; onPick?: (id: MeasurementId) => void }) {
  const y = ROUND[field];
  const v = VERTICAL[field];
  return (
    <svg viewBox="0 0 200 420" role={onPick ? 'group' : 'img'} aria-label={`Dress form showing where to measure: ${NAMES[field]}`} className="figure">
      <path
        d="M86 40 L114 40 L116 60 Q150 66 156 82 Q162 112 150 140 Q140 158 142 176 Q160 200 154 232 L46 232 Q40 200 58 176 Q60 158 50 140 Q38 112 44 82 Q50 66 84 60 Z"
        style={{ fill: 'var(--fill)', stroke: 'var(--muted)' }}
        strokeWidth="1"
      />
      <line x1="100" y1="232" x2="100" y2="390" style={{ stroke: 'var(--muted)' }} strokeWidth="1.5" />
      <path d="M60 404 L100 390 L140 404" style={{ stroke: 'var(--muted)' }} strokeWidth="1.5" fill="none" />
      <line x1="10" y1="404" x2="190" y2="404" style={{ stroke: 'var(--line-strong)' }} strokeWidth="1" strokeDasharray="4 4" />
      <line x1="10" y1="330" x2="190" y2="330" style={{ stroke: 'var(--line-strong)' }} strokeWidth="1" strokeDasharray="4 4" />
      {!onPick && (
        <text x="12" y="325" fontSize="10" style={{ fill: 'var(--muted)', fontFamily: 'var(--mono)' }}>
          knee
        </text>
      )}
      {y !== undefined && <line x1="24" y1={y} x2="176" y2={y} style={{ stroke: 'var(--ink)' }} strokeWidth="2.5" strokeLinecap="round" />}
      {v && (
        <g style={{ stroke: 'var(--ink)' }} strokeWidth="2" fill="none">
          <line x1="176" y1={v[0]} x2="176" y2={v[1]} />
          <path d={`M168 ${v[0]} H184 M168 ${v[1]} H184`} />
        </g>
      )}
      {onPick &&
        SPOTS.map((s) => {
          const on = s.id === field;
          return (
            <g
              key={s.id}
              className={on ? 'spot on' : 'spot'}
              role="button"
              tabIndex={0}
              aria-label={`How to measure your ${NAMES[s.id]}`}
              aria-pressed={on}
              onClick={() => onPick(s.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPick(s.id);
                }
              }}
            >
              <rect x={s.hit[0]} y={s.hit[1]} width={s.hit[2]} height={s.hit[3]} className="spot-hit" />
              {!on && <circle cx={s.at[0]} cy={s.at[1]} r="9" className="spot-ring" />}
              <circle cx={s.at[0]} cy={s.at[1]} r="3.5" className="spot-dot" />
              <text x={s.at[0]} y={s.at[1] - 13} fontSize="9" textAnchor="middle">
                {s.label}
              </text>
            </g>
          );
        })}
    </svg>
  );
}
