import { z } from "zod";

/**
 * Every mutating route parses its body through one of these before touching the
 * database. Rejecting bad input at the edge means the handlers below never carry
 * "is this even a string" branches.
 */

export const TITLE_MAX = 200;

export const titleSchema = z
  .string()
  .trim()
  .min(1, "Title cannot be empty")
  .max(TITLE_MAX, `Title must be ${TITLE_MAX} characters or fewer`);

/** ProseMirror documents are recursive; validate the shape, not every node. */
export const contentSchema = z
  .object({ type: z.literal("doc") })
  .passthrough();

export const createDocumentSchema = z.object({
  title: titleSchema.optional(),
  content: contentSchema.optional(),
});

export const updateDocumentSchema = z
  .object({
    title: titleSchema.optional(),
    content: contentSchema.optional(),
  })
  .refine((v) => v.title !== undefined || v.content !== undefined, {
    message: "Provide a title or content to update",
  });

export const shareSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  role: z.enum(["VIEWER", "EDITOR"]).default("EDITOR"),
});

export const signInSchema = z.object({
  userId: z.string().min(1),
});

// ── File import ───────────────────────────────────────────────────────────────

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Allowlist, not a blocklist. Browsers report inconsistent MIME types for .md
 * (often empty or text/plain), so the extension is the source of truth and the
 * MIME type is not trusted.
 */
export const ACCEPTED_EXTENSIONS = [".txt", ".md", ".markdown", ".docx"] as const;

export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.join(",");

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

export function isAcceptedFile(filename: string): boolean {
  return (ACCEPTED_EXTENSIONS as readonly string[]).includes(extensionOf(filename));
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
