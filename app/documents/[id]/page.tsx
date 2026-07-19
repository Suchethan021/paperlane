import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { loadDocument } from "@/lib/documents";
import { AppHeader } from "@/components/AppHeader";
import { DocumentWorkspace } from "@/components/DocumentWorkspace";
import type { JSONContent } from "@tiptap/react";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const user = await getCurrentUser();
  const doc = await loadDocument(id, user);
  return { title: doc?.title ?? "Not found" };
}

export default async function DocumentPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const doc = await loadDocument(id, user);
  // loadDocument returns null both for "missing" and "not yours" — deliberately.
  if (!doc) notFound();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, color: true },
  });

  return (
    <>
      <AppHeader user={user} users={users} />
      <DocumentWorkspace
        key={doc.id}
        documentId={doc.id}
        initialTitle={doc.title}
        initialContent={doc.content as JSONContent}
        level={doc.level}
        owner={doc.owner}
        shares={doc.shares.map((s) => ({ role: s.role, user: s.user }))}
        people={users}
        updatedAt={doc.updatedAt.toISOString()}
        lastEditedBy={doc.lastEditedBy?.name ?? null}
        aiEnabled={Boolean(process.env.GEMINI_API_KEY)}
      />
    </>
  );
}
