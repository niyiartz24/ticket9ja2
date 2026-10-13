import type { Prisma } from "@prisma/client";
import { publicEventWhere } from "@/lib/events";
import { available } from "@/lib/ticket-types";

export const PAGE_SIZE = 12;
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

export type Discovery = {
  q: string; when: "any" | "week" | "month"; price: "any" | "free" | "paid"; mode: "any" | "online" | "in-person"; page: number;
};

export function parseDiscoveryParams(sp: Record<string, string | string[] | undefined>): Discovery {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]);
  const page = Number.parseInt(String(one("page") ?? "1"), 10);
  return {
    q: String(one("q") ?? "").trim().slice(0, 80),
    when: pick(one("when"), ["any", "week", "month"], "any"),
    price: pick(one("price"), ["any", "free", "paid"], "any"),
    mode: pick(one("mode"), ["any", "online", "in-person"], "any"),
    page: Number.isFinite(page) ? Math.min(Math.max(page, 1), 200) : 1,
  };
}

export function buildEventWhere(d: Discovery, now = new Date()): Prisma.EventWhereInput {
  const and: Prisma.EventWhereInput[] = [];
  if (d.q) {
    and.push({
      OR: [
        { title: { contains: d.q, mode: "insensitive" } },
        { description: { contains: d.q, mode: "insensitive" } },
        { venueName: { contains: d.q, mode: "insensitive" } },
      ],
    });
  }
  if (d.when !== "any") and.push({ startsAt: { lt: new Date(now.getTime() + (d.when === "week" ? 7 : 30) * 864e5) } });
  if (d.mode !== "any") and.push({ isOnline: d.mode === "online" });
  if (d.price === "free") and.push({ ticketTypes: { some: { isActive: true, priceMinor: 0 } } });
  if (d.price === "paid") and.push({ ticketTypes: { some: { isActive: true, priceMinor: { gt: 0 } } } });
  return { ...publicEventWhere(now), AND: and };
}

type T = { priceMinor: number; currency: string; quantityTotal: number; quantitySold: number; quantityReserved: number };

export function startingPrice(types: T[]): { minor: number; currency: string } | null {
  if (!types.length) return null;
  const min = types.reduce((a, b) => (b.priceMinor < a.priceMinor ? b : a));
  return { minor: min.priceMinor, currency: min.currency };
}

export const isSoldOut = (types: T[]) => types.length > 0 && types.every((t) => available(t) === 0);

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local[0] ?? ""}${"*".repeat(Math.max(3, local.length - 1))}@${domain}`;
}
