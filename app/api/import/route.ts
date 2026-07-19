import { marked } from "marked";
import mammoth from "mammoth";
import { prisma } from "@/lib/db";
import { htmlToDoc } from "@/lib/tiptap";
import {
  ACCEPTED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  extensionOf,
  humanSize,
  isAcceptedFile,
  TITLE_MAX,
} from "@/lib/validation";
import { fail, guard, ok, requireUser } from "@/lib/api";
import type { Prisma } from "@prisma/client";

/**
 * Import a file as a new document.
 *
 * The bytes are parsed and thrown away — only the resulting document is stored.
 * That is a deliberate scope decision: "upload becomes a document" is the more
 * product-relevant of the behaviours the brief offered, and it needs no blob
 * storage, no signed URLs and no lifecycle policy.
 *
 * A Route Handler rather than a Server Action: Server Actions cap request bodies
 * at 1 MB by default, which a .docx passes easily.
 */
export async function POST(request: Request) {
  return guard(async () => {
    const user = await requireUser();
    if (user instanceof Response) return user;

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail(400, "Expected a file upload.");
    }

    const file = form.get("file");
    if (!file || typeof file === "string") {
      return fail(400, "No file was attached.");
    }

    if (!isAcceptedFile(file.name)) {
      return fail(
        415,
        `Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.join(", ")}`,
      );
    }

    if (file.size === 0) return fail(400, "That file is empty.");
    if (file.size > MAX_UPLOAD_BYTES) {
      return fail(
        413,
        `File is ${humanSize(file.size)}. The limit is ${humanSize(MAX_UPLOAD_BYTES)}.`,
      );
    }

    const ext = extensionOf(file.name);
    let html: string;
    let warnings: string[] = [];

    try {
      if (ext === ".docx") {
        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await mammoth.convertToHtml({ buffer });
        html = result.value;
        // mammoth reports what it dropped (images, unsupported styles) — surfacing
        // that is more honest than silently importing a lossy document.
        warnings = result.messages.slice(0, 3).map((m) => m.message);
      } else if (ext === ".md" || ext === ".markdown") {
        html = await marked.parse(await file.text(), { async: true });
      } else {
        html = plainTextToHtml(await file.text());
      }
    } catch {
      return fail(422, "That file could not be read. It may be corrupt.");
    }

    const content = htmlToDoc(html);
    const title = deriveTitle(file.name);

    const doc = await prisma.document.create({
      data: {
        title,
        content: content as unknown as Prisma.InputJsonValue,
        ownerId: user.id,
        lastEditedById: user.id,
      },
      select: { id: true, title: true },
    });

    return ok({ ...doc, warnings }, 201);
  });
}

/** Blank lines separate paragraphs; everything else is literal text. */
function plainTextToHtml(text: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return text
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escape(block).replace(/\r?\n/g, "<br>")}</p>`)
    .join("");
}

function deriveTitle(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  if (!base) return "Imported document";
  return base.slice(0, TITLE_MAX);
}
