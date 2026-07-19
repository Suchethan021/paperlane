import StarterKit from "@tiptap/starter-kit";
import { generateJSON } from "@tiptap/html";
import type { JSONContent } from "@tiptap/react";

/**
 * One extension list, used by three callers: the browser editor, the read-only
 * renderer, and the server-side import parser. They must agree — if the server
 * generates a node the client can't render, the document opens blank.
 */
export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false },
  }),
];

export const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

/**
 * HTML → ProseMirror JSON, server-side.
 * `@tiptap/html` resolves to a DOM-free build under Node, so imports are parsed
 * on the server rather than round-tripping through the browser.
 */
export function htmlToDoc(html: string): JSONContent {
  const trimmed = html.trim();
  if (!trimmed) return EMPTY_DOC;
  const doc = generateJSON(trimmed, editorExtensions) as JSONContent;
  return doc.content?.length ? doc : EMPTY_DOC;
}

/** Flatten a document to plain text — used for list previews and the summariser. */
export function docToPlainText(node: unknown, depth = 0): string {
  if (depth > 50 || !node || typeof node !== "object") return "";
  const n = node as JSONContent;

  if (n.type === "text") return n.text ?? "";

  const inner = (n.content ?? []).map((c) => docToPlainText(c, depth + 1)).join("");

  // Block-level nodes get a newline so paragraphs don't run together.
  const isBlock =
    n.type === "paragraph" ||
    n.type === "heading" ||
    n.type === "listItem" ||
    n.type === "blockquote" ||
    n.type === "codeBlock";

  return isBlock ? `${inner}\n` : inner;
}

/** Short single-line preview for document cards. */
export function preview(content: unknown, max = 120): string {
  const text = docToPlainText(content).replace(/\s+/g, " ").trim();
  if (!text) return "Empty document";
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}
