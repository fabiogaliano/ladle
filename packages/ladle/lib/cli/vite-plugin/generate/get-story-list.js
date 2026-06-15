import { storyDelimiter, storyEncodeDelimiter } from "../naming-utils.js";

/**
 * @param entryData {import('../../../shared/types').EntryData}
 */
const getStoryList = (entryData) => {
  /** @type {string[]} */
  let storyIds = [];
  /** @type {{[key: string]: any}} */
  let storyParams = {};
  /** @type {{[key: string]: { locStart: number; locEnd: number; entry: string;}}} */
  let storyLocs = {};

  Object.keys(entryData).forEach((entry) => {
    entryData[entry].stories.forEach(({ storyId, locStart, locEnd }) => {
      storyIds.push(storyId);
      storyLocs[storyId] = {
        locStart,
        locEnd,
        entry,
      };
    });
    storyParams = { ...storyParams, ...entryData[entry].storyParams };
  });

  const entries = storyIds.map((story) => {
    const componentRef = story.replace(
      new RegExp(storyDelimiter, "g"),
      storyEncodeDelimiter,
    );
    const { locStart, locEnd, entry } = storyLocs[story];
    const lines = [
      `    component: ${componentRef}`,
      `    locStart: ${locStart}`,
      `    locEnd: ${locEnd}`,
      `    entry: ${JSON.stringify(entry)}`,
    ];
    if (storyParams[story]) {
      lines.push(`    meta: ${JSON.stringify(storyParams[story])}`);
    }
    return `  ${JSON.stringify(story)}: {\n${lines.join(",\n")}\n  }`;
  });

  return `export let stories = {\n${entries.join(",\n")}\n};`;
};

export default getStoryList;
