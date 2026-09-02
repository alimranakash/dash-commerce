/**
 * Dark-mode check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * theme, and — like `verify-sitemap.mts` — the half of it that needs neither a
 * database nor a browser.
 *
 * One property matters more than every other one here: **dark mode is additive**.
 * It was added to an app whose dashboard, admin console and storefront templates
 * were already written against 3,300 literal Tailwind colours and 1,500 more
 * declarations in `globals.css`, and the only reason that was safe to do was
 * that nothing it emits can match without `data-theme="dark"` on the document.
 * A single unscoped rule in the generated stylesheet would repaint light mode
 * for every seller and every shopper, so that is asserted rule by rule rather
 * than trusted.
 *
 * Covers:
 * - every selector in both dark stylesheets — and in the block each CSS module
 *   carries — being scoped to `[data-theme="dark"]`, so light mode is
 *   untouched;
 * - the generated stylesheet being in step with the colours currently in the
 *   source, which is what turns "someone added a panel and forgot" into a
 *   failing check rather than a white card in a dark dashboard;
 * - the colour mapping itself: surfaces keeping their stacking order, text
 *   staying legible, and a brand or status colour keeping its hue;
 * - the import order in `globals.css`, which is what decides whether a
 *   deliberate override or a mapped literal wins;
 * - the preference never reaching the DOM as anything but `light` or `dark`, so
 *   stylesheets only ever have to answer one question;
 * - the toggle being mounted under a provider on all three surfaces, since it
 *   renders nothing at all without one.
 *
 * Run with: npm run verify:dark-mode
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { mapColor, parseColor } from "./dark-mode/color.mjs";

const ROOT = process.cwd();
const WEB_SRC = join(ROOT, "apps", "web", "src");
const APP_DIR = join(WEB_SRC, "app");
const GENERATED = join(APP_DIR, "dark-mode.generated.css");
const HAND_WRITTEN = join(APP_DIR, "dark-mode.css");
const GLOBALS = join(APP_DIR, "globals.css");

let failures = 0;

function check(label: string, passed: boolean, detail = "") {
  if (passed) {
    console.log(`  ok   ${label}`);
    return;
  }

  failures += 1;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

function read(path: string) {
  return readFileSync(path, "utf8");
}

/** Every selector in a stylesheet, at any nesting depth, minus the at-rules. */
function selectorsOf(css: string) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

  return [...withoutComments.matchAll(/(^|[;{}])\s*([^@;{}][^{}]*?)\s*\{/g)]
    .map((match) => (match[2] ?? "").trim())
    .flatMap((group) => group.split(",").map((part) => part.trim()))
    .filter((selector) => selector.length > 0 && !selector.startsWith("@"));
}

function walk(dir: string, test: (name: string) => boolean, found: string[] = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);

    if (statSync(full).isDirectory()) {
      if (name === "node_modules" || name === "generated") {
        continue;
      }

      walk(full, test, found);
      continue;
    }

    if (test(name)) {
      found.push(full);
    }
  }

  return found;
}

const generated = read(GENERATED);
const handWritten = read(HAND_WRITTEN);
const globals = read(GLOBALS);

console.log("=== Light mode is untouched ===");

const generatedSelectors = selectorsOf(generated);
const unscoped = generatedSelectors.filter((selector) => !selector.includes("[data-theme="));

check(
  `all ${generatedSelectors.length} generated selectors are scoped to dark mode`,
  unscoped.length === 0,
  unscoped.slice(0, 3).join(" / ")
);

// The hand-written half legitimately styles the toggle itself in both themes,
// so it is allowed one unscoped class and nothing else.
const handWrittenUnscoped = selectorsOf(handWritten).filter(
  (selector) => !selector.includes("[data-theme=") && !selector.includes("theme-mode-toggle")
);

check(
  "the hand-written half styles nothing outside dark mode but its own toggle",
  handWrittenUnscoped.length === 0,
  handWrittenUnscoped.slice(0, 3).join(" / ")
);

const moduleFiles = walk(WEB_SRC, (name) => name.endsWith(".module.css"));
const moduleBlocks = moduleFiles
  .map((file) => ({ file, source: read(file) }))
  .filter(({ source }) => source.includes("dark-mode:generated:start"));

const leakingModules = moduleBlocks.filter(({ source }) => {
  const start = source.indexOf("dark-mode:generated:start");
  const end = source.indexOf("dark-mode:generated:end");

  return selectorsOf(source.slice(start, end)).some(
    (selector) => !selector.includes("[data-theme=")
  );
});

check(
  `all ${moduleBlocks.length} CSS modules keep their dark block scoped`,
  leakingModules.length === 0,
  leakingModules.map(({ file }) => file).join(" ")
);

check(
  "no dark rule escalates priority beyond the rule it shadows",
  !handWritten.includes("!important") &&
    count(generated, "!important") <= count(globals, "!important"),
  "the generator carries an existing !important across; it must never add one"
);

console.log("\n=== The generated stylesheet is current ===");

const before = generated;

execFileSync("node", [join(ROOT, "scripts", "generate-dark-mode-css.mjs")], { stdio: "pipe" });

check(
  "regenerating produces no change",
  read(GENERATED) === before,
  "a colour was added or changed without running `npm run theme:dark`"
);

console.log("\n=== Colour mapping ===");

const page = mapColor(parseColor("#f5f6ff")!, "bg");
const card = mapColor(parseColor("#ffffff")!, "bg");

check(
  "a white card stays above the page it sits on",
  lightnessOf(card) > lightnessOf(page),
  `card ${card} vs page ${page} — inverting lightness alone would put the card underneath`
);

check(
  "the darkest body text becomes the lightest foreground",
  lightnessOf(mapColor(parseColor("#20212c")!, "text")) > 0.85
);

check(
  "muted text stays a step below primary text",
  lightnessOf(mapColor(parseColor("#777985")!, "text")) <
    lightnessOf(mapColor(parseColor("#20212c")!, "text")),
  "the light palette leans on near-identical greys for hierarchy"
);

check(
  "white sitting on a coloured fill is left alone",
  mapColor(parseColor("#ffffff")!, "text") === "#ffffff",
  "otherwise every primary button loses its label"
);

check(
  "the product's violet survives as a fill",
  mapColor(parseColor("#7c3aed")!, "bg") === "#7c3aed",
  "brand colour is not a theme decision"
);

check(
  "a merchant's dark brand colour is lifted, not repainted",
  (() => {
    const source = parseColor("#135d66")!;
    const mapped = parseColor(mapColor(source, "accent"))!;

    return Math.abs(mapped.h - source.h) < 4 && mapped.l > source.l;
  })(),
  "hue is the shop's, lightness is the theme's"
);

check(
  "a status colour stays its own hue as text",
  (() => {
    const rose = parseColor(mapColor(parseColor("#b3273f")!, "text"))!;
    const green = parseColor(mapColor(parseColor("#119c73")!, "text"))!;

    return (
      Math.abs(rose.h - 350) < 25 && Math.abs(green.h - 160) < 25 && rose.l > 0.6 && green.l > 0.6
    );
  })(),
  "a failed payment and a paid one have to stay different colours"
);

check(
  "a near-white page background is not read as a saturated blue",
  (() => {
    const mapped = parseColor(mapColor(parseColor("#f5f6ff")!, "bg"))!;

    return chroma(mapped) < 0.14;
  })(),
  "HSL saturation is meaningless near white; the mapping has to use chroma"
);

console.log("\n=== Wiring ===");

const generatedImport = globals.indexOf('@import "./dark-mode.generated.css"');
const handWrittenImport = globals.indexOf('@import "./dark-mode.css"');

check("globals.css imports the generated stylesheet", generatedImport > -1);
check("globals.css imports the hand-written stylesheet", handWrittenImport > -1);
check(
  "the hand-written half is imported last",
  generatedImport > -1 && handWrittenImport > generatedImport,
  "otherwise a mapped literal would beat the token it was meant to defer to"
);

const themeMode = read(join(WEB_SRC, "modules", "theme-mode", "theme-mode.ts"));

check(
  "the inline script writes only light or dark to the document",
  /\?"dark":"light"/.test(themeMode) && !/setAttribute\([^)]*,\s*m\)/.test(themeMode),
  "`system` has to be resolved before it reaches CSS, or every rule needs a media query too"
);

check(
  "the default preference is light",
  /DEFAULT_THEME_MODE: ThemeMode = "light"/.test(themeMode),
  "with nothing stored, no attribute is stamped and no dark rule can match"
);

check(
  "the script cannot throw a page down",
  /try\{/.test(themeMode) && /catch\(e\)\{\}/.test(themeMode),
  "storage is unavailable in a locked-down browser and the rest of the page still has to run"
);

const surfaces: Array<[string, string]> = [
  ["dashboard", join(WEB_SRC, "components", "dashboard", "dashboard-shell.tsx")],
  ["admin console", join(WEB_SRC, "components", "admin", "admin-shell.tsx")],
  ["storefront", join(APP_DIR, "storefront", "[slug]", "layout.tsx")]
];

for (const [name, file] of surfaces) {
  check(
    `the ${name} mounts ThemeModeProvider`,
    read(file).includes("<ThemeModeProvider>"),
    "the toggle renders nothing without one"
  );
}

const toggleHosts = [
  join(WEB_SRC, "components", "dashboard", "dashboard-topbar.tsx"),
  join(WEB_SRC, "components", "admin", "admin-shell.tsx"),
  join(
    WEB_SRC,
    "modules",
    "storefront",
    "themes",
    "default",
    "components",
    "default-storefront-header.tsx"
  ),
  join(WEB_SRC, "modules", "storefront", "templates", "fashion-default", "fashion-header.tsx"),
  join(
    WEB_SRC,
    "modules",
    "storefront",
    "templates",
    "electronics-default",
    "electronics-header.tsx"
  )
];

check(
  "every header that can reach a provider carries the toggle",
  toggleHosts.every((file) => read(file).includes("<ThemeModeToggle")),
  toggleHosts.filter((file) => !read(file).includes("<ThemeModeToggle")).join(" ")
);

check(
  "the root document is marked as client-corrected",
  read(join(APP_DIR, "layout.tsx")).includes('<html lang="en" suppressHydrationWarning>'),
  "the inline script rewrites an attribute React rendered, which is a hydration error without it"
);

function count(haystack: string, needle: string) {
  return haystack.split(needle).length - 1;
}

function lightnessOf(hex: string) {
  return parseColor(hex)!.l;
}

function chroma(color: { s: number; l: number }) {
  return (1 - Math.abs(2 * color.l - 1)) * color.s;
}

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
