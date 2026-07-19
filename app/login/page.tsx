import { redirect } from "next/navigation";
import { FileText, Share2, Sparkles, Upload } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { UserPicker } from "@/components/UserPicker";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/documents");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      color: true,
      _count: { select: { documents: true, shares: true } },
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-lg">
        {/* ── Brand ─────────────────────────────────────────────────────── */}
        <div className="mb-8 text-center rise-in">
          <div className="brand-mark mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl">
            <FileText className="h-7 w-7 text-white" strokeWidth={2.2} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-900">
            Paperlane
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-500">
            Write, import and share documents — with a real ownership and
            permission model underneath.
          </p>
        </div>

        {/* ── Account picker ────────────────────────────────────────────── */}
        <div className="surface-raised rounded-2xl p-2 rise-in">
          <div className="flex items-center justify-between px-3 pb-2 pt-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              Choose an account
            </p>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200/70">
              Demo · no passwords
            </span>
          </div>

          {users.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-ink-500">
              No accounts found. Run{" "}
              <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs">
                npm run db:seed
              </code>{" "}
              to create the demo users.
            </p>
          ) : (
            <UserPicker
              users={users.map((u) => ({
                id: u.id,
                name: u.name,
                email: u.email,
                color: u.color,
                owned: u._count.documents,
                shared: u._count.shares,
              }))}
            />
          )}
        </div>

        {/* ── What's inside ─────────────────────────────────────────────── */}
        <ul className="mt-6 grid grid-cols-3 gap-2 rise-in">
          {[
            { icon: FileText, label: "Rich text" },
            { icon: Upload, label: "File import" },
            { icon: Share2, label: "Roles & sharing" },
          ].map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="surface flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center"
            >
              <Icon className="h-4 w-4 text-accent" />
              <span className="text-[11px] font-medium text-ink-600">
                {label}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-6 flex items-start justify-center gap-1.5 px-4 text-center text-xs leading-relaxed text-ink-400">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            Authentication is intentionally mocked for this demo — picking an
            account signs you in. Sessions are still real signed, httpOnly
            cookies.
          </span>
        </p>
      </div>
    </main>
  );
}
