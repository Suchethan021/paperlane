/**
 * Authorization rules.
 *
 * These are deliberately *pure* functions over plain data rather than methods
 * that reach for the database. Two reasons:
 *
 *  1. They can be unit-tested exhaustively with no Postgres, no HTTP, no mocks —
 *     which is why the one automated test in this project lives here. This is
 *     the highest-consequence logic in the app; a bug here is a data leak.
 *  2. Every route reaches the same decision through the same function, so there
 *     is exactly one place where "can this person see this document" is decided.
 */

export type Role = "VIEWER" | "EDITOR";

/** The minimum shape needed to make an access decision. */
export interface AccessSubject {
  id: string;
}

export interface AccessResource {
  ownerId: string;
  shares: { userId: string; role: Role }[];
}

export type AccessLevel = "OWNER" | "EDITOR" | "VIEWER" | "NONE";

/**
 * Resolve what `user` may do with `doc`.
 * A null user (signed out) always resolves to NONE.
 */
export function accessLevel(
  user: AccessSubject | null | undefined,
  doc: AccessResource | null | undefined,
): AccessLevel {
  if (!user || !doc) return "NONE";
  if (doc.ownerId === user.id) return "OWNER";

  const share = doc.shares.find((s) => s.userId === user.id);
  if (!share) return "NONE";

  return share.role === "EDITOR" ? "EDITOR" : "VIEWER";
}

/** Owner, editor and viewer can all read. */
export function canRead(
  user: AccessSubject | null | undefined,
  doc: AccessResource | null | undefined,
): boolean {
  return accessLevel(user, doc) !== "NONE";
}

/** Only the owner and explicit editors may change content or title. */
export function canWrite(
  user: AccessSubject | null | undefined,
  doc: AccessResource | null | undefined,
): boolean {
  const level = accessLevel(user, doc);
  return level === "OWNER" || level === "EDITOR";
}

/** Sharing, unsharing and deleting are owner-only. Editors cannot re-share. */
export function canManage(
  user: AccessSubject | null | undefined,
  doc: AccessResource | null | undefined,
): boolean {
  return accessLevel(user, doc) === "OWNER";
}
