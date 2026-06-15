import { createHash } from "crypto";

/**
 * @param entryData {import('../../../shared/types').EntryData}
 * @param enabled {boolean}
 */
const getStorySource = (entryData, enabled) => {
  if (!enabled) {
    return "export const storySource = {}";
  }
  /** @type {{[key: string]: string}} */
  const storySource = {};
  /** @type {{[key: string]: string}} */
  const fileSourceCodes = {};
  Object.keys(entryData).forEach((entry) => {
    const fileHash = createHash("sha256")
      .update(entryData[entry].storySource, "utf8")
      .digest("hex")
      .slice(0, 8);
    fileSourceCodes[fileHash] = entryData[entry].storySource;
    entryData[entry].stories.forEach(({ storyId }) => {
      storySource[storyId] = fileHash;
    });
  });

  // encodeURIComponent escapes backticks, `$` and `\` so the value is safe to
  // embed inside a template literal
  const fileSourceEntries = Object.keys(fileSourceCodes).map(
    (fileHash) =>
      `  ${JSON.stringify(fileHash)}: \`${encodeURIComponent(
        fileSourceCodes[fileHash],
      )}\``,
  );
  const fileSources = `let fileSourceCodes = {\n${fileSourceEntries.join(
    ",\n",
  )}\n};`;

  const storySourceEntries = Object.keys(storySource).map(
    (storyId) =>
      `  ${JSON.stringify(storyId)}: fileSourceCodes[${JSON.stringify(
        storySource[storyId],
      )}]`,
  );
  const storyToSource = `export let storySource = {\n${storySourceEntries.join(
    ",\n",
  )}\n};`;

  return `${fileSources}\n${storyToSource}\n`;
};

export default getStorySource;
