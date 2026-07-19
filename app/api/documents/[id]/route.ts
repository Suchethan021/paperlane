import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { loadDocument } from "@/lib/documents";
import { canManage, canWrite } from "@/lib/authz";
import { updateDocumentSchema } from "@/lib/validation";
import { fail, guard, ok, parseBody, requireUser } from "@/lib/api";
import type { Prisma } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  return guard(async () => {
    const { id } = await params;
    const user = await getCurrentUser();

    const doc = await loadDocument(id, user);
    // Not found and not allowed are the same answer on purpose.
    if (!doc) return fail(404, "Document not found.");

    return ok(doc);
  });
}

export async function PATCH(request: Request, { params }: Ctx) {
  return guard(async () => {
    const { id } = await params;
    const user = await requireUser();
    if (user instanceof Response) return user;

    const doc = await loadDocument(id, user);
    if (!doc) return fail(404, "Document not found.");

    if (!canWrite(user, doc)) {
      return fail(403, "You have view-only access to this document.");
    }

    const body = await parseBody(request, updateDocumentSchema);
    if (body instanceof Response) return body;

    const updated = await prisma.document.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.content !== undefined
          ? { content: body.content as Prisma.InputJsonValue }
          : {}),
        lastEditedById: user.id,
      },
      select: { id: true, title: true, updatedAt: true },
    });

    return ok(updated);
  });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  return guard(async () => {
    const { id } = await params;
    const user = await requireUser();
    if (user instanceof Response) return user;

    const doc = await loadDocument(id, user);
    if (!doc) return fail(404, "Document not found.");

    // Editors can change a document but not destroy it.
    if (!canManage(user, doc)) {
      return fail(403, "Only the owner can delete this document.");
    }

    await prisma.document.delete({ where: { id } });
    return ok({ ok: true });
  });
}
