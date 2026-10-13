import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatInTz } from "@/lib/events";
import { formatMinor } from "@/lib/money";
import { maskEmail } from "@/lib/discovery";

const STATUS: Record<string, { title: string; body: string }> = {
  PAID: { title: "Order confirmed", body: "Your tickets have been issued for this order." },
  PENDING: { title: "Awaiting payment", body: "Your tickets are held for a short time while payment is completed." },
  EXPIRED: { title: "Reservation expired", body: "This order was not completed in time and the tickets were released." },
  FAILED: { title: "Order failed", body: "Something went wrong with this order. No payment was taken." },
  CANCELLED: { title: "Order cancelled", body: "This order was cancelled." },
  REFUNDED: { title: "Order refunded", body: "This order has been refunded." },
};

export default async function OrderPage({ params }: { params: Promise<{ reference: string }> }) {
  const reference = (await params).reference.trim().toUpperCase();
  if (!/^T9-[0-9A-Z]{10}$/.test(reference)) notFound();
  const order = await db.order.findUnique({
    where: { reference },
    include: { event: true, items: { include: { ticketType: true } }, _count: { select: { tickets: true } } },
  });
  if (!order) notFound();
  const s = STATUS[order.status];
  return (
    <main className="mx-auto max-w-2xl space-y-8 px-6 py-12">
      <header>
        <p className="text-sm text-muted-foreground">Order {order.reference}</p>
        <h1 className="text-2xl font-semibold">{s.title}</h1>
        <p className="mt-2 text-muted-foreground">{s.body}</p>
      </header>
      <section className="space-y-1 text-sm">
        <p className="font-medium">{order.event.title}</p>
        <p className="text-muted-foreground">{formatInTz(order.event.startsAt, order.event.timezone)}</p>
        <p className="text-muted-foreground">Tickets for {maskEmail(order.buyerEmail)}</p>
      </section>
      <ul className="divide-y rounded-lg border text-sm">
        {order.items.map((it) => (
          <li key={it.id} className="flex justify-between p-4">
            <span>{it.quantity} x {it.ticketType.name}</span>
            <span>{formatMinor(it.unitPriceMinor * it.quantity, order.currency)}</span>
          </li>
        ))}
        <li className="flex justify-between p-4 font-semibold"><span>Total</span><span>{order.totalMinor === 0 ? "Free" : formatMinor(order.totalMinor, order.currency)}</span></li>
      </ul>
      {order.status === "PAID" && <p className="text-sm text-muted-foreground">{order._count.tickets} ticket(s) issued. Email delivery of tickets is added in a later release.</p>}
      {order.status === "PENDING" && order.totalMinor > 0 && (
        <p className="rounded-md border p-4 text-sm">Online payment is not available yet. This order will be released automatically if it is not paid in time.</p>
      )}
    </main>
  );
}
