import fs from "fs";
import path from "path";
import debugFactory from "debug";
import parseFile from "../parse-file.js";
import cleanupWindowsPath from "./cleanup-windows-path.js";

const debug = debugFactory("ladle:vite");

/**
 * @param {string} namedExport
 * @param {string} sourceCode
 * @param {string} filename
 */
const checkIfNamedExportExists = (namedExport, sourceCode, filename) => {
  const program = parseFile(filename, sourceCode);
  for (const node of program.body) {
    if (node.type !== "ExportNamedDeclaration") continue;
    // ignore re-exports like `export { x } from './y'`
    if (node.source !== null) continue;
    if (node.declaration) {
      if (
        node.declaration.type === "VariableDeclaration" &&
        node.declaration.declarations.some(
          (/** @type {any} */ d) =>
            d.id.type === "Identifier" && d.id.name === namedExport,
        )
      ) {
        return true;
      }
      if (
        (node.declaration.type === "FunctionDeclaration" ||
          node.declaration.type === "ClassDeclaration") &&
        node.declaration.id?.name === namedExport
      ) {
        return true;
      }
    } else if (node.specifiers?.length > 0) {
      if (
        node.specifiers.some(
          (/** @type {any} */ s) => s.exported.name === namedExport,
        )
      ) {
        return true;
      }
    }
  }
  return false;
};

/**
 * @param {string} configFolder
 */
const getComponents = (configFolder) => {
  let defaultProvider = `export const Provider = ({children}) => /*#__PURE__*/createElement(Fragment, null, children);\n`;
  let defaultStorySourceHeader = `export const StorySourceHeader = ({ path }) => /*#__PURE__*/createElement('div', { style: { paddingTop: "2em" }}, /*#__PURE__*/createElement('code', { className: "ladle-code" }, path));\n`;
  let defaultArgs = `export const args = {};\n`;
  let defaultArgTypes = `export const argTypes = {};\n`;
  const componentsPaths = [
    path.join(configFolder, "components.tsx"),
    path.join(configFolder, "components.ts"),
    path.join(configFolder, "components.jsx"),
    path.join(configFolder, "components.js"),
  ];
  const firstFoundComponentsPath = componentsPaths.find((componentsPath) =>
    fs.existsSync(componentsPath),
  );

  if (!firstFoundComponentsPath) {
    debug(`Custom components.{tsx,ts,jsx,js} not found.`);
    return `${defaultProvider}${defaultStorySourceHeader}${defaultArgs}${defaultArgTypes}`;
  }

  const sourceCode = fs.readFileSync(firstFoundComponentsPath, "utf8");
  const filename = path.basename(firstFoundComponentsPath);

  firstFoundComponentsPath && debug(`${configFolder}/${filename} found.`);

  const isProvider = checkIfNamedExportExists("Provider", sourceCode, filename);
  const isStorySourceHeader = checkIfNamedExportExists(
    "StorySourceHeader",
    sourceCode,
    filename,
  );
  const isArgs = checkIfNamedExportExists("args", sourceCode, filename);
  const isArgTypes = checkIfNamedExportExists("argTypes", sourceCode, filename);

  if (!isStorySourceHeader && !isProvider && !isArgs && !isArgTypes) {
    return `import '${cleanupWindowsPath(
      path.join(configFolder, filename),
    )}';\n${defaultProvider}${defaultStorySourceHeader}${defaultArgs}${defaultArgTypes}`;
  }

  let output = "";
  const componentsPath = cleanupWindowsPath(path.join(configFolder, filename));

  if (isProvider) {
    debug(`Custom Provider found.`);
    output += `export { Provider } from '${componentsPath}';\n`;
  } else {
    debug(`Custom Provider not found. Returning the default.`);
    output += defaultProvider;
  }

  if (isStorySourceHeader) {
    debug(`Custom StorySourceHeader found.`);
    output += `export { StorySourceHeader } from '${componentsPath}';\n`;
  } else {
    debug(`Custom StorySourceHeader not found. Returning the default.`);
    output += defaultStorySourceHeader;
  }

  if (isArgs) {
    debug(`Global args found.`);
    output += `export { args } from '${componentsPath}';\n`;
  } else {
    debug(`Global args not found.`);
    output += defaultArgs;
  }

  if (isArgTypes) {
    debug(`Global argTypes found.`);
    output += `export { argTypes } from '${componentsPath}';\n`;
  } else {
    debug(`Global argTypes not found.`);
    output += defaultArgTypes;
  }

  return output;
};

export default getComponents;
