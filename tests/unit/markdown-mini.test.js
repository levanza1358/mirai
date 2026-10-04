import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "../../src/shared/utils/sanitizeHtml.js";

describe("MarkdownMini sanitizeHtml", () => {
  it("returns empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
    expect(sanitizeHtml(null)).toBe("");
    expect(sanitizeHtml(undefined)).toBe("");
  });

  it("keeps plain markdown-derived html", () => {
    expect(sanitizeHtml("<p><strong>bold</strong> text</p>")).toBe("<p><strong>bold</strong> text</p>");
  });

  it("strips script tags with content", () => {
    expect(sanitizeHtml('<p>hi</p><script>alert(1)</script>')).toBe("<p>hi</p>");
  });

  it("strips self-closing dangerous tags", () => {
    expect(sanitizeHtml('<iframe src="x"></iframe><p>ok</p>')).toBe("<p>ok</p>");
  });

  it("removes inline event handlers", () => {
    expect(sanitizeHtml('<img src="x" onerror="alert(1)">')).not.toContain("onerror");
    expect(sanitizeHtml('<a onclick="evil()" href="http://a">a</a>')).not.toContain("onclick");
  });

  it("neutralizes javascript: urls", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toMatch(/javascript:/i);
  });
});
