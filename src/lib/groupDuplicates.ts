// Groups a newest-first list of posts by identical body text, so a run of
// repeated test posts collapses into one row with a "×N" count instead of
// N nearly-identical rows. Keeps the newest instance of each group to link
// to, since the input is already newest-first.
export interface DuplicateGroup<T> {
  item: T;
  count: number;
}

export function groupByBody<T extends { body: string }>(items: T[]): DuplicateGroup<T>[] {
  const groups = new Map<string, DuplicateGroup<T>>();
  const order: string[] = [];

  for (const item of items) {
    const key = item.body.trim().toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, { item, count: 1 });
      order.push(key);
    }
  }

  return order.map((key) => groups.get(key)!);
}
