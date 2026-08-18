import { CATEGORY_LABELS } from "@/lib/config";
import type { PostCategory } from "@/lib/database.types";

// Distinct per-category hues, not the cream/ink/coral/teal chrome — these
// need to stay visually separable from each other at a glance, so they keep
// their own light/dark pairs instead of pulling from the shared tokens.
const COLORS: Record<PostCategory, string> = {
  repair: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  ride: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  yard: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  moving: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  talk: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  other: "bg-stone-200 text-stone-700 dark:bg-stone-700/40 dark:text-stone-300",
};

export default function CategoryBadge({ category }: { category: PostCategory }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[category]}`}>
      {CATEGORY_LABELS[category]}
    </span>
  );
}
