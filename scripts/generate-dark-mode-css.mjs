/**
 * Generates the dark-mode stylesheet.
 *
 * Run it after adding or changing a colour anywhere in `apps/web`:
 *
 *     npm run theme:dark
 *
 * Why generate rather than refactor: the dashboard, the admin console and the
 * storefront templates were written against literal light-mode colours - some
 * 3,300 Tailwind arbitrary values plus 1,500 declarations in `globals.css`.
 * Converting those to tokens by hand would touch nearly every file in the app
 * and would break light mode in a hundred small ways on the way through. Mapping
 * each literal to a dark counterpart instead is purely additive: every rule this
 * script writes is scoped to `[data-theme="dark"]`, so with no attribute on the
 * document nothing it emits can match, and light mode is bit-for-bit unchanged.
 *
 * Output is committed, not built on the fly, so the diff is reviewable and a
 * production build needs no extra step.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectUtilities, renderUtilityCss } from "./dark-mode/utilities.mjs";
import { buildDarkStylesheet } from "./dark-mode/stylesheet.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webSrc = path.join(root, "apps/web/src");
const globalsPath = path.join(webSrc, "app/globals.css");
const outputPath = path.join(webSrc, "app/dark-mode.generated.css");

const MODULE_MARKER_START = "/* dark-mode:generated:start */";
const MODULE_MARKER_END = "/* dark-mode:generated:end */";

const HEADER = `/*
 * GENERATED FILE - do not edit by hand.
 *
 * Written by \`npm run theme:dark\` (scripts/generate-dark-mode-css.mjs) from the
 * colours already present in apps/web/src. Every rule below is scoped to
 * \`[data-theme="dark"]\`; with no such attribute on <html> none of it applies,
 * which is what keeps light mode exactly as it was.
 *
 * To change how a colour translates, edit scripts/dark-mode/color.mjs and
 * regenerate - do not patch the output.
 */
`;

function walkFiles(dir, test, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "generated") {
        continue;
      }

      walkFiles(full, test, found);
      continue;
    }

    if (test(entry.name)) {
      found.push(full);
    }
  }

  return found;
}

function generateUtilities() {
  const files = walkFiles(webSrc, (name) => /\.(tsx|ts|jsx|js)$/.test(name));
  const tokens = new Map();

  for (const file of files) {
    for (const [token, meta] of collectUtilities(fs.readFileSync(file, "utf8"))) {
      tokens.set(token, meta);
    }
  }

  const { count, css, skipped } = renderUtilityCss(tokens);

  return { count, css, scanned: files.length, skipped, tokens: tokens.size };
}

function generateGlobals() {
  const css = fs.readFileSync(globalsPath, "utf8");

  return buildDarkStylesheet(css);
}

/**
 * CSS modules cannot be reached from `globals.css` - their class names are
 * hashed at build time - so each module carries its own dark block, rewritten in
 * place between markers. Rules whose selector has no class in it are dropped:
 * Next compiles modules in pure mode and rejects a global-only selector.
 */
function generateModules() {
  const files = walkFiles(webSrc, (name) => name.endsWith(".module.css"));
  const touched = [];

  for (const file of files) {
    const original = fs.readFileSync(file, "utf8");
    const source = stripGeneratedBlock(original);
    const { css } = buildDarkStylesheet(source, {
      skipSelector: (selector) => !selector.includes(".")
    });
    const block = css
      ? `${MODULE_MARKER_START}\n/* Written by npm run theme:dark - edit scripts/dark-mode/, not this. */\n${css}\n${MODULE_MARKER_END}\n`
      : "";
    const next = block ? `${source.trimEnd()}\n\n${block}` : `${source.trimEnd()}\n`;

    if (next !== original) {
      fs.writeFileSync(file, next);
      touched.push(path.relative(root, file));
    }
  }

  return touched;
}

function stripGeneratedBlock(css) {
  const start = css.indexOf(MODULE_MARKER_START);

  if (start === -1) {
    return css;
  }

  const end = css.indexOf(MODULE_MARKER_END, start);

  return css.slice(0, start) + (end === -1 ? "" : css.slice(end + MODULE_MARKER_END.length));
}

const utilities = generateUtilities();
const globals = generateGlobals();
const modules = generateModules();

const output = [
  HEADER,
  "/* ---- Tailwind utilities ----------------------------------------------",
  `   ${utilities.count} overrides derived from ${utilities.tokens} colour utilities`,
  `   found across ${utilities.scanned} source files. */`,
  "",
  utilities.css,
  "",
  "/* ---- globals.css ------------------------------------------------------",
  `   ${globals.declarations} declarations across ${globals.rules} rules. These come`,
  "   last so that, exactly as in light mode, a component stylesheet beats a",
  "   utility class at the same specificity. */",
  "",
  globals.css,
  ""
].join("\n");

fs.writeFileSync(outputPath, output);

console.log(`utilities : ${utilities.count} overrides from ${utilities.tokens} tokens`);
console.log(`globals   : ${globals.rules} rules, ${globals.declarations} declarations`);
console.log(`modules   : ${modules.length} updated`);

for (const file of modules) {
  console.log(`            ${file}`);
}

if (utilities.skipped.length > 0) {
  console.log(`skipped   : ${utilities.skipped.length} tokens`);
  console.log(`            ${[...new Set(utilities.skipped)].slice(0, 20).join(" ")}`);
}

console.log(`wrote     : ${path.relative(root, outputPath)}`);
