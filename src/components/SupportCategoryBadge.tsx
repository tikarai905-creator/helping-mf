import { SUPPORT_CATEGORY_LABELS } from "@/lib/config";
import type { SupportCategory } from "@/lib/database.types";

// Distinct per-category hues, same reasoning as CategoryBadge.tsx — this is
// an owner-only organizational tool, never shown to the user who sent it.
const COLORS: Record<SupportCategory, string> = {
  question: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  bug: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  suggestion: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  complaint: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

export default function SupportCategoryBadge({ category }: { category: SupportCategory }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[category]}`}>
      {SUPPORT_CATEGORY_LABELS[category]}
    </span>
  );
}
