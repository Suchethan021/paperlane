import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { UserPicker } from "@/components/UserPicker";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/documents");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, color: true },
  });

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rise-in">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent)] text-lg font-bold text-white">
            P
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
            Paperlane
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            Choose an account to continue.
          </p>
        </div>

        <div className="rounded-2xl border border-ink-200 bg-white p-2 shadow-sm">
          {users.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-500">
              No accounts found. Run{" "}
              <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs">
                npm run db:seed
              </code>{" "}
              to create the demo users.
            </p>
          ) : (
            <UserPicker users={users} />
          )}
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-ink-400">
          Authentication is intentionally mocked for this demo — picking an
          account signs you in. Sessions are still real, signed, httpOnly
          cookies.
        </p>
      </div>
    </main>
  );
}
