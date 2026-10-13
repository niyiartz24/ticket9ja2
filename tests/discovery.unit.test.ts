import { describe, expect, it } from "vitest";
import { buildEventWhere, isSoldOut, maskEmail, parseDiscoveryParams, startingPrice } from "@/lib/discovery";
import { newQrToken, newTicketCode } from "@/lib/tickets";

describe("parseDiscoveryParams", () => {
  it("applies safe defaults", () => {
    expect(parseDiscoveryParams({})).toEqual({ q: "", when: "any", price: "any", mode: "any", page: 1 });
  });
  it("rejects unknown filter values and bad pages", () => {
    const d = parseDiscoveryParams({ when: "yesterday", price: "'; DROP", mode: ["online"], page: "abc" });
    expect(d).toMatchObject({ when: "any", price: "any", mode: "online", page: 1 });
    expect(parseDiscoveryParams({ page: "-5" }).page).toBe(1);
    expect(parseDiscoveryParams({ page: "99999" }).page).toBe(200);
  });
  it("trims and caps the search text", () => {
    expect(parseDiscoveryParams({ q: "  jazz  " }).q).toBe("jazz");
    expect(parseDiscoveryParams({ q: "x".repeat(500) }).q).toHaveLength(80);
  });
});

describe("buildEventWhere", () => {
  const now = new Date("2026-10-10T00:00:00Z");
  it("always restricts to published, not-ended events", () => {
    const w = buildEventWhere(parseDiscoveryParams({}), now);
    expect(w).toMatchObject({ status: "PUBLISHED", endsAt: { gt: now } });
  });
  it("adds search, date, format and price filters", () => {
    const w = buildEventWhere(parseDiscoveryParams({ q: "jazz", when: "week", mode: "online", price: "free" }), now);
    expect(w.AND).toHaveLength(4);
  });
});

describe("display helpers", () => {
  const t = (p: number, left: number) => ({ priceMinor: p, currency: "NGN", quantityTotal: 10, quantitySold: 10 - left, quantityReserved: 0 });
  it("finds the starting price", () => expect(startingPrice([t(500000, 1), t(0, 1), t(900000, 1)])?.minor).toBe(0));
  it("detects sold out only when every type is sold out", () => {
    expect(isSoldOut([t(1, 0), t(1, 0)])).toBe(true);
    expect(isSoldOut([t(1, 0), t(1, 2)])).toBe(false);
    expect(isSoldOut([])).toBe(false);
  });
  it("masks emails", () => {
    expect(maskEmail("john.doe@gmail.com")).toBe("j*******@gmail.com");
    expect(maskEmail("a@b.co")).toBe("a***@b.co");
    expect(maskEmail("nonsense")).toBe("***");
  });
});

describe("ticket identifiers", () => {
  it("are well-formed and unique", () => {
    const codes = new Set(Array.from({ length: 1000 }, newTicketCode));
    const tokens = new Set(Array.from({ length: 1000 }, newQrToken));
    expect(codes.size).toBe(1000);
    expect(tokens.size).toBe(1000);
    for (const c of codes) expect(c).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    for (const t of tokens) expect(t.length).toBeGreaterThanOrEqual(32);
  });
});
