import cloneDeep from "../../lib/cli/deps/lodash.clonedeep.js";
import merge from "lodash.merge";
import parseFile from "../../lib/cli/vite-plugin/parse-file.js";
import { buildLineOffsets } from "../../lib/cli/vite-plugin/offset-to-line.js";
import type { ParsedStoriesResult } from "../../lib/shared/types";

export const parseWithFn = (
  code: string,
  input: Partial<ParsedStoriesResult>,
  fn: any,
  visitor: string,
  filename = "foo.stories.js",
): ParsedStoriesResult => {
  const start: ParsedStoriesResult = merge(
    {
      entry: "file.js",
      stories: [],
      exportDefaultProps: { title: undefined, meta: undefined },
      namedExportToMeta: {},
      namedExportToStoryName: {},
      storyParams: {},
      fileId: "file",
    },
    input,
  );
  const end: ParsedStoriesResult = cloneDeep(start);
  const program: any = parseFile(filename, code);
  const ctx = { lineOffsets: buildLineOffsets(code), body: program.body };
  if (visitor === "Program") {
    fn(end, program, ctx);
  } else {
    for (const node of program.body) {
      if (node.type === visitor) fn(end, node, ctx);
    }
  }
  return end;
};

export const getOutput = (
  input: Partial<ParsedStoriesResult>,
): ParsedStoriesResult => {
  return merge(
    {
      entry: "file.js",
      stories: [],
      exportDefaultProps: { title: undefined, meta: undefined },
      namedExportToMeta: {},
      namedExportToStoryName: {},
      storyParams: {},
      fileId: "file",
    },
    input,
  );
};
