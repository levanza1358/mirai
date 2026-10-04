#!/usr/bin/env node
/**
 * Mirai rebrand script.
 *
 * Performs a deterministic, ordered set of literal replacements across the repo.
 * Ordering matters (most specific patterns run first) so we never produce
 * half-replaced identifiers like `Mirai.com`.
 *
 * Usage:
 *   node scripts/rebrand.mjs --dry     # report only
 *   node scripts/rebrand.mjs           # apply
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DRY = process.argv.includes("--dry");

// Skip directories that are generated / vendored / not part of the source tree.
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".next-cli-build",
  ".next-analyze",
  ".git",
  "dist",
  "build",
  "coverage",
]);

// Only touch text files we care about.
const TEXT_EXT = new Set([
  ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx",
  ".json", ".md", ".mdx", ".css", ".scss",
  ".yml", ".yaml", ".html", ".svg", ".txt", ".sh", ".ps1", ".example",
]);

const NO_EXT = new Set(["dockerfile", "captain-definition", ".gitignore", ".npmignore", ".dockerignore", ".env.example"]);

/**
 * Ordered replacement table. Each entry: [find, replace, options]
 * - literal: plain string (default) or regex when `regex: true`
 * - caseSensitive: default false for the wordmark variants we enumerate explicitly
 */
const RULES = [
  // --- 1. Fully-qualified URLs / hostnames (most specific first) -----------------
  ["https://9router.com", "https://mirai.local"],
  ["http://9router.com", "http://mirai.local"],
  ["9router.com", "mirai.local"],
  ["9router.github.io", "mirai-router.github.io"],

  // --- 2. Package names ----------------------------------------------------------
  ["9router-app", "mirai-app"],
  ["9router-docs", "mirai-docs"],
  ["9router-tests", "mirai-tests"],
  ["9router-embeddings", "mirai-embeddings"],

  // --- 3. Env vars + identifiers -------------------------------------------------
  ["NINEROUTER_", "MIRAI_"],
  ["x-9r-", "x-mirai-"],

  // --- 4. Data dir / dotfiles ----------------------------------------------------
  ["~/.9router", "~/.mirai"],
  ["/root/.9router", "/root/.mirai"],
  ["/.9router", "/.mirai"],
  [".9router/", ".mirai/"],
  [`".9router"`, `".mirai"`],
  ["`.9router`", "`.mirai`"],
  ["9router-data", "mirai-data"],
  ["9router-*", "mirai-*"],

  // --- 5. Wordmark / prose -------------------------------------------------------
  ["9Router", "Mirai"],
  ["9router", "mirai"],
  ["9ROUTER", "MIRAI"],
];

// Files/patterns we intentionally leave alone (historical changelog, upstream URLs we
// cannot invent, image assets, and this script itself).
const SKIP_FILES = new Set([
  path.join(ROOT, "CHANGELOG.md"),
  path.join(ROOT, "REBRAND-NOTES.md"),
  path.join(ROOT, "scripts", "rebrand.mjs"),
]);
const SKIP_FILE_RE = [
  /[\\/]\.github[\\/]issue-assets[\\/]/,
  /[\\/]\.github[\\/]assets[\\/]/,
  /[\\/]public[\\/]providers[\\/]/,
  /[\\/]docs[\\/]images[\\/]/,
  /[\\/]images[\\/]/,
];

const stats = { files: 0, replacements: 0 };
const changed = [];

function shouldSkip(rel) {
  const segments = rel.split(/[\\/]/);
  if (segments.some((s) => SKIP_DIRS.has(s))) return true;
  const abs = path.join(ROOT, rel);
  if (SKIP_FILES.has(abs)) return true;
  if (SKIP_FILE_RE.some((re) => re.test(abs))) return true;
  const ext = path.extname(rel).toLowerCase();
  const base = path.basename(rel).toLowerCase();
  if (!TEXT_EXT.has(ext) && !NO_EXT.has(base)) return true;
  return false;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(abs, out);
    } else if (entry.isFile()) {
      out.push(abs);
    }
  }
  return out;
}

function applyRules(text) {
  let out = text;
  let local = 0;
  for (const [find, replace] of RULES) {
    if (!out.includes(find)) continue;
    const before = out;
    out = out.split(find).join(replace);
    // Count non-overlapping occurrences of `find`.
    let idx = 0;
    while ((idx = before.indexOf(find, idx)) !== -1) {
      local++;
      idx += find.length;
    }
  }
  return { out, local };
}

const files = walk(ROOT);

for (const abs of files) {
  const rel = path.relative(ROOT, abs);
  if (shouldSkip(rel)) continue;
  let raw;
  try {
    raw = fs.readFileSync(abs, "utf8");
  } catch {
    continue;
  }
  if (!/9router|9Router|9ROUTER|NINEROUTER|x-9r-/.test(raw)) continue;

  const { out, local } = applyRules(raw);
  if (out === raw) continue;

  stats.files++;
  stats.replacements += local;
  changed.push(`${rel}  (+${local})`);
  if (!DRY) fs.writeFileSync(abs, out, "utf8");
}

console.log(`${DRY ? "[dry-run] " : ""}files changed: ${stats.files}`);
console.log(`${DRY ? "[dry-run] " : ""}replacements:  ${stats.replacements}`);
if (process.argv.includes("--verbose")) {
  for (const line of changed.sort()) console.log("  " + line);
}
