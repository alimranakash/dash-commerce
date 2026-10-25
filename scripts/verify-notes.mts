/**
 * Notes check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * Notes module — the same shape as `verify-wishlist.mts`, and the half of it
 * that needs neither a database nor a session.
 *
 * The *contract* checks run `note.schema.ts` for real: it is the boundary every
 * save is parsed at, so the limits, the label normalisation and the new-versus-
 * existing rule are asserted against the code the server runs.
 *
 * The *privacy* checks read the repository and the actions as text, because
 * both pull in Prisma and `next/*`, which cannot load outside Next — the same
 * reason `verify-staff-permissions.mts` inspects action modules as text. It is
 * also the stronger assertion: "every statement is scoped by store and user" is
 * true of the file or it is not, whereas one scoped call proves nothing about
 * the next.
 *
 * The *no lost edits* checks pin the compare-and-set and the single save loop,
 * and the *rendering* checks pin that a note's HTML is never handed to the
 * browser as markup.
 *
 * Covers:
 * - a new note needing neither id nor version, and an existing one needing both;
 * - every size limit, counted on what was typed rather than on the markup;
 * - labels trimmed, de-duplicated case-insensitively, and capped;
 * - checklist items needing unique, well-formed ids;
 * - URL filters falling back instead of failing;
 * - search matching the words of a note, not its tags, with `%` and `_` literal;
 * - every repository statement naming `storeId` and `userId`, both from the
 *   session-derived owner, and no action accepting either from the browser;
 * - the content update being compare-and-set on `version`, and pin/archive
 *   leaving `version` alone;
 * - autosave never revalidating, and the editor saving only through one loop;
 * - no `dangerouslySetInnerHTML`, and the body rendered through `ProductRichText`;
 * - the runtime DDL creating exactly the columns `schema.prisma` declares;
 * - the sidebar linking the page, ungated and open to members.
 *
 * Run with: npm run verify:notes
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NOTE_BODY_TEXT_MAX,
  NOTE_CHECKLIST_MAX_ITEMS,
  NOTE_LABEL_MAX,
  NOTE_LABELS_MAX,
  NOTE_SEARCH_MAX,
  NOTE_TITLE_MAX,
  escapeLikePattern,
  isNoteContentEmpty,
  normalizeNoteLabels,
  noteFiltersSchema,
  noteSaveSchema,
  noteSearchText
} from "../apps/web/src/modules/notes/note.schema";

const ROOT = process.cwd();
const MODULE_DIR = join(ROOT, "apps", "web", "src", "modules", "notes");
const COMPONENTS_DIR = join(MODULE_DIR, "components");

const source = {
  actions: read(join(MODULE_DIR, "note.actions.ts")),
  nav: read(join(ROOT, "apps", "web", "src", "components", "dashboard", "dashboard-nav.tsx")),
  page: read(join(ROOT, "apps", "web", "src", "app", "dashboard", "notes", "page.tsx")),
  prisma: read(join(ROOT, "packages", "db", "prisma", "schema.prisma")),
  repository: read(join(MODULE_DIR, "note.repository.ts")),
  service: read(join(MODULE_DIR, "note.service.ts"))
};
const components = readdirSync(COMPONENTS_DIR).map((name) => ({
  name,
  text: read(join(COMPONENTS_DIR, name))
}));

let failures = 0;

function read(file: string) {
  return readFileSync(file, "utf8");
}

/**
 * The module with its prose taken out, for the checks that assert a name is
 * *absent* — the doc comments name `storeId` and `revalidatePath` while
 * explaining the rules about them.
 */
function code(text: string) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join("\n");
}

function check(label: string, passed: boolean, detail = "") {
  if (passed) {
    console.log(`  ok   ${label}`);
    return;
  }

  failures += 1;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

const blank = { body: "", checklist: [], color: "default", labels: [], title: "" };
const newNote = { ...blank, expectedVersion: null, id: null, title: "Supplier call" };
const existing = { ...newNote, expectedVersion: 3, id: "note_1" };

console.log("=== Save contract ===");

check("a new note parses without an id or version", noteSaveSchema.safeParse(newNote).success);
check("an existing note parses with both", noteSaveSchema.safeParse(existing).success);
check(
  "an id without a version is refused",
  !noteSaveSchema.safeParse({ ...existing, expectedVersion: null }).success
);
check(
  "a version without an id is refused",
  !noteSaveSchema.safeParse({ ...existing, id: null }).success
);
check(
  "a version below 1 is refused",
  !noteSaveSchema.safeParse({ ...existing, expectedVersion: 0 }).success
);
check(
  "a malformed id is refused",
  !noteSaveSchema.safeParse({ ...existing, id: "note 1; DROP" }).success
);
check(
  "an unknown colour is refused",
  !noteSaveSchema.safeParse({ ...newNote, color: "#ff0000" }).success
);
check(
  "a title over the limit is refused",
  !noteSaveSchema.safeParse({ ...newNote, title: "x".repeat(NOTE_TITLE_MAX + 1) }).success
);

const titled = noteSaveSchema.safeParse({ ...newNote, title: "Line one\nline two\u0007" });
check(
  "a title is kept to one line",
  titled.success && !titled.data.title.includes("\n") && !titled.data.title.includes("\u0007"),
  titled.success ? JSON.stringify(titled.data.title) : "refused"
);

const words = "a".repeat(NOTE_BODY_TEXT_MAX);
check(
  "the body limit counts text, not markup",
  noteSaveSchema.safeParse({ ...newNote, body: `<p><strong>${words}</strong></p>` }).success
);
check(
  "a body over the text limit is refused",
  !noteSaveSchema.safeParse({ ...newNote, body: `<p>${words}b</p>` }).success
);

const items = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ done: false, id: `i${index}`, text: "x" }));

check(
  `a checklist of ${NOTE_CHECKLIST_MAX_ITEMS} items parses`,
  noteSaveSchema.safeParse({ ...newNote, checklist: items(NOTE_CHECKLIST_MAX_ITEMS) }).success
);
check(
  "one item more is refused",
  !noteSaveSchema.safeParse({ ...newNote, checklist: items(NOTE_CHECKLIST_MAX_ITEMS + 1) }).success
);
check(
  "duplicate checklist ids are refused",
  !noteSaveSchema.safeParse({
    ...newNote,
    checklist: [
      { done: false, id: "a", text: "one" },
      { done: true, id: "a", text: "two" }
    ]
  }).success
);
check(
  "a checklist item without a boolean done is refused",
  !noteSaveSchema.safeParse({ ...newNote, checklist: [{ done: "yes", id: "a", text: "x" }] })
    .success
);

console.log("\n=== Labels ===");

const labels = normalizeNoteLabels(["  Ideas ", "ideas", "", "Supplier   costs", "IDEAS"]);
check(
  "labels are trimmed, collapsed and de-duplicated case-insensitively",
  JSON.stringify(labels) === JSON.stringify(["Ideas", "Supplier costs"]),
  JSON.stringify(labels)
);

const parsedLabels = noteSaveSchema.safeParse({ ...newNote, labels: [" Ideas", "ideas"] });
check(
  "the save schema stores the normalised labels",
  parsedLabels.success && JSON.stringify(parsedLabels.data.labels) === '["Ideas"]'
);
check(
  `more than ${NOTE_LABELS_MAX} labels are refused`,
  !noteSaveSchema.safeParse({
    ...newNote,
    labels: Array.from({ length: NOTE_LABELS_MAX + 1 }, (_, index) => `L${index}`)
  }).success
);
check(
  "an overlong label is refused",
  !noteSaveSchema.safeParse({ ...newNote, labels: ["x".repeat(NOTE_LABEL_MAX + 1)] }).success
);

console.log("\n=== Filters ===");

const fallback = noteFiltersSchema.parse({});
check(
  "missing filters fall back to the active board",
  fallback.view === "active" && fallback.q === "" && fallback.label === ""
);
check(
  "an unknown view falls back to active",
  noteFiltersSchema.parse({ label: "", q: "", view: "trash" }).view === "active"
);
check(
  "the archive view is recognised",
  noteFiltersSchema.parse({ label: "", q: "", view: "archived" }).view === "archived"
);
check(
  "a search term is trimmed and bounded",
  noteFiltersSchema.parse({ label: "", q: `  ${"q".repeat(NOTE_SEARCH_MAX + 50)}`, view: "" }).q
    .length === NOTE_SEARCH_MAX
);

console.log("\n=== Search ===");

const searchText = noteSearchText({
  body: "<p>Call <strong>Karim</strong> about boxes</p>",
  checklist: [{ done: false, id: "a", text: "Order tape" }]
});
check("search text holds the body's words", searchText.includes("Call Karim about boxes"));
check("search text holds checklist items", searchText.includes("Order tape"));
check("search text carries no tags", !/[<>]|strong/.test(searchText), searchText);
check(
  "a search term's % and _ are literal",
  escapeLikePattern("50%_off\\") === "50\\%\\_off\\\\",
  escapeLikePattern("50%_off\\")
);
check(
  "an untouched draft is empty",
  isNoteContentEmpty({
    body: "<p></p>",
    checklist: [{ done: false, id: "a", text: "  " }],
    title: " "
  })
);
check(
  "a draft with a checklist item is not",
  !isNoteContentEmpty({ body: "", checklist: [{ done: false, id: "a", text: "Tape" }], title: "" })
);

console.log("\n=== Privacy ===");

const repositoryCode = code(source.repository);
const statements = repositoryCode
  .split(/\nexport (?:async )?function /)
  .slice(1)
  .filter((chunk) => !chunk.startsWith("ensureStoreNoteSchema"));

check("the repository has statements to check", statements.length >= 8, `${statements.length}`);

for (const chunk of statements) {
  const name = chunk.slice(0, chunk.indexOf("("));

  check(
    `${name} is scoped by store and user`,
    chunk.includes('"storeId"') &&
      chunk.includes('"userId"') &&
      chunk.includes("owner.storeId") &&
      chunk.includes("owner.userId")
  );
}

const actionsCode = code(source.actions);
const exportedActions = [...actionsCode.matchAll(/export async function (\w+)\(([^)]*)\)/g)];

check("the actions resolve the store", /\brequireStore\(\)/.test(actionsCode));
check("the actions resolve the user", /\brequireUser\(\)/.test(actionsCode));
check(
  "the owner is the session's store and user",
  /storeId:\s*store\.id/.test(actionsCode) && /userId:\s*user\.id/.test(actionsCode)
);
check("there are actions to check", exportedActions.length >= 4, `${exportedActions.length}`);

for (const [, name, params] of exportedActions) {
  check(`${name} takes no store or user from the browser`, !/storeId|userId/.test(params ?? ""));
  const body = actionsCode.slice(actionsCode.indexOf(`function ${name}(`));
  const end = body.indexOf("\nexport ", 1);
  check(
    `${name} resolves the owner first`,
    (end > 0 ? body.slice(0, end) : body).includes("await requireNoteOwner()")
  );
}

check(
  "the page reads with the session's store and user",
  /storeId:\s*store\.id/.test(source.page) && /userId:\s*user\.id/.test(source.page)
);
check(
  "notes are not plan-gated",
  !/requirePlanFeature|hasPlanFeature/.test(code(source.actions) + code(source.service))
);
check(
  "the runtime DDL never runs inside a transaction",
  !/\$transaction/.test(repositoryCode + code(source.service))
);

console.log("\n=== No lost edits ===");

const updateChunk = statements.find((chunk) => chunk.startsWith("updateNoteContentRow")) ?? "";
check(
  "the content update only applies at the expected version",
  /"version" = \$4/.test(updateChunk) && /WHERE[^`]*"version" = \$4/.test(updateChunk)
);
check("the content update moves the version on", updateChunk.includes('"version" = "version" + 1'));

for (const name of ["setNotePinnedRow", "setNoteArchivedRow"]) {
  const chunk = statements.find((candidate) => candidate.startsWith(name)) ?? "";
  check(`${name} leaves the version alone`, chunk.length > 0 && !chunk.includes('"version"'));
}

check(
  "a refused update is told apart as a conflict or not found",
  /status: "conflict"/.test(source.service) && /status: "not_found"/.test(source.service)
);

const saveActionBody = actionsCode.slice(
  actionsCode.indexOf("function saveNoteAction("),
  actionsCode.indexOf("function setNotePinnedAction(")
);
check(
  "autosave does not revalidate the page",
  saveActionBody.length > 0 && !saveActionBody.includes("revalidatePath")
);

const savers = components.filter((file) => /\bsaveNoteAction\b/.test(code(file.text)));
check(
  "the editor saves only through the autosave loop",
  savers.length === 1 && savers[0]?.name === "use-note-autosave.ts",
  savers.map((file) => file.name).join(", ")
);

const autosave = components.find((file) => file.name === "use-note-autosave.ts")?.text ?? "";
check("one save is in flight at a time", /runnerRef\.current \?\?= drain\(\)/.test(autosave));
check("each save names the version it last saw", /expectedVersion: version/.test(autosave));
check("leaving with unsaved edits asks first", autosave.includes("beforeunload"));
check(
  "every successful save is reported back",
  /onSavedRef\.current\?\.\(result\.note\)/.test(autosave)
);

// Props only catch up when router.refresh() lands. A note reopened before then
// must open at the version just saved, or its next keystroke is a conflict
// whose "Keep my version" overwrites those very edits.
const board = components.find((file) => file.name === "notes-board.tsx")?.text ?? "";
check(
  "the board remembers the editor's saves",
  /onSaved=\{\(note\) => savedNotes\.current\.set\(note\.id, note\)\}/.test(board)
);
check(
  "a note reopens at the newer of the board's copy and the last save",
  /saved\.version > note\.version/.test(board) && /onOpen=\{\(\) => openNote\(note\)\}/.test(board)
);

console.log("\n=== Rendering ===");

const everything = [source.page, ...components.map((file) => file.text)].map(code).join("\n");
check("nothing sets inner HTML", !everything.includes("dangerouslySetInnerHTML"));

const card = components.find((file) => file.name === "note-card.tsx")?.text ?? "";
check(
  "a card renders the body through ProductRichText",
  /<ProductRichText text=\{note\.body\}/.test(card)
);

console.log("\n=== Schema ===");

const model = /model StoreNote \{([\s\S]*?)\n\}/.exec(source.prisma)?.[1] ?? "";
const modelColumns = model
  .split("\n")
  .map((line) => /^\s+(\w+)\s+(\w+)/.exec(line))
  .filter((match): match is RegExpExecArray => match !== null)
  .filter((match) => match[2] !== "Store" && match[2] !== "User")
  .map((match) => match[1])
  .sort();
const createTable =
  /CREATE TABLE IF NOT EXISTS[\s\S]*?\n\s*\)\n/.exec(source.repository)?.[0] ?? "";
const ddlColumns = [
  ...createTable.matchAll(/^\s+"(\w+)" (?:TEXT|JSONB|BOOLEAN|INTEGER|TIMESTAMP)/gm)
]
  .map((match) => match[1])
  .sort();

check("schema.prisma declares StoreNote", modelColumns.length > 0);
check(
  "the runtime DDL creates exactly the model's columns",
  JSON.stringify(modelColumns) === JSON.stringify(ddlColumns),
  `model ${modelColumns.join(",")} / ddl ${ddlColumns.join(",")}`
);
check(
  "the model is indexed by store and user",
  model.includes("@@index([storeId, userId])") &&
    source.repository.includes('"StoreNote_storeId_userId_idx"')
);
check(
  "both relations cascade",
  /store\s+Store\s+@relation\([^)]*onDelete: Cascade\)/.test(model) &&
    /user\s+User\s+@relation\([^)]*onDelete: Cascade\)/.test(model)
);

console.log("\n=== Navigation ===");

check("the sidebar links /dashboard/notes", source.nav.includes('href: "/dashboard/notes"'));
check("the link carries no plan badge", !/"\/dashboard\/notes":\s*"/.test(source.nav));
const managerOnly = /MANAGER_ONLY_HREFS[^=]*= new Set\(\[([\s\S]*?)\]\)/.exec(source.nav)?.[1];
check(
  "the link is open to members",
  managerOnly !== undefined && !managerOnly.includes('"/dashboard/notes"')
);

console.log(
  failures === 0
    ? "\nNotes: all checks passed."
    : `\nNotes: ${failures} check${failures === 1 ? "" : "s"} failed.`
);

process.exit(failures === 0 ? 0 : 1);
