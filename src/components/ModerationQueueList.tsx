"use client";

import { useState } from "react";
import ModerationItem from "@/components/ModerationItem";
import type { ModerationQueueItem } from "@/lib/queries";

export default function ModerationQueueList({
  initialItems,
}: {
  initialItems: ModerationQueueItem[];
}) {
  const [items, setItems] = useState(initialItems);

  function handleDismiss(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div>
      <p className="text-sm font-medium text-ink">
        {items.length} pending
      </p>

      <div className="mt-3 flex flex-col gap-3">
        {items.length === 0 && (
          <p className="text-sm text-muted">Nothing flagged right now.</p>
        )}
        {items.map((item) => (
          <ModerationItem key={item.id} item={item} onDismiss={handleDismiss} />
        ))}
      </div>
    </div>
  );
}
