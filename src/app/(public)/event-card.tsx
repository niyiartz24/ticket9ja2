/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { CalendarDays, MapPin, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatInTz } from "@/lib/events";
import { formatMinor } from "@/lib/money";
import { isSoldOut, startingPrice } from "@/lib/discovery";

type CardEvent = {
  slug: string; title: string; coverImage: string | null; startsAt: Date; timezone: string;
  venueName: string | null; isOnline: boolean;
  ticketTypes: { priceMinor: number; currency: string; quantityTotal: number; quantitySold: number; quantityReserved: number }[];
};

export function EventCard({ event }: { event: CardEvent }) {
  const price = startingPrice(event.ticketTypes);
  return (
    <Link href={`/events/${event.slug}`} className="group block overflow-hidden rounded-lg border transition-shadow hover:shadow-md focus-visible:ring-2">
      {event.coverImage ? (
        <img src={event.coverImage} alt="" className="h-44 w-full object-cover" />
      ) : (
        <div className="h-44 w-full bg-muted" aria-hidden />
      )}
      <div className="space-y-2 p-4">
        <h3 className="font-medium group-hover:underline">{event.title}</h3>
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4" aria-hidden />{formatInTz(event.startsAt, event.timezone)}</p>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {event.isOnline ? <Wifi className="h-4 w-4" aria-hidden /> : <MapPin className="h-4 w-4" aria-hidden />}
          {event.isOnline ? "Online" : event.venueName ?? "Venue to be announced"}
        </p>
        <div className="flex items-center gap-2 pt-1 text-sm">
          {isSoldOut(event.ticketTypes) ? <Badge variant="secondary">Sold out</Badge> : price && (
            <span className="font-medium">{price.minor === 0 ? "Free" : `From ${formatMinor(price.minor, price.currency)}`}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
