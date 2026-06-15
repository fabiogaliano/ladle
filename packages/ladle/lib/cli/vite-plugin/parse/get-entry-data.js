import fs from "fs";
import path from "path";
import debugFactory from "debug";
import { getFileId } from "../naming-utils.js";
import parseFile from "../parse-file.js";
import { buildLineOffsets } from "../offset-to-line.js";
import getDefaultExport from "./get-default-export.js";
import getStorynameAndMeta from "./get-storyname-and-meta.js";
import getNamedExports from "./get-named-exports.js";
import { IMPORT_ROOT } from "../utils.js";

const debug = debugFactory("ladle:vite");

/**
 * @param {string[]} entries
 */
export const getEntryData = async (entries) => {
  /**
   * @type {import('../../../shared/types').EntryData}
   */
  const entryData = {};
  entries.sort();
  for (let entry of entries) {
    debug(`Parsing ${entry}`);
    entryData[entry] = await getSingleEntry(entry);
  }
  return entryData;
};

/**
 * @param {string} entry
 */
export const getSingleEntry = async (entry) => {
  // fs.promises.readFile is much slower and we don't mind hogging
  // the whole CPU core since this is blocking everything else
  const code = fs.readFileSync(path.join(IMPORT_ROOT, entry), "utf8");
  /** @type {import('../../../shared/types').ParsedStoriesResult} */
  const result = {
    entry,
    stories: [],
    exportDefaultProps: { title: undefined, meta: undefined },
    namedExportToMeta: {},
    namedExportToStoryName: {},
    storyParams: {},
    storySource: code.replace(/\r/g, ""),
    fileId: getFileId(entry),
  };
  const program = parseFile(entry, code);
  // line offsets are built from the parsed source (before the \r strip) so they
  // align with oxc's UTF-16 offsets
  const lineOffsets = buildLineOffsets(code);
  // order matters: storyName/meta and the default export populate state that
  // named exports read when building story ids and params
  getStorynameAndMeta(result, program);
  for (const node of program.body) {
    if (node.type === "ExportDefaultDeclaration") {
      getDefaultExport(result, node, { body: program.body });
    }
  }
  for (const node of program.body) {
    if (node.type === "ExportNamedDeclaration") {
      getNamedExports(result, node, { lineOffsets });
    }
  }
  debug(`Parsed data for ${entry}:`);
  // make story order deterministic
  result.stories = result.stories.sort((a, b) => {
    if (a.storyId < b.storyId) return -1;
    if (a.storyId > b.storyId) return 1;
    return 0;
  });
  debug(result);
  return result;
};
