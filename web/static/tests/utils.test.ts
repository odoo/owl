import { escape, htmlTrim } from "../src/ts/core/utils";

describe("escape", () => {
  test("normal strings", () => {
    const text = "abc";
    expect(escape(text)).toBe(text);
  });

  test("special symbols", () => {
    const text = "<ok>";
    expect(escape(text)).toBe("&lt;ok&gt;");
  });
});

describe("htmlTrim", () => {
  test("basic use", () => {
    expect(htmlTrim("abc")).toBe("abc");
    expect(htmlTrim("  abc")).toBe(" abc");
    expect(htmlTrim("abc  ")).toBe("abc ");
    expect(htmlTrim("   abc   ")).toBe(" abc ");
    expect(htmlTrim("abc\n   ")).toBe("abc ");
    expect(htmlTrim("\n ")).toBe(" ");
    expect(htmlTrim(" \n ")).toBe(" ");
    expect(htmlTrim("  ")).toBe(" ");
    expect(htmlTrim("")).toBe("");
  });
});
