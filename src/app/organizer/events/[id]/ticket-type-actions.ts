"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { EventError, getOwnedEvent } from "@/lib/event-service";
import { parseTicketTypeForm } from "@/lib/ticket-types";
import { createTicketType, deleteTicketType, setTicketTypeActive, updateTicketType } from "@/lib/ticket-type-service";

type State = { ok: boolean; message: string } | null;

function toState(e: unknown): State {
  if (e instanceof EventError) return { ok: false, message: e.message };
  console.error(e);
  return { ok: false, message: "Something went wrong. Please try again." };
}

export async function saveTicketType(_: State, form: FormData): Promise<State> {
  const user = await requireRole("ORGANIZER");
  const raw = Object.fromEntries(form);
  try {
    const eventId = z.string().min(1).parse(raw.eventId);
    const event = await getOwnedEvent(user.id, eventId);
    const parsed = parseTicketTypeForm(raw, event.timezone);
    if (!parsed.ok) return { ok: false, message: parsed.error };
    if (typeof raw.id === "string" && raw.id) await updateTicketType(user.id, raw.id, parsed.data);
    else await createTicketType(user.id, eventId, parsed.data);
    revalidatePath(`/organizer/events/${eventId}`);
    return { ok: true, message: "Saved." };
  } catch (e) {
    return toState(e);
  }
}

export async function ticketTypeAction(_: State, form: FormData): Promise<State> {
  const user = await requireRole("ORGANIZER");
  try {
    const id = z.string().min(1).parse(form.get("id"));
    const eventId = z.string().min(1).parse(form.get("eventId"));
    const intent = z.enum(["activate", "deactivate", "delete"]).parse(form.get("intent"));
    if (intent === "delete") await deleteTicketType(user.id, id);
    else await setTicketTypeActive(user.id, id, intent === "activate");
    revalidatePath(`/organizer/events/${eventId}`);
    return { ok: true, message: "Done." };
  } catch (e) {
    return toState(e);
  }
}
