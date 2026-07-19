import { prisma } from "@/lib/db";
import { signIn, signOut } from "@/lib/auth";
import { signInSchema } from "@/lib/validation";
import { fail, guard, ok, parseBody } from "@/lib/api";

/** Sign in as a seeded user. Mocked auth — see lib/auth.ts for the reasoning. */
export async function POST(request: Request) {
  return guard(async () => {
    const body = await parseBody(request, signInSchema);
    if (body instanceof Response) return body;

    const user = await prisma.user.findUnique({ where: { id: body.userId } });
    if (!user) return fail(404, "That account no longer exists.");

    await signIn(user.id);
    return ok({ id: user.id, name: user.name });
  });
}

export async function DELETE() {
  return guard(async () => {
    await signOut();
    return ok({ ok: true });
  });
}
