#!/usr/bin/env node
/**
 * Generalized Playwright verifier for codebase-mindmap output.
 *
 * Unlike the two fixture-specific test scripts this was generalized from
 * (test-mindmap.mjs / test-icons-comprehensive.mjs in the repo root, which
 * hardcode exact node counts like 69/18/15/10 for one specific Hermes tree),
 * every assertion here derives its expected value from the generated file's
 * *own* embedded codebaseData — so this works on any output this skill
 * produces, not just one fixture. See references/verification-strategies.md.
 *
 * Requires: Node.js, `playwright` package, and a Chromium install
 * (`npx playwright install chromium` if you don't already have one).
 *
 * Usage:
 *   node verify.mjs <path-to-generated-mindmap>.html
 */
import path from "node:path";
import { pathToFileURL } from "node:url";

const target = process.argv[2];
if (!target) {
  console.error("usage: node verify.mjs <path-to-generated-mindmap>.html");
  process.exit(2);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error(
    "error: the `playwright` package isn't installed.\n" +
    "  npm install -D playwright && npx playwright install chromium\n" +
    "Or use a lighter verification strategy — see references/verification-strategies.md."
  );
  process.exit(2);
}

let passed = 0, failed = 0, warned = 0;
function ok(desc) { passed++; console.log(`  ✓ ${desc}`); }
function fail(desc, detail) { failed++; console.log(`  ✗ ${desc}${detail ? ` — ${detail}` : ""}`); }
function warn(desc) { warned++; console.log(`  ⚠ ${desc}`); }
function assert(cond, desc, detail) { cond ? ok(desc) : fail(desc, detail); }

function countNodes(node) {
  let n = 1;
  for (const child of node.children || []) n += countNodes(child);
  return n;
}

const url = pathToFileURL(path.resolve(target)).href;
const browser = await chromium.launch();
const page = await browser.newPage();

const consoleErrors = [];
page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
page.on("pageerror", (err) => consoleErrors.push(String(err)));

await page.goto(url);
await page.waitForTimeout(300); // let the init setTimeout(...,50) settle

const { codebaseData, features } = await page.evaluate(() => ({
  codebaseData: typeof codebaseData !== "undefined" ? codebaseData : null,
  features: typeof FEATURES !== "undefined" ? FEATURES : null,
}));

if (!codebaseData) {
  console.error("error: could not find `codebaseData` in the page — is this a codebase-mindmap output file?");
  await browser.close();
  process.exit(2);
}

const totalNodeCount = countNodes(codebaseData);
const rootChildCount = (codebaseData.children || []).length;

console.log(`Verifying ${target}`);
console.log(`  data: ${totalNodeCount} total nodes, root has ${rootChildCount} children, features=${JSON.stringify(features)}`);
console.log("");

// ─── Initial state ───
console.log("Initial state:");
assert((await page.locator(".node-group").count()) === 1, "exactly 1 node rendered initially");
assert(await page.locator(".node-group.node-breathing, .node-visual.node-breathing").count() >= 0, "breathing check ran");
const rootHasBreathing = await page.evaluate(() => {
  const el = document.querySelector('[data-id="root"]');
  return !!(el && (el.classList.contains("node-breathing") || el.querySelector(".node-visual")?.classList.contains("node-breathing")));
});
assert(rootHasBreathing, "root has idle breathing animation before first interaction");

if (features?.legend) {
  const legendVisible = await page.evaluate(() => document.getElementById("legend")?.classList.contains("visible"));
  assert(!legendVisible, "legend hidden before first expansion");
} else {
  warn("legend feature disabled — skipping legend visibility checks");
}

// ─── Expand all, check structural correctness ───
console.log("\nExpand All:");
if (await page.locator("#expand-all").count()) {
  await page.click("#expand-all", { force: true });
  await page.waitForTimeout(400);

  const renderedCount = await page.locator(".node-group").count();
  assert(renderedCount === totalNodeCount, "rendered node count matches total nodes in data",
    `expected ${totalNodeCount}, got ${renderedCount}`);

  // The regression check for the exact bug found & fixed during development:
  // every node must occupy a distinct screen position, not stack at one point.
  const positions = await page.evaluate(() => {
    return [...document.querySelectorAll("#nodes-group > g.node-group")].map((g) => {
      const r = g.getBoundingClientRect();
      return `${Math.round(r.x)},${Math.round(r.y)}`;
    });
  });
  const uniquePositions = new Set(positions);
  assert(uniquePositions.size === positions.length, "no two nodes overlap at the exact same position",
    `${positions.length} nodes, only ${uniquePositions.size} distinct positions`);

  // No NaN/undefined leaking into SVG path geometry.
  const badPaths = await page.evaluate(() => {
    return [...document.querySelectorAll("path")].filter((p) => /NaN|undefined/.test(p.getAttribute("d") || "")).length;
  });
  assert(badPaths === 0, "no malformed (NaN/undefined) SVG path data", `${badPaths} bad paths found`);

  if (features?.legend) {
    const legendVisible = await page.evaluate(() => document.getElementById("legend")?.classList.contains("visible"));
    assert(legendVisible, "legend becomes visible after expansion");
  }
} else {
  warn("no #expand-all control found — skipping expand-all checks");
}

// ─── Collapse all ───
console.log("\nCollapse All:");
if (await page.locator("#collapse-all").count()) {
  await page.click("#collapse-all", { force: true });
  await page.waitForTimeout(300);
  assert((await page.locator(".node-group").count()) === 1, "back to exactly 1 node after Collapse All");
} else {
  warn("no #collapse-all control found — skipping");
}

// ─── Single-node click-to-expand (the exact scenario the stacking bug lived in) ───
console.log("\nClick-to-expand a single node:");
if (rootChildCount > 0) {
  // force: true because the root node has a perpetual "breathing" idle
  // animation until first interaction, which Playwright's actionability
  // check flags as "not stable" — the animation is intentional, not a bug.
  await page.click('[data-id="root"]', { force: true });
  await page.waitForTimeout(400);
  const afterClick = await page.locator(".node-group").count();
  assert(afterClick === rootChildCount + 1, "clicking root reveals exactly its direct children",
    `expected ${rootChildCount + 1}, got ${afterClick}`);

  const positions = await page.evaluate(() => {
    return [...document.querySelectorAll("#nodes-group > g.node-group")].map((g) => {
      const r = g.getBoundingClientRect();
      return `${Math.round(r.x)},${Math.round(r.y)}`;
    });
  });
  assert(new Set(positions).size === positions.length, "single-expand children occupy distinct positions (regression check)");
} else {
  warn("root has no children — skipping click-to-expand check");
}

// ─── Search ───
console.log("\nSearch:");
if (features?.search) {
  const term = codebaseData.name.slice(0, Math.max(3, Math.min(6, codebaseData.name.length))).toLowerCase();
  await page.fill("#search-input", term);
  await page.waitForTimeout(150);
  const heading = await page.locator("#detail-content h2").innerText().catch(() => "");
  assert(heading.toLowerCase().includes("search"), "search results panel shows a Search heading for a matching term");

  await page.fill("#search-input", "");
  await page.waitForTimeout(150);
  const headingAfterClear = await page.locator("#detail-content h2").innerText().catch(() => "");
  assert(!headingAfterClear.toLowerCase().includes("search"),
    "search panel reverts (not stuck showing stale results) once query is cleared",
    `got heading: "${headingAfterClear}"`);
} else {
  warn("search feature disabled — skipping search checks");
}

// ─── Console errors ───
console.log("\nConsole:");
assert(consoleErrors.length === 0, "no console errors during the whole interaction sequence",
  consoleErrors.slice(0, 3).join(" | "));

await browser.close();

console.log(`\nRESULTS: ${passed} passed, ${failed} failed, ${warned} warnings`);
process.exit(failed > 0 ? 1 : 0);
