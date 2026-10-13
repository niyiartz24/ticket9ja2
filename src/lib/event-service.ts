import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { publishProblems, slugify, type EventInput } from "@/lib/events";

export class EventError extends Error {}

const NOT_FOUND = "Event not found.";

/** The only way to load an event for an organizer. A foreign id is indistinguishable from a missing one. */
export async function getOwnedEvent(organizerId: string, id: string) {
  const event = await db.event.findFirst({ where: { id, organizerId }, include: { ticketTypes: true } });
  if (!event) throw new EventError(NOT_FOUND);
  return event;
}

export function listOwnedEvents(organizerId: string) {
  return db.event.findMany({
    where: { organizerId },
    orderBy: { startsAt: "desc" },
    include: { _count: { select: { orders: true } } },
  });
}

export async function createEvent(organizerId: string, input: EventInput) {
  const base = slugify(input.title);
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomBytes(3).toString("hex")}`;
    try {
      return await db.$transaction(async (tx) => {
        const event = await tx.event.create({ data: { ...input, slug, organizerId } });
        await tx.auditLog.create({
          data: { actorId: organizerId, action: "event.create", entityType: "Event", entityId: event.id },
        });
        return event;
      });
    } catch (e) {
      const slugTaken = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!slugTaken) throw e;
    }
  }
  throw new EventError("Could not generate a unique URL for this event. Try a different title.");
}

export async function updateEvent(organizerId: string, id: string, input: EventInput) {
  return db.$transaction(async (tx) => {
    const current = await tx.event.findFirst({ where: { id, organizerId } });
    if (!current) throw new EventError(NOT_FOUND);
    if (current.status !== "DRAFT" && current.status !== "PUBLISHED") {
      throw new EventError("Cancelled or completed events cannot be edited.");
    }
    if (current.status === "PUBLISHED") {
      const active = await tx.ticketType.count({ where: { eventId: id, isActive: true } });
      const problems = publishProblems(input, active);
      if (problems.length) throw new EventError(`A published event must stay complete: ${problems.join("; ")}.`);
    }
    // slug is deliberately never updated: public URLs stay stable
    const event = await tx.event.update({ where: { id }, data: input });
    await tx.auditLog.create({ data: { actorId: organizerId, action: "event.update", entityType: "Event", entityId: id } });
    return event;
  });
}

export async function publishEvent(organizerId: string, id: string) {
  return db.$transaction(async (tx) => {
    const event = await tx.event.findFirst({ where: { id, organizerId } });
    if (!event) throw new EventError(NOT_FOUND);
    if (event.status !== "DRAFT") throw new EventError("Only draft events can be published.");
    const active = await tx.ticketType.count({ where: { eventId: id, isActive: true } });
    const problems = publishProblems(event, active);
    if (problems.length) throw new EventError(`Cannot publish yet: ${problems.join("; ")}.`);
    const r = await tx.event.updateMany({
      where: { id, organizerId, status: "DRAFT" },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
    if (r.count !== 1) throw new EventError("Only draft events can be published.");
    await tx.auditLog.create({ data: { actorId: organizerId, action: "event.publish", entityType: "Event", entityId: id } });
  });
}

export async function unpublishEvent(organizerId: string, id: string) {
  return db.$transaction(async (tx) => {
    const event = await tx.event.findFirst({ where: { id, organizerId } });
    if (!event) throw new EventError(NOT_FOUND);
    if (event.status !== "PUBLISHED") throw new EventError("Only published events can be unpublished.");
    if (await tx.order.count({ where: { eventId: id } })) {
      throw new EventError("This event already has orders. Cancel it instead of unpublishing.");
    }
    await tx.event.updateMany({ where: { id, organizerId, status: "PUBLISHED" }, data: { status: "DRAFT", publishedAt: null } });
    await tx.auditLog.create({ data: { actorId: organizerId, action: "event.unpublish", entityType: "Event", entityId: id } });
  });
}

/** Cancelling never deletes orders, payments or tickets. */
export async function cancelEvent(organizerId: string, id: string) {
  return db.$transaction(async (tx) => {
    const r = await tx.event.updateMany({
      where: { id, organizerId, status: { in: ["DRAFT", "PUBLISHED"] } },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    if (r.count !== 1) {
      const exists = await tx.event.findFirst({ where: { id, organizerId } });
      throw new EventError(exists ? "This event can no longer be cancelled." : NOT_FOUND);
    }
    await tx.auditLog.create({ data: { actorId: organizerId, action: "event.cancel", entityType: "Event", entityId: id } });
  });
}
