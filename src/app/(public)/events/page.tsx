import Link from "next/link";
import { db } from "@/lib/db";
import { PAGE_SIZE, buildEventWhere, parseDiscoveryParams } from "@/lib/discovery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EventCard } from "../event-card";

const select = "h-9 rounded-md border bg-background px-3 text-sm";

export default async function EventsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const d = parseDiscoveryParams(await searchParams);
  const where = buildEventWhere(d);
  const [total, events] = await Promise.all([
    db.event.count({ where }),
    db.event.findMany({
      where, orderBy: { startsAt: "asc" }, skip: (d.page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      select: {
        slug: true, title: true, coverImage: true, startsAt: true, timezone: true, venueName: true, isOnline: true,
        ticketTypes: { where: { isActive: true }, select: { priceMinor: true, currency: true, quantityTotal: true, quantitySold: true, quantityReserved: true } },
      },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (page: number) => {
    const p = new URLSearchParams();
    if (d.q) p.set("q", d.q);
    if (d.when !== "any") p.set("when", d.when);
    if (d.price !== "any") p.set("price", d.price);
    if (d.mode !== "any") p.set("mode", d.mode);
    if (page > 1) p.set("page", String(page));
    return `/events?${p.toString()}`;
  };
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <h1 className="text-2xl font-semibold">Events</h1>
      <form className="flex flex-wrap items-end gap-3" role="search">
        <Input name="q" defaultValue={d.q} placeholder="Search" aria-label="Search events" className="max-w-xs" maxLength={80} />
        <select name="when" defaultValue={d.when} aria-label="When" className={select}>
          <option value="any">Any date</option><option value="week">Next 7 days</option><option value="month">Next 30 days</option>
        </select>
        <select name="price" defaultValue={d.price} aria-label="Price" className={select}>
          <option value="any">Any price</option><option value="free">Free</option><option value="paid">Paid</option>
        </select>
        <select name="mode" defaultValue={d.mode} aria-label="Format" className={select}>
          <option value="any">In person and online</option><option value="in-person">In person</option><option value="online">Online</option>
        </select>
        <Button type="submit">Apply</Button>
      </form>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events match your search. Try changing the filters.</p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => <li key={e.slug}><EventCard event={e} /></li>)}
        </ul>
      )}
      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-4 text-sm">
          {d.page > 1 && <Link href={link(d.page - 1)} className="hover:underline">Previous</Link>}
          <span className="text-muted-foreground">Page {d.page} of {pages}</span>
          {d.page < pages && <Link href={link(d.page + 1)} className="hover:underline">Next</Link>}
        </nav>
      )}
    </main>
  );
}
