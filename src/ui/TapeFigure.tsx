import type { MeasurementId } from '../measurements';

// Where the tape goes on a neutral dress form, in the figure's 200 x 420 coordinate space.
const ROUND: Partial<Record<MeasurementId, number>> = { waist: 150, full_hip: 208 };
const VERTICAL: Partial<Record<MeasurementId, [number, number]>> = {
  waist_to_hip: [150, 208],
  waist_to_knee: [150, 330],
  waist_to_floor: [150, 404],
};

export function TapeFigure({ field }: { field: MeasurementId }) {
  const y = ROUND[field];
  const v = VERTICAL[field];
  return (
    <svg viewBox="0 0 200 420" role="img" aria-label={`Dress form showing where to measure: ${field.replace(/_/g, ' ')}`} className="figure">
      <path
        d="M86 40 L114 40 L116 60 Q150 66 156 82 Q162 112 150 140 Q140 158 142 176 Q160 200 154 232 L46 232 Q40 200 58 176 Q60 158 50 140 Q38 112 44 82 Q50 66 84 60 Z"
        style={{ fill: 'var(--fill)', stroke: 'var(--muted)' }}
        strokeWidth="1"
      />
      <line x1="100" y1="232" x2="100" y2="390" style={{ stroke: 'var(--muted)' }} strokeWidth="1.5" />
      <path d="M60 404 L100 390 L140 404" style={{ stroke: 'var(--muted)' }} strokeWidth="1.5" fill="none" />
      <line x1="10" y1="404" x2="190" y2="404" style={{ stroke: 'var(--line-strong)' }} strokeWidth="1" strokeDasharray="4 4" />
      <line x1="10" y1="330" x2="190" y2="330" style={{ stroke: 'var(--line-strong)' }} strokeWidth="1" strokeDasharray="4 4" />
      <text x="12" y="325" fontSize="10" style={{ fill: 'var(--muted)', fontFamily: 'var(--mono)' }}>knee</text>
      {y !== undefined && <line x1="24" y1={y} x2="176" y2={y} style={{ stroke: 'var(--ink)' }} strokeWidth="2.5" strokeLinecap="round" />}
      {v && (
        <g style={{ stroke: 'var(--ink)' }} strokeWidth="2" fill="none">
          <line x1="176" y1={v[0]} x2="176" y2={v[1]} />
          <path d={`M168 ${v[0]} H184 M168 ${v[1]} H184`} />
        </g>
      )}
    </svg>
  );
}
