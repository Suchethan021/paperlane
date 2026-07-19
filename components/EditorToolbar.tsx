"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Underline,
  Undo2,
} from "lucide-react";

function Button({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // keep the selection in the editor
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition disabled:opacity-30 ${
        active
          ? "bg-accent-soft text-accent"
          : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-ink-200" />;
}

const HEADINGS = [
  { level: 0, label: "Body" },
  { level: 1, label: "Heading 1" },
  { level: 2, label: "Heading 2" },
  { level: 3, label: "Heading 3" },
] as const;

export function EditorToolbar({ editor }: { editor: Editor }) {
  const currentHeading =
    HEADINGS.slice(1).find((h) =>
      editor.isActive("heading", { level: h.level }),
    )?.level ?? 0;

  return (
    <div className="surface flex flex-wrap items-center gap-0.5 rounded-xl px-2 py-1.5">
      <select
        aria-label="Text style"
        value={currentHeading}
        onChange={(e) => {
          const level = Number(e.target.value);
          const chain = editor.chain().focus();
          if (level === 0) chain.setParagraph().run();
          else chain.setHeading({ level: level as 1 | 2 | 3 }).run();
        }}
        className="mr-1 h-8 rounded-md border border-ink-200 bg-white px-2 text-xs font-medium text-ink-700 outline-none hover:bg-ink-50 focus:border-accent"
      >
        {HEADINGS.map((h) => (
          <option key={h.level} value={h.level}>
            {h.label}
          </option>
        ))}
      </select>

      <Divider />

      <Button
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        label="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline className="h-4 w-4" />
      </Button>

      <Divider />

      <Button
        label="Bulleted list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button
        label="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4" />
      </Button>

      <Divider />

      <Button
        label="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        label="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
