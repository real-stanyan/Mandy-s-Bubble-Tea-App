// components/home/helpers.ts
import type { OrderHistoryItem, OrderHistoryLine } from '@/store/orders';

export type YourUsualItem = {
  key: string;
  itemId: string;
  variationId: string;
  name: string;
  variationName?: string;
  modifiers: { id: string; name: string; listName: string; priceCents: number }[];
  size?: string;
  subtitle: string;
  priceCents: number;
  imageUrl?: string;
  count: number;
};

// @verification
// Given two orders each with one "Brown Sugar Milk Tea | L | 50% sugar | less ice",
// returns that item with count=2. Ties broken by latest order (first in the array
// — orders store is newest-first per store/orders.ts).
export function computeYourUsual(orders: OrderHistoryItem[]): YourUsualItem | null {
  const groups = new Map<string, { item: YourUsualItem; latestIndex: number }>();
  for (let idx = 0; idx < orders.length; idx++) {
    const order = orders[idx];
    if (order.state === 'CANCELED') continue;
    for (const line of order.lineItems ?? []) {
      if (!line.variationId) continue;
      const key = buildLineKey(line);
      const existing = groups.get(key);
      if (existing) {
        existing.item.count += line.quantity || 1;
        if (idx < existing.latestIndex) existing.latestIndex = idx;
      } else {
        groups.set(key, { item: toUsual(line, key), latestIndex: idx });
      }
    }
  }
  if (!groups.size) return null;
  let winner: { item: YourUsualItem; latestIndex: number } | null = null;
  for (const entry of groups.values()) {
    if (!winner) { winner = entry; continue; }
    if (entry.item.count > winner.item.count) { winner = entry; continue; }
    if (entry.item.count === winner.item.count && entry.latestIndex < winner.latestIndex) {
      winner = entry;
    }
  }
  return winner?.item ?? null;
}

function buildLineKey(line: OrderHistoryLine): string {
  const modIds = (line.modifiers ?? [])
    .map((m) => m.id || `${m.listName}:${m.name}`)
    .sort()
    .join(',');
  return `${line.variationId}::${modIds}`;
}

function toUsual(line: OrderHistoryLine, key: string): YourUsualItem {
  const modifiers = (line.modifiers ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    listName: m.listName,
    priceCents: Number(m.priceCents) || 0,
  }));
  const size = modifiers.find((m) => normalizeListName(m.listName) === 'size')?.name;
  const subtitle = buildSubtitle(modifiers, size);
  const base = Number(line.basePriceCents) || 0;
  const mods = modifiers.reduce((sum, m) => sum + m.priceCents, 0);
  return {
    key,
    itemId: line.itemId,
    variationId: line.variationId,
    name: line.name,
    variationName: line.variationName || undefined,
    modifiers,
    size,
    subtitle,
    priceCents: base + mods,
    imageUrl: line.imageUrl || undefined,
    count: line.quantity || 1,
  };
}

function normalizeListName(listName: string): string {
  return (listName || '').toLowerCase();
}

function buildSubtitle(mods: YourUsualItem['modifiers'], size?: string): string {
  const parts: string[] = [];
  if (size) parts.push(size);
  const sugar = mods.find((m) => normalizeListName(m.listName).includes('sugar'))?.name;
  if (sugar) parts.push(sugar);
  const ice = mods.find((m) => normalizeListName(m.listName).includes('ice'))?.name;
  if (ice) parts.push(ice);
  const toppings = mods
    .filter((m) => normalizeListName(m.listName).includes('topping'))
    .map((m) => m.name);
  if (toppings.length) parts.push(toppings.join(', '));
  return parts.join(' · ');
}

// ---------------------------------------------------------------------

export type StoreStatus = { open: boolean; nextLabel: string };

// Store runs 09:00–21:00 Australia/Brisbane (UTC+10, no DST) every day per
// AGENTS.md / .claude/CLAUDE.md. YAGNI: no holiday exceptions.
const OPEN_HOUR = 9;
const CLOSE_HOUR = 21;

// @verification
// getStoreStatus(new Date('2026-04-19T03:00:00Z')) // 13:00 Brisbane → open, "until 9pm"
// getStoreStatus(new Date('2026-04-19T13:00:00Z')) // 23:00 Brisbane → closed, "9am tomorrow"
// getStoreStatus(new Date('2026-04-18T22:00:00Z')) // 08:00 Brisbane Sat → closed, "9am"
export function getStoreStatus(now: Date = new Date()): StoreStatus {
  // Brisbane is UTC+10 year-round (no DST). Shift UTC timestamp by +10h then
  // read with getUTCHours() to get the Brisbane wall-clock hour regardless
  // of the device's local timezone.
  const hour = new Date(now.getTime() + 10 * 60 * 60 * 1000).getUTCHours();
  const isOpen = hour >= OPEN_HOUR && hour < CLOSE_HOUR;
  if (isOpen) {
    return { open: true, nextLabel: `until ${formatHour(CLOSE_HOUR)}` };
  }
  const beforeOpen = hour < OPEN_HOUR;
  return {
    open: false,
    nextLabel: beforeOpen ? `${formatHour(OPEN_HOUR)}` : `${formatHour(OPEN_HOUR)} tomorrow`,
  };
}

function formatHour(h24: number): string {
  const suffix = h24 < 12 || h24 === 24 ? 'am' : 'pm';
  const mod = h24 % 12;
  const label = mod === 0 ? 12 : mod;
  return `${label}${suffix}`;
}

// ---------------------------------------------------------------------

// @verification
// normalizeSlug('Fruity Black Tea') === 'fruity-black-tea'
// normalizeSlug('Cheese Cream') === 'cheese-cream'
// normalizeSlug('MILKY') === 'milky'
export function normalizeSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ---------------------------------------------------------------------

// @verification
// timeGreeting(new Date('2026-04-19T00:00:00Z')) // 10:00 Brisbane → 'Good morning'
// timeGreeting(new Date('2026-04-19T05:00:00Z')) // 15:00 Brisbane → 'Good afternoon'
// timeGreeting(new Date('2026-04-19T10:00:00Z')) // 20:00 Brisbane → 'Good evening'
export function timeGreeting(now: Date = new Date()): 'Good morning' | 'Good afternoon' | 'Good evening' {
  const hour = new Date(now.getTime() + 10 * 60 * 60 * 1000).getUTCHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
