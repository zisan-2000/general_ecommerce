// components/tinymceEditor.tsx

import React from "react";
import { Editor } from "@tinymce/tinymce-react";

interface HeadingMenuItem {
  type: "menuitem";
  text: string;
  onAction: () => void;
}

// Describe the APIs used here; TinyMCE itself is loaded from the cloud.
interface ScopedHeadingEditor {
  formatter: {
    remove: (name: string) => void;
    apply: (name: string) => void;
  };
  ui: {
    registry: {
      addMenuButton: (
        name: string,
        options: {
          text: string;
          tooltip: string;
          fetch: (callback: (items: HeadingMenuItem[]) => void) => void;
        },
      ) => void;
    };
  };
}

interface TinymceEditorProps {
  value: string;
  onChange: (content: string) => void;
  height?: number;
  selectionScopedHeadings?: boolean;
}

const scopedHeadingFormats = [
  ["policyHeading1", "Heading 1", "2em"],
  ["policyHeading2", "Heading 2", "1.75em"],
  ["policyHeading3", "Heading 3", "1.5em"],
  ["policyHeading4", "Heading 4", "1.25em"],
  ["policyHeading5", "Heading 5", "1.125em"],
  ["policyHeading6", "Heading 6", "1em"],
] as const;

const TinymceEditor: React.FC<TinymceEditorProps> = ({
  value,
  onChange,
  height = 400,
  selectionScopedHeadings = false,
}) => {
  return (
    <Editor
      apiKey="didaagwh80y1vdeim49h9hsorsljm8n5mmr713t1r6n5m4zr"
      init={{
        height: height,
        menubar: true,
        plugins: [
          "advlist",
          "autolink",
          "lists",
          "link",
          "image",
          "charmap",
          "preview",
          "anchor",
          "searchreplace",
          "visualblocks",
          "code",
          "fullscreen",
          "insertdatetime",
          "media",
          "table",
          "code",
          "help",
          "wordcount",
        ],
        toolbar:
          `undo redo | ${selectionScopedHeadings ? "selectionheadings" : "blocks"} | ` +
          "bold italic forecolor | alignleft aligncenter " +
          "alignright alignjustify | bullist numlist outdent indent | " +
          "removeformat | help",
        formats: selectionScopedHeadings
          ? Object.fromEntries(
              scopedHeadingFormats.map(([name, , fontSize]) => [
                name,
                {
                  inline: "span",
                  styles: {
                    fontSize,
                    fontWeight: "700",
                    lineHeight: "1.25",
                  },
                  exact: true,
                },
              ]),
            )
          : undefined,
        setup: selectionScopedHeadings
          ? (editor: ScopedHeadingEditor) => {
              const clearScopedHeadings = () => {
                for (const [formatName] of scopedHeadingFormats) {
                  editor.formatter.remove(formatName);
                }
              };

              editor.ui.registry.addMenuButton("selectionheadings", {
                text: "Paragraph / Heading",
                tooltip: "Format selected text",
                fetch: (callback: (items: HeadingMenuItem[]) => void) => {
                  callback([
                    {
                      type: "menuitem",
                      text: "Paragraph",
                      onAction: clearScopedHeadings,
                    },
                    ...scopedHeadingFormats.map(([formatName, label]) => ({
                      type: "menuitem" as const,
                      text: label,
                      onAction: () => {
                        clearScopedHeadings();
                        editor.formatter.apply(formatName);
                      },
                    })),
                  ]);
                },
              });
            }
          : undefined,
        content_style: `
          body { 
            font-family: Helvetica, Arial, sans-serif; 
            font-size: 14px;
            background-color: hsl(var(--background));
            color: hsl(var(--foreground));
          }
          h1, h2, h3, h4, h5, h6 {
            color: hsl(var(--primary));
          }
          a {
            color: hsl(var(--primary));
          }
          code {
            background-color: hsl(var(--muted));
            color: hsl(var(--muted-foreground));
            padding: 0.2rem 0.4rem;
            border-radius: 0.25rem;
          }
          blockquote {
            border-left: 4px solid hsl(var(--border));
            padding-left: 1rem;
            color: hsl(var(--muted-foreground));
          }
          table {
            border: 1px solid hsl(var(--border));
          }
          th, td {
            border: 1px solid hsl(var(--border));
            padding: 0.5rem;
          }
          th {
            background-color: hsl(var(--muted));
          }
        `,
      }}
      value={value}
      onEditorChange={onChange}
    />
  );
};

export default TinymceEditor;
