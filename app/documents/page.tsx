import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { listDocuments } from "@/lib/documents";
import { preview } from "@/lib/tiptap";
import { AppHeader } from "@/components/AppHeader";
import { DocumentActions } from "@/components/DocumentActions";
import { Avatar } from "@/components/Avatar";
import { RelativeTime } from "@/components/RelativeTime";

export const metadata = { title: "Documents" };
export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [{ owned, shared }, users] = await Promise.all([
    listDocuments(user.id),
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, color: true },
    }),
  ]);

  return (
    <>
      <AppHeader user={user} users={users} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 rise-in">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink-900">
              Documents
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-500">
              <span>
                Signed in as{" "}
                <strong className="font-medium text-ink-700">{user.name}</strong>
              </span>
              <span className="text-ink-300">·</span>
              <span>
                {owned.length} owned, {shared.length} shared with you
              </span>
            </p>
          </div>
          <DocumentActions />
        </div>

        <Section
          title="Owned by me"
          icon={<FileText className="h-4 w-4" />}
          count={owned.length}
          empty="You haven't created a document yet."
        >
          {owned.map((doc) => (
            <DocumentCard
              key={doc.id}
              id={doc.id}
              title={doc.title}
              snippet={preview(doc.content)}
              updatedAt={doc.updatedAt}
              badge={
                doc.shares.length > 0
                  ? `Shared with ${doc.shares.length}`
                  : "Private"
              }
              badgeTone={doc.shares.length > 0 ? "accent" : "muted"}
            />
          ))}
        </Section>

        <Section
          title="Shared with me"
          icon={<Users className="h-4 w-4" />}
          count={shared.length}
          empty="Nothing has been shared with you yet."
        >
          {shared.map((doc) => (
            <DocumentCard
              key={doc.id}
              id={doc.id}
              title={doc.title}
              snippet={preview(doc.content)}
              updatedAt={doc.updatedAt}
              owner={doc.owner}
              badge={doc.shares[0]?.role === "VIEWER" ? "Can view" : "Can edit"}
              badgeTone={doc.shares[0]?.role === "VIEWER" ? "muted" : "accent"}
            />
          ))}
        </Section>
      </main>
    </>
  );
}

function Section({
  title,
  icon,
  count,
  empty,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
        <span className="text-ink-400">{icon}</span>
        {title}
        <span className="rounded-full bg-ink-200 px-1.5 py-0.5 text-[10px] font-semibold text-ink-600">
          {count}
        </span>
      </h2>

      {count === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-300/70 bg-white/40 px-4 py-10 text-center text-sm text-ink-400">
          {empty}
        </p>
      ) : (
        <ul className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {children}
        </ul>
      )}
    </section>
  );
}

function DocumentCard({
  id,
  title,
  snippet,
  updatedAt,
  owner,
  badge,
  badgeTone,
}: {
  id: string;
  title: string;
  snippet: string;
  updatedAt: Date;
  owner?: { name: string; color: string };
  badge: string;
  badgeTone: "accent" | "muted";
}) {
  return (
    <li>
      <Link
        href={`/documents/${id}`}
        className="surface card-hover group flex h-full flex-col rounded-2xl p-4"
      >
        <h3 className="truncate text-sm font-semibold text-ink-900 transition group-hover:text-accent">
          {title}
        </h3>
        <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed text-ink-500">
          {snippet}
        </p>

        <div className="mt-4 flex items-center gap-2">
          {owner && (
            <span className="flex items-center gap-1.5 text-[11px] text-ink-500">
              <Avatar name={owner.name} color={owner.color} size="sm" />
              {owner.name.split(" ")[0]}
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              badgeTone === "accent"
                ? "bg-accent-soft text-accent"
                : "bg-ink-100 text-ink-500"
            }`}
          >
            {badge}
          </span>
          <span className="ml-auto text-[11px] text-ink-400">
            <RelativeTime value={updatedAt.toISOString()} />
          </span>
        </div>
      </Link>
    </li>
  );
}
