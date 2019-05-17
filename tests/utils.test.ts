import { escape, debounce } from "../src/utils";

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

describe("debounce", () => {
  test("works as expected", () => {
    jest.useFakeTimers();
    let n = 0;
    let f = debounce(() => n++, 100);
    expect(n).toBe(0);
    f();
    expect(n).toBe(0);
    f();
    expect(n).toBe(0);
    jest.advanceTimersByTime(90);
    expect(n).toBe(0);
    jest.advanceTimersByTime(20);
    expect(n).toBe(1);
  });
});
