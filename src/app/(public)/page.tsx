import { db } from "@/lib/db";
import { publicEventWhere } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EventCard } from "./event-card";

export default async function Home() {
  const events = await db.event.findMany({
    where: publicEventWhere(),
    orderBy: { startsAt: "asc" },
    take: 6,
    select: {
      slug: true, title: true, coverImage: true, startsAt: true, timezone: true, venueName: true, isOnline: true,
      ticketTypes: { where: { isActive: true }, select: { priceMinor: true, currency: true, quantityTotal: true, quantitySold: true, quantityReserved: true } },
    },
  });
  return (
    <main>
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Find your next event. <span className="text-muted-foreground">Tickets in minutes.</span>
        </h1>
        <form action="/events" className="mt-8 flex max-w-xl gap-3" role="search">
          <Input name="q" placeholder="Search events, venues or keywords" aria-label="Search events" maxLength={80} />
          <Button type="submit">Search</Button>
        </form>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="mb-6 text-xl font-semibold">Upcoming events</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events are on sale right now. Check back soon.</p>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => <li key={e.slug}><EventCard event={e} /></li>)}
          </ul>
        )}
      </section>
    </main>
  );
}
