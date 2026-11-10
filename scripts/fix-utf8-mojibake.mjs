#!/usr/bin/env node
/**
 * Repairs UTF-8 text that was decoded as Windows-1252 (double-encoded mojibake).
 *
 * Usage:
 *   node scripts/fix-utf8-mojibake.mjs          # rewrite files
 *   node scripts/fix-utf8-mojibake.mjs --check  # exit 1 if any mojibake remains
 *
 * Sources are written with unicode escapes on purpose: this file must never
 * contain the mojibake it repairs.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOTS = ["app", "components", "lib", "prisma"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".json"]);

const pairs = [
  // Punctuation and symbols
  ["\u00e2\u20ac\u201d", "\u2014"], // em dash
  ["\u00e2\u20ac\u201c", "\u2013"], // en dash
  ["\u00e2\u20ac\u00a6", "\u2026"], // ellipsis
  ["\u00e2\u20ac\u0153", "\u201c"], // left double quote
  ["\u00e2\u20ac\u009d", "\u201d"], // right double quote
  ["\u00e2\u20ac\u02dc", "\u2018"], // left single quote
  ["\u00e2\u20ac\u2122", "\u2019"], // right single quote
  ["\u00e2\u20ac\u00a2", "\u2022"], // bullet
  ["\u00e2\u2020\u2019", "\u2192"], // right arrow
  ["\u00e2\u2020\u0090", "\u2190"], // left arrow
  ["\u00e2\u0153\u201c", "\u2713"], // check mark
  ["\u00e2\u0153\u2022", "\u2715"], // cross mark
  ["\u00e2\u0153\u2014", "\u2715"], // heavy ballot X
  ["\u00e2\u0161\u2122", "\u2699"], // gear
  ["\u00e2\u2013\u00b6", "\u25b6"], // play
  ["\u00e2\u2013\u00be", "\u25be"], // down triangle
  ["\u00e2\u2013\u00b8", "\u25b8"], // right triangle
  ["\u00e2\u009d\u0161", "\u275a"], // pause bar
  ["\u00e2\u0161\u00a0", "\u26a0"], // warning
  ["\u00e2\u201a\u00ac", "\u20ac"], // euro
  ["\u00c2\u00b7", "\u00b7"], // middle dot
  ["\u00c2\u00a9", "\u00a9"], // copyright
  ["\u00c2\u00ae", "\u00ae"], // registered
  ["\u00c2\u00b0", "\u00b0"], // degree
  ["\u00c2\u00b1", "\u00b1"], // plus-minus
  ["\u00c2\u00d7", "\u00d7"], // multiplication
  ["\u00c2\u00f7", "\u00f7"], // division
  ["\u00c2\u00a0", "\u00a0"], // non-breaking space
  ["\u00c5\u201c", "\u0153"], // oe
  ["\u00c5\u2019", "\u0152"], // OE
  // Latin-1 letters
  ["\u00c3\u00a9", "\u00e9"], // é
  ["\u00c3\u00a8", "\u00e8"], // è
  ["\u00c3\u00a0", "\u00e0"], // à
  ["\u00c3\u00a2", "\u00e2"], // â
  ["\u00c3\u00a7", "\u00e7"], // ç
  ["\u00c3\u00b4", "\u00f4"], // ô
  ["\u00c3\u00aa", "\u00ea"], // ê
  ["\u00c3\u00ae", "\u00ee"], // î
  ["\u00c3\u00ab", "\u00eb"], // ë
  ["\u00c3\u00af", "\u00ef"], // ï
  ["\u00c3\u00bb", "\u00fb"], // û
  ["\u00c3\u00b9", "\u00f9"], // ù
  ["\u00c3\u2030", "\u00c9"], // É
  ["\u00c3\u0153", "\u00dc"], // Ü
  ["\u00c3\u00a4", "\u00e4"], // ä
  ["\u00c3\u00b6", "\u00f6"], // ö
  ["\u00c3\u00bc", "\u00fc"], // ü
  ["\u00c3\u0178", "\u00df"], // ß
];

// Longest first so multi-character sequences win before their prefixes.
const MAPPINGS = pairs.sort((a, b) => b[0].length - a[0].length);

// Anything that still looks like mojibake after the repair pass.
const SUSPICIOUS = [
  /\u00e2\u20ac/,
  /\u00e2\u2020/,
  /\u00e2\u0153/,
  /\u00e2\u2013/,
  /\u00e2\u009d/,
  /\u00e2\u0161/,
  /\u00e2\u201a/,
  /\u00c2[\u00a0-\u00bf]/,
  /\u00c3[\u0080-\u00bf]/,
  /\uFFFD/,
];

function repair(text) {
  let out = text;
  let changes = 0;
  for (const [from, to] of MAPPINGS) {
    if (!out.includes(from)) continue;
    const parts = out.split(from);
    changes += parts.length - 1;
    out = parts.join(to);
  }
  return { out, changes };
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".git"].includes(entry)) continue;
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) walk(full, files);
    else if (EXTENSIONS.has(extname(entry))) files.push(full);
  }
  return files;
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const files = ROOTS.flatMap((root) => {
    try {
      return statSync(root).isDirectory() ? walk(root) : [];
    } catch {
      return [];
    }
  });

  const changedFiles = [];
  const suspicious = [];
  let replacements = 0;

  for (const file of files) {
    const before = readFileSync(file, "utf8");
    const { out, changes } = repair(before);
    if (changes > 0) {
      replacements += changes;
      changedFiles.push(`${relative(process.cwd(), file)} (${changes})`);
      if (!checkOnly) writeFileSync(file, out, "utf8");
    }
    const lines = out.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (SUSPICIOUS.some((pattern) => pattern.test(line))) {
        suspicious.push(`${relative(process.cwd(), file)}:${index + 1}: ${line.trim()}`);
      }
    });
  }

  if (checkOnly) {
    if (changedFiles.length > 0) {
      console.error(`Mojibake found in ${changedFiles.length} file(s):`);
      for (const file of changedFiles) console.error(`  ${file}`);
    }
    if (suspicious.length > 0) {
      console.error(`Suspicious sequences remain in ${suspicious.length} line(s):`);
      for (const line of suspicious.slice(0, 40)) console.error(`  ${line}`);
    }
    const ok = changedFiles.length === 0 && suspicious.length === 0;
    console.log(ok ? "UTF-8 check passed: no mojibake found." : "UTF-8 check failed.");
    process.exit(ok ? 0 : 1);
  }

  console.log(`Repaired ${replacements} sequence(s) across ${changedFiles.length} file(s).`);
  for (const file of changedFiles) console.log(`  ${file}`);
  if (suspicious.length > 0) {
    console.error(`WARNING: ${suspicious.length} line(s) still contain suspicious sequences:`);
    for (const line of suspicious.slice(0, 40)) console.error(`  ${line}`);
    process.exitCode = 2;
  }
}

main();
