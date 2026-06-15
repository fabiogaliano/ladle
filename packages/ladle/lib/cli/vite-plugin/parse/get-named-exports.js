import cloneDeep from "../../deps/lodash.clonedeep.js";
import merge from "lodash.merge";
import { getLine } from "../offset-to-line.js";
import {
  getEncodedStoryName,
  storyDelimiter,
  titleToFileId,
  kebabCase,
} from "../naming-utils.js";

/**
 * @param {import('../../../shared/types').ParsedStoriesResult} result
 * @param {any} node
 * @param {{ lineOffsets: Int32Array }} ctx
 */
const getNamedExports = (
  {
    fileId,
    exportDefaultProps,
    namedExportToMeta,
    namedExportToStoryName,
    storyParams,
    stories,
    entry,
  },
  node,
  ctx,
) => {
  // skip re-exports like `export { x } from './y'` — they aren't local stories
  // and would otherwise produce broken lazy imports
  if (node.source !== null) return;

  /**
   * @param {any} locNode a node carrying start/end offsets
   * @param {string} namedExport
   * @returns {import('../../../shared/types').StoryEntry} result
   */
  const namedExportToStory = (locNode, namedExport) => {
    if (namedExport.includes("__")) {
      throw new Error(
        `Story named ${namedExport} can't contain "__". It's reserved for internal encoding. Please rename this export.`,
      );
    }

    let storyNamespace = fileId;
    if (exportDefaultProps && exportDefaultProps.title) {
      storyNamespace = titleToFileId(exportDefaultProps.title);
    }
    const storyName = namedExportToStoryName[namedExport]
      ? namedExportToStoryName[namedExport]
      : namedExport;
    const storyId = `${kebabCase(
      storyNamespace,
    )}${storyDelimiter}${storyDelimiter}${kebabCase(storyName)}`;
    // attach default meta to each story
    if (exportDefaultProps && exportDefaultProps.meta) {
      storyParams[storyId] = exportDefaultProps;
    }
    // add and merge story specific meta
    if (namedExportToMeta[namedExport]) {
      storyParams[storyId] = merge(cloneDeep(storyParams[storyId] || {}), {
        meta: namedExportToMeta[namedExport],
      });
    }
    const componentName = getEncodedStoryName(
      kebabCase(storyNamespace),
      kebabCase(storyName),
    );
    const story = {
      storyId,
      componentName,
      namedExport,
      locStart: getLine(ctx.lineOffsets, locNode.start),
      locEnd: getLine(ctx.lineOffsets, locNode.end),
    };
    return story;
  };

  // Inline exports, such as: export const Story = () => <h1>Export List</h1>;
  if (node.declaration?.type) {
    let namedExport = "";
    const namedExportDeclaration = node.declaration;
    if (namedExportDeclaration.type === "ClassDeclaration") {
      namedExport = namedExportDeclaration.id.name;
    } else if (namedExportDeclaration.type === "VariableDeclaration") {
      namedExport = namedExportDeclaration.declarations[0].id.name;
    } else if (namedExportDeclaration.type === "FunctionDeclaration") {
      namedExport = namedExportDeclaration.id.name;
    } else {
      throw new Error(
        `Named export in ${entry} must be variable, class or function.`,
      );
    }
    const story = namedExportToStory(namedExportDeclaration, namedExport);
    stories.push(story);
  } else if (node.specifiers?.length > 0) {
    // It's an export block export, such as: { story, story as storyRenamed };
    node.specifiers.forEach(
      /** @param {any} specifier */
      (specifier) => {
        const namedExport = specifier.exported.name;
        const story = namedExportToStory(specifier, namedExport);
        stories.push(story);
      },
    );
  }
};

export default getNamedExports;
