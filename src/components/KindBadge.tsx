import { KIND_LABELS } from "@/lib/config";
import type { PostKind } from "@/lib/database.types";

// Deliberately subtle — the category pill (CategoryBadge) is the colorful
// signal on a card; kind is secondary context, not another headline color.
export default function KindBadge({ kind }: { kind: PostKind }) {
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted">
      {KIND_LABELS[kind]}
    </span>
  );
}
