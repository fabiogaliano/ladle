import { parseSync } from "oxc-parser";

// oxc needs the language up front; .js/.jsx are parsed as jsx so that JSX in
// plain .js story files keeps working like it did under Babel's always-on jsx
// plugin. .ts stays jsx-free because TSX in a .ts file isn't valid TS.
/** @type {Record<string, "ts" | "tsx" | "jsx" | "js">} */
const langByExtension = {
  ts: "ts",
  mts: "ts",
  cts: "ts",
  tsx: "tsx",
  jsx: "jsx",
  js: "jsx",
  mjs: "jsx",
  cjs: "jsx",
};

/**
 * @param {string} filename
 * @param {string} code
 * @returns {import('oxc-parser').Program}
 */
const parseFile = (filename, code) => {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const lang = langByExtension[ext] ?? "tsx";
  // oxc returns parse errors in `result.errors` instead of throwing
  const result = parseSync(filename, code, { lang });
  if (result.errors.length > 0) {
    const error = result.errors[0];
    console.log("");
    console.log(`${error.message} in ${filename}`);
    console.log("");
    if (error.codeframe) {
      console.log(error.codeframe);
      console.log("");
    }
    throw new Error(`${error.message} in ${filename}`);
  }
  return result.program;
};

export default parseFile;
