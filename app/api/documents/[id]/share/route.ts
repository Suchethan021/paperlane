import { prisma } from "@/lib/db";
import { loadDocument } from "@/lib/documents";
import { canManage } from "@/lib/authz";
import { shareSchema } from "@/lib/validation";
import { fail, guard, ok, parseBody, requireUser } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** Grant or update access. Owner-only. */
export async function POST(request: Request, { params }: Ctx) {
  return guard(async () => {
    const { id } = await params;
    const user = await requireUser();
    if (user instanceof Response) return user;

    const doc = await loadDocument(id, user);
    if (!doc) return fail(404, "Document not found.");
    if (!canManage(user, doc)) {
      return fail(403, "Only the owner can share this document.");
    }

    const body = await parseBody(request, shareSchema);
    if (body instanceof Response) return body;

    const recipient = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true, name: true, email: true, color: true },
    });
    if (!recipient) {
      return fail(404, `No account found for ${body.email}.`);
    }
    if (recipient.id === doc.ownerId) {
      return fail(400, "You already own this document.");
    }

    // Re-sharing changes the role rather than creating a second grant.
    const share = await prisma.share.upsert({
      where: { documentId_userId: { documentId: id, userId: recipient.id } },
      update: { role: body.role },
      create: { documentId: id, userId: recipient.id, role: body.role },
      include: { user: { select: { id: true, name: true, email: true, color: true } } },
    });

    return ok(share, 201);
  });
}

/** Revoke access. Owner-only. */
export async function DELETE(request: Request, { params }: Ctx) {
  return guard(async () => {
    const { id } = await params;
    const user = await requireUser();
    if (user instanceof Response) return user;

    const doc = await loadDocument(id, user);
    if (!doc) return fail(404, "Document not found.");
    if (!canManage(user, doc)) {
      return fail(403, "Only the owner can change sharing.");
    }

    const userId = new URL(request.url).searchParams.get("userId");
    if (!userId) return fail(400, "Missing userId.");

    await prisma.share.deleteMany({ where: { documentId: id, userId } });
    return ok({ ok: true });
  });
}
