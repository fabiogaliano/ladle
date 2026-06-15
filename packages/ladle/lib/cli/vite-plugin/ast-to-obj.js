// this code comes from:
// nd-02110114/babel-plugin-object-to-json-parse
// https://github.com/nd-02110114/babel-plugin-object-to-json-parse/blob/master/src/utils.ts
// Adapted from @babel/types helpers to oxc's ESTree-style nodes: a single
// `Literal` node discriminated by typeof .value instead of StringLiteral /
// NumericLiteral / BooleanLiteral / NullLiteral.

/**
 * A JSON-serializable scalar: string, number, boolean or null. Excludes oxc
 * `Literal`s that are regexes or bigints, mirroring Babel's separate node types.
 * @param {any} node
 * @returns {boolean}
 */
const isScalarLiteral = (node) =>
  node &&
  node.type === "Literal" &&
  (node.value === null || ["string", "number", "boolean"].includes(typeof node.value));

/**
 * @param {any} node
 * @returns {boolean}
 */
const isValidJsonValue = (node) => {
  if (
    isScalarLiteral(node) ||
    (node &&
      (node.type === "ArrayExpression" || node.type === "ObjectExpression"))
  ) {
    return true;
  }

  return false;
};

/**
 * Check whether given ObjectExpression consists only of plain (non-computed,
 * `init` kind) properties.
 * @param {any} node
 * @returns {boolean}
 */
const isConvertibleObjectExpression = (node) => {
  return node.properties.every(
    (/** @type {any} */ property) =>
      property.type === "Property" &&
      property.kind === "init" &&
      !property.computed,
  );
};

/**
 * @param {string} value
 */
const createSafeStringForJsonParse = (value) => {
  if (/\\/.test(value)) {
    value = value.replace(/\\/g, "\\\\");
  }

  if (/"/.test(value)) {
    value = value.replace(/"/g, '\\"');
  }

  if (/[\t\f\r\n\b]/g.test(value)) {
    const codes = ["\f", "\r", "\n", "\t", "\b"];
    const replaceCodes = ["\\f", "\\r", "\\n", "\\t", "\\b"];
    for (let i = 0; i < codes.length; i++) {
      value = value.replace(new RegExp(codes[i], "g"), replaceCodes[i]);
    }
  }

  return value;
};

/**
 * @param {any} node
 * @returns {unknown}
 */
export function converter(node) {
  // for negative number, ex) -10
  if (node && node.type === "UnaryExpression") {
    const { operator, argument } = node;
    if (
      operator === "-" &&
      argument &&
      argument.type === "Literal" &&
      typeof argument.value === "number"
    ) {
      return -argument.value;
    }
  }

  if (!isValidJsonValue(node)) {
    throw new Error("Invalid value is included.");
  }

  if (isScalarLiteral(node)) {
    if (node.value === null) {
      return null;
    }
    if (typeof node.value === "string") {
      return createSafeStringForJsonParse(node.value);
    }
    // number or boolean
    return node.value;
  }

  if (node.type === "ArrayExpression") {
    const { elements } = node;
    return elements.map((/** @type {any} */ element) => converter(element));
  }

  // ObjectExpression
  if (!isConvertibleObjectExpression(node)) {
    throw new Error("Invalid syntax is included.");
  }

  const { properties } = node;
  return properties.reduce((/** @type {any} */ acc, /** @type {any} */ cur) => {
    let key = cur.key.name ?? cur.key.value;
    if (typeof key === "string") {
      key = createSafeStringForJsonParse(key);
    }
    // see issues#10
    if (typeof key === "number" && !Number.isSafeInteger(key)) {
      throw new Error("Invalid syntax is included.");
    }
    const value = converter(cur.value);
    return { ...acc, [key]: value };
  }, {});
}
