/**
 * Utility to find expression positions in raw template XML strings.
 * Used by the code generator when expression tracking is enabled.
 */
export class ExprLocFinder {
  private xml: string;
  private lineStarts: number[];
  private cursor: number = 0;

  constructor(xml: string) {
    this.xml = xml;
    this.lineStarts = [0];
    for (let i = 0; i < xml.length; i++) {
      if (xml[i] === "\n") {
        this.lineStarts.push(i + 1);
      }
    }
  }

  /**
   * Find the next occurrence of `expr` in the XML, advancing the cursor.
   * Returns 1-based line, 0-based col, and endCol (exclusive).
   */
  find(expr: string): { line: number; col: number; endCol: number } | null {
    if (!expr) return null;

    // Try exact attribute value match first: ="expr" or ='expr'
    let pos = this.findAttrValue(expr, this.cursor);

    // Fallback: bare substring search from cursor
    if (pos === -1) {
      pos = this.xml.indexOf(expr, this.cursor);
    }

    // If still not found, wrap around and try from beginning
    if (pos === -1 && this.cursor > 0) {
      pos = this.findAttrValue(expr, 0);
      if (pos === -1) {
        pos = this.xml.indexOf(expr, 0);
      }
    }

    if (pos === -1) return null;

    this.cursor = pos + expr.length;
    return this.posToLoc(pos, expr.length);
  }

  private findAttrValue(expr: string, from: number): number {
    for (const q of ['"', "'"]) {
      const pattern = `${q}${expr}${q}`;
      const idx = this.xml.indexOf(pattern, from);
      if (idx !== -1) {
        return idx + 1; // skip the opening quote
      }
    }
    return -1;
  }

  private posToLoc(
    pos: number,
    len: number
  ): { line: number; col: number; endCol: number } {
    // Binary search for line number
    let lo = 0,
      hi = this.lineStarts.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.lineStarts[mid] <= pos) {
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    const line = lo; // 1-based
    const col = pos - this.lineStarts[line - 1]; // 0-based
    return { line, col, endCol: col + len };
  }
}
