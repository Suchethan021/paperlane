import { prisma } from "@/lib/db";
import { listDocuments } from "@/lib/documents";
import { createDocumentSchema } from "@/lib/validation";
import { EMPTY_DOC } from "@/lib/tiptap";
import { guard, ok, parseBody, requireUser } from "@/lib/api";
import type { Prisma } from "@prisma/client";

export async function GET() {
  return guard(async () => {
    const user = await requireUser();
    if (user instanceof Response) return user;

    return ok(await listDocuments(user.id));
  });
}

export async function POST(request: Request) {
  return guard(async () => {
    const user = await requireUser();
    if (user instanceof Response) return user;

    const body = await parseBody(request, createDocumentSchema);
    if (body instanceof Response) return body;

    const doc = await prisma.document.create({
      data: {
        title: body.title ?? "Untitled document",
        content: (body.content ?? EMPTY_DOC) as Prisma.InputJsonValue,
        ownerId: user.id,
        lastEditedById: user.id,
      },
      select: { id: true, title: true },
    });

    return ok(doc, 201);
  });
}
