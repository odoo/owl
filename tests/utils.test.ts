import { escape, debounce } from "../src/utils";
import { browser } from "../src/browser";

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
    // need to reset them on browser because they were mocked in window, but not
    // on browser object
    browser.setTimeout = window.setTimeout.bind(window);
    browser.clearTimeout = window.clearTimeout.bind(window);
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
