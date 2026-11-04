import { useSyncExternalStore } from "react";

export type CartLine = { product_id: string; sku: string; name: string; pack_size: number; quantity: number };

const KEY = "promaint-cart";
let lines: CartLine[] = [];
let loaded = false;
const subs = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    lines = JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    lines = [];
  }
}
function save(next: CartLine[]) {
  lines = next;
  localStorage.setItem(KEY, JSON.stringify(lines));
  subs.forEach((f) => f());
}

export const cart = {
  add(l: CartLine) {
    load();
    const ex = lines.find((x) => x.product_id === l.product_id);
    save(ex ? lines.map((x) => (x === ex ? { ...x, quantity: x.quantity + l.quantity } : x)) : [...lines, l]);
  },
  setQty(id: string, q: number) {
    load();
    save(q <= 0 ? lines.filter((x) => x.product_id !== id) : lines.map((x) => (x.product_id === id ? { ...x, quantity: q } : x)));
  },
  clear() {
    save([]);
  },
};

const EMPTY: CartLine[] = [];
export function useCart() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => {
      load();
      return lines;
    },
    () => EMPTY,
  );
}
