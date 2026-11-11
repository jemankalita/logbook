"use client";

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { Bold, Code, Heading1, Heading2, Italic, Link2, List, ListChecks, ListOrdered, Quote, Strikethrough } from "lucide-react";
import type { DocNode } from "@/lib/rich-text";

interface ToolProps {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function Tool({ label, active, onClick, children }: ToolProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`grid size-8 place-items-center rounded-md transition ${active ? "bg-line text-fg" : "text-muted hover:bg-panel-2 hover:text-fg"}`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      task: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
    }),
  });
  const chain = () => editor.chain().focus();

  function editLink() {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link address (leave empty to remove)", previous ?? "https://");
    if (url === null) return;
    if (url.trim() === "" || url === "https://") {
      chain().extendMarkRange("link").unsetLink().run();
      return;
    }
    const href = /^(https?:\/\/|\/)/i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    chain().extendMarkRange("link").setLink({ href }).run();
  }

  return (
    <div role="toolbar" aria-label="Formatting" className="sticky top-0 z-10 -mx-1 mb-2 flex flex-wrap gap-0.5 border-b border-line bg-bg/95 px-1 py-1 backdrop-blur">
      <Tool label="Heading 1" active={s.h1} onClick={() => chain().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="size-4" aria-hidden />
      </Tool>
      <Tool label="Heading 2" active={s.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="size-4" aria-hidden />
      </Tool>
      <Tool label="Bold (Ctrl+B)" active={s.bold} onClick={() => chain().toggleBold().run()}>
        <Bold className="size-4" aria-hidden />
      </Tool>
      <Tool label="Italic (Ctrl+I)" active={s.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic className="size-4" aria-hidden />
      </Tool>
      <Tool label="Strikethrough" active={s.strike} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough className="size-4" aria-hidden />
      </Tool>
      <Tool label="Inline code" active={s.code} onClick={() => chain().toggleCode().run()}>
        <Code className="size-4" aria-hidden />
      </Tool>
      <Tool label="Bullet list" active={s.bullet} onClick={() => chain().toggleBulletList().run()}>
        <List className="size-4" aria-hidden />
      </Tool>
      <Tool label="Numbered list" active={s.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered className="size-4" aria-hidden />
      </Tool>
      <Tool label="Checklist" active={s.task} onClick={() => chain().toggleTaskList().run()}>
        <ListChecks className="size-4" aria-hidden />
      </Tool>
      <Tool label="Quote" active={s.quote} onClick={() => chain().toggleBlockquote().run()}>
        <Quote className="size-4" aria-hidden />
      </Tool>
      <Tool label="Link" active={s.link} onClick={editLink}>
        <Link2 className="size-4" aria-hidden />
      </Tool>
    </div>
  );
}

/**
 * Notion-style editor. Markdown shortcuts work as you type:
 * "# " heading, "- " bullet, "1. " numbers, "[ ] " checklist, "> " quote, "```" code block.
 */
export function RichEditor({
  initial,
  placeholder = "Start writing…  (# heading, - list, [ ] checklist)",
  onChange,
  label,
}: {
  initial: DocNode | null;
  placeholder?: string;
  onChange: (doc: DocNode) => void;
  label: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" }, protocols: ["http", "https", "mailto"] },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: initial ?? undefined,
    editorProps: { attributes: { class: "prose-doc min-h-[50vh] outline-none", "aria-label": label, role: "textbox", "aria-multiline": "true" } },
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as DocNode),
  });

  if (!editor) return <div className="min-h-[50vh] animate-pulse rounded-xl bg-panel/50" aria-hidden />;

  return (
    <div>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
