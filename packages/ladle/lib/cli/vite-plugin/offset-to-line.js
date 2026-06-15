// oxc nodes carry UTF-16 start/end offsets but no line/column info (skipping it
// is what keeps the parser fast), so we reconstruct line numbers ourselves to
// replace Babel's node.loc.start.line / end.line.

/**
 * Builds a lookup table of the source offset at the start of each line.
 * @param {string} source
 * @returns {Int32Array}
 */
export const buildLineOffsets = (source) => {
  const offsets = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") offsets.push(i + 1);
  }
  return Int32Array.from(offsets);
};

/**
 * Resolves a UTF-16 offset to a 1-based line number via binary search.
 * @param {Int32Array} lineOffsets
 * @param {number} offset
 * @returns {number}
 */
export const getLine = (lineOffsets, offset) => {
  let low = 0;
  let high = lineOffsets.length - 1;
  let line = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lineOffsets[mid] <= offset) {
      line = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return line + 1;
};
