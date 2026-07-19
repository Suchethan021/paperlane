import { describe, expect, it } from "vitest";
import {
  accessLevel,
  canManage,
  canRead,
  canWrite,
  type AccessResource,
} from "@/lib/authz";

/**
 * The one thing in this app that is a security bug if it is wrong.
 *
 * Everything else fails loudly — a broken toolbar button is visible in a second.
 * An authorization mistake is silent, and the failure mode is "a stranger read a
 * document they were never shared". So this is where the test budget went.
 *
 * These are pure functions over plain objects, so the suite needs no database,
 * no HTTP server and no mocks — it runs in milliseconds and can't flake.
 */

const OWNER = { id: "u_owner" };
const EDITOR = { id: "u_editor" };
const VIEWER = { id: "u_viewer" };
const STRANGER = { id: "u_stranger" };

const doc: AccessResource = {
  ownerId: OWNER.id,
  shares: [
    { userId: EDITOR.id, role: "EDITOR" },
    { userId: VIEWER.id, role: "VIEWER" },
  ],
};

describe("accessLevel", () => {
  it("recognises the owner even if they are also in the share list", () => {
    const selfShared: AccessResource = {
      ownerId: OWNER.id,
      shares: [{ userId: OWNER.id, role: "VIEWER" }],
    };
    // Ownership must win, otherwise sharing a doc with yourself would demote you.
    expect(accessLevel(OWNER, selfShared)).toBe("OWNER");
  });

  it("resolves each share role", () => {
    expect(accessLevel(EDITOR, doc)).toBe("EDITOR");
    expect(accessLevel(VIEWER, doc)).toBe("VIEWER");
  });

  it("denies a user with no relationship to the document", () => {
    expect(accessLevel(STRANGER, doc)).toBe("NONE");
  });

  it("denies signed-out users and missing documents", () => {
    expect(accessLevel(null, doc)).toBe("NONE");
    expect(accessLevel(OWNER, null)).toBe("NONE");
    expect(accessLevel(undefined, undefined)).toBe("NONE");
  });
});

describe("canRead", () => {
  it("allows owner, editor and viewer", () => {
    expect(canRead(OWNER, doc)).toBe(true);
    expect(canRead(EDITOR, doc)).toBe(true);
    expect(canRead(VIEWER, doc)).toBe(true);
  });

  it("refuses a stranger", () => {
    expect(canRead(STRANGER, doc)).toBe(false);
  });
});

describe("canWrite", () => {
  it("allows owner and editor", () => {
    expect(canWrite(OWNER, doc)).toBe(true);
    expect(canWrite(EDITOR, doc)).toBe(true);
  });

  it("refuses a viewer — read access is not write access", () => {
    expect(canWrite(VIEWER, doc)).toBe(false);
  });

  it("refuses a stranger", () => {
    expect(canWrite(STRANGER, doc)).toBe(false);
  });
});

describe("canManage", () => {
  it("is owner-only: an editor cannot re-share or delete", () => {
    expect(canManage(OWNER, doc)).toBe(true);
    expect(canManage(EDITOR, doc)).toBe(false);
    expect(canManage(VIEWER, doc)).toBe(false);
    expect(canManage(STRANGER, doc)).toBe(false);
  });
});

describe("share list edge cases", () => {
  it("treats an empty share list as private to the owner", () => {
    const priv: AccessResource = { ownerId: OWNER.id, shares: [] };
    expect(canRead(OWNER, priv)).toBe(true);
    expect(canRead(EDITOR, priv)).toBe(false);
  });

  it("does not confuse a user id that is a prefix of another", () => {
    // Guards against any future switch to substring/startsWith matching.
    const tricky: AccessResource = {
      ownerId: "u_owner",
      shares: [{ userId: "u_edit", role: "EDITOR" }],
    };
    expect(canRead({ id: "u_edito" }, tricky)).toBe(false);
    expect(canRead({ id: "u_edit" }, tricky)).toBe(true);
  });
});
