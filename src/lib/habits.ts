// RG-16 — "Mes références habituelles": products ordered in at least 2 distinct orders
// over the last 12 months (cancelled orders excluded), sorted by frequency, with last quantity.
export type HistoryLine = { order_id: string; created_at: string; status: string; product_id: string; quantity: number };
export type HabitualRef = { product_id: string; count: number; lastQuantity: number; lastOrderedAt: string };

export const HABIT_MIN_ORDERS = 2;
export const HABIT_WINDOW_MONTHS = 12;

export function habitualReferences(lines: HistoryLine[], now: Date = new Date()): HabitualRef[] {
  const since = new Date(now);
  since.setMonth(since.getMonth() - HABIT_WINDOW_MONTHS);
  const map = new Map<string, { orders: Set<string>; last: HistoryLine }>();
  for (const l of lines) {
    if (l.status === "cancelled" || new Date(l.created_at) < since) continue;
    const e = map.get(l.product_id) ?? { orders: new Set<string>(), last: l };
    e.orders.add(l.order_id);
    if (l.created_at > e.last.created_at) e.last = l;
    map.set(l.product_id, e);
  }
  return [...map.entries()]
    .filter(([, e]) => e.orders.size >= HABIT_MIN_ORDERS)
    .map(([product_id, e]) => ({ product_id, count: e.orders.size, lastQuantity: e.last.quantity, lastOrderedAt: e.last.created_at }))
    .sort((a, b) => b.count - a.count || b.lastOrderedAt.localeCompare(a.lastOrderedAt));
}
