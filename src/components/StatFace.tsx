import type { PublicStats } from "@/lib/database.types";

// The three numbers, read together as a "face" — a glanceable little widget,
// not a leaderboard. Each number gets its own small color cue so the three
// read as distinct at a glance; no checkmark/shield/verified iconography —
// facilitate, never vouch.
export default function StatFace({ stats, compact }: { stats: PublicStats; compact?: boolean }) {
  const items = [
    { label: "helped", value: stats.helped_count, dot: "bg-coral" },
    { label: "score", value: Math.round(stats.score), dot: "bg-ink/40" },
    { label: "got helped", value: stats.got_helped_count, dot: "bg-teal" },
  ];

  return (
    <div
      className={`inline-flex items-stretch divide-x divide-border rounded-2xl border border-border bg-surface shadow-soft ${
        compact ? "text-xs" : "text-sm"
      }`}
    >
      {items.map((item) => (
        <div key={item.label} className={`flex flex-col items-center gap-1 ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
          <span className="font-semibold text-ink">{item.value}</span>
          <span className="text-muted">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
