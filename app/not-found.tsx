import Link from "next/link";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-sm text-center rise-in">
        <p className="text-5xl font-bold tracking-tight text-ink-300">404</p>
        <h1 className="mt-3 text-lg font-semibold text-ink-900">
          We couldn&apos;t find that document
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          It may have been deleted, or it may not be shared with the account
          you&apos;re signed in as.
        </p>
        <Link
          href="/documents"
          className="btn-accent mt-6 inline-block rounded-lg px-4 py-2 text-sm font-medium text-white"
        >
          Back to documents
        </Link>
      </div>
    </main>
  );
}
