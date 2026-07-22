#!/usr/bin/env node
/**
 * Render the control service's plan store into a browsable markdown operations
 * log — one file per day, a section per `subactor ask`.
 *
 * Every founder command produces a plan (query, resolved situation, decision,
 * OQL steps, lifecycle, result). Those live in the control service and were only
 * reachable through the API or an ephemeral /tmp dump; this turns them into a
 * persistent, version-controlled log you read like a journal. The output is
 * markdown, so build-docs.mjs renders it to HTML alongside the rest of the docs.
 *
 * Usage:
 *   node bin/build-operations-log.mjs                 # fetch from the live API
 *   node bin/build-operations-log.mjs --file plans.json
 *   node bin/build-operations-log.mjs --source http://127.0.0.1:8091/api/plans
 *   node bin/build-operations-log.mjs --token <admin-token>
 */

import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "operations");
const DEFAULT_SOURCE = "http://127.0.0.1:8091/api/plans";

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

async function loadPlans() {
  const file = arg("--file");
  if (file) {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(data) ? data : data.plans || [];
  }
  const source = arg("--source") || DEFAULT_SOURCE;
  const token = arg("--token") || process.env.SUBACTOR_ADMIN_TOKEN || "";
  const response = await fetch(source, {
    headers: token ? {authorization: `Bearer ${token}`} : {},
  });
  if (!response.ok) throw new Error(`plan source ${source} returned HTTP ${response.status}`);
  const data = await response.json();
  return Array.isArray(data) ? data : data.plans || [];
}

// ── formatting ───────────────────────────────────────────────────────────────

const STATUS_ICON = {executed: "✅", proposed: "🕓", failed: "❌", approved: "☑️", rejected: "🚫"};

function dayOf(plan) {
  return String(plan.created_at || plan.executed_at || "unknown").slice(0, 10) || "unknown";
}

function timeOf(iso) {
  return String(iso || "").slice(11, 19) || "--:--:--";
}

function lifecycle(plan) {
  const stamps = [
    ["created", plan.created_at],
    ["approved", plan.approved_at],
    ["executed", plan.executed_at],
  ].filter(([, v]) => v);
  return stamps.map(([k]) => k).join(" → ") || plan.status || "unknown";
}

function target(plan) {
  const s = plan.situation || {};
  if (s.domain && s.remote_path) return `\`${s.domain}\` → \`${s.remote_path}\``;
  if (s.domain) return `\`${s.domain}\` (docroot not resolved)`;
  return "—";
}

function modelLabel(plan) {
  const base = `\`${plan.model || "—"}\``;
  const llm = plan.llm || {};
  const via = llm.selected_model || llm.provider_model;
  const source = llm.source ? ` via ${llm.source}` : "";
  return via ? `${base} (${via}${source})` : `${base}${source}`;
}

function formatResultLine(r) {
  const files = r?.files_planned ?? r?.urirun?.files_planned;
  const mode = r?.mode || r?.urirun?.mode || r?.status;
  const bits = [r?.id || r?.op, mode, files != null ? `${files} files` : null].filter(Boolean);
  return bits.join(" · ");
}

export function resultSummary(plan) {
  const results = Array.isArray(plan.results) ? plan.results : [];
  if (!results.length) return plan.status === "executed" ? "executed, no step detail recorded" : "";
  return results.map(formatResultLine).join("; ");
}

function planSection(plan) {
  const icon = STATUS_ICON[plan.status] || "•";
  const lines = [];
  lines.push(`### ${icon} ${timeOf(plan.created_at)} — ${plan.title || plan.id}`);
  lines.push("");
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| Plan | \`${plan.id}\` |`);
  lines.push(`| Model | ${modelLabel(plan)} |`);
  lines.push(`| Target | ${target(plan)} |`);
  lines.push(`| Status | **${plan.status || "?"}** |`);
  lines.push(`| Lifecycle | ${lifecycle(plan)} |`);
  if (plan.created_by) lines.push(`| By | ${plan.created_by}${plan.approved_by ? ` → approved ${plan.approved_by}` : ""} |`);
  const decision = plan.decision || {};
  if (decision.plan_steps?.length) lines.push(`| Steps | ${decision.plan_steps.map((s) => `\`${s}\``).join(", ")} |`);
  if (plan.oql_hash) lines.push(`| OQL hash | \`${String(plan.oql_hash).slice(0, 16)}…\` |`);
  const summary = resultSummary(plan);
  if (summary) lines.push(`| Result | ${summary} |`);
  lines.push("");
  return lines.join("\n");
}

// ── build ────────────────────────────────────────────────────────────────────

function buildDayFile(day, plans) {
  const ordered = [...plans].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const counts = ordered.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});
  const summary = Object.entries(counts).map(([s, n]) => `${STATUS_ICON[s] || "•"} ${n} ${s}`).join(" · ");
  const body = [
    `# Operations — ${day}`,
    "",
    `${ordered.length} operation(s): ${summary}`,
    "",
    ...ordered.map(planSection),
  ].join("\n");
  fs.writeFileSync(path.join(OUT_DIR, `${day}.md`), `${body}\n`, "utf8");
}

function buildIndex(byDay) {
  const days = Object.keys(byDay).sort().reverse();
  const total = Object.values(byDay).reduce((n, ps) => n + ps.length, 0);
  const rows = days.map((day) => {
    const ps = byDay[day];
    const executed = ps.filter((p) => p.status === "executed").length;
    return `| [${day}](${day}.md) | ${ps.length} | ${executed} |`;
  });
  const body = [
    "# Operations log",
    "",
    `Every \`subactor ask\` and founder command, from the control plan store. ${total} operation(s) across ${days.length} day(s).`,
    "",
    "| Day | Operations | Executed |",
    "|---|---|---|",
    ...rows,
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT_DIR, "index.md"), `${body}\n`, "utf8");
}

async function main() {
  const plans = await loadPlans();
  fs.mkdirSync(OUT_DIR, {recursive: true});
  const byDay = {};
  for (const plan of plans) {
    const day = dayOf(plan);
    (byDay[day] ||= []).push(plan);
  }
  for (const [day, dayPlans] of Object.entries(byDay)) buildDayFile(day, dayPlans);
  buildIndex(byDay);
  console.log(`rendered ${plans.length} operation(s) across ${Object.keys(byDay).length} day(s) → docs/operations/`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
