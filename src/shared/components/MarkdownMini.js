"use client";

import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { sanitizeHtml } from "@/shared/utils/sanitizeHtml";

/**
 * Lightweight markdown renderer for small surfaces (toasts, chips).
 *
 * Model replies come back as markdown ("**bold**", lists, `code`, links), and
 * showing the raw text leaks "**" markers. This renders it with the already
 * bundled `marked` (GFM + line breaks) and strips anything dangerous from the
 * untrusted model output before injecting it as HTML.
 */

// Tailwind typography tweaks applied to the rendered markdown output.
const PROSE_CLASSES = [
  "text-xs leading-relaxed text-foreground/90 break-words",
  "[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
  "[&_strong]:font-semibold [&_em]:italic",
  "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4",
  "[&_li]:my-0.5",
  "[&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11px] [&_code]:font-mono",
  "[&_pre]:my-1 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-surface-2 [&_pre]:p-2 [&_pre]:text-[11px]",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_a]:text-brand-500 [&_a]:underline",
  "[&_h1]:my-1 [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:my-1 [&_h2]:text-sm [&_h2]:font-semibold",
  "[&_h3]:my-1 [&_h3]:text-xs [&_h3]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-2 [&_blockquote]:text-foreground/70",
  "[&_hr]:my-2 [&_hr]:border-border",
].join(" ");

export default function MarkdownMini({ children, className = "" }) {
  const text = useMemo(() => (children == null ? "" : String(children)), [children]);
  const [html, setHtml] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!text.trim()) {
      setHtml("");
      return undefined;
    }
    // Fast path: no markdown markers -> render plain text (avoids flicker).
    if (!/[*_`#>[\]()~]/.test(text)) {
      setHtml("");
      return undefined;
    }
    import("marked")
      .then(({ marked }) => {
        if (cancelled) return;
        marked.setOptions({ gfm: true, breaks: true });
        setHtml(sanitizeHtml(marked.parse(text)));
      })
      .catch(() => {
        if (!cancelled) setHtml("");
      });
    return () => {
      cancelled = true;
    };
  }, [text]);

  if (!html) {
    return <div className={`${PROSE_CLASSES} whitespace-pre-wrap ${className}`}>{text}</div>;
  }

  return (
    // eslint-disable-next-line react/no-danger -- sanitized above
    <div className={`${PROSE_CLASSES} ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

MarkdownMini.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};
