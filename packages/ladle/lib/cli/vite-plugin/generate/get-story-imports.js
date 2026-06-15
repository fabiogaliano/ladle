import path from "path";
import { IMPORT_ROOT } from "../utils.js";
import cleanupWindowsPath from "./cleanup-windows-path.js";

/**
 * @param entryData {import('../../../shared/types').EntryData}
 */
const getStoryImports = (entryData) => {
  let storyImports = `import { lazy, createElement, Fragment } from "react";\n`;
  storyImports += `import composeEnhancers from "/src/compose-enhancers";\n`;

  Object.keys(entryData).forEach((entry) => {
    const source = cleanupWindowsPath(path.join(IMPORT_ROOT, entry));
    entryData[entry].stories.forEach(({ componentName, namedExport }) => {
      storyImports += `\nconst ${componentName} = lazy(() => import(${JSON.stringify(
        source,
      )}).then(module => {
  return {
    default: composeEnhancers(module, ${JSON.stringify(namedExport)})
  };
}));`;
    });
  });

  return storyImports;
};

export default getStoryImports;
