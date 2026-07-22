import test from "node:test";
import assert from "node:assert/strict";

import {resultSummary} from "../bin/build-operations-log.mjs";

test("resultSummary returns empty string when there are no results and the plan is not executed", () => {
  assert.equal(resultSummary({status: "proposed", results: []}), "");
});

test("resultSummary flags an executed plan with no recorded step detail", () => {
  assert.equal(resultSummary({status: "executed", results: []}), "executed, no step detail recorded");
});

test("resultSummary formats id, mode, and file count for a single result", () => {
  const summary = resultSummary({results: [{id: "step-1", mode: "apply", files_planned: 3}]});
  assert.equal(summary, "step-1 · apply · 3 files");
});

test("resultSummary falls back to op and urirun-nested fields, and joins multiple results", () => {
  const summary = resultSummary({
    results: [
      {op: "publish", urirun: {mode: "dry-run", files_planned: 5}},
      {id: "step-2", status: "skipped"},
    ],
  });
  assert.equal(summary, "publish · dry-run · 5 files; step-2 · skipped");
});

test("resultSummary omits missing bits (no id/op, no mode, no file count)", () => {
  assert.equal(resultSummary({results: [{}]}), "");
});
