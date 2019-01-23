export function escape(str: string | number | undefined): string {
  if (str === undefined) {
    return "";
  }
  if (typeof str === "number") {
    return String(str);
  }
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&#x27;")
    .replace(/`/g, "&#x60;");
}

/**
 * Remove trailing and leading spaces
 */
export function htmlTrim(s: string): string {
  let result = s.replace(/(^\s+|\s+$)/g, "");
  if (s[0] === " ") {
    result = " " + result;
  }
  if (result !== " " && s[s.length - 1] === " ") {
    result = result + " ";
  }
  return result;
}
