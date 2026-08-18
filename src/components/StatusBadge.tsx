import type { PostStatus } from "@/lib/database.types";

const STYLES: Record<PostStatus, string> = {
  open: "bg-teal/20 text-teal-hover",
  closed: "bg-ink/5 text-muted",
};

export default function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STYLES[status]}`}>
      {status}
    </span>
  );
}
