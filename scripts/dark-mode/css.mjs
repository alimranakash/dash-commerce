/**
 * A deliberately small CSS reader for the dark-mode generator.
 *
 * It only has to cope with what this repository actually writes: flat rules,
 * `@media` blocks, `@keyframes` and one `@import`. No nesting (`globals.css` has
 * none), no custom-selector syntax, no source maps. Reaching for postcss would
 * add a build dependency to a script that runs by hand a few times a year.
 */

/**
 * @typedef {{type: "rule", selector: string, declarations: Declaration[]}} Rule
 * @typedef {{type: "atrule", name: string, params: string, declarations: Declaration[], nodes: Node[]}} AtRule
 * @typedef {{type: "statement", text: string}} Statement
 * @typedef {Rule | AtRule | Statement} Node
 * @typedef {{prop: string, value: string}} Declaration
 */

/**
 * @param {string} css
 * @returns {Node[]}
 */
export function parseCss(css) {
  let index = 0;

  function readString() {
    const quote = css[index];
    let out = quote;

    index += 1;

    while (index < css.length) {
      const ch = css[index];

      out += ch;
      index += 1;

      if (ch === "\\") {
        out += css[index] ?? "";
        index += 1;
        continue;
      }

      if (ch === quote) {
        break;
      }
    }

    return out;
  }

  /** @returns {{declarations: Declaration[], nodes: Node[]}} */
  function readBlock(atTopLevel) {
    /** @type {Declaration[]} */
    const declarations = [];
    /** @type {Node[]} */
    const nodes = [];
    let buffer = "";

    while (index < css.length) {
      const ch = css[index];

      if (ch === "/" && css[index + 1] === "*") {
        const end = css.indexOf("*/", index + 2);

        index = end === -1 ? css.length : end + 2;
        continue;
      }

      if (ch === '"' || ch === "'") {
        buffer += readString();
        continue;
      }

      if (ch === "(") {
        // Values such as `url(data:…;base64,…)` and `rgb(0 0 0 / 50%)` may hold
        // semicolons and braces that are not structure.
        let depth = 0;

        while (index < css.length) {
          const inner = css[index];

          if (inner === '"' || inner === "'") {
            buffer += readString();
            continue;
          }

          buffer += inner;
          index += 1;

          if (inner === "(") {
            depth += 1;
          } else if (inner === ")") {
            depth -= 1;

            if (depth === 0) {
              break;
            }
          }
        }

        continue;
      }

      if (ch === "}") {
        index += 1;

        if (!atTopLevel) {
          return { declarations, nodes };
        }

        buffer = "";
        continue;
      }

      if (ch === "{") {
        index += 1;

        const prelude = buffer.trim();

        buffer = "";

        if (prelude.startsWith("@")) {
          const match = /^@([\w-]+)\s*([\s\S]*)$/.exec(prelude);
          const block = readBlock(false);

          nodes.push({
            declarations: block.declarations,
            name: match ? match[1] : prelude.slice(1),
            nodes: block.nodes,
            params: match ? match[2].trim() : "",
            type: "atrule"
          });
        } else {
          const block = readBlock(false);

          nodes.push({ declarations: block.declarations, selector: prelude, type: "rule" });
          nodes.push(...block.nodes);
        }

        continue;
      }

      if (ch === ";") {
        index += 1;

        const statement = buffer.trim();

        buffer = "";

        if (statement.startsWith("@")) {
          nodes.push({ text: statement, type: "statement" });
        } else if (statement) {
          const colon = splitDeclaration(statement);

          if (colon) {
            declarations.push(colon);
          }
        }

        continue;
      }

      buffer += ch;
      index += 1;
    }

    const trailing = buffer.trim();

    if (trailing && !atTopLevel) {
      const declaration = splitDeclaration(trailing);

      if (declaration) {
        declarations.push(declaration);
      }
    }

    return { declarations, nodes };
  }

  return readBlock(true).nodes;
}

/** @returns {Declaration | null} */
function splitDeclaration(statement) {
  const colon = statement.indexOf(":");

  if (colon <= 0) {
    return null;
  }

  return {
    prop: statement.slice(0, colon).trim(),
    value: statement.slice(colon + 1).trim()
  };
}
