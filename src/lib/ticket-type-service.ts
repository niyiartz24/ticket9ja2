import { db } from "@/lib/db";
import { EventError } from "@/lib/event-service";
import type { TicketTypeInput } from "@/lib/ticket-types";

const NOT_FOUND = "Ticket type not found.";
type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

async function ownedType(tx: Tx, organizerId: string, id: string) {
  const tt = await tx.ticketType.findFirst({ where: { id, event: { organizerId } }, include: { event: true } });
  if (!tt) throw new EventError(NOT_FOUND);
  if (tt.event.status !== "DRAFT" && tt.event.status !== "PUBLISHED") {
    throw new EventError("Ticket types cannot be changed on cancelled or completed events.");
  }
  return tt;
}

function checkAgainstEvent(event: { endsAt: Date }, input: TicketTypeInput) {
  if (input.salesCloseAt && input.salesCloseAt > event.endsAt) {
    throw new EventError("Ticket sales cannot close after the event ends.");
  }
}

export async function createTicketType(organizerId: string, eventId: string, input: TicketTypeInput) {
  return db.$transaction(async (tx) => {
    const event = await tx.event.findFirst({ where: { id: eventId, organizerId } });
    if (!event) throw new EventError("Event not found.");
    if (event.status !== "DRAFT" && event.status !== "PUBLISHED") {
      throw new EventError("Ticket types cannot be added to cancelled or completed events.");
    }
    checkAgainstEvent(event, input);
    const tt = await tx.ticketType.create({ data: { ...input, eventId } });
    await tx.auditLog.create({ data: { actorId: organizerId, action: "ticketType.create", entityType: "TicketType", entityId: tt.id } });
    return tt;
  });
}

async function assertStillPublishable(tx: Tx, event: { id: string; status: string }, id: string, willBeActive: boolean) {
  if (event.status !== "PUBLISHED" || willBeActive) return;
  const others = await tx.ticketType.count({ where: { eventId: event.id, isActive: true, id: { not: id } } });
  if (others < 1) throw new EventError("A published event needs at least one active ticket type.");
}

export async function updateTicketType(organizerId: string, id: string, input: TicketTypeInput) {
  return db.$transaction(async (tx) => {
    const tt = await ownedType(tx, organizerId, id);
    checkAgainstEvent(tt.event, input);
    await assertStillPublishable(tx, tt.event, id, input.isActive);
    // Guarded in SQL so a concurrent sale cannot slip under the new total.
    const n = await tx.$executeRaw`UPDATE "TicketType" SET "quantityTotal" = ${input.quantityTotal}
      WHERE "id" = ${id} AND "quantitySold" + "quantityReserved" <= ${input.quantityTotal}`;
    if (n !== 1) throw new EventError("Quantity cannot be lower than tickets already sold or reserved.");
    const { quantityTotal: _ignored, ...rest } = input;
    const updated = await tx.ticketType.update({ where: { id }, data: rest });
    await tx.auditLog.create({ data: { actorId: organizerId, action: "ticketType.update", entityType: "TicketType", entityId: id } });
    return updated;
  });
}

export async function setTicketTypeActive(organizerId: string, id: string, active: boolean) {
  return db.$transaction(async (tx) => {
    const tt = await ownedType(tx, organizerId, id);
    await assertStillPublishable(tx, tt.event, id, active);
    await tx.ticketType.update({ where: { id }, data: { isActive: active } });
    await tx.auditLog.create({ data: { actorId: organizerId, action: active ? "ticketType.activate" : "ticketType.deactivate", entityType: "TicketType", entityId: id } });
  });
}

/** Only possible while no order has ever referenced the type; otherwise deactivate. */
export async function deleteTicketType(organizerId: string, id: string) {
  return db.$transaction(async (tx) => {
    const tt = await ownedType(tx, organizerId, id);
    if (await tx.orderItem.count({ where: { ticketTypeId: id } })) {
      throw new EventError("This ticket type has orders. Deactivate it instead.");
    }
    await assertStillPublishable(tx, tt.event, id, false);
    await tx.ticketType.delete({ where: { id } });
    await tx.auditLog.create({ data: { actorId: organizerId, action: "ticketType.delete", entityType: "TicketType", entityId: id } });
  });
}
