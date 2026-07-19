import { ZodError } from "zod";
import { getCurrentUser, type SessionUser } from "./auth";

/** Consistent JSON error shape so the client never has to guess. */
export function fail(status: number, error: string, details?: unknown) {
  return Response.json({ error, ...(details ? { details } : {}) }, { status });
}

export function ok<T>(data: T, status = 200) {
  return Response.json(data, { status });
}

/**
 * Every route starts here. Returning a Response (rather than throwing) keeps the
 * handlers linear: `if (user instanceof Response) return user`.
 */
export async function requireUser(): Promise<SessionUser | Response> {
  const user = await getCurrentUser();
  return user ?? fail(401, "You need to sign in.");
}

/** Parse a JSON body, converting Zod issues into a readable message. */
export async function parseBody<T>(
  request: Request,
  schema: { parse: (v: unknown) => T },
): Promise<T | Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail(400, "Request body must be valid JSON.");
  }

  try {
    return schema.parse(raw);
  } catch (e) {
    if (e instanceof ZodError) {
      return fail(400, e.issues[0]?.message ?? "Invalid request.", e.issues);
    }
    return fail(400, "Invalid request.");
  }
}

/** Wrap a handler so an unexpected throw is a 500 with a log, never a blank page. */
export async function guard(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    console.error("[api]", e);
    return fail(500, "Something went wrong on our end.");
  }
}
