import {
  escape,
  debounce,
  patch,
  unpatch
} from "../src/utils";

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

describe("patch/unpatch", () => {
  test("can monkey patch a class", () => {
    class Test {
      n = 1;

      doSomething(): string {
        return "hey";
      }
    }

    patch(Test, "some_custo", {
      doSomething(): string {
        this.n = this.n + 1;
        return this._super();
      }
    });

    const t = new Test();
    expect(t.n).toBe(1);
    expect(t.doSomething()).toBe("hey");
    expect(t.n).toBe(2);
  });

  test("cannot patch a class twice with same patch name", () => {
    class Test {}

    patch(Test, "some_custo", {});
    expect(() => {
      patch(Test, "some_custo", {});
    }).toThrow();
  });

  test("can unpatch a class", () => {
    class Test {
      doSomething(): number {
        return 1;
      }
    }

    patch(Test, "some_custo", {
      doSomething(): number {
        return this._super() + 2;
      }
    });

    const t = new Test();
    expect(t.doSomething()).toBe(3);

    unpatch(Test, "some_custo");
    expect(t.doSomething()).toBe(1);
  });
});
