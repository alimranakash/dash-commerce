"use client";

import { TextAlign } from "@tiptap/extension-text-align";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import {
  Bold,
  Check,
  CornerDownLeft,
  Heading2,
  Heading3,
  Heading4,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Pilcrow,
  Redo2,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  TextAlignStart,
  Underline,
  Undo2,
  Unlink,
  X
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ComponentType, KeyboardEvent } from "react";
import { isSafeBarHref } from "../../notification-bar/notification-bar.render";
import {
  PRODUCT_DESCRIPTION_CONTENT_CLASS,
  productDescriptionEditorHtml
} from "../product-description";

/**
 * The rich-text editor behind a product's short and long description.
 *
 * It writes HTML into a hidden input under the field's own name, so the product
 * action reads it exactly as it read the textarea it replaces. What it can
 * produce is held to what the storefront's `ProductRichText` renders — no code,
 * no rules, no images — and links pass the same `isSafeBarHref` allow-list on
 * the way in as they do on the way out.
 *
 * A description saved before the editor existed is plain text; it opens as the
 * lines it was typed as and is stored unchanged until the seller edits it.
 */

type ProductDescriptionToolbar = "full" | "minimal";

type ProductDescriptionEditorProps = {
  label: string;
  name: string;
  /** Called with the editor's HTML, or "" when there is no text left. */
  onChange: (value: string) => void;
  placeholder: string;
  toolbar: ProductDescriptionToolbar;
  value: string;
};

export function ProductDescriptionEditor({
  label,
  name,
  onChange,
  placeholder,
  toolbar,
  value
}: ProductDescriptionEditorProps) {
  const full = toolbar === "full";
  // The last value this editor produced. A `value` that differs came from
  // outside — a Generate with AI draft — and is loaded into the editor.
  const emitted = useRef(value);
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const editor = useEditor({
    content: productDescriptionEditorHtml(value),
    editorProps: {
      attributes: {
        "aria-label": label,
        "aria-multiline": "true",
        class: `${PRODUCT_DESCRIPTION_CONTENT_CLASS} ${full ? "min-h-36" : "min-h-16"} px-3.5 py-3 text-sm font-normal leading-6 text-[#292a34] outline-none`,
        role: "textbox"
      }
    },
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        heading: full ? { levels: [2, 3, 4] } : false,
        horizontalRule: false,
        link: {
          autolink: true,
          defaultProtocol: "https",
          isAllowedUri: (url, { defaultValidate }) => defaultValidate(url) && isSafeBarHref(url),
          openOnClick: false
        },
        trailingNode: false
      }),
      ...(full ? [TextAlign.configure({ types: ["heading", "paragraph"] })] : [])
    ],
    // Rendered on the client only, so the server's HTML and the first client
    // render agree.
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => {
      // Empty lines a seller leaves at the end are not content.
      const html = current.getText().trim() ? current.getHTML().replace(/(?:<p><\/p>)+$/, "") : "";
      emitted.current = html;
      onChange(html);
    }
  });

  useEffect(() => {
    if (!editor || value === emitted.current) {
      return;
    }

    emitted.current = value;
    editor.commands.setContent(productDescriptionEditorHtml(value), { emitUpdate: false });
  }, [editor, value]);

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            alignCenter: current.isActive({ textAlign: "center" }),
            alignJustify: current.isActive({ textAlign: "justify" }),
            alignRight: current.isActive({ textAlign: "right" }),
            bold: current.isActive("bold"),
            bulletList: current.isActive("bulletList"),
            canRedo: current.can().redo(),
            canUndo: current.can().undo(),
            empty: current.isEmpty,
            h2: current.isActive("heading", { level: 2 }),
            h3: current.isActive("heading", { level: 3 }),
            h4: current.isActive("heading", { level: 4 }),
            italic: current.isActive("italic"),
            link: current.isActive("link"),
            orderedList: current.isActive("orderedList"),
            paragraph: current.isActive("paragraph"),
            underline: current.isActive("underline")
          }
        : null
  });

  function run(command: (current: Editor) => void) {
    if (editor) {
      command(editor);
    }
  }

  function openLink() {
    if (!editor) {
      return;
    }

    const href: unknown = editor.getAttributes("link").href;
    setLinkError(null);
    setLinkDraft(typeof href === "string" ? href : "");
  }

  function closeLink() {
    setLinkDraft(null);
    setLinkError(null);
    editor?.commands.focus();
  }

  function applyLink() {
    if (!editor || linkDraft === null) {
      return;
    }

    const typed = linkDraft.trim();

    if (!typed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      closeLink();
      return;
    }

    // "example.com" means the website, the way a seller would say it.
    const href = /^([a-z][a-z0-9+.-]*:|\/|#)/i.test(typed) ? typed : `https://${typed}`;

    if (!isSafeBarHref(href)) {
      setLinkError("Use a web address, a page on your store, or a mailto: or tel: link.");
      return;
    }

    if (editor.state.selection.empty && !editor.isActive("link")) {
      editor
        .chain()
        .focus()
        .insertContent({ marks: [{ attrs: { href }, type: "link" }], text: typed, type: "text" })
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }

    closeLink();
  }

  function handleLinkKey(event: KeyboardEvent<HTMLInputElement>) {
    // Enter would otherwise submit the whole product form.
    if (event.key === "Enter") {
      event.preventDefault();
      applyLink();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeLink();
    }
  }

  const disabled = !editor;

  return (
    <div className="overflow-hidden rounded-lg border border-[#dedcea] bg-white focus-within:border-[#8b5cf6] focus-within:ring-2 focus-within:ring-[#7c3aed]/10">
      <div
        aria-label={`${label} formatting`}
        className="flex flex-wrap items-center gap-1 border-b border-[#e7e5ef] bg-[#fafaff] p-2"
        role="toolbar"
      >
        {full ? (
          <>
            <ToolbarButton
              active={state?.paragraph}
              disabled={disabled}
              icon={Pilcrow}
              label="Paragraph"
              onClick={() => run((current) => current.chain().focus().setParagraph().run())}
            />
            <ToolbarButton
              active={state?.h2}
              disabled={disabled}
              icon={Heading2}
              label="Heading"
              onClick={() =>
                run((current) => current.chain().focus().toggleHeading({ level: 2 }).run())
              }
            />
            <ToolbarButton
              active={state?.h3}
              disabled={disabled}
              icon={Heading3}
              label="Subheading"
              onClick={() =>
                run((current) => current.chain().focus().toggleHeading({ level: 3 }).run())
              }
            />
            <ToolbarButton
              active={state?.h4}
              disabled={disabled}
              icon={Heading4}
              label="Small heading"
              onClick={() =>
                run((current) => current.chain().focus().toggleHeading({ level: 4 }).run())
              }
            />
            <ToolbarDivider />
          </>
        ) : null}
        <ToolbarButton
          active={state?.bold}
          disabled={disabled}
          icon={Bold}
          label="Bold"
          onClick={() => run((current) => current.chain().focus().toggleBold().run())}
        />
        <ToolbarButton
          active={state?.italic}
          disabled={disabled}
          icon={Italic}
          label="Italic"
          onClick={() => run((current) => current.chain().focus().toggleItalic().run())}
        />
        {full ? (
          <ToolbarButton
            active={state?.underline}
            disabled={disabled}
            icon={Underline}
            label="Underline"
            onClick={() => run((current) => current.chain().focus().toggleUnderline().run())}
          />
        ) : null}
        <ToolbarDivider />
        <ToolbarButton
          active={state?.bulletList}
          disabled={disabled}
          icon={List}
          label="Bulleted list"
          onClick={() => run((current) => current.chain().focus().toggleBulletList().run())}
        />
        <ToolbarButton
          active={state?.orderedList}
          disabled={disabled}
          icon={ListOrdered}
          label="Numbered list"
          onClick={() => run((current) => current.chain().focus().toggleOrderedList().run())}
        />
        {full ? (
          <>
            <ToolbarDivider />
            <ToolbarButton
              active={Boolean(
                state && !state.alignCenter && !state.alignRight && !state.alignJustify
              )}
              disabled={disabled}
              icon={TextAlignStart}
              label="Align left"
              onClick={() => run((current) => current.chain().focus().unsetTextAlign().run())}
            />
            <ToolbarButton
              active={state?.alignCenter}
              disabled={disabled}
              icon={TextAlignCenter}
              label="Align center"
              onClick={() => run((current) => current.chain().focus().setTextAlign("center").run())}
            />
            <ToolbarButton
              active={state?.alignRight}
              disabled={disabled}
              icon={TextAlignEnd}
              label="Align right"
              onClick={() => run((current) => current.chain().focus().setTextAlign("right").run())}
            />
            <ToolbarButton
              active={state?.alignJustify}
              disabled={disabled}
              icon={TextAlignJustify}
              label="Justify"
              onClick={() =>
                run((current) => current.chain().focus().setTextAlign("justify").run())
              }
            />
          </>
        ) : null}
        <ToolbarDivider />
        <ToolbarButton
          active={state?.link || linkDraft !== null}
          disabled={disabled}
          icon={LinkIcon}
          label="Link"
          onClick={openLink}
        />
        {full ? (
          <>
            <ToolbarButton
              disabled={disabled}
              icon={CornerDownLeft}
              label="Line break (Shift+Enter)"
              onClick={() => run((current) => current.chain().focus().setHardBreak().run())}
            />
            <ToolbarDivider />
            <ToolbarButton
              disabled={!state?.canUndo}
              icon={Undo2}
              label="Undo"
              onClick={() => run((current) => current.chain().focus().undo().run())}
            />
            <ToolbarButton
              disabled={!state?.canRedo}
              icon={Redo2}
              label="Redo"
              onClick={() => run((current) => current.chain().focus().redo().run())}
            />
          </>
        ) : null}
      </div>

      {linkDraft !== null ? (
        <div className="grid gap-1 border-b border-[#e7e5ef] bg-[#fafaff] p-2">
          <div className="flex flex-wrap items-center gap-1">
            <input
              aria-label="Link address"
              autoFocus
              className="min-w-0 flex-1"
              onChange={(event) => {
                setLinkDraft(event.target.value);
                setLinkError(null);
              }}
              onKeyDown={handleLinkKey}
              placeholder="https://example.com"
              type="text"
              value={linkDraft}
            />
            <ToolbarButton icon={Check} label="Apply link" onClick={applyLink} />
            {state?.link ? (
              <ToolbarButton
                icon={Unlink}
                label="Remove link"
                onClick={() => {
                  run((current) =>
                    current.chain().focus().extendMarkRange("link").unsetLink().run()
                  );
                  closeLink();
                }}
              />
            ) : null}
            <ToolbarButton icon={X} label="Cancel" onClick={closeLink} />
          </div>
          {linkError ? <span className="field-error">{linkError}</span> : null}
        </div>
      ) : null}

      <div className="relative">
        {(state?.empty ?? !value) ? (
          <p className="pointer-events-none absolute left-3.5 top-3 m-0 text-sm leading-6 text-[#a2a3b0]">
            {placeholder}
          </p>
        ) : null}
        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          <div className={full ? "min-h-36" : "min-h-16"} />
        )}
      </div>

      <input name={name} type="hidden" value={value} />
    </div>
  );
}

function ToolbarButton({
  active,
  disabled,
  icon: Icon,
  label,
  onClick
}: {
  active?: boolean | undefined;
  disabled?: boolean | undefined;
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active ?? undefined}
      className={`grid h-8 w-8 place-items-center rounded-md hover:bg-[#eee9ff] hover:text-[#7548f5] disabled:opacity-40 ${active ? "bg-[#eee9ff] text-[#7548f5]" : "text-[#5f616d]"}`}
      disabled={disabled}
      // Keeps the selection in the editor, so the button formats what was selected.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ToolbarDivider() {
  return <span aria-hidden="true" className="mx-1 h-5 border-l border-[#e7e5ef]" />;
}
