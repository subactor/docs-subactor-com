#!/usr/bin/env node
/**
 * Render every tracked .md in this repo to a sibling .html page.
 *
 * The docs origin serves .md files as text/markdown, which browsers show as
 * raw text — so every link out of index.html landed on an unrendered wall of
 * markup. There is no build pipeline here to hook into, and the site
 * generator is a separate service; a dependency-free converter covering the
 * subset these docs actually use (headings, fenced code, tables, lists,
 * links, emphasis, blockquotes) keeps publishing a plain folder sync.
 *
 * Usage:  node bin/build-docs.mjs [--check]
 *   --check  exit 1 if any .html is missing or stale (for CI), write nothing
 */

import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------- markdown

export function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inline(text) {
  let out = escapeHtml(text);
  // code spans first so emphasis markers inside them stay literal
  out = out.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  // links; relative .md targets become the rendered .html sibling
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const isRelativeMd = /^(?![a-z]+:)(?!#).*\.md(#.*)?$/.test(href);
    const rewritten = isRelativeMd ? href.replace(/\.md(#|$)/, ".html$1") : href;
    return `<a href="${rewritten}">${label}</a>`;
  });
  return out;
}

function consumeCodeFence(lines, index, html) {
  const lang = lines[index].slice(3).trim();
  const body = [];
  index += 1;
  while (index < lines.length && !/^```/.test(lines[index])) {
    body.push(lines[index]);
    index += 1;
  }
  index += 1; // closing fence
  const cls = lang ? ` class="language-${escapeHtml(lang)}"` : "";
  html.push(`<pre><code${cls}>${escapeHtml(body.join("\n"))}</code></pre>`);
  return index;
}

function consumeHeading(index, html, heading) {
  const level = heading[1].length;
  html.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`);
  return index + 1;
}

function tableCells(row) {
  return row.replace(/^\||\|\s*$/g, "").split("|").map((c) => c.trim());
}

function consumeTable(lines, index, html) {
  const rows = [];
  while (index < lines.length && /^\|.*\|\s*$/.test(lines[index])) {
    rows.push(lines[index]);
    index += 1;
  }
  const isDivider = rows.length > 1 && tableCells(rows[1]).every((c) => /^:?-{3,}:?$/.test(c));
  const head = tableCells(rows[0]);
  const bodyRows = isDivider ? rows.slice(2) : rows.slice(1);
  html.push("<table>");
  html.push(`<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>`);
  html.push("<tbody>");
  for (const row of bodyRows) {
    html.push(`<tr>${tableCells(row).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`);
  }
  html.push("</tbody></table>");
  return index;
}

function consumeListItem(index, html, listStack, item) {
  const depth = Math.floor(item[1].length / 2) + 1;
  const kind = /\d/.test(item[2]) ? "ol" : "ul";
  while (listStack.length > depth) html.push(`</${listStack.pop()}>`);
  while (listStack.length < depth) {
    html.push(`<${kind}>`);
    listStack.push(kind);
  }
  html.push(`<li>${inline(item[3])}</li>`);
  return index + 1;
}

function consumeBlockquote(lines, index, html) {
  const body = [];
  while (index < lines.length && /^>\s?/.test(lines[index])) {
    body.push(lines[index].replace(/^>\s?/, ""));
    index += 1;
  }
  html.push(`<blockquote>${body.map((l) => inline(l)).join("<br />")}</blockquote>`);
  return index;
}

function consumeParagraph(lines, index, html) {
  const paragraph = [lines[index]];
  index += 1;
  while (
    index < lines.length
    && lines[index].trim()
    && !/^(#{1,6}\s|```|\||\s*([-*+]|\d+\.)\s|>|-{3,}\s*$)/.test(lines[index])
  ) {
    paragraph.push(lines[index]);
    index += 1;
  }
  html.push(`<p>${paragraph.map((l) => inline(l.trim())).join(" ")}</p>`);
  return index;
}

export function renderMarkdown(source) {
  const lines = String(source).replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let index = 0;

  const listStack = [];
  const closeLists = (depth = 0) => {
    while (listStack.length > depth) html.push(`</${listStack.pop()}>`);
  };

  while (index < lines.length) {
    const line = lines[index];

    if (/^```/.test(line)) {
      closeLists();
      index = consumeCodeFence(lines, index, html);
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeLists();
      index = consumeHeading(index, html, heading);
      continue;
    }

    if (/^\|.*\|\s*$/.test(line)) {
      closeLists();
      index = consumeTable(lines, index, html);
      continue;
    }

    const item = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(line);
    if (item) {
      index = consumeListItem(index, html, listStack, item);
      continue;
    }

    if (/^>\s?/.test(line)) {
      closeLists();
      index = consumeBlockquote(lines, index, html);
      continue;
    }

    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      closeLists();
      html.push("<hr />");
      index += 1;
      continue;
    }

    if (!line.trim()) {
      closeLists();
      index += 1;
      continue;
    }

    closeLists();
    index = consumeParagraph(lines, index, html);
  }
  closeLists();
  return html.join("\n");
}

// ---------------------------------------------------------------- page shell

export function renderPage(markdown, {title, home}) {
  const body = renderMarkdown(markdown);
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — Subactor Docs</title>
  <style>
    :root { --bg:#0f1419; --fg:#e7ecf1; --muted:#9aa7b5; --accent:#3d9cf0; --line:#243041; }
    * { box-sizing: border-box; }
    body { margin:0; font-family:"IBM Plex Sans","Segoe UI",sans-serif;
      background: radial-gradient(1200px 600px at 10% -10%, #1a2a3d, var(--bg));
      color: var(--fg); line-height:1.6; min-height:100vh; }
    main { max-width: 52rem; margin:0 auto; padding:3rem 1.5rem 5rem; }
    a { color: var(--accent); text-decoration:none; }
    a:hover { text-decoration:underline; }
    h1,h2,h3,h4 { letter-spacing:-0.01em; line-height:1.25; }
    h1 { font-size:1.9rem; } h2 { font-size:1.4rem; margin-top:2.2rem; }
    h3 { font-size:1.15rem; margin-top:1.8rem; }
    code { font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:0.88em;
      background:#1a2331; border:1px solid var(--line); border-radius:4px; padding:0.1em 0.35em; }
    pre { background:#0b1017; border:1px solid var(--line); border-radius:8px;
      padding:1rem; overflow-x:auto; }
    pre code { background:none; border:none; padding:0; }
    table { border-collapse:collapse; width:100%; margin:1rem 0; display:block; overflow-x:auto; }
    th,td { border:1px solid var(--line); padding:0.45rem 0.7rem; text-align:left;
      font-size:0.92rem; }
    th { background:#161f2c; }
    blockquote { border-left:3px solid var(--accent); margin:1rem 0; padding:0.2rem 1rem;
      color: var(--muted); }
    hr { border:0; border-top:1px solid var(--line); margin:2rem 0; }
    .docnav { font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:0.8rem;
      margin-bottom:2rem; color:var(--muted); }
  </style>
</head>
<body>
<main>
  <nav class="docnav"><a href="${escapeHtml(home)}">subactor/docs</a></nav>
${body}
</main>
</body>
</html>
`;
}

// ---------------------------------------------------------------- build

function trackedMarkdown() {
  return execFileSync("git", ["ls-files", "*.md"], {cwd: ROOT, encoding: "utf8"})
    .split("\n")
    .filter(Boolean);
}

export function buildAll({check = false} = {}) {
  const stale = [];
  for (const rel of trackedMarkdown()) {
    const source = fs.readFileSync(path.join(ROOT, rel), "utf8");
    const title = (/^#\s+(.+)$/m.exec(source)?.[1] ?? path.basename(rel, ".md")).trim();
    const home = `${path.relative(path.dirname(rel), ".") || "."}/index.html`.replace(/^\.\/\.\//, "./");
    const page = renderPage(source, {title, home});
    const outPath = path.join(ROOT, rel.replace(/\.md$/, ".html"));
    const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, "utf8") : null;
    if (current !== page) {
      stale.push(rel);
      if (!check) fs.writeFileSync(outPath, page, "utf8");
    }
  }
  return stale;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  const stale = buildAll({check});
  if (check && stale.length) {
    console.error(`stale or missing rendered pages:\n  ${stale.join("\n  ")}`);
    process.exit(1);
  }
  console.log(check ? "rendered pages up to date" : `rendered ${stale.length} page(s)`);
}
