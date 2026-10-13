"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { parseEventForm } from "@/lib/events";
import { EventError, cancelEvent, createEvent, publishEvent, unpublishEvent, updateEvent } from "@/lib/event-service";

type State = { ok: boolean; message: string } | null;

function toState(e: unknown): State {
  if (e instanceof EventError) return { ok: false, message: e.message };
  console.error(e);
  return { ok: false, message: "Something went wrong. Please try again." };
}

export async function saveEvent(_: State, form: FormData): Promise<State> {
  const user = await requireRole("ORGANIZER");
  const raw = Object.fromEntries(form);
  const parsed = parseEventForm(raw);
  if (!parsed.ok) return { ok: false, message: parsed.error };
  const id = typeof raw.id === "string" && raw.id ? raw.id : null;
  let eventId: string;
  try {
    if (id) {
      await updateEvent(user.id, id, parsed.data);
      eventId = id;
    } else {
      eventId = (await createEvent(user.id, parsed.data)).id;
    }
  } catch (e) {
    return toState(e);
  }
  revalidatePath("/organizer/events");
  if (!id) redirect(`/organizer/events/${eventId}`);
  return { ok: true, message: "Saved." };
}

export async function changeStatus(_: State, form: FormData): Promise<State> {
  const user = await requireRole("ORGANIZER");
  const id = z.string().min(1).parse(form.get("id"));
  const intent = z.enum(["publish", "unpublish", "cancel"]).parse(form.get("intent"));
  try {
    if (intent === "publish") await publishEvent(user.id, id);
    if (intent === "unpublish") await unpublishEvent(user.id, id);
    if (intent === "cancel") await cancelEvent(user.id, id);
  } catch (e) {
    return toState(e);
  }
  revalidatePath(`/organizer/events/${id}`);
  revalidatePath("/organizer/events");
  return { ok: true, message: intent === "publish" ? "Event published." : intent === "unpublish" ? "Event moved back to draft." : "Event cancelled." };
}
