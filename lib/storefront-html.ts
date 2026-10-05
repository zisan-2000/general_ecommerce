import sanitizeHtml from "sanitize-html";

export function sanitizeStorefrontHtml(content: string) {
  const hasMarkup = /<[a-z][\s\S]*>/i.test(content);
  const html = hasMarkup ? content : content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r?\n/g, "<br>");
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img"],
    allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, "*": ["class", "style"], img: ["src", "alt", "width", "height", "loading"], a: ["href", "name", "target", "rel"] },
    allowedStyles: { "*": {
      "color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i, /^[a-z]+$/i],
      "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i, /^[a-z]+$/i],
      "text-align": [/^(left|right|center|justify)$/],
      "font-weight": [/^(normal|bold|[1-9]00)$/],
      "font-style": [/^(normal|italic)$/],
      "text-decoration": [/^(none|underline|line-through)$/],
      "font-size": [/^\d+(\.\d+)?(px|pt|em|rem|%)$/],
    } },
    transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }) },
  });
}

