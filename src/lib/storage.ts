import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Local-disk driver: development only. Serverless hosts have ephemeral disks and
 * `next start` does not serve files added to public/ after boot. Before production,
 * replace saveCover with an object-storage driver (S3, R2, or Vercel Blob) that
 * returns a stable URL. The rest of the app only depends on this function.
 */
export async function saveCover(bytes: Uint8Array, ext: "png" | "jpg" | "webp"): Promise<string> {
  const name = `${randomBytes(16).toString("hex")}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "covers");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);
  return `/uploads/covers/${name}`;
}
