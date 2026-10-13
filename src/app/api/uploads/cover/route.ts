import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { MAX_COVER_BYTES, sniffImage } from "@/lib/uploads";
import { saveCover } from "@/lib/storage";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ORGANIZER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_COVER_BYTES) return NextResponse.json({ error: "Image must be 2 MB or smaller" }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return NextResponse.json({ error: "Use a PNG, JPEG or WebP image" }, { status: 415 });
  return NextResponse.json({ url: await saveCover(bytes, kind.ext) });
}
