import { converter } from "../ast-to-obj.js";

/**
 * Resolves `export default foo` by finding `const foo = {...}` at the top level
 * and returning its initializer. Replaces Babel's scope.bindings lookup; like
 * the original it only handles initializers (not later reassignments).
 * @param {any[]} body
 * @param {string} name
 * @returns {any}
 */
const resolveIdentifierInit = (body, name) => {
  for (const node of body) {
    if (node.type === "VariableDeclaration") {
      for (const declarator of node.declarations) {
        if (declarator.id.type === "Identifier" && declarator.id.name === name) {
          return declarator.init;
        }
      }
    }
  }
  return undefined;
};

/**
 * @param {import('../../../shared/types').ParsedStoriesResult} result
 * @param {any} node
 * @param {{ body: any[] }} ctx
 */
const getDefaultExport = (result, node, ctx) => {
  if (!node) return;
  try {
    const declaration = node.declaration;
    let objNode = declaration;
    if (declaration.type === "Identifier") {
      objNode = resolveIdentifierInit(ctx.body, declaration.name);
    }
    if (
      declaration.type === "TSAsExpression" ||
      declaration.type === "TSSatisfiesExpression"
    ) {
      objNode = declaration.expression;
    }
    objNode &&
      objNode.properties.forEach((/** @type {any} */ prop) => {
        if (prop.type === "Property" && prop.key.name === "title") {
          if (prop.value.type !== "Literal" || typeof prop.value.value !== "string") {
            throw new Error("Default title must be a string literal.");
          }
          result.exportDefaultProps.title = prop.value.value;
        } else if (
          prop.type === "Property" &&
          prop.key.type === "Identifier" &&
          prop.key.name === "meta"
        ) {
          const obj = converter(prop.value);
          const json = JSON.stringify(obj);
          result.exportDefaultProps.meta = JSON.parse(json);
        }
      });
  } catch (e) {
    throw new Error(
      `Can't parse the default title and meta of ${result.entry}. Meta must be serializable and title a string literal.`,
    );
  }
};

export default getDefaultExport;
