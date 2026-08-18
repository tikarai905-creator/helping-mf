// The reward side of the engine, shown back to the user: the same web data
// that defuses farming (BUILD_SPEC.md THE ENGINE) lit up as "people you've
// helped," not a leaderboard. Purely presentational — helpedCount is the
// exact number already shown in StatFace, just drawn instead of printed.
const MAX_DOTS = 10;

export default function TrackRecordWeb({ helpedCount }: { helpedCount: number }) {
  const shown = Math.min(helpedCount, MAX_DOTS);
  const overflow = helpedCount - shown;
  const center = 100;
  const outerR = 72;
  const dots = Array.from({ length: shown }, (_, i) => {
    const angle = (i / shown) * 2 * Math.PI - Math.PI / 2;
    return { x: center + outerR * Math.cos(angle), y: center + outerR * Math.sin(angle) };
  });

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <p className="text-sm font-medium text-ink">Your track record</p>
      <p className="mt-1 text-xs text-muted">
        {helpedCount === 0
          ? "Your web starts here — help someone and it lights up."
          : `You've helped ${helpedCount} ${helpedCount === 1 ? "person" : "people"}. Every dot is someone new.`}
      </p>

      <svg viewBox="0 0 200 200" className="mx-auto mt-4 h-44 w-44">
        {dots.map((d, i) => (
          <line
            key={`line-${i}`}
            x1={center}
            y1={center}
            x2={d.x}
            y2={d.y}
            className="stroke-border"
            strokeWidth={1.5}
          />
        ))}
        {dots.map((d, i) => (
          <circle key={`dot-${i}`} cx={d.x} cy={d.y} r={7} className="fill-teal" />
        ))}
        <circle cx={center} cy={center} r={16} className="fill-coral" />
        <text x={center} y={center + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">
          you
        </text>
      </svg>

      {overflow > 0 && <p className="mt-1 text-center text-xs text-muted">+{overflow} more</p>}
    </div>
  );
}
