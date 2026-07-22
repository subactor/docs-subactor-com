import test from "node:test";
import assert from "node:assert/strict";

import {escapeHtml, renderMarkdown, renderPage} from "../bin/build-docs.mjs";

test("headings render at their level with inline markup", () => {
  const html = renderMarkdown("# Title\n\n## Sub `code`\n");
  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /<h2>Sub <code>code<\/code><\/h2>/);
});

test("fenced code keeps markup literal and is escaped", () => {
  const html = renderMarkdown("```js\nconst a = '<b>' && `x`;\n**not bold**\n```\n");
  assert.match(html, /<pre><code class="language-js">/);
  assert.match(html, /&lt;b&gt;/);
  assert.match(html, /\*\*not bold\*\*/); // emphasis must NOT apply inside fences
  assert.doesNotMatch(html, /<strong>/);
});

test("tables render with header and body, the dominant feature here", () => {
  const html = renderMarkdown("| Col | Val |\n|---|---|\n| a | `b` |\n| c | d |\n");
  assert.match(html, /<thead><tr><th>Col<\/th><th>Val<\/th><\/tr><\/thead>/);
  assert.match(html, /<td>a<\/td><td><code>b<\/code><\/td>/);
  assert.equal((html.match(/<tr>/g) || []).length, 3);
});

test("nested lists open and close in order", () => {
  const html = renderMarkdown("- one\n  - nested\n- two\n\nafter\n");
  assert.match(html, /<ul>\n<li>one<\/li>\n<ul>\n<li>nested<\/li>\n<\/ul>\n<li>two<\/li>\n<\/ul>/);
  assert.match(html, /<p>after<\/p>/);
});

test("relative .md links become .html; external and anchors are untouched", () => {
  const html = renderMarkdown(
    "[a](platform/X.md) [b](https://example.com/y.md) [c](#frag) [d](README.md#top)",
  );
  assert.match(html, /href="platform\/X.html"/);
  assert.match(html, /href="https:\/\/example.com\/y.md"/);
  assert.match(html, /href="#frag"/);
  assert.match(html, /href="README.html#top"/);
});

test("raw html in source text is escaped, not emitted", () => {
  const html = renderMarkdown("hello <script>alert(1)</script>\n");
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("page shell carries the title and a home link", () => {
  const page = renderPage("# X\nbody", {title: "My & Page", home: "../index.html"});
  assert.match(page, /<title>My &amp; Page — Subactor Docs<\/title>/);
  assert.match(page, /href="\.\.\/index.html"/);
  assert.match(page, /<h1>X<\/h1>/);
});

test("escapeHtml covers the four risky characters", () => {
  assert.equal(escapeHtml(`<a href="x">&`), "&lt;a href=&quot;x&quot;&gt;&amp;");
});
